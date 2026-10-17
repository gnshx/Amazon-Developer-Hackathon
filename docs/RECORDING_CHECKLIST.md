# Warrant: 1-Page Video Recording Checklist (2:45 Target)

**Total Runtime:** 2 minutes 45 seconds (165s)  
**Resolution:** 1080p (1920×1080), 16:9  
**Audio Target:** 130–145 words per minute (Clear, steady voiceover)  
**Strict Safety Rules:**  
1. **Zero Real Trademarks:** Fictional services only (*Coastal Rail Express*, *Harbor Inn Hotel*).  
2. **Persistent Prototype Disclosure:** Ensure the header pill `Simulated Voice Prototype` and caption `[On-Screen: "Simulated Alexa+ Assistant Interface — Warrant Gateway MCP"]` remain clearly visible.  
3. **Pre-record & Cut Terminal Takes:** Run `npm run test:siege` and `npm run test:mutation` separately in full-screen terminal recordings, then splice them into Scene 4.

---

## Pre-Flight Setup Checklist
- [ ] Reset database: `rm -f warrant.sqlite`
- [ ] Start services in background terminal: `npm run dev`
- [ ] Browser window 1 (`http://localhost:3000`): Full 1080p width with dark mode enabled.
- [ ] Terminal window 2: 80×24 or 120×30 characters, clean font (JetBrains Mono / Menlo), high contrast.
- [ ] Audio input checked: No room echo, microphone gain adjusted to -6dB.
- [ ] **Audio Narration Mode (Prevent Audio Collision):** In the Alexa+ client header, click the toggle to set `🔇 Voice: MUTED (Narration Mode)`. The visual waveform and pulsing voice orb remain fully animated on camera when Alexa speaks, but silent in browser audio so your spoken voiceover narration never collides with Web Speech playback. (Or, if you prefer audible Alexa output, record browser audio and mic on separate tracks in OBS and duck the assistant under your narration).

---

## Scene-by-Scene Shot List

```
0:00 ──[ Hook ]── 0:12 ──[ Happy Path ]── 1:00 ──[ Rollback ]── 1:35 ──[ Proof & Mutation ]── 2:15 ──[ Close ]── 2:35 ──[ Roadmap ]── 2:45
```

### Scene 1: The Hook (0:00 – 0:12 | 12s | 25 Words)
- **Framing:** Full screen browser showing the Alexa+ Client UI header.
- **On-Screen Pill Visible:** `Simulated Voice Prototype` (cyan badge next to title).
- **On-Screen Subtitle / Lower-Third:**  
  `Simulated Alexa+ Assistant Interface — Warrant Gateway MCP`
- **Voiceover (125 WPM):**
  > *"Voice assistants are starting to book and buy for us, with no screen to check first. Warrant makes every action limited, approved, and undoable."*

---

### Scene 2: The Happy Path & Bound Approvals (0:12 – 1:00 | 48s | 82 Words)
- **Framing:** Split screen — Left: Voice Assistant chat & tool trace; Right: Household Phone card.
- **Screen Actions:**
  1. **0:12 – 0:22:** Click prompt or speak: *"Book me a weekend trip from Portland to Seattle with a hotel under $200."*  
     Live trace immediately displays `search_trains`, `search_hotels`, and `propose_plan`.
  2. **0:22 – 0:34:** Phone Approval Card slides in:
     - Harbor Inn Hotel: 2 nights, \$120.00.
     - **Canonical Hash:** `ba39...395c` displayed in monospace (computed dynamically via Web Crypto SHA-256 over RFC 8785 canonical JSON).
     - *Pro-Tip for Video:* Highlight the hash on camera; notice that altering any parameter instantly alters this cryptographic fingerprint, which is why approval tampering fails in S4.
  3. **0:34 – 0:42:** Tap **Approve**. Booking commits. Alexa announces summary via Web Speech audio & wave:  
     *“Your train and hotel in Seattle are booked for $165.00 total.”*
  4. **0:42 – 1:00:** Click **View Signed Receipt** to reveal detached Ed25519 signature verified offline. Meanwhile, the 8-second undo grace hold countdown animates silently on screen.
- **Voiceover (102 WPM — relaxed & crisp):**
  > *"When Alexa proposes the trip, Warrant evaluates risk before anything touches a provider. The train is a reversible step, but the hotel is a high-value commitment. On the phone, the approval card locks to the exact parameters with an RFC 8785 canonical hash. With the user’s tap, Warrant mints a single-use token, commits the booking, and produces an Ed25519 signed action receipt verified offline. Alexa confirms: Seattle train and hotel confirmed for $165."*

---

### Scene 3: Mid-Plan Failure & Automatic Rollback (1:00 – 1:35 | 35s | 78 Words)
- **Framing:** Browser view focusing on the Saga Orchestrator Canvas & Fault Injection control.
- **Screen Actions:**
  1. **1:00 – 1:12:** In Fault Injection panel, toggle Coastal Rail Express to `DECLINE` (sold out). Trigger trip request.
  2. **1:12 – 1:24:** Step 1 (Hotel) books. Step 2 (Train) declines.  
     Saga Orchestrator automatically halts forward progress and dispatches `cancel_hotel`.
  3. **1:24 – 1:35:** Screen displays: *"Nothing charged, no bookings left."*  
     Alexa announces cancellation. On the Audit tab, click **Verify Chain** button: green checkmark appears confirming SHA-256 chain continuity.
- **Voiceover (134 WPM):**
  > *"Now let’s simulate real-world failure. The hotel reservation succeeds, but the train declines due to sold-out seats. Instead of stranding the user with an orphaned hotel room, Warrant’s saga orchestrator immediately halts forward execution and triggers an automatic reverse compensation. The hotel is cancelled at the mock provider with zero residue, no money is charged, and Alexa announces the rollback plainly. The SHA-256 audit timeline records every transition from start to finish."*

---

### Scene 4: Adversarial Proof & Mutation Moment (1:35 – 2:15 | 40s | 92 Words)
- **Framing:** Full-screen clean Terminal window.
- **Screen Actions (Pre-recorded & Spliced):**
  1. **1:35 – 1:52:** Run `npm run test:siege`.  
     Terminal streams 10 scenarios ($S_1 - S_{10}$) executing over real HTTP: **10 passed, 0 failed**.
  2. **1:52 – 2:15:** Run `npm run test:mutation`.  
     Harness intentionally disables approval verification: **Scenario S4 turns RED!**  
     Harness restores protection: scorecard returns to 100% green.
- **Voiceover (138 WPM):**
  > *"A safety gateway is only as trustworthy as the tests that attack it. We run our adversarial test harness with npm run test:siege. It executes all 10 attack scenarios over real HTTP: concurrency storms, prompt injections, and expired grants. All 10 pass green. But can the harness actually catch a real security flaw? We run npm run test:mutation. We deliberately disable the approval-hash check. Instantly, scenario S4 turns red, catching the parameter tampering. We restore the check, and the scorecard returns to 100% green."*

---

### Scene 5: Scorecard & Open Source Deliverables (2:15 – 2:35 | 20s | 52 Words)
- **Framing:** Browser showing generated `scorecard.html` side-by-side with the GitHub repository.
- **Screen Actions:** Scroll through the interactive scorecard table, invariant badges, and GitHub file tree.
- **Voiceover (156 WPM):**
  > *"Warrant generates a complete HTML scorecard, audit trail proofs, and a reusable CI workflow. The entire project is open source under Apache 2.0. The test harness package is modular and ready for any team building MCP agent tools to verify their safety before putting an agent in front of customers."*

---

### Scene 6: Roadmap (Future Work) (2:35 – 2:45 | 10s | 27 Words)
- **Framing:** Single clean graphic slide titled **"Roadmap: Future Work"**:
  1. **Attenuated Capability Tokens:** Macaroons / Biscuits for multi-agent delegation
  2. **Public Transparency Logs:** Merkle tree signed roots across independent brands
  3. **Biometric Passkey Step-Up:** Approvals bound to the device's secure hardware
- **Voiceover (162 WPM):**
  > *"Beyond the hackathon, we are expanding Warrant into universal trust infrastructure: capability tokens for sub-agent delegation, public transparency logs, and hardware-secured biometric passkeys. That is Warrant."*

---

## Post-Recording Verification
- [ ] Total video duration is between **2:40 and 2:50** (strictly under 3:00).
- [ ] No real-world brand names appear in chat, phone cards, or terminal logs.
- [ ] `Simulated Voice Prototype` header pill is visible in all UI footage.
- [ ] Export audio at 48kHz, video at 1080p MP4 (H.264), upload as Unlisted on YouTube.
