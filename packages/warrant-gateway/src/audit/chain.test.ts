import { describe, it, expect } from "vitest";
import { createAuditEvent, verifyAuditChain, GENESIS_HASH } from "./chain.js";
import { AuditEvent } from "../types.js";

describe("Cryptographic Audit Chain (Invariant I7)", () => {
  it("verifies a valid append-only chain from genesis to tip", () => {
    const e1 = createAuditEvent(null, "GRANT_CREATED", "grant_1", {
      scopes: ["hotel:*"],
      cap: 15000
    });
    const e2 = createAuditEvent(e1, "PLAN_PROPOSED", "plan_1", {
      total: 12000,
      steps: 2
    });
    const e3 = createAuditEvent(e2, "APPROVAL_GRANTED", "action_1", {
      token: "tok_abc"
    });
    const e4 = createAuditEvent(e3, "ACTION_SUCCEEDED", "action_1", {
      bookingId: "hotel_99"
    });

    const chain: AuditEvent[] = [e1, e2, e3, e4];
    const result = verifyAuditChain(chain);

    expect(result.valid).toBe(true);
    expect(result.eventCount).toBe(4);
    expect(result.genesisHash).toBe(GENESIS_HASH);
    expect(result.tipHash).toBe(e4.hash);
  });

  it("detects payload tampering in any historical event", () => {
    const e1 = createAuditEvent(null, "GRANT_CREATED", "grant_1", { cap: 15000 });
    const e2 = createAuditEvent(e1, "PLAN_PROPOSED", "plan_1", { total: 12000 });
    const e3 = createAuditEvent(e2, "ACTION_SUCCEEDED", "action_1", { bookingId: "hotel_99" });

    // Attacker modifies e2 payload in database (e.g. changes total from 12000 to 1200)
    const tamperedE2: AuditEvent = {
      ...e2,
      payloadCanonical: '{"total":1200}' // Tampered!
    };

    const chain = [e1, tamperedE2, e3];
    const result = verifyAuditChain(chain);

    expect(result.valid).toBe(false);
    expect(result.error?.seq).toBe(2);
    expect(result.error?.reason).toContain("Cryptographic hash mismatch");
  });

  it("detects deletion of an audit record", () => {
    const e1 = createAuditEvent(null, "GRANT_CREATED", "grant_1", { cap: 15000 });
    const e2 = createAuditEvent(e1, "PLAN_PROPOSED", "plan_1", { total: 12000 });
    const e3 = createAuditEvent(e2, "ACTION_SUCCEEDED", "action_1", { bookingId: "hotel_99" });

    // Attacker deletes e2
    const chain = [e1, e3];
    const result = verifyAuditChain(chain);

    expect(result.valid).toBe(false);
    expect(result.error?.seq).toBe(3);
    expect(result.error?.reason).toContain("Broken sequence");
  });

  it("detects retroactive insertion of an unchained record", () => {
    const e1 = createAuditEvent(null, "GRANT_CREATED", "grant_1", { cap: 15000 });
    const e2 = createAuditEvent(e1, "PLAN_PROPOSED", "plan_1", { total: 12000 });

    const insertedEvent: AuditEvent = {
      seq: 2,
      timestamp: new Date().toISOString(),
      eventType: "GRANT_REVOKED",
      refId: "grant_1",
      payloadCanonical: "{}",
      prevHash: e1.hash,
      hash: "fake_hash"
    };

    const chain = [e1, insertedEvent, e2];
    const result = verifyAuditChain(chain);

    expect(result.valid).toBe(false);
  });

  it("empty chain returns valid with zero count", () => {
    const result = verifyAuditChain([]);
    expect(result.valid).toBe(true);
    expect(result.eventCount).toBe(0);
  });
});
