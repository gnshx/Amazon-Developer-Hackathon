#!/usr/bin/env tsx
import { ReceiptService } from "../src/receipt/service.js";
import { WarrantRepository } from "../src/storage/db.js";
import { ActionReceipt } from "../src/types.js";
import * as fs from "node:fs";
import * as path from "node:path";

function printUsage(): void {
  console.log(`
Usage:
  tsx verify-receipt.ts [options]

Options:
  --file <path>        Path to JSON file containing an ActionReceipt
  --json <string>      Raw JSON string of an ActionReceipt
  --db <path>          Path to SQLite database to verify latest receipt (default: warrant.sqlite)
  --help               Display this help message
`);
}

function main(): void {
  const args = process.argv.slice(2);
  let receiptJson: string | null = null;
  let dbPath = "warrant.sqlite";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help") {
      printUsage();
      process.exit(0);
    } else if (args[i] === "--file" && args[i + 1]) {
      const filePath = path.resolve(process.cwd(), args[++i]);
      receiptJson = fs.readFileSync(filePath, "utf-8");
    } else if (args[i] === "--json" && args[i + 1]) {
      receiptJson = args[++i];
    } else if (args[i] === "--db" && args[i + 1]) {
      dbPath = args[++i];
    }
  }

  let receipt: ActionReceipt;

  if (receiptJson) {
    try {
      receipt = JSON.parse(receiptJson);
    } catch {
      console.error("❌ Error: Invalid JSON input provided.");
      process.exit(1);
    }
  } else {
    let foundReceipt: ActionReceipt | null = null;
    if (fs.existsSync(dbPath)) {
      const repo = new WarrantRepository(dbPath);
      const receipts = repo.listReceipts(1);
      if (receipts.length > 0) {
        foundReceipt = receipts[0];
      }
      repo.close();
    }

    if (foundReceipt) {
      receipt = foundReceipt;
    } else {
      console.log(`ℹ️  No action receipts found in ${dbPath}.`);
      console.log("   Creating a verified Ed25519 action receipt to demonstrate offline verification...\n");
      const repo = new WarrantRepository(":memory:");
      const service = new ReceiptService(repo);
      repo.createGrant({
        id: "g_demo",
        sessionToken: "s_demo",
        scopes: ["*"],
        spendCapMinor: 25000,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        status: "ACTIVE"
      });
      repo.createPlan({
        id: "p_demo",
        grantId: "g_demo",
        state: "COMPLETED",
        totalEstimatedMinor: 12000,
        totalConfirmedMinor: 12000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        actions: [
          {
            id: "act_hotel_01",
            planId: "p_demo",
            seq: 1,
            toolName: "book_hotel",
            params: { hotel_id: "harbor_inn", nights: 2, price: 12000 },
            paramsCanonical: '{"hotel_id":"harbor_inn","nights":2,"price":12000}',
            paramsHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            riskTier: "T2",
            state: "SUCCEEDED",
            idempotencyKey: "idem_sample",
            estimatedCostMinor: 12000,
            confirmedCostMinor: 12000
          }
        ]
      });

      receipt = service.createReceipt({
        actionId: "act_hotel_01",
        planId: "p_demo",
        grantId: "g_demo",
        toolName: "book_hotel",
        paramsHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        spendMinor: 12000,
        providerBookingRef: "RES-HARBOR-INN-9912"
      });
      repo.close();
    }
  }

  console.log("\n========================================================");
  console.log("📜  WARRANT ACTION RECEIPT VERIFIER (Ed25519)");
  console.log("========================================================");
  console.log(`Receipt ID:    ${receipt.receiptId}`);
  console.log(`Action:        ${receipt.toolName} (Action ID: ${receipt.actionId})`);
  console.log(`Provider Ref:  ${receipt.providerBookingRef}`);
  console.log(`Spend:         $${(receipt.spendMinor / 100).toFixed(2)} ${receipt.currency}`);
  console.log(`Executed At:   ${receipt.executedAt}`);
  console.log(`Params Hash:   ${receipt.paramsHash}`);
  console.log(`Signature:     ${receipt.signature.slice(0, 32)}...`);
  console.log("--------------------------------------------------------");

  const verification = ReceiptService.verifyReceipt(receipt);

  if (verification.valid) {
    console.log("Status:        ✅ CRYPTOGRAPHICALLY VALID");
    console.log("Proof:         Detached Ed25519 signature verified from canonical payload.");
    console.log("Non-repudiation: Validated without trusting server state.");
    console.log("========================================================\n");
    process.exit(0);
  } else {
    console.error("Status:        ❌ VERIFICATION FAILED");
    console.error(`Reason:        ${verification.reason}`);
    console.log("========================================================\n");
    process.exit(1);
  }
}

main();
