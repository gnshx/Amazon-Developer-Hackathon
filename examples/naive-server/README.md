# Naive Unprotected Booking Server (DEMO ONLY)

> ⚠️ **SECURITY WARNING:** This server is intentionally insecure and unprotected. It is provided strictly as a demonstration and baseline benchmark for hackathon evaluators to contrast an unprotected MCP tool server against the Warrant Trust Gateway. Do NOT deploy or run this server in production.

---

## Why This Exists

Voice assistants acting on real services must handle real-world failure modes: duplicate submits, network timeouts, mid-sequence failures, and runaway spend.

This naive server demonstrates what occurs when an AI agent interacts with services **without** Warrant:
1. **No Idempotency ($I_1$ Failure):** Duplicate or retried requests execute repeated external provider calls, causing duplicate bookings and multi-charges.
2. **No Spend Cap ($I_2$ Failure):** Accepts plans and purchases of arbitrary cost without checking cumulative customer limits.
3. **No Approval Hash Binding ($I_3$ Failure):** Executes high-risk state changes without validating parameter integrity or out-of-band user approval tokens.
4. **No Saga Rollback ($I_4$ Failure):** If step 2 of a multi-step itinerary fails (e.g. train sold out), step 1 (hotel) remains orphaned and charged, leaving residual financial liability.
5. **No Active Reconciliation ($I_8$ Failure):** Ambiguous network outcomes cannot be verified against external provider truth.

---

## Running the Comparative Benchmark

To evaluate the naive server side-by-side against the Warrant Trust Gateway under identical attack loads:

```bash
# Run comparative benchmark
npm run test:compare
```

### Expected Benchmark Results:

```
========================================================
⚔️  WARRANT SIEGE: Naive vs. Warrant Comparative Benchmark
========================================================

Scenario: Duplicate Submit Storm (I1)
  ❌ NAIVE SYSTEM:     [FAIL] Duplicate charges: 10 bookings created ($950.00)
  ✅ WARRANT GATEWAY:  [PASS] Exactly 1 booking executed ($45.00); 9 duplicates safely deduplicated

Scenario: Mid-Plan Failure Rollback (I4)
  ❌ NAIVE SYSTEM:     [FAIL] Orphan residue: Hotel remained booked ($120.00 charged) despite trip failure
  ✅ WARRANT GATEWAY:  [PASS] Clean residue: Hotel automatically compensated; $0 remaining residue

Scenario: Spend Cap Enforcement (I2)
  ❌ NAIVE SYSTEM:     [FAIL] Unchecked spend: Accepts plans of any cost without budget verification
  ✅ WARRANT GATEWAY:  [PASS] Strict minor-unit boundary: $800 plan blocked against $500 cap

========================================================
Scorecard Summary:
  Naive Unprotected Server:  0/3 Scenarios Passed (3 Vulnerabilities)
  Warrant Trust Gateway:     3/3 Scenarios Passed (Zero Vulnerabilities)
========================================================
```
