import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { MockHotelProvider } from "../providers/hotel.js";
import { MockTrainProvider } from "../providers/train.js";
import { MockRestaurantProvider } from "../providers/restaurant.js";
import { SagaOrchestrator } from "./orchestrator.js";
import { Grant, Plan } from "../types.js";
import { verifyAuditChain } from "../audit/chain.js";

describe("Saga Orchestrator & Timeout Reconciliation (Invariants I4, I8, I1)", () => {
  let repo: WarrantRepository;
  let approvalService: ApprovalService;
  let hotelProvider: MockHotelProvider;
  let trainProvider: MockTrainProvider;
  let restaurantProvider: MockRestaurantProvider;
  let orchestrator: SagaOrchestrator;
  let grant: Grant;

  beforeEach(() => {
    repo = new WarrantRepository(":memory:");
    approvalService = new ApprovalService(repo);
    hotelProvider = new MockHotelProvider();
    trainProvider = new MockTrainProvider();
    restaurantProvider = new MockRestaurantProvider();

    orchestrator = new SagaOrchestrator(
      repo,
      approvalService,
      hotelProvider,
      trainProvider,
      restaurantProvider
    );

    grant = repo.createGrant({
      id: "grant_saga",
      sessionToken: "tok_saga",
      scopes: ["*"],
      spendCapMinor: 30000, // $300.00
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });
  });

  afterEach(() => {
    repo.close();
    hotelProvider.clear();
    trainProvider.clear();
    restaurantProvider.clear();
  });

  it("Happy path: executes multi-step plan, commits external provider state, and updates spend (Invariant I2)", async () => {
    const plan: Plan = {
      id: "plan_happy",
      grantId: grant.id,
      state: "PROPOSED",
      totalEstimatedMinor: 16500,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_hotel",
          planId: "plan_happy",
          seq: 1,
          toolName: "book_hotel",
          params: { hotel_id: "grand_plaza", nights: 2, price: 12000 },
          paramsCanonical: '{"hotel_id":"grand_plaza","nights":2,"price":12000}',
          paramsHash: "h1",
          riskTier: "T2",
          state: "PENDING_APPROVAL",
          idempotencyKey: "idem_hotel_1",
          estimatedCostMinor: 12000
        },
        {
          id: "act_train",
          planId: "plan_happy",
          seq: 2,
          toolName: "book_train",
          params: { origin: "Portland", destination: "Seattle", price: 4500 },
          paramsCanonical: '{"destination":"Seattle","origin":"Portland","price":4500}',
          paramsHash: "h2",
          riskTier: "T1",
          state: "PROPOSED",
          idempotencyKey: "idem_train_1",
          estimatedCostMinor: 4500
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repo.createPlan(plan);

    // User approves T2 hotel
    const approval = approvalService.createPendingApproval("act_hotel", "plan_happy", {
      hotel_id: "grand_plaza",
      nights: 2,
      price: 12000
    });
    approvalService.decide(approval.id, "APPROVED");

    const result = await orchestrator.executePlan("plan_happy", grant.id, {
      act_hotel: approval.approvalToken
    });

    expect(result.state).toBe("COMPLETED");
    expect(result.confirmedSpendMinor).toBe(16500);
    expect(result.stepResults.length).toBe(2);

    // External provider state assertion
    expect(hotelProvider.getBookings().length).toBe(1);
    expect(hotelProvider.getBookings()[0].status).toBe("CONFIRMED");
    expect(trainProvider.getBookings().length).toBe(1);
    expect(trainProvider.getBookings()[0].status).toBe("CONFIRMED");

    // Spend cap updated in repository
    const updatedGrant = repo.getGrantById(grant.id);
    expect(updatedGrant?.spentMinor).toBe(16500);

    // Cryptographic audit chain verified
    const events = repo.getAuditEvents();
    expect(verifyAuditChain(events).valid).toBe(true);
  });

  it("Scenario S2: Mid-Plan Failure triggers automatic reverse rollback with clean residue (Invariant I4)", async () => {
    // Inject DECLINE fault on Train provider
    trainProvider.injectFault("DECLINE", 1);

    const plan: Plan = {
      id: "plan_s2",
      grantId: grant.id,
      state: "PROPOSED",
      totalEstimatedMinor: 16500,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_hotel_s2",
          planId: "plan_s2",
          seq: 1,
          toolName: "book_hotel",
          params: { hotel_id: "grand_plaza", nights: 2, price: 12000 },
          paramsCanonical: '{"hotel_id":"grand_plaza","nights":2,"price":12000}',
          paramsHash: "h_s2",
          riskTier: "T2",
          state: "PENDING_APPROVAL",
          idempotencyKey: "idem_s2_hotel",
          estimatedCostMinor: 12000
        },
        {
          id: "act_train_s2",
          planId: "plan_s2",
          seq: 2,
          toolName: "book_train",
          params: { origin: "Portland", destination: "Seattle", price: 4500 },
          paramsCanonical: '{"destination":"Seattle","origin":"Portland","price":4500}',
          paramsHash: "h_s2_train",
          riskTier: "T1",
          state: "PROPOSED",
          idempotencyKey: "idem_s2_train",
          estimatedCostMinor: 4500
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repo.createPlan(plan);

    const approval = approvalService.createPendingApproval("act_hotel_s2", "plan_s2", {
      hotel_id: "grand_plaza",
      nights: 2,
      price: 12000
    });
    approvalService.decide(approval.id, "APPROVED");

    const result = await orchestrator.executePlan("plan_s2", grant.id, {
      act_hotel_s2: approval.approvalToken
    });

    // Plan state must transition to COMPENSATED
    expect(result.state).toBe("COMPENSATED");
    expect(result.compensatedSteps).toContain("act_hotel_s2");
    expect(result.confirmedSpendMinor).toBe(0);
    expect(result.spoken_summary).toContain("cancelled at no charge");

    // INVARIANT I4: External Provider Truth Verification!
    // Hotel booking was created during Step 1, but must be CANCELLED during compensation
    const hotelBookings = hotelProvider.getBookings();
    expect(hotelBookings.length).toBe(1);
    expect(hotelBookings[0].status).toBe("CANCELLED");

    // Train provider was declined, so 0 bookings created
    const trainBookings = trainProvider.getBookings();
    expect(trainBookings.length).toBe(0);

    // Grant spent amount remains 0 (no financial loss)
    const currentGrant = repo.getGrantById(grant.id);
    expect(currentGrant?.spentMinor).toBe(0);

    // Audit trail records compensation sequence
    const events = repo.getAuditEvents();
    const compensationEvent = events.find((e) => e.eventType === "SAGA_COMPENSATION_SUCCEEDED");
    expect(compensationEvent).toBeDefined();
    expect(verifyAuditChain(events).valid).toBe(true);
  });

  it("Scenario S8: Ambiguous Timeout with Succeeded-Response-Lost reconciles external state (Invariants I8, I1)", async () => {
    // Hotel provider saves booking in its external DB, but connection drops before ACK
    hotelProvider.injectFault("SUCCEEDED_BUT_DISCONNECTED", 1);

    const plan: Plan = {
      id: "plan_s8",
      grantId: grant.id,
      state: "PROPOSED",
      totalEstimatedMinor: 12000,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_hotel_s8",
          planId: "plan_s8",
          seq: 1,
          toolName: "book_hotel",
          params: { hotel_id: "grand_plaza", nights: 2, price: 12000 },
          paramsCanonical: '{"hotel_id":"grand_plaza","nights":2,"price":12000}',
          paramsHash: "h_s8",
          riskTier: "T2",
          state: "PENDING_APPROVAL",
          idempotencyKey: "idem_s8_hotel",
          estimatedCostMinor: 12000
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repo.createPlan(plan);

    const approval = approvalService.createPendingApproval("act_hotel_s8", "plan_s8", {
      hotel_id: "grand_plaza",
      nights: 2,
      price: 12000
    });
    approvalService.decide(approval.id, "APPROVED");

    const result = await orchestrator.executePlan("plan_s8", grant.id, {
      act_hotel_s8: approval.approvalToken
    });

    // Reconciler verified booking exists at provider, avoids duplicate booking, completes plan
    expect(result.state).toBe("COMPLETED");
    expect(result.confirmedSpendMinor).toBe(12000);

    // External provider has EXACTLY 1 booking (Invariant I1)
    const bookings = hotelProvider.getBookings();
    expect(bookings.length).toBe(1);
    expect(bookings[0].status).toBe("CONFIRMED");

    // Audit trail logged timeout followed by reconciliation
    const events = repo.getAuditEvents();
    expect(events.some((e) => e.eventType === "ACTION_UNKNOWN_TIMEOUT")).toBe(true);
    expect(events.some((e) => e.eventType === "ACTION_RECONCILED")).toBe(true);
    expect(verifyAuditChain(events).valid).toBe(true);
  });
});
