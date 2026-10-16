import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarrantRepository } from "../storage/db.js";
import { IdempotencyService, IdempotencyConflictError } from "./service.js";

describe("IdempotencyService (Invariant I1)", () => {
  let repo: WarrantRepository;
  let service: IdempotencyService;

  beforeEach(() => {
    repo = new WarrantRepository(":memory:");
    service = new IdempotencyService(repo);

    repo.createGrant({
      id: "grant_1",
      sessionToken: "bearer_1",
      scopes: ["*"],
      spendCapMinor: 50000,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });
  });

  afterEach(() => {
    repo.close();
  });

  it("executes external effect exactly once across repeated calls (Invariant I1)", async () => {
    let callCount = 0;
    const executeMock = async () => {
      callCount++;
      return { bookingId: "bk_12345", status: "CONFIRMED" };
    };

    const params = { room: "deluxe", nights: 2 };

    // First call
    const res1 = await service.executeWithIdempotency("grant_1", "book_hotel", "key_abc", params, executeMock);
    expect(res1.cached).toBe(false);
    expect(res1.result.bookingId).toBe("bk_12345");
    expect(callCount).toBe(1);

    // Second call with same idempotency key and same parameters
    const res2 = await service.executeWithIdempotency("grant_1", "book_hotel", "key_abc", params, executeMock);
    expect(res2.cached).toBe(true);
    expect(res2.result.bookingId).toBe("bk_12345");
    // Assert downstream provider was NOT called again!
    expect(callCount).toBe(1);
  });

  it("throws 409 Conflict if same idempotency key is reused with different parameters", async () => {
    const executeMock = async () => ({ status: "OK" });

    // Call with room: deluxe
    await service.executeWithIdempotency("grant_1", "book_hotel", "key_same", { room: "deluxe" }, executeMock);

    // Replay with room: standard (different parameters)
    await expect(
      service.executeWithIdempotency("grant_1", "book_hotel", "key_same", { room: "standard" }, executeMock)
    ).rejects.toThrow(IdempotencyConflictError);
  });
});
