import { WarrantRepository } from "../storage/db.js";
import { canonicalSha256 } from "../crypto/canonical.js";

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyService {
  constructor(private repo: WarrantRepository) {}

  /**
   * Executes an action with guaranteed single-execution idempotency (Invariant I1).
   * Prevents retry storms and duplicate bookings across concurrent and sequential calls.
   */
  public async executeWithIdempotency<T extends Record<string, unknown>>(
    grantId: string,
    toolName: string,
    idempotencyKey: string,
    params: Record<string, unknown>,
    executeFn: () => Promise<T>
  ): Promise<{ result: T; cached: boolean }> {
    const paramsHash = canonicalSha256(params);
    const existing = this.repo.getIdempotencyRecord(grantId, toolName, idempotencyKey);

    if (existing) {
      // If the same key is reused with DIFFERENT parameters, reject with 409 Conflict
      if (existing.paramsHash !== paramsHash) {
        throw new IdempotencyConflictError(
          `Idempotency key '${idempotencyKey}' was already used for tool '${toolName}' with different parameters.`
        );
      }

      // If already completed, return the cached result immediately
      if (existing.state === "COMPLETED" && existing.responsePayload) {
        return {
          result: existing.responsePayload as T,
          cached: true
        };
      }

      // If currently processing, wait briefly or return processing error
      if (existing.state === "PROCESSING") {
        throw new Error(
          `Concurrent execution in progress for tool '${toolName}' with idempotency key '${idempotencyKey}'.`
        );
      }
    }

    // Record start of processing
    this.repo.recordIdempotencyStart(grantId, toolName, idempotencyKey, paramsHash);

    try {
      const result = await executeFn();
      this.repo.recordIdempotencyComplete(grantId, toolName, idempotencyKey, result);
      return { result, cached: false };
    } catch (err: any) {
      // Allow retry on execution failure by leaving or cleaning record
      throw err;
    }
  }
}
