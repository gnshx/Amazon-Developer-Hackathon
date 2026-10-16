import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarrantRepository } from "../storage/db.js";
import { ReceiptService } from "./service.js";
import { canonicalSha256 } from "../crypto/canonical.js";

describe("ReceiptService: Cryptographic Ed25519 Action Receipts", () => {
  let repo: WarrantRepository;
  let receiptService: ReceiptService;

  beforeEach(() => {
    repo = new WarrantRepository(":memory:");
    receiptService = new ReceiptService(repo);

    // Seed dummy grant and plan for foreign key constraints
    repo.createGrant({
      id: "grant_rec_test",
      sessionToken: "tok_rec_test",
      scopes: ["*"],
      spendCapMinor: 50000,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });

    const now = new Date().toISOString();
    const params = { hotel_id: "harbor_inn", nights: 2, price: 12000 };
    const paramsCanonical = JSON.stringify(params);
    const paramsHash = canonicalSha256(params);

    repo.createPlan({
      id: "plan_rec_test",
      grantId: "grant_rec_test",
      state: "EXECUTING",
      totalEstimatedMinor: 12000,
      totalConfirmedMinor: 0,
      createdAt: now,
      updatedAt: now,
      actions: [
        {
          id: "act_hotel_rec",
          planId: "plan_rec_test",
          seq: 1,
          toolName: "book_hotel",
          params,
          paramsCanonical,
          paramsHash,
          riskTier: "T2",
          state: "SUCCEEDED",
          idempotencyKey: "idem_rec_01",
          estimatedCostMinor: 12000
        }
      ]
    });
  });

  afterEach(() => {
    repo.close();
  });

  it("mints an Ed25519 signed receipt and stores it in the repository", () => {
    const params = { hotel_id: "harbor_inn", nights: 2, price: 12000 };
    const paramsHash = canonicalSha256(params);

    const receipt = receiptService.createReceipt({
      actionId: "act_hotel_rec",
      planId: "plan_rec_test",
      grantId: "grant_rec_test",
      toolName: "book_hotel",
      paramsHash,
      spendMinor: 12000,
      providerBookingRef: "RES-HARBOR-8821"
    });

    expect(receipt.receiptId).toMatch(/^rcpt_/);
    expect(receipt.signature).toBeDefined();
    expect(receipt.signature.length).toBeGreaterThan(64);
    expect(receipt.gatewayPublicKey).toContain("BEGIN PUBLIC KEY");

    // Verify stored in repo
    const stored = receiptService.getReceipt(receipt.receiptId);
    expect(stored).not.toBeNull();
    expect(stored?.signature).toBe(receipt.signature);
  });

  it("verifies an authentic receipt offline using static verifyReceipt", () => {
    const params = { hotel_id: "harbor_inn", nights: 2, price: 12000 };
    const paramsHash = canonicalSha256(params);

    const receipt = receiptService.createReceipt({
      actionId: "act_hotel_rec",
      planId: "plan_rec_test",
      grantId: "grant_rec_test",
      toolName: "book_hotel",
      paramsHash,
      spendMinor: 12000,
      providerBookingRef: "RES-HARBOR-8821"
    });

    const verifyResult = ReceiptService.verifyReceipt(receipt);
    expect(verifyResult.valid).toBe(true);
  });

  it("rejects receipt when financial spendMinor is tampered with", () => {
    const params = { hotel_id: "harbor_inn", nights: 2, price: 12000 };
    const paramsHash = canonicalSha256(params);

    const receipt = receiptService.createReceipt({
      actionId: "act_hotel_rec",
      planId: "plan_rec_test",
      grantId: "grant_rec_test",
      toolName: "book_hotel",
      paramsHash,
      spendMinor: 12000,
      providerBookingRef: "RES-HARBOR-8821"
    });

    // Tamper with spend: claim only $10.00 was charged instead of $120.00
    const tamperedReceipt = {
      ...receipt,
      spendMinor: 1000
    };

    const verifyResult = ReceiptService.verifyReceipt(tamperedReceipt);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.reason).toContain("signature mismatch");
  });

  it("rejects receipt when providerBookingRef or paramsHash is tampered with", () => {
    const params = { hotel_id: "harbor_inn", nights: 2, price: 12000 };
    const paramsHash = canonicalSha256(params);

    const receipt = receiptService.createReceipt({
      actionId: "act_hotel_rec",
      planId: "plan_rec_test",
      grantId: "grant_rec_test",
      toolName: "book_hotel",
      paramsHash,
      spendMinor: 12000,
      providerBookingRef: "RES-HARBOR-8821"
    });

    // Tamper with booking ref
    const forgedRefReceipt = {
      ...receipt,
      providerBookingRef: "FORGED-REF-9999"
    };
    expect(ReceiptService.verifyReceipt(forgedRefReceipt).valid).toBe(false);

    // Tamper with params hash
    const forgedHashReceipt = {
      ...receipt,
      paramsHash: "0000000000000000000000000000000000000000000000000000000000000000"
    };
    expect(ReceiptService.verifyReceipt(forgedHashReceipt).valid).toBe(false);
  });
});
