import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createGatewayApp } from "../packages/warrant-gateway/src/mcp/server.js";
import { WarrantRepository } from "../packages/warrant-gateway/src/storage/db.js";

async function runLatencyBenchmark() {
  console.log("\n========================================================");
  console.log("⚡ WARRANT LATENCY BENCHMARK: Alexa+ 500ms SLA Gate");
  console.log("========================================================");

  const repo = new WarrantRepository(":memory:");
  const sessionToken = "perf_test_token_123";
  repo.createGrant({
    id: "grant_perf",
    sessionToken,
    userId: "amzn1.account.PERF_USER_01",
    scopes: ["*"],
    spendCapMinor: 5000000,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: "ACTIVE"
  });

  const { app, sagaOrchestrator } = createGatewayApp({ repo });
  let server: http.Server;
  let baseUrl = "";

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
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

  const computeStats = (times: number[]) => {
    const sorted = [...times].sort((a, b) => a - b);
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const max = sorted[sorted.length - 1];
    return { avg, p50, p95, p99, max };
  };

  try {
    const N = 50;
    console.log(`Executing ${N} sequential calls each for search, propose_plan, and execute_plan (undo hold)...`);

    // 1. Search Tool (50 calls)
    const searchTimes: number[] = [];
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      const res = await mcpCall("tools/call", {
        name: "search_hotels",
        arguments: { destination: "Seattle", nights: 2 }
      });
      const t1 = performance.now();
      if (res.status !== 200) throw new Error(`Search failed: ${JSON.stringify(res.json)}`);
      searchTimes.push(t1 - t0);
    }
    const searchStats = computeStats(searchTimes);

    // 2. Propose Plan (50 calls)
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
              params: { origin: "Portland", destination: "Seattle", price: 4500 },
              estimatedCostMinor: 4500
            }
          ]
        }
      });
      const t1 = performance.now();
      if (res.status !== 200) throw new Error(`Propose failed: ${JSON.stringify(res.json)}`);
      proposeTimes.push(t1 - t0);
      const plan = JSON.parse(res.json.result.content[0].text);
      proposedPlanIds.push(plan.planId);
    }
    const proposeStats = computeStats(proposeTimes);

    // 3. Execute Plan with 8-second undo window (50 calls)
    // Must return immediately (<500ms) with state: HELD
    const executeTimes: number[] = [];
    for (let i = 0; i < N; i++) {
      const planId = proposedPlanIds[i];
      const t0 = performance.now();
      const res = await mcpCall("tools/call", {
        name: "execute_plan",
        arguments: {
          planId,
          idempotencyKey: `idem_bench_run_${i}`,
          undoWindowSeconds: 8
        }
      });
      const t1 = performance.now();
      if (res.status !== 200) throw new Error(`Execute failed: ${JSON.stringify(res.json)}`);
      executeTimes.push(t1 - t0);
    }
    const executeStats = computeStats(executeTimes);

    // Machine info
    const cpus = os.cpus();
    const machine = {
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || "Generic CPU",
      cpuCores: cpus.length,
      totalMemoryGb: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)
    };

    console.log(`\nMachine: ${machine.cpuModel} (${machine.cpuCores} cores, ${machine.arch}, ${machine.platform}, ${machine.totalMemoryGb} GB RAM)`);
    console.log("----------------------------------------------------------------------------------");
    console.log("| Tool / Operation              | Calls | Avg (ms) | p50 (ms) | p95 (ms) | Max (ms) | Status |");
    console.log("|-------------------------------|-------|----------|----------|----------|----------|--------|");
    console.log(
      `| search_hotels (T0 Read-Only)  | ${N}    | ${searchStats.avg.toFixed(2).padStart(8)} | ${searchStats.p50.toFixed(2).padStart(8)} | ${searchStats.p95.toFixed(2).padStart(8)} | ${searchStats.max.toFixed(2).padStart(8)} | ${searchStats.p95 < 500 ? "✅ PASS" : "❌ FAIL"} |`
    );
    console.log(
      `| propose_plan (T1 Policy Check)| ${N}    | ${proposeStats.avg.toFixed(2).padStart(8)} | ${proposeStats.p50.toFixed(2).padStart(8)} | ${proposeStats.p95.toFixed(2).padStart(8)} | ${proposeStats.max.toFixed(2).padStart(8)} | ${proposeStats.p95 < 500 ? "✅ PASS" : "❌ FAIL"} |`
    );
    console.log(
      `| execute_plan (8s Undo Window) | ${N}    | ${executeStats.avg.toFixed(2).padStart(8)} | ${executeStats.p50.toFixed(2).padStart(8)} | ${executeStats.p95.toFixed(2).padStart(8)} | ${executeStats.max.toFixed(2).padStart(8)} | ${executeStats.p95 < 500 ? "✅ PASS" : "❌ FAIL"} |`
    );
    console.log("----------------------------------------------------------------------------------");

    const allPassed = searchStats.p95 < 500 && proposeStats.p95 < 500 && executeStats.p95 < 500 && executeStats.max < 500;

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
      overallStatus: allPassed ? "PASS" : "FAIL"
    };

    const evidenceDir = path.resolve(process.cwd(), "examples/evidence");
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    let commit = "unknown";
    try {
      commit = require("child_process").execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch {}

    const rawText = [
      `# Command: npm run test:latency`,
      `# Date (UTC): ${new Date().toISOString()}`,
      `# Git Commit: ${commit}`,
      `# Machine: ${machine.cpuModel} (${machine.cpuCores} cores, ${machine.arch}, ${machine.platform}, ${machine.totalMemoryGb} GB RAM)`,
      `# Note: Gateway processing time on localhost with mock providers (50 sequential calls per tool)`,
      `# Platform SLA Ceiling: 500ms p95`,
      `----------------------------------------------------------------------------------`,
      `| Tool / Operation              | Calls | Avg (ms) | p50 (ms) | p95 (ms) | Max (ms) | Status |`,
      `|-------------------------------|-------|----------|----------|----------|----------|--------|`,
      `| search_hotels (T0 Read-Only)  | ${N}    | ${searchStats.avg.toFixed(2).padStart(8)} | ${searchStats.p50.toFixed(2).padStart(8)} | ${searchStats.p95.toFixed(2).padStart(8)} | ${searchStats.max.toFixed(2).padStart(8)} | ${searchStats.p95 < 500 ? "✅ PASS" : "❌ FAIL"} |`,
      `| propose_plan (T1 Policy Check)| ${N}    | ${proposeStats.avg.toFixed(2).padStart(8)} | ${proposeStats.p50.toFixed(2).padStart(8)} | ${proposeStats.p95.toFixed(2).padStart(8)} | ${proposeStats.max.toFixed(2).padStart(8)} | ${proposeStats.p95 < 500 ? "✅ PASS" : "❌ FAIL"} |`,
      `| execute_plan (8s Undo Window) | ${N}    | ${executeStats.avg.toFixed(2).padStart(8)} | ${executeStats.p50.toFixed(2).padStart(8)} | ${executeStats.p95.toFixed(2).padStart(8)} | ${executeStats.max.toFixed(2).padStart(8)} | ${executeStats.p95 < 500 ? "✅ PASS" : "❌ FAIL"} |`,
      `----------------------------------------------------------------------------------`,
      `Overall Status: ${allPassed ? "PASS" : "FAIL"}`
    ].join("\n");

    fs.writeFileSync(
      path.join(evidenceDir, "latency.json"),
      JSON.stringify(benchmarkReport, null, 2)
    );
    console.log(`\n📄 Measured numbers written to: examples/evidence/latency.json`);

    fs.writeFileSync(path.join(evidenceDir, "latency-raw.txt"), rawText + "\n");
    console.log(`📄 Raw output written to: examples/evidence/latency-raw.txt`);

    if (allPassed) {
      console.log(`\n🎉 [PASS] Alexa+ <500ms Latency SLA Gate Satisfied across all operations.`);
      console.log(`   Fastest p95: ${Math.min(searchStats.p95, proposeStats.p95, executeStats.p95).toFixed(2)} ms`);
      console.log(`   execute_plan with 8s undo window returned in max ${executeStats.max.toFixed(2)} ms (non-blocking).`);
    } else {
      console.error("\n❌ [FAIL] One or more operations exceeded 500ms p95 ceiling.");
      process.exit(1);
    }
  } finally {
    sagaOrchestrator?.clearAllTimers();
    server!.close();
    repo.close();
  }
}

runLatencyBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
