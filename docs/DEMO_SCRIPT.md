# Warrant: Official Demo Video Script (2:45 Target)

**Target Runtime:** 2 minutes 45 seconds (165 seconds)  
**Track:** Amazon Developer Hackathon, Alexa+ Track  
**Pacing:** Natural, confident speech (130–145 words per minute)  
**Total Word Count:** 379 words  
**Key Deliverables Demonstrated:** Simulated Alexa+ Client UI, Phone Approval Card, Cryptographic Hash Binding, Saga Compensation Rollback, Adversarial Siege Suite (`npm run test:siege`), Live Mutation Test ("break and fix"), Ed25519 Receipts, and Merkle Audit Chain.

---

## Video Scene Breakdown

```
0:00 ──[ Hook ]── 0:12 ──[ Happy Path ]── 1:00 ──[ Rollback ]── 1:35 ──[ Proof & Mutation ]── 2:15 ──[ Close ]── 2:35 ──[ Roadmap ]── 2:45
```

---

### Scene 1: The Hook (0:00 – 0:12)
- **Duration:** 12 seconds
- **Word Count:** 25 words (125 WPM)
- **On-Screen Display:** Split screen or title overlay with persistent badge:  
  `[On-Screen: "Simulated Alexa+ Assistant Interface — Warrant Gateway MCP"]`
- **Voiceover:**
  > "Voice assistants are starting to book and buy for us, with no screen to check first. Warrant makes every action limited, approved, and undoable."

---

### Scene 2: The Happy Path & Approval Binding (0:12 – 1:00)
- **Duration:** 48 seconds
- **Word Count:** 105 words (131 WPM)
- **Visual:** Simulated Alexa+ Client UI (dark mode, glassmorphism). User speaks or types:  
  *“Book me a weekend trip from Portland to Seattle with a hotel under $200.”*
- **Screen Action:**
  1. Live MCP trace shows Bedrock agent discovering tools and calling `propose_plan`.
  2. Policy engine flags Coastal Rail as reversible write ($T_1$) and Harbor Inn Hotel as high-value commitment ($T_2$).
  3. Phone approval card slides in showing:
     - Exact hotel parameters: Harbor Inn, 2 nights, \$120.00.
     - Parameter Hash: `SHA-256: a7f9...4c21`.
  4. User taps **Approve**. Single-use approval token is minted.
  5. Gateway validates token and parameter hash, commits booking, and Alexa speaks natural summary:  
     *“Your train and hotel in Seattle are booked for $165.00 total.”*
  6. Click **View Signed Receipt**: shows detached Ed25519 signature verified offline.
  7. Show **Undo Window** badge with 8-second grace hold countdown.
- **Voiceover:**
  > "When Alexa proposes the trip, Warrant evaluates risk before anything touches a provider. The train is a reversible step, but the hotel is a high-value commitment. On the phone, the approval card locks to the exact parameters with an RFC 8785 canonical hash. If anything changes after approval, it stops. With the user’s tap, Warrant mints a single-use token, executes the booking, and Alexa gives a concise spoken summary: Seattle train and hotel confirmed for $165. We can inspect the Ed25519 signed action receipt right in the client, and even test the 8-second grace hold undo window."

---

### Scene 3: Failure & Automatic Saga Rollback (1:00 – 1:35)
- **Duration:** 35 seconds
- **Word Count:** 78 words (134 WPM)
- **Visual:** Provider Control panel: Mock Train service set to `DECLINE` (sold out inventory).
- **Screen Action:**
  1. User triggers multi-step trip booking.
  2. Step 1 (Hotel) books successfully.
  3. Step 2 (Train) declines.
  4. Warrant Saga Orchestrator immediately intercepts the failure:
     - Halts forward execution.
     - Issues automatic reverse compensation: `cancel_hotel(booking_id)`.
     - Mock Hotel database transitions to `CANCELLED`.
  5. Client displays: *"Nothing charged, no bookings left."*
  6. Alexa speaks: *"Your train could not be booked, so your hotel reservation was automatically cancelled at no charge."*
  7. Audit tab displays SHA-256 event transitions from genesis. Click **Verify Chain** button (or show CLI `npm run audit:verify`): green checkmark.
- **Voiceover:**
  > "Now let’s simulate real-world failure. The hotel reservation succeeds, but the train declines due to sold-out seats. Instead of stranding the user with an orphaned hotel room, Warrant’s saga orchestrator immediately halts forward execution and triggers an automatic reverse compensation. The hotel is cancelled at the mock provider with zero residue, no money is charged, and Alexa announces the rollback plainly. The SHA-256 audit timeline records every transition from start to finish."

---

### Scene 4: Adversarial Proof & The Mutation Moment (1:35 – 2:15)
- **Duration:** 40 seconds
- **Word Count:** 92 words (138 WPM)
- **Visual:** Terminal window running `npm run test:siege`, then `npm run test:mutation`.
- **Screen Action:**
  1. Terminal runs: `npm run test:siege`  
     Output streams all 10 adversarial attack scenarios (duplicate storms, spend cap breaches, parameter tampering, prompt injection, expired grants, ambiguous timeouts).  
     Scorecard: **10 passed, 0 failed**.
  2. Terminal runs: `npm run test:mutation`  
     - Harness intentionally mutates the gateway: disables approval hash verification.
     - **Mutation Detected! Scenario S4 turns RED!** Showing that tampered parameters fail verification when protection is active.
     - Harness restores protection, and tests return to green.
- **Voiceover:**
  > "A safety gateway is only as trustworthy as the tests that attack it. We run our adversarial test harness with npm run test:siege. It executes all 10 attack scenarios over real HTTP: concurrency storms, prompt injections, and expired grants. All 10 pass green. But can the harness actually catch a real security flaw? We run npm run test:mutation. We deliberately disable the approval-hash check. Instantly, scenario S4 turns red, catching the parameter tampering. We restore the check, and the scorecard returns to 100% green."

---

### Scene 5: Scorecard & Open Source Deliverables (2:15 – 2:35)
- **Duration:** 20 seconds
- **Word Count:** 52 words (156 WPM)
- **Visual:** Browser opens generated `scorecard.html` with green badges, SVG badge, and GitHub repository.
- **Screen Action:** Show interactive scorecard table, invariant mapping ($I_1 - I_{10}$), and GitHub repo tree.
- **Voiceover:**
  > "Warrant generates a complete HTML scorecard, audit trail proofs, and a reusable CI workflow. The entire project is open source under Apache 2.0. The test harness package is modular and ready for any team building MCP agent tools to verify their safety before putting an agent in front of customers."

---

### Scene 6: Roadmap (Future Work) (2:35 – 2:45)
- **Duration:** 10 seconds
- **Word Count:** 27 words (162 WPM)
- **Visual:** One clean slide labeled **"Roadmap: Future Work"**:
  1. **Attenuated Capability Tokens:** Macaroons / Biscuits for agent-to-agent delegation
  2. **Public Transparency Logs:** Merkle tree signed roots across independent brands
  3. **Biometric Passkey Enclaves:** Approvals signed in the device's secure hardware
- **Voiceover:**
  > "Beyond the hackathon, we are expanding Warrant into universal trust infrastructure: capability tokens for sub-agent delegation, public transparency logs, and hardware-secured biometric passkeys. That is Warrant."

---

## Speaker Pace & Word Budget Summary

| Scene | Timestamp | Duration | Budgeted Words | Actual Words | Pacing (WPM) | Status |
|---|---|---|---|---|---|---|
| **Scene 1 (Hook)** | 0:00 – 0:12 | 12s | 25 – 30 | 25 | 125 | ✅ Ideal |
| **Scene 2 (Happy Path)** | 0:12 – 1:00 | 48s | 100 – 115 | 105 | 131 | ✅ Comfortable |
| **Scene 3 (Rollback)** | 1:00 – 1:35 | 35s | 75 – 85 | 78 | 134 | ✅ Comfortable |
| **Scene 4 (Proof & Mutation)**| 1:35 – 2:15 | 40s | 90 – 100 | 92 | 138 | ✅ High-energy |
| **Scene 5 (Close)** | 2:15 – 2:35 | 20s | 45 – 55 | 52 | 156 | ✅ Crisp |
| **Scene 6 (Roadmap)** | 2:35 – 2:45 | 10s | 25 – 30 | 27 | 162 | ✅ Punchy |
| **Total** | **0:00 – 2:45** | **165s** | **360 – 415** | **379** | **138 avg** | **Strictly under 3:00 limit** |
