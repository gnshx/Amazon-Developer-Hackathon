#!/usr/bin/env tsx
import { createGatewayApp, WarrantRepository, ApprovalService, MockTrainProvider } from "@warrant/gateway";
import { SiegeRunner } from "../packages/warrant-siege/src/runner.js";
import * as http from "node:http";

async function runScenarioWithHarness(
  options: {
    disableIdempotency?: boolean;
    disableApprovalVerification?: boolean;
    disableUserIsolation?: boolean;
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

  let approvalService: ApprovalService | undefined;
  if (options.disableApprovalVerification) {
    approvalService = new ApprovalService(repo);
    // Mutate verifyApprovalToken to bypass all hash and token verification checks
    (approvalService as any).verifyApprovalToken = (_token: string, _params: any) => {
      return { valid: true };
    };
  }

  const { app } = createGatewayApp({
    repo,
    trainProvider,
    approvalService,
    disableUserIsolation: options.disableUserIsolation
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

  let mutationsDetected = 0;

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
    mutationsDetected++;
    console.log("   🎯 Mutation Detected! S1 turned RED as expected:");
    console.log(`      ↳ Failure: ${s1Result.error || s1Result.assertion}`);
  } else {
    console.error("   ❌ Error: S1 did not turn red when idempotency was disabled!");
  }

  // TEST 3: Mutation S4 (Disable Approval Token/Hash Verification)
  console.log("\n3. Mutating Invariant I3 (Disabling Approval Token/Hash Verification):");
  const m2 = await runScenarioWithHarness({ disableApprovalVerification: true });
  const s4Result = await m2.runner.runS4();
  await m2.cleanup();

  if (!s4Result.passed) {
    mutationsDetected++;
    console.log("   🎯 Mutation Detected! S4 turned RED as expected:");
    console.log(`      ↳ Failure caught: Tampered parameters executed without rejection (bypass allowed execution).`);
  } else {
    console.error("   ❌ Error: S4 did not turn red when approval check was disabled!");
  }

  // TEST 4: Mutation S11 (Disable User Isolation / Cross-User Access Boundary)
  console.log("\n4. Mutating Invariant I6 (Disabling User Isolation / Cross-User Plan Check):");
  const m3 = await runScenarioWithHarness({ disableUserIsolation: true });
  const s11Result = await m3.runner.runS11();
  await m3.cleanup();

  if (!s11Result.passed) {
    mutationsDetected++;
    console.log("   🎯 Mutation Detected! S11 turned RED as expected:");
    console.log(`      ↳ Failure caught: Cross-user violation allowed User B to access/execute User A's plan.`);
  } else {
    console.error("   ❌ Error: S11 did not turn red when user isolation was disabled!");
  }

  console.log("\n========================================================");
  if (mutationsDetected === 3) {
    console.log("🎉 ALL MUTATIONS DETECTED (3/3 RED): Invariants I1, I3, & I6 detected by the scorecard.");
    console.log("========================================================\n");
    process.exit(0);
  } else {
    console.error(`⚠️ FAILED: Only ${mutationsDetected}/3 mutations were detected.`);
    console.log("========================================================\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during mutation test:", err);
  process.exit(1);
});
