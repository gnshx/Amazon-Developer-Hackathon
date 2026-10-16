import { PlanAction, PlanState } from "../types.js";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { TimeoutReconciler } from "./reconciler.js";
import { MockHotelProvider } from "../providers/hotel.js";
import { MockTrainProvider } from "../providers/train.js";
import { MockRestaurantProvider } from "../providers/restaurant.js";
import { IMockProvider } from "../providers/types.js";

export interface CompensationStep {
  actionId: string;
  toolName: string;
  bookingRef: string;
  provider: IMockProvider;
}

export interface SagaExecutionResult {
  [key: string]: unknown;
  planId: string;
  state: PlanState;
  confirmedSpendMinor: number;
  stepResults: any[];
  compensatedSteps: string[];
  spoken_summary: string;
  error?: string;
}

export class SagaOrchestrator {
  private reconciler: TimeoutReconciler;

  constructor(
    private repo: WarrantRepository,
    private approvalService: ApprovalService,
    private hotelProvider: MockHotelProvider,
    private trainProvider: MockTrainProvider,
    private restaurantProvider: MockRestaurantProvider
  ) {
    this.reconciler = new TimeoutReconciler(repo);
  }

  private getProvider(toolName: string): IMockProvider | null {
    if (toolName.includes("hotel")) return this.hotelProvider;
    if (toolName.includes("train")) return this.trainProvider;
    if (toolName.includes("restaurant") || toolName.includes("table")) return this.restaurantProvider;
    return null;
  }

  /**
   * Executes a multi-step plan with automatic reverse rollback upon partial failure (Invariant I4)
   * and active reconciliation for timeouts (Invariant I8).
   */
  public async executePlan(
    planId: string,
    grantId: string,
    userApprovals: Record<string, string> = {}
  ): Promise<SagaExecutionResult> {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    this.repo.updatePlanState(planId, "EXECUTING");
    const compensationStack: CompensationStep[] = [];
    const stepResults: any[] = [];
    let confirmedSpendMinor = 0;

    for (const act of plan.actions) {
      this.repo.updateActionState(act.id, "EXECUTING");
      this.repo.appendAuditEvent("ACTION_EXECUTION_STARTED", act.id, {
        toolName: act.toolName,
        planId
      });

      // 1. Verify Approval for T2 actions (Invariant I3)
      if (act.riskTier === "T2") {
        let token = userApprovals[act.id] || userApprovals[act.toolName];
        if (!token) {
          const storedApproval = this.repo.getApprovalByActionId(act.id);
          if (storedApproval && storedApproval.status === "APPROVED") {
            token = storedApproval.approvalToken;
          }
        }

        if (!token) {
          return await this.handleSagaFailure(
            planId,
            act,
            compensationStack,
            `APPROVAL_REQUIRED: Action '${act.toolName}' requires user confirmation token.`
          );
        }

        const verifyResult = this.approvalService.verifyApprovalToken(token, act.params);
        if (!verifyResult.valid) {
          return await this.handleSagaFailure(
            planId,
            act,
            compensationStack,
            `APPROVAL_MISMATCH: ${verifyResult.reason}`
          );
        }
      }

      // 2. Execute step on provider
      const provider = this.getProvider(act.toolName);
      let executionSuccess = false;
      let bookingRef = "";
      let cost = act.estimatedCostMinor;

      try {
        if (act.toolName === "book_hotel") {
          const res = await this.hotelProvider.bookHotel(act.idempotencyKey, act.params as any);
          bookingRef = res.bookingRef;
          cost = res.priceMinor;
          executionSuccess = true;
        } else if (act.toolName === "book_train") {
          const res = await this.trainProvider.bookTrain(act.idempotencyKey, act.params as any);
          bookingRef = res.bookingRef;
          cost = res.priceMinor;
          executionSuccess = true;
        } else if (act.toolName === "reserve_table") {
          const res = await this.restaurantProvider.reserveTable(act.idempotencyKey, act.params as any);
          bookingRef = res.bookingRef;
          cost = res.priceMinor;
          executionSuccess = true;
        } else {
          // Generic simulated action
          bookingRef = `ref_${act.id.slice(0, 8)}`;
          executionSuccess = true;
        }
      } catch (err: any) {
        const errMsg = err.message || "";

        // Check if ambiguous timeout occurred (Invariant I8)
        if (errMsg.includes("TIMEOUT") || errMsg.includes("CONNECTION_LOST")) {
          this.repo.updateActionState(act.id, "UNKNOWN");
          if (provider) {
            const reconciliation = await this.reconciler.reconcile(provider, act.id, act.idempotencyKey);
            if (reconciliation.resolved && reconciliation.state === "SUCCEEDED" && reconciliation.booking) {
              bookingRef = reconciliation.booking.bookingRef;
              executionSuccess = true;
            } else {
              // Reconciled as failed
              return await this.handleSagaFailure(
                planId,
                act,
                compensationStack,
                `Network timeout resolved: booking was not created.`
              );
            }
          }
        } else {
          // Direct failure (e.g. DECLINED) -> Trigger rollback!
          return await this.handleSagaFailure(planId, act, compensationStack, errMsg);
        }
      }

      if (executionSuccess) {
        this.repo.updateActionState(act.id, "SUCCEEDED", { bookingRef, costMinor: cost }, cost);
        confirmedSpendMinor += cost;
        stepResults.push({ actionId: act.id, toolName: act.toolName, bookingRef, costMinor: cost });

        if (provider && bookingRef) {
          compensationStack.push({
            actionId: act.id,
            toolName: act.toolName,
            bookingRef,
            provider
          });
        }

        this.repo.appendAuditEvent("ACTION_SUCCEEDED", act.id, {
          toolName: act.toolName,
          bookingRef,
          costMinor: cost
        });
      }
    }

    // All steps completed successfully
    this.repo.updateGrantSpent(grantId, confirmedSpendMinor);
    this.repo.updatePlanState(planId, "COMPLETED");

    return {
      planId,
      state: "COMPLETED",
      confirmedSpendMinor,
      stepResults,
      compensatedSteps: [],
      spoken_summary: `Your trip is booked and confirmed! Total spend was $${(confirmedSpendMinor / 100).toFixed(2)}.`
    };
  }

  /**
   * Rollback handler: executes compensations in reverse order (Invariant I4).
   */
  private async handleSagaFailure(
    planId: string,
    failingAction: PlanAction,
    compensationStack: CompensationStep[],
    errorMessage: string
  ): Promise<SagaExecutionResult> {
    this.repo.updateActionState(failingAction.id, "FAILED", { error: errorMessage });
    this.repo.appendAuditEvent("ACTION_FAILED", failingAction.id, {
      toolName: failingAction.toolName,
      error: errorMessage
    });

    this.repo.appendAuditEvent("SAGA_COMPENSATION_STARTED", planId, {
      failingActionId: failingAction.id,
      stepsToRollback: compensationStack.length
    });

    const compensatedSteps: string[] = [];
    let compensationFailed = false;

    // Rollback in REVERSE order (Last In, First Out)
    while (compensationStack.length > 0) {
      const step = compensationStack.pop()!;
      try {
        if (step.toolName === "book_hotel" && "cancelHotel" in step.provider) {
          await (step.provider as MockHotelProvider).cancelHotel(`comp_${step.actionId}`, step.bookingRef);
        } else if (step.toolName === "book_train" && "cancelTrain" in step.provider) {
          await (step.provider as MockTrainProvider).cancelTrain(`comp_${step.actionId}`, step.bookingRef);
        } else if (step.toolName === "reserve_table" && "cancelReservation" in step.provider) {
          await (step.provider as MockRestaurantProvider).cancelReservation(`comp_${step.actionId}`, step.bookingRef);
        }

        this.repo.updateActionState(step.actionId, "COMPENSATED");
        compensatedSteps.push(step.actionId);

        this.repo.appendAuditEvent("SAGA_COMPENSATION_SUCCEEDED", step.actionId, {
          toolName: step.toolName,
          bookingRef: step.bookingRef
        });
      } catch (compErr: any) {
        compensationFailed = true;
        this.repo.updateActionState(step.actionId, "COMPENSATION_FAILED");
        this.repo.appendAuditEvent("SAGA_COMPENSATION_FAILED", step.actionId, {
          toolName: step.toolName,
          bookingRef: step.bookingRef,
          error: compErr.message
        });
      }
    }

    const finalState: PlanState = compensationFailed ? "COMPENSATION_FAILED" : "COMPENSATED";
    this.repo.updatePlanState(planId, finalState);

    const spoken = compensationFailed
      ? `Booking failed on ${failingAction.toolName}. Automatic cancellation encountered an error; please check your email.`
      : `Your ${failingAction.toolName.replace("book_", "")} could not be confirmed, so all preceding reservations were automatically cancelled at no charge.`;

    return {
      planId,
      state: finalState,
      confirmedSpendMinor: 0,
      stepResults: [],
      compensatedSteps,
      spoken_summary: spoken,
      error: errorMessage
    };
  }
}
