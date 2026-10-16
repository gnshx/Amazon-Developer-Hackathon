import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluatePolicy, isToolInScope } from "./engine.js";
import { Grant } from "../types.js";

describe("Deterministic Policy Engine (Invariants I2, I3, I6)", () => {
  const baseGrant: Grant = {
    id: "grant_123",
    sessionToken: "bearer_xyz",
    scopes: ["hotel:*", "train:*", "dining:*", "search_*"],
    spendCapMinor: 15000, // $150.00
    spentMinor: 0,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    status: "ACTIVE",
    createdAt: new Date().toISOString()
  };

  it("T0 read action is always allowed with zero budget deduction", () => {
    const decision = evaluatePolicy(baseGrant, {
      toolName: "search_hotels",
      estimatedCostMinor: 0
    });

    expect(decision.allowed).toBe(true);
    expect(decision.riskTier).toBe("T0");
    expect(decision.requiresApproval).toBe(false);
    expect(decision.reasonCode).toBe("ALLOWED_READ_ONLY");
  });

  it("T1 action under spend threshold is allowed automatically", () => {
    const decision = evaluatePolicy(baseGrant, {
      toolName: "book_train",
      estimatedCostMinor: 3500 // $35.00 <= $50.00 threshold
    });

    expect(decision.allowed).toBe(true);
    expect(decision.riskTier).toBe("T1");
    expect(decision.requiresApproval).toBe(false);
    expect(decision.reasonCode).toBe("ALLOWED_WITHIN_THRESHOLD");
  });

  it("T1 action exceeding spend threshold escalates to T2 and requires approval", () => {
    const decision = evaluatePolicy(baseGrant, {
      toolName: "book_train",
      estimatedCostMinor: 6500 // $65.00 > $50.00 threshold
    });

    expect(decision.allowed).toBe(true);
    expect(decision.riskTier).toBe("T2");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCode).toBe("REQUIRES_PHONE_APPROVAL");
  });

  it("T2 high-risk action (book_hotel) always requires phone approval (Invariant I3)", () => {
    const decision = evaluatePolicy(baseGrant, {
      toolName: "book_hotel",
      estimatedCostMinor: 12000 // $120.00
    });

    expect(decision.allowed).toBe(true);
    expect(decision.riskTier).toBe("T2");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCode).toBe("REQUIRES_PHONE_APPROVAL");
  });

  it("Action exceeding grant spend cap is strictly DENIED (Invariant I2)", () => {
    const decision = evaluatePolicy(baseGrant, {
      toolName: "book_hotel",
      estimatedCostMinor: 15001 // $150.01 > $150.00 cap
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskTier).toBe("T3");
    expect(decision.reasonCode).toBe("EXCEEDS_SPEND_CAP");
  });

  it("Expired grant authorizes zero actions (Invariant I6)", () => {
    const expiredGrant: Grant = {
      ...baseGrant,
      expiresAt: new Date(Date.now() - 1000).toISOString()
    };

    const decision = evaluatePolicy(expiredGrant, {
      toolName: "search_hotels",
      estimatedCostMinor: 0
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskTier).toBe("T3");
    expect(decision.reasonCode).toBe("GRANT_EXPIRED");
  });

  it("Revoked grant authorizes zero actions (Invariant I6)", () => {
    const revokedGrant: Grant = {
      ...baseGrant,
      status: "REVOKED"
    };

    const decision = evaluatePolicy(revokedGrant, {
      toolName: "search_hotels",
      estimatedCostMinor: 0
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskTier).toBe("T3");
    expect(decision.reasonCode).toBe("GRANT_REVOKED");
  });

  it("Out-of-scope action is denied", () => {
    const scopedGrant: Grant = {
      ...baseGrant,
      scopes: ["hotel:*"]
    };

    const decision = evaluatePolicy(scopedGrant, {
      toolName: "buy_flight_ticket",
      estimatedCostMinor: 5000
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskTier).toBe("T3");
    expect(decision.reasonCode).toBe("OUT_OF_SCOPE");
  });

  it("property test: spend cap invariant I2 holds for all generated spend amounts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000 }), // Cap
        fc.integer({ min: 0, max: 50000 }),     // Current spent
        fc.integer({ min: 1, max: 100000 }),    // Requested cost
        (cap, currentSpent, requestedCost) => {
          const grant: Grant = {
            ...baseGrant,
            spendCapMinor: cap,
            spentMinor: currentSpent
          };

          const decision = evaluatePolicy(grant, {
            toolName: "book_hotel",
            estimatedCostMinor: requestedCost
          });

          if (currentSpent + requestedCost > cap) {
            return !decision.allowed && decision.reasonCode === "EXCEEDS_SPEND_CAP";
          } else {
            return decision.allowed;
          }
        }
      ),
      { numRuns: 300 }
    );
  });
});
