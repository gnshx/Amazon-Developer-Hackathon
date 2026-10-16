import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarrantRepository } from "./db.js";
import { verifyAuditChain } from "../audit/chain.js";

describe("Warrant SQLite Repository", () => {
  let repo: WarrantRepository;

  beforeEach(() => {
    repo = new WarrantRepository(":memory:");
  });

  afterEach(() => {
    repo.close();
  });

  it("creates, retrieves, and updates grants with integer minor units", () => {
    const grant = repo.createGrant({
      id: "grant_100",
      sessionToken: "tok_secret_1",
      scopes: ["hotel:*", "train:*"],
      spendCapMinor: 20000, // $200.00
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      status: "ACTIVE"
    });

    expect(grant.spentMinor).toBe(0);

    const fetched = repo.getGrantById("grant_100");
    expect(fetched).not.toBeNull();
    expect(fetched?.spendCapMinor).toBe(20000);

    const fetchedByToken = repo.getGrantBySessionToken("tok_secret_1");
    expect(fetchedByToken?.id).toBe("grant_100");

    const updated = repo.updateGrantSpent("grant_100", 4500);
    expect(updated.spentMinor).toBe(4500);
  });

  it("revokes grants and automatically appends a tamper-evident audit event", () => {
    repo.createGrant({
      id: "grant_200",
      sessionToken: "tok_secret_2",
      scopes: ["hotel:*"],
      spendCapMinor: 10000,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      status: "ACTIVE"
    });

    const revoked = repo.revokeGrant("grant_200");
    expect(revoked.status).toBe("REVOKED");

    const events = repo.getAuditEvents();
    expect(events.length).toBe(2); // GRANT_CREATED + GRANT_REVOKED
    expect(events[1].eventType).toBe("GRANT_REVOKED");

    const chainResult = verifyAuditChain(events);
    expect(chainResult.valid).toBe(true);
  });

  it("records idempotency starts and completions", () => {
    repo.createGrant({
      id: "grant_300",
      sessionToken: "tok_secret_3",
      scopes: ["*"],
      spendCapMinor: 50000,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      status: "ACTIVE"
    });

    repo.recordIdempotencyStart("grant_300", "book_hotel", "idem_key_1", "hash_abc");
    const record = repo.getIdempotencyRecord("grant_300", "book_hotel", "idem_key_1");
    expect(record).not.toBeNull();
    expect(record?.state).toBe("PROCESSING");

    repo.recordIdempotencyComplete("grant_300", "book_hotel", "idem_key_1", {
      bookingId: "b_123"
    });

    const completed = repo.getIdempotencyRecord("grant_300", "book_hotel", "idem_key_1");
    expect(completed?.state).toBe("COMPLETED");
    expect(completed?.responsePayload).toEqual({ bookingId: "b_123" });
  });

  it("maintains cryptographic audit chain continuity across multiple operations", () => {
    repo.createGrant({
      id: "grant_400",
      sessionToken: "tok_secret_4",
      scopes: ["hotel:*"],
      spendCapMinor: 15000,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      status: "ACTIVE"
    });

    repo.appendAuditEvent("PLAN_PROPOSED", "plan_1", { steps: 3 });
    repo.appendAuditEvent("APPROVAL_REQUESTED", "action_1", { cost: 12000 });
    repo.appendAuditEvent("APPROVAL_GRANTED", "action_1", { token: "app_tok" });
    repo.appendAuditEvent("ACTION_SUCCEEDED", "action_1", { bookingId: "b_999" });

    const events = repo.getAuditEvents();
    expect(events.length).toBe(5);

    const verification = verifyAuditChain(events);
    expect(verification.valid).toBe(true);
    expect(verification.eventCount).toBe(5);
  });
});
