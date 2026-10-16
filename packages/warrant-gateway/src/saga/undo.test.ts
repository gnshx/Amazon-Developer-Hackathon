import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { ReceiptService } from "../receipt/service.js";
import { SagaOrchestrator } from "./orchestrator.js";
import { MockHotelProvider } from "../providers/hotel.js";
import { MockTrainProvider } from "../providers/train.js";
import { MockRestaurantProvider } from "../providers/restaurant.js";
import { Plan } from "../types.js";

describe("Undo Window & Grace Hold (Invariant I10)", () => {
  let repo: WarrantRepository;
  let orchestrator: SagaOrchestrator;
  let hotelProvider: MockHotelProvider;
  let trainProvider: MockTrainProvider;
  let restaurantProvider: MockRestaurantProvider;
  let grantId: string;

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new WarrantRepository(":memory:");
    const approvalService = new ApprovalService(repo);
    const receiptService = new ReceiptService(repo);
    hotelProvider = new MockHotelProvider();
    trainProvider = new MockTrainProvider();
    restaurantProvider = new MockRestaurantProvider();

    orchestrator = new SagaOrchestrator(
      repo,
      approvalService,
      hotelProvider,
      trainProvider,
      restaurantProvider,
      receiptService
    );

    const grant = repo.createGrant({
      id: "grant_undo_test",
      sessionToken: "tok_undo_test",
      scopes: ["*"],
      spendCapMinor: 50000,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });
    grantId = grant.id;
  });

  afterEach(() => {
    vi.useRealTimers();
    repo.close();
  });

  it("places a plan into HELD state with a settlesAt timestamp", async () => {
    const plan: Plan = {
      id: "plan_held_1",
      grantId,
      state: "PROPOSED",
      totalEstimatedMinor: 12000,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_hotel_1",
          planId: "plan_held_1",
          seq: 1,
          toolName: "book_hotel",
          params: { hotel_id: "harbor_inn", nights: 1, price: 12000 },
          paramsCanonical: '{"hotel_id":"harbor_inn","nights":1,"price":12000}',
          paramsHash: "hash123",
          riskTier: "T2",
          state: "PROPOSED",
          idempotencyKey: "key_hotel_1",
          estimatedCostMinor: 12000
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repo.createPlan(plan);

    const result = await orchestrator.executePlanWithUndoWindow("plan_held_1", grantId, {}, 10);
    expect(result.state).toBe("HELD");
    expect(result.undoWindowSeconds).toBe(10);
    expect(result.settlesAt).toBeDefined();

    const storedPlan = repo.getPlanById("plan_held_1");
    expect(storedPlan?.state).toBe("HELD");
    expect(storedPlan?.undoWindowSeconds).toBe(10);
    expect(hotelProvider.getBookings()).toHaveLength(0);
  });

  it("cancels a held plan before settlement, committing zero external provider effects", async () => {
    const plan: Plan = {
      id: "plan_cancel_1",
      grantId,
      state: "PROPOSED",
      totalEstimatedMinor: 9500,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_train_1",
          planId: "plan_cancel_1",
          seq: 1,
          toolName: "book_train",
          params: { origin: "Portland", destination: "Seattle", price: 9500 },
          paramsCanonical: '{"destination":"Seattle","origin":"Portland","price":9500}',
          paramsHash: "hash_train",
          riskTier: "T1",
          state: "PROPOSED",
          idempotencyKey: "key_train_1",
          estimatedCostMinor: 9500
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repo.createPlan(plan);

    // Place on 10s hold
    await orchestrator.executePlanWithUndoWindow("plan_cancel_1", grantId, {}, 10);

    // Advance 3 seconds (still inside hold window)
    vi.advanceTimersByTime(3000);

    // User cancels via undo
    const undoResult = await orchestrator.undoPlan("plan_cancel_1");
    expect(undoResult.success).toBe(true);
    expect(undoResult.state).toBe("UNDONE");
    expect(undoResult.spendReleasedMinor).toBe(9500);

    // Verify zero train bookings were created
    expect(trainProvider.getBookings()).toHaveLength(0);

    // Advance past original timer (e.g. 15s)
    vi.advanceTimersByTime(15000);

    // Verify still 0 bookings and state remains UNDONE
    expect(trainProvider.getBookings()).toHaveLength(0);
    const finalPlan = repo.getPlanById("plan_cancel_1");
    expect(finalPlan?.state).toBe("UNDONE");

    // Check audit trail for ACTION_UNDO_REQUESTED and ACTION_UNDONE
    const auditEvents = repo.getAuditEvents();
    const undoReq = auditEvents.find((e) => e.eventType === "ACTION_UNDO_REQUESTED");
    const undoSuccess = auditEvents.find((e) => e.eventType === "ACTION_UNDONE");
    expect(undoReq).toBeDefined();
    expect(undoSuccess).toBeDefined();
  });

  it("automatically settles after grace hold window expires without cancellation", async () => {
    const plan: Plan = {
      id: "plan_settle_1",
      grantId,
      state: "PROPOSED",
      totalEstimatedMinor: 4500,
      totalConfirmedMinor: 0,
      actions: [
        {
          id: "act_train_settle",
          planId: "plan_settle_1",
          seq: 1,
          toolName: "book_train",
          params: { origin: "Portland", destination: "Seattle", price: 4500 },
          paramsCanonical: '{"destination":"Seattle","origin":"Portland","price":4500}',
          paramsHash: "hash_train_settle",
          riskTier: "T1",
          state: "PROPOSED",
          idempotencyKey: "key_train_settle",
          estimatedCostMinor: 4500
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repo.createPlan(plan);

    // Place on 5-second hold
    await orchestrator.executePlanWithUndoWindow("plan_settle_1", grantId, {}, 5);
    expect(trainProvider.getBookings()).toHaveLength(0);

    // Advance past the 5-second hold
    await vi.advanceTimersByTimeAsync(5500);

    // Provider now has confirmed booking!
    const bookings = trainProvider.getBookings();
    expect(bookings).toHaveLength(1);
    expect(bookings[0].status).toBe("CONFIRMED");

    const settledPlan = repo.getPlanById("plan_settle_1");
    expect(settledPlan?.state).toBe("COMPLETED");
  });
});
