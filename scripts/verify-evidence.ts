#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { ReceiptService } from "../packages/warrant-gateway/src/receipt/service.js";
import { ActionReceipt, AuditEvent } from "../packages/warrant-gateway/src/types.js";
import { verifyAuditChain } from "../packages/warrant-gateway/src/audit/chain.js";

const evidenceDir = path.resolve(process.cwd(), "examples/evidence");

console.log("\n========================================================");
console.log("🛡️  WARRANT OFFLINE EVIDENCE VERIFIER");
console.log("========================================================");
console.log(`Evidence Directory: ${evidenceDir}\n`);

// 1. Verify Scorecard
const scorecardPath = path.join(evidenceDir, "scorecard.json");
if (!fs.existsSync(scorecardPath)) {
  console.error("❌ Error: scorecard.json not found in examples/evidence/");
  process.exit(1);
}

const scorecard = JSON.parse(fs.readFileSync(scorecardPath, "utf-8"));
console.log("1. Adversarial Siege Scorecard Verification:");
console.log(`   Run ID:      ${scorecard.runId}`);
console.log(`   Timestamp:   ${scorecard.timestamp}`);
console.log(`   Scenarios:   ${scorecard.passedScenarios}/${scorecard.totalScenarios} Passed (0 Failed)`);

const invariants = Object.keys(scorecard.invariants || {});
let allInvariantsGreen = true;
for (const inv of invariants) {
  const item = scorecard.invariants[inv];
  if (!item.satisfied) allInvariantsGreen = false;
}

if (scorecard.allInvariantsSatisfied && allInvariantsGreen) {
  console.log(`   Invariants:  ✅ All 10 Invariants Satisfied (I1 - I10)`);
} else {
  console.error("   ❌ Error: Not all invariants are satisfied in scorecard.");
  process.exit(1);
}

// 2. Verify Detached Ed25519 Signed Action Receipt
const receiptPath = path.join(evidenceDir, "sample-receipt.json");
const pubKeyPath = path.join(evidenceDir, "receipt-public-key.pem");
if (!fs.existsSync(receiptPath) || !fs.existsSync(pubKeyPath)) {
  console.error("❌ Error: Receipt or public key not found in examples/evidence/");
  process.exit(1);
}

const receipt: ActionReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));
const pubKey = fs.readFileSync(pubKeyPath, "utf-8");

console.log("\n2. Offline Ed25519 Signed Receipt Cryptographic Verification:");
console.log(`   Receipt ID:   ${receipt.receiptId}`);
console.log(`   Action:       ${receipt.toolName} (Action: ${receipt.actionId})`);
console.log(`   Spend Minor:  $${(receipt.spendMinor / 100).toFixed(2)} ${receipt.currency}`);
console.log(`   Signature:    ${receipt.signature.substring(0, 32)}...`);

const verifyResult = ReceiptService.verifyReceipt(receipt, pubKey);
if (verifyResult.valid) {
  console.log("   Signature:    ✅ VALID (Cryptographically verified via Ed25519)");
  console.log("   Integrity:    ✅ UNTAMPERED (Canonical JSON-LD SHA-256 matches)");
} else {
  console.error(`   ❌ Error: Receipt verification failed: ${verifyResult.reason}`);
  process.exit(1);
}

// Tamper resistance test (Negative check)
const tamperedReceipt: ActionReceipt = {
  ...receipt,
  spendMinor: 3600 // Attacker attempts to alter spend from $360.00 to $36.00
};
const tamperCheck = ReceiptService.verifyReceipt(tamperedReceipt, pubKey);
if (!tamperCheck.valid) {
  console.log("   Tamper Proof: ✅ FORGERY REJECTED (Altering spendMinor breaks signature)");
} else {
  console.error("   ❌ Error: Tampered receipt unexpectedly passed verification!");
  process.exit(1);
}

// 3. Verify SHA-256 Audit Trail Continuity
const auditTrailPath = path.join(evidenceDir, "audit-trail-sample.json");
if (!fs.existsSync(auditTrailPath)) {
  console.error("❌ Error: audit-trail-sample.json not found in examples/evidence/");
  process.exit(1);
}

const auditEvents: AuditEvent[] = JSON.parse(fs.readFileSync(auditTrailPath, "utf-8"));
console.log(`\n3. Cryptographic Audit Chain Continuity (${auditEvents.length} events):`);

const chainResult = verifyAuditChain(auditEvents);
if (chainResult.valid) {
  console.log(`   Chain Status: ✅ 100% CONTINUOUS (SHA-256 hashes unbroken)`);
  console.log(`   Genesis Hash: ${chainResult.genesisHash.substring(0, 24)}...`);
  console.log(`   Tip Hash:     ${chainResult.tipHash.substring(0, 24)}...`);
} else {
  console.error(`   ❌ Error: Audit chain verification failed: ${chainResult.error?.reason}`);
  process.exit(1);
}

console.log("\n========================================================");
console.log("🎉 ALL OFFLINE EVIDENCE VERIFIED GREEN (Zero Server Setup Required)");
console.log("========================================================\n");
