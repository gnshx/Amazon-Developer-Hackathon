import http from "node:http";
import { createGatewayApp } from "../packages/warrant-gateway/src/mcp/server.js";
import { WarrantRepository } from "../packages/warrant-gateway/src/storage/db.js";

async function runLatencyBenchmark() {
  console.log("\n========================================================");
  console.log("⚡ WARRANT LATENCY BENCHMARK: Alexa+ 500ms SLA Gate");
  console.log("========================================================");

  const repo = new WarrantRepository(":memory:");
  const sessionToken = "perf_test_token_123";
  const grant = repo.createGrant({
    id: "grant_perf",
    sessionToken,
    userId: "amzn1.account.PERF_USER_01",
    scopes: ["*"],
    spendCapMinor: 500000,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: "ACTIVE"
  });

  const { app } = createGatewayApp({ repo });
  let server: http.Server;
  let baseUrl = "";

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    const latencies: number[] = [];
    const iterations = 50;

    console.log(`Executing ${iterations} consecutive operations over Streamable HTTP...`);

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Alternate through typical Alexa+ agent turns:
      if (i % 3 === 0) {
        // Turn 1: Search
        await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `req_${i}`,
            method: "tools/call",
            params: {
              name: "search_hotels",
              arguments: { destination: "Seattle", nights: 2 }
            }
          })
        });
      } else if (i % 3 === 1) {
        // Turn 2: Propose Plan
        await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `req_${i}`,
            method: "tools/call",
            params: {
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
            }
          })
        });
      } else {
        // Turn 3: Protected Resource Metadata
        await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
      }

      const elapsed = performance.now() - start;
      latencies.push(elapsed);
    }

    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const max = latencies[latencies.length - 1];

    console.log("\nResults Summary (Streamable HTTP):");
    console.log(`  Requests:     ${iterations}`);
    console.log(`  Average:      ${avg.toFixed(2)} ms`);
    console.log(`  Median (p50): ${p50.toFixed(2)} ms`);
    console.log(`  p95:          ${p95.toFixed(2)} ms`);
    console.log(`  p99:          ${p99.toFixed(2)} ms`);
    console.log(`  Max:          ${max.toFixed(2)} ms`);
    console.log(`  Alexa+ SLA:   < 500.00 ms`);

    const passed = p99 < 500;
    if (passed) {
      console.log("\n✅ [PASS] Alexa+ <500ms Latency Requirement Satisfied.");
      console.log(`   Warrant operates ${(500 / p99).toFixed(1)}x faster than the platform SLA ceiling.`);
    } else {
      console.error("\n❌ [FAIL] Latency exceeded 500ms ceiling.");
      process.exit(1);
    }
  } finally {
    server!.close();
    repo.close();
  }
}

runLatencyBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
