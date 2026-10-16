# Warrant: Official Demo Video Script (Under 3:00 Minutes)

**Target Runtime:** 2 minutes 50 seconds  
**Track:** Amazon Developer Hackathon, Alexa+ Track  
**Pacing:** Fast, technical, high-density, zero fluff  

---

## Timeline & Scene Breakdown

### Scene 1: The Problem (0:00 – 0:20)
- **Visual:** Split screen. Left: Voice assistant listening waveform. Right: Bank notification showing unexpected charges.
- **Voiceover:**
  > "Voice assistants are getting agency to act for us: book flights, buy tickets, reserve tables. But voice has no screen to review what is about to happen. One hallucination, prompt injection, or retry storm can double-book, drain a bank account, or leave a half-finished mess. Brands exposing tools to voice assistants have no standard way to make actions safe and auditable. That's why we built **Warrant**."

### Scene 2: Happy Path, Approval Binding & Audit Chain (0:20 – 1:10)
- **Visual:** Simulated Alexa+ client UI (dark mode, glassmorphism). User speaks or types: *"Book me a weekend trip from Portland to Seattle with a hotel under $200."*
- **Screen Action:**
  1. Bedrock agent calls `search_trains` and `search_hotels` via MCP Streamable HTTP.
  2. Agent calls `propose_plan`.
  3. Warrant Gateway Policy Engine classifies Coastal Rail as $T_1$ (reversible write within budget) and Harbor Inn Hotel as $T_2$ (high-value commitment).
  4. Phone approval card pops up on mobile view showing:
     - Exact hotel name, nights, and cost ($120.00).
     - **RFC 8785 Canonical Hash:** `a7f9...4c21`.
  5. User taps **Approve**. Single-use approval token is minted.
  6. Agent dispatches `execute_plan`. Gateway recomputes parameter hash, validates match, and commits the booking.
  7. Alexa speaks natural summary ($\le 300$ chars): *"Your train and hotel in Seattle are booked for $165.00 total."*
  8. Click **View Signed Receipt ($I_9$)**: Modal displays detached Ed25519 signature, canonical parameter hash, and validates offline.
  9. Click **Undo Window Demo ($I_{10}$)**: Shows animated 8-second grace hold countdown with a real-time **Cancel Booking** button that halts execution with zero provider charges.
  10. Click **Verify Audit Chain**: Cryptographic SHA-256 chain and Merkle root checkpoint validate green from genesis.
- **Voiceover:**
  > "Notice the approval: it’s cryptographically bound to the RFC 8785 canonical hash of the exact parameters. Even after completion, each action produces a detached Ed25519 signed receipt verifiable offline. Plus, high-value actions support configurable undo windows before provider settlement."

### Scene 3: Mid-Plan Failure & Automatic Rollback (1:10 – 1:50)
- **Visual:** Fault injection toggle enabled: Mock Train service set to `DECLINE`.
- **Screen Action:**
  1. User requests a trip with hotel and train.
  2. Step 1 (Hotel) books successfully.
  3. Step 2 (Train) declines due to sold-out inventory.
  4. **Warrant Saga Orchestrator** intervenes:
     - Halts forward progress immediately.
     - Automatically invokes `cancel_hotel(booking_id)` in reverse order.
     - Mock Hotel database updates to `CANCELLED`.
  5. Assistant speaks plainly: *"Your train could not be booked, so your hotel reservation was automatically cancelled at no charge."*
  6. Audit timeline records: `ACTION_SUCCEEDED` $\to$ `ACTION_FAILED` $\to$ `SAGA_COMPENSATION_SUCCEEDED`. Zero residue left on providers.

### Scene 4: Adversarial Attack Suite (`warrant-siege`) (1:50 – 2:30)
- **Visual:** Terminal window running `npx warrant-siege`.
- **Screen Action:**
  - Siege harness executes all 10 adversarial scenarios against the gateway:
    1. **S1: Duplicate Submit Storm:** 10 concurrent requests; exactly 1 external booking created ($I_1$).
    2. **S2: Mid-Plan Failure:** Automatic saga rollback leaves zero orphan state ($I_4$).
    3. **S3: Spend Over Cap:** Propose plan exceeding grant limit; immediate `DENY` ($I_2$).
    4. **S4: Parameter Tampering:** Mutate price after approval; approval hash mismatch halts execution ($I_3$).
    5. **S5: Injected Instruction:** Jailbreak inside provider description flagged and isolated; grant unmodified ($I_5$).
    6. **S6: Expired Grant:** Tool invocation after grant timestamp rejected with 403 ($I_6$).
    7. **S7: Unapproved T2 Action:** Bypass attempt blocked by policy engine ($I_3$).
    8. **S8: Ambiguous Timeout:** Succeeded-but-lost connection resolved by idempotency inquiry, never retried blindly ($I_8$).
    9. **S9: Receipt Tampering Attack:** Mutated spend amount rejected by Ed25519 offline verifier ($I_9$).
    10. **S10: Grace-Hold Cancellation:** Abort action during undo hold; zero bookings created ($I_{10}$).

### Scene 5: Scorecard & Open Source Deliverables (2:30 – 2:50)
- **Visual:** Generated `scorecard.html` opening in browser. All 10 scenarios displayed with green badges, execution durations, Merkle tree root checkpoints, and SHA-256 audit proof.
- **Voiceover:**
  > "Warrant is open source under Apache 2.0, and Warrant Siege is published as a standalone testing harness with a reusable GitHub Action so any brand building MCP tools can verify their safety. Scoped grants, bound approvals, automatic rollbacks, and proof you can verify."

### Scene 6: The Roadmap Ahead (Future Work) (2:50 – 3:00)
- **Visual:** Clean slide labeled **"Roadmap (Future Work)"** highlighting:
  1. Signed Action Receipts with Transparency Logs
  2. Attenuated Capability Tokens for Agent-to-Agent Delegation
  3. Ecosystem Certification Built on the Harness
- **Voiceover:**
  > "Looking ahead beyond the hackathon, we're expanding Warrant into open trust infrastructure: cryptographically signed receipts anchored to a transparency log, capability tokens for agent-to-agent delegation, and safety certification badges for every MCP server. That is Warrant."

