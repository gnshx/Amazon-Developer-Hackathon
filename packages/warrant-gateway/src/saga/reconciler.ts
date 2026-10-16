import { BookingRecord, IMockProvider } from "../providers/types.js";
import { WarrantRepository } from "../storage/db.js";

export interface ReconciliationResult {
  resolved: boolean;
  state: "SUCCEEDED" | "FAILED";
  booking?: BookingRecord;
  reason: string;
}

export class TimeoutReconciler {
  constructor(private repo: WarrantRepository) {}

  /**
   * Actively reconciles an ambiguous network outcome by querying the provider's external truth (Invariant I8).
   * Prevents blind retries and double bookings.
   */
  public async reconcile(
    provider: IMockProvider,
    actionId: string,
    idempotencyKey: string
  ): Promise<ReconciliationResult> {
    // 1. Audit transition to UNKNOWN timeout state
    this.repo.appendAuditEvent("ACTION_UNKNOWN_TIMEOUT", actionId, {
      provider: provider.name,
      idempotencyKey
    });

    // 2. Query provider by idempotency key out-of-band
    const existing = provider.getBookingByIdempotencyKey(idempotencyKey);

    if (existing && existing.status === "CONFIRMED") {
      // External truth proves booking completed before socket dropped!
      this.repo.appendAuditEvent("ACTION_RECONCILED", actionId, {
        resolution: "SUCCEEDED",
        bookingRef: existing.bookingRef,
        provider: provider.name
      });

      return {
        resolved: true,
        state: "SUCCEEDED",
        booking: existing,
        reason: `Reconciliation verified booking ${existing.bookingRef} was confirmed at provider despite connection timeout.`
      };
    }

    // External truth proves no booking was created
    this.repo.appendAuditEvent("ACTION_RECONCILED", actionId, {
      resolution: "FAILED",
      provider: provider.name
    });

    return {
      resolved: true,
      state: "FAILED",
      reason: `Reconciliation confirmed zero bookings were created at provider for idempotency key ${idempotencyKey}.`
    };
  }
}
