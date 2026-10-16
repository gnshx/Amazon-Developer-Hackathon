#!/usr/bin/env tsx
import { WarrantRepository } from "../src/storage/db.js";
import { verifyAuditChain } from "../src/audit/chain.js";
import * as path from "node:path";
import * as fs from "node:fs";

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), "warrant.sqlite");

console.log("\n========================================================");
console.log("🔒 WARRANT AUDIT LEDGER: Cryptographic Chain Verifier");
console.log("========================================================");
console.log(`Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.log("Database file does not exist yet; initializing fresh database to verify genesis...");
}

const repo = new WarrantRepository(dbPath);
const events = repo.getAuditEvents();
const verification = verifyAuditChain(events);

console.log(`Total Events: ${events.length}`);
console.log(`Tip Hash:     ${verification.tipHash}`);
console.log(`Continuous:   ${verification.valid ? "YES ✅" : "NO ❌"}`);

if (!verification.valid && verification.error) {
  console.error(`\n❌ INTEGRITY BREACH: Tampering detected at seq ${verification.error.seq}: ${verification.error.reason}`);
  process.exit(1);
} else {
  console.log("\n🎉 Cryptographic audit chain verified continuous from genesis.");
  process.exit(0);
}
