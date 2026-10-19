import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createGatewayApp } from "./server.js";
import { WarrantRepository } from "../storage/db.js";

describe("T4: Alexa+ Latency SLA & Contract Benchmark (<500ms)", () => {
  let repo: WarrantRepository;
  let server: http.Server;
  let baseUrl: string;
  let sagaOrchestrator: any;
  const sessionToken = "latency_contract_token_123";

  beforeEach(async () => {
    repo = new WarrantRepository(":memory:");
    repo.createGrant({
      id: "grant_latency_sla",
      sessionToken,
      userId: "amzn1.account.LATENCY_SLA_USER",
      scopes: ["*"],
      spendCapMinor: 5000000, // $50,000.00
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });

    const gateway = createGatewayApp({ repo });
    sagaOrchestrator = gateway.sagaOrchestrator;
    const app = gateway.app;

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    sagaOrchestrator?.clearAllTimers();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    repo.close();
  });

  const mcpCall = async (method: string, params: any) => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `bench_${Math.random()}`,
        method,
        params
      })
    });
    return { status: res.status, json: await res.json() };
  };

  it("measures 50 sequential calls for search, propose_plan, and execute_plan (<500ms p95 SLA)", async () => {
    const N = 50;

    const computeStats = (times: number[]) => {
      const sorted = [...times].sort((a, b) => a - b);
      const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const max = sorted[sorted.length - 1];
      return { avg, p50, p95, p99, max };
    };

    // 1. Search Tool (50 sequential calls)
    const searchTimes: number[] = [];
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      const res = await mcpCall("tools/call", {
        name: "search_hotels",
        arguments: { destination: `City_${i}`, nights: 2 }
      });
      const t1 = performance.now();
      expect(res.status).toBe(200);
      searchTimes.push(t1 - t0);
    }
    const searchStats = computeStats(searchTimes);

    // 2. Propose Plan (50 sequential calls)
    const proposeTimes: number[] = [];
    const proposedPlanIds: string[] = [];
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      const res = await mcpCall("tools/call", {
        name: "propose_plan",
        arguments: {
          steps: [
            {
              toolName: "book_train",
              params: { origin: "City A", destination: "City B", price: 3500 },
              estimatedCostMinor: 3500
            }
          ]
        }
      });
      const t1 = performance.now();
      expect(res.status).toBe(200);
      proposeTimes.push(t1 - t0);
      const plan = JSON.parse(res.json.result.content[0].text);
      proposedPlanIds.push(plan.planId);
    }
    const proposeStats = computeStats(proposeTimes);

    // 3. Execute Plan with 8-second undo window (50 sequential calls)
    // Must return immediately (<500ms) with state: HELD, without blocking the 8s hold.
    const executeTimes: number[] = [];
    for (let i = 0; i < N; i++) {
      const planId = proposedPlanIds[i];
      const t0 = performance.now();
      const res = await mcpCall("tools/call", {
        name: "execute_plan",
        arguments: {
          planId,
          idempotencyKey: `idem_bench_run_${i}`,
          undoWindowSeconds: 8 // 8-second hold requested
        }
      });
      const t1 = performance.now();
      expect(res.status).toBe(200);
      const data = JSON.parse(res.json.result.content[0].text);
      expect(data.state).toBe("HELD");
      executeTimes.push(t1 - t0);
    }
    const executeStats = computeStats(executeTimes);

    // Assert p95 under 500ms SLA for all three call types
    expect(searchStats.p95).toBeLessThan(500);
    expect(proposeStats.p95).toBeLessThan(500);
    expect(executeStats.p95).toBeLessThan(500);

    // Explicitly verify execute_plan returns in under 500ms even with an 8-second undo window
    expect(executeStats.max).toBeLessThan(500);

    // Prepare machine info
    const cpus = os.cpus();
    const machine = {
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || "Generic CPU",
      cpuCores: cpus.length,
      totalMemoryGb: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)
    };

    const benchmarkReport = {
      benchmark: "Alexa+ Sub-500ms Latency SLA & Contract Verification",
      timestamp: new Date().toISOString(),
      platformSlaCeilingMs: 500,
      machine,
      iterationsPerTool: N,
      results: {
        search_hotels: {
          calls: N,
          avgMs: Number(searchStats.avg.toFixed(2)),
          p50Ms: Number(searchStats.p50.toFixed(2)),
          p95Ms: Number(searchStats.p95.toFixed(2)),
          p99Ms: Number(searchStats.p99.toFixed(2)),
          maxMs: Number(searchStats.max.toFixed(2)),
          status: searchStats.p95 < 500 ? "PASS" : "FAIL"
        },
        propose_plan: {
          calls: N,
          avgMs: Number(proposeStats.avg.toFixed(2)),
          p50Ms: Number(proposeStats.p50.toFixed(2)),
          p95Ms: Number(proposeStats.p95.toFixed(2)),
          p99Ms: Number(proposeStats.p99.toFixed(2)),
          maxMs: Number(proposeStats.max.toFixed(2)),
          status: proposeStats.p95 < 500 ? "PASS" : "FAIL"
        },
        execute_plan_undo_hold: {
          calls: N,
          undoWindowSeconds: 8,
          avgMs: Number(executeStats.avg.toFixed(2)),
          p50Ms: Number(executeStats.p50.toFixed(2)),
          p95Ms: Number(executeStats.p95.toFixed(2)),
          p99Ms: Number(executeStats.p99.toFixed(2)),
          maxMs: Number(executeStats.max.toFixed(2)),
          status: executeStats.p95 < 500 ? "PASS" : "FAIL"
        }
      },
      overallStatus: "PASS"
    };

    // Save report to workspace root examples/evidence/latency.json only when explicitly requested
    if (process.env.UPDATE_LATENCY_EVIDENCE === "true") {
      const rootDir = process.cwd().includes("packages")
        ? path.resolve(process.cwd(), "../..")
        : process.cwd();
      const evidenceDir = path.resolve(rootDir, "examples/evidence");
      if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(evidenceDir, "latency.json"),
        JSON.stringify(benchmarkReport, null, 2)
      );
    }
  });
});
