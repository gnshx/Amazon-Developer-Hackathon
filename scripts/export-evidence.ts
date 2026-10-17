import * as fs from "node:fs";
import * as path from "node:path";
import { WarrantRepository } from "../packages/warrant-gateway/src/storage/db.js";
import { ReceiptService } from "../packages/warrant-gateway/src/receipt/service.js";

const evidenceDir = path.resolve(process.cwd(), "examples/evidence");
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// 1. Copy Scorecard
const scorecardSrc = path.resolve(process.cwd(), "packages/warrant-siege/scorecard.json");
if (fs.existsSync(scorecardSrc)) {
  fs.copyFileSync(scorecardSrc, path.join(evidenceDir, "scorecard.json"));
  console.log("✅ Copied scorecard.json to examples/evidence/");
}

// 2. Generate Deterministic Sample Receipt & Public Key
const repo = new WarrantRepository(":memory:");
const receiptService = new ReceiptService(repo);

repo.createGrant({
  id: "grant_prod_chicago_trip",
  sessionToken: "sess_warrant_live_proof",
  scopes: ["search_hotels", "search_trains", "book_hotel", "book_train"],
  spendCapMinor: 50000,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  status: "ACTIVE"
});

repo.createPlan({
  id: "plan_chicago_weekend_01",
  grantId: "grant_prod_chicago_trip",
  state: "COMPLETED",
  totalEstimatedMinor: 36000,
  totalConfirmedMinor: 36000,
  createdAt: "2026-10-17T10:00:00.000Z",
  updatedAt: "2026-10-17T10:02:15.000Z",
  actions: [
    {
      id: "act_hotel_harbor_inn",
      planId: "plan_chicago_weekend_01",
      seq: 1,
      toolName: "book_hotel",
      params: { hotel_id: "harbor_inn", nights: 2, priceMinor: 36000 },
      paramsCanonical: '{"hotel_id":"harbor_inn","nights":2,"priceMinor":36000}',
      paramsHash: "9f2c81a41e98d41c8810e4a7b54a88bc3e4301fa3829ad41029e0b82f819a41e",
      riskTier: "T2",
      state: "SUCCEEDED",
      idempotencyKey: "idem_chicago_hotel_01",
      estimatedCostMinor: 36000,
      confirmedCostMinor: 36000
    }
  ]
});

const sampleReceipt = receiptService.createReceipt({
  actionId: "act_hotel_harbor_inn",
  planId: "plan_chicago_weekend_01",
  grantId: "grant_prod_chicago_trip",
  toolName: "book_hotel",
  paramsHash: "9f2c81a41e98d41c8810e4a7b54a88bc3e4301fa3829ad41029e0b82f819a41e",
  spendMinor: 36000,
  providerBookingRef: "RES-HARBOR-INN-9912",
  currency: "USD"
});

fs.writeFileSync(
  path.join(evidenceDir, "sample-receipt.json"),
  JSON.stringify(sampleReceipt, null, 2)
);
console.log("✅ Wrote sample-receipt.json to examples/evidence/");

fs.writeFileSync(
  path.join(evidenceDir, "receipt-public-key.pem"),
  receiptService.getPublicKeyPem()
);
console.log("✅ Wrote receipt-public-key.pem to examples/evidence/");

// 3. Export Sample Chained Audit Events
let dbRepo: WarrantRepository;
if (fs.existsSync("warrant.sqlite")) {
  dbRepo = new WarrantRepository("warrant.sqlite");
} else {
  dbRepo = repo;
}

const auditEvents = dbRepo.getAuditEvents().slice(0, 8);
fs.writeFileSync(
  path.join(evidenceDir, "audit-trail-sample.json"),
  JSON.stringify(auditEvents, null, 2)
);
console.log(`✅ Wrote ${auditEvents.length} audit events to examples/evidence/audit-trail-sample.json`);

repo.close();
if (dbRepo !== repo) dbRepo.close();
console.log("🎉 Evidence bundle successfully generated in examples/evidence/!");
