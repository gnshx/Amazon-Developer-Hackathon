import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "./service.js";

describe("ApprovalService & Parameter Binding (Invariant I3)", () => {
  let repo: WarrantRepository;
  let service: ApprovalService;

  beforeEach(() => {
    repo = new WarrantRepository(":memory:");
    service = new ApprovalService(repo);

    repo.createGrant({
      id: "grant_1",
      sessionToken: "bearer_1",
      scopes: ["*"],
      spendCapMinor: 50000,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });

    repo.createPlan({
      id: "plan_1",
      grantId: "grant_1",
      state: "PROPOSED",
      totalEstimatedMinor: 15000,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_1",
          planId: "plan_1",
          seq: 1,
          toolName: "book_hotel",
          params: { hotel_id: "grand_plaza", nights: 2, price: 15000 },
          paramsCanonical: '{"hotel_id":"grand_plaza","nights":2,"price":15000}',
          paramsHash: "h1",
          riskTier: "T2",
          state: "PENDING_APPROVAL",
          idempotencyKey: "idem_1",
          estimatedCostMinor: 15000
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  afterEach(() => {
    repo.close();
  });

  it("creates a pending approval bound to canonical parameter hash", () => {
    const params = { hotel_id: "grand_plaza", nights: 2, price: 15000 };
    const approval = service.createPendingApproval("act_1", "plan_1", params);

    expect(approval.status).toBe("PENDING");
    expect(approval.approvalToken).toMatch(/^appr_/);

    const pending = service.getPendingApprovals();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(approval.id);
  });

  it("verifies successfully when approved parameters match exactly", () => {
    const originalParams = { hotel_id: "grand_plaza", nights: 2, price: 15000 };
    const approval = service.createPendingApproval("act_1", "plan_1", originalParams);

    // User approves on phone
    service.decide(approval.id, "APPROVED");

    // Incoming execution call with identical parameters in different key order
    const incomingParams = { price: 15000, nights: 2, hotel_id: "grand_plaza" };
    const verifyResult = service.verifyApprovalToken(approval.approvalToken, incomingParams);

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.approval?.status).toBe("APPROVED");
  });

  it("rejects execution if parameters are tampered with after approval (Invariant I3)", () => {
    const originalParams = { hotel_id: "grand_plaza", nights: 2, price: 15000 };
    const approval = service.createPendingApproval("act_1", "plan_1", originalParams);

    // User approves $150.00
    service.decide(approval.id, "APPROVED");

    // Agent attempts execution with modified price or hotel
    const tamperedParams = { hotel_id: "grand_plaza", nights: 2, price: 99900 };
    const verifyResult = service.verifyApprovalToken(approval.approvalToken, tamperedParams);

    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.reason).toContain("APPROVAL_PARAMETER_MISMATCH");

    // Verify tamper event was audited
    const events = repo.getAuditEvents();
    const tamperEvent = events.find((e) => e.eventType === "APPROVAL_TAMPER_DETECTED");
    expect(tamperEvent).toBeDefined();
  });

  it("rejects execution if approval was rejected or not decided", () => {
    const params = { hotel_id: "grand_plaza", nights: 2, price: 15000 };
    const approval = service.createPendingApproval("act_1", "plan_1", params);

    // Not approved yet (still PENDING)
    const check1 = service.verifyApprovalToken(approval.approvalToken, params);
    expect(check1.valid).toBe(false);
    expect(check1.reason).toContain("APPROVAL_NOT_GRANTED");

    // User explicitly rejects
    service.decide(approval.id, "REJECTED");
    const check2 = service.verifyApprovalToken(approval.approvalToken, params);
    expect(check2.valid).toBe(false);
    expect(check2.reason).toContain("APPROVAL_NOT_GRANTED");
  });
});
