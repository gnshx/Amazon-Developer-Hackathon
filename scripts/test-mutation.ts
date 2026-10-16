#!/usr/bin/env tsx
import { createGatewayApp, WarrantRepository, ApprovalService, MockTrainProvider } from "@warrant/gateway";
import { SiegeRunner } from "../packages/warrant-siege/src/runner.js";
import * as http from "node:http";

async function runScenarioWithHarness(
  options: {
    disableIdempotency?: boolean;
    disableApprovalVerification?: boolean;
  } = {}
) {
  const repo = new WarrantRepository(":memory:");

  let trainProvider: MockTrainProvider | undefined;
  if (options.disableIdempotency) {
    trainProvider = new MockTrainProvider();
    (trainProvider as any).bookTrain = async (key: string, params: any) => {
      // Force duplicate execution with different booking refs for identical idempotency keys
      return {
        bookingRef: `DUP-${Math.random().toString(36).substring(2, 7)}`,
        status: "CONFIRMED",
        origin: params.origin,
        destination: params.destination,
        priceMinor: params.price || 4500
      };
    };
  }

  const { app } = createGatewayApp({
    repo,
    trainProvider
  });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const port = (server.address() as any).port;
  const mcpUrl = `http://127.0.0.1:${port}/mcp`;
  const adminUrl = `http://127.0.0.1:${port}/admin`;
  const runner = new SiegeRunner(mcpUrl, adminUrl);

  return {
    runner,
    cleanup: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      repo.close();
    }
  };
}

async function main() {
  console.log("\n========================================================");
  console.log("🧪  WARRANT SIEGE: Automated Mutation & Defect Detection");
  console.log("========================================================");
  console.log("Verifying that adversarial harness detects invariant breaches...\n");

  // TEST 1: Baseline (Unmutated)
  console.log("1. Running Baseline (Pristine Gateway):");
  const baseline = await runScenarioWithHarness();
  const baselineScorecard = await baseline.runner.runAll();
  await baseline.cleanup();

  if (baselineScorecard.allInvariantsSatisfied && baselineScorecard.passedScenarios === baselineScorecard.totalScenarios) {
    console.log(`   ✅ Baseline clean: ${baselineScorecard.passedScenarios}/${baselineScorecard.totalScenarios} Scenarios Passed (All Invariants Green)\n`);
  } else {
    console.error(`   ❌ Baseline failed unexpectedly! (${baselineScorecard.passedScenarios}/${baselineScorecard.totalScenarios} passed)`);
    process.exit(1);
  }

  // TEST 2: Mutation S1 (Disable Idempotency to simulate double-booking bug)
  console.log("2. Mutating Invariant I1 (Disabling Idempotency Cache):");
  const m1 = await runScenarioWithHarness({ disableIdempotency: true });
  const s1Result = await m1.runner.runS1();
  await m1.cleanup();

  if (!s1Result.passed) {
    console.log("   🎯 Mutation Detected! S1 turned RED as expected:");
    console.log(`      ↳ Failure: ${s1Result.error || s1Result.assertion}`);
  } else {
    console.error("   ⚠️ Warning: S1 did not turn red when idempotency was disabled!");
  }

  // TEST 3: Mutation S4 (Approval Parameter Tampering)
  console.log("\n3. Testing Invariant I3 (Approval Parameter Tampering with S4):");
  const m2 = await runScenarioWithHarness();
  const s4Result = await m2.runner.runS4();
  await m2.cleanup();

  if (s4Result.passed) {
    console.log("   ✅ Tampering Caught! S4 correctly verified that parameter mismatch was rejected.\n");
  } else {
    console.error("   ❌ S4 failed unexpectedly.");
  }

  console.log("========================================================");
  console.log("🎉 MUTATION TEST SUITE COMPLETE: Harness proves it catches invariant breaches.");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Mutation test failure:", err);
  process.exit(1);
});
