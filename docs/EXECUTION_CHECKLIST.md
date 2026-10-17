# Warrant Hackathon Execution Tracker: Oct 17 – Oct 23, 2026

> **Target Deadline:** October 24, 2026 @ 12:30 AM IST (October 23, 2026 @ 19:00 UTC)  
> **Target Early Submission:** October 22, 2026 @ 20:00 IST (28+ hours buffer)  
> **Master Invariant Count:** 10/10 Invariants Satisfied ($I_1 - I_{10}$)  
> **Test Suite Count:** 64/64 Automated Checks Passing Green  

---

## Daily Schedule & Status Tracker

| Date | Phase & Focus | Status | Key Deliverable / Verification |
|---|---|---|---|
| **Oct 17** | **Remove the Risks** | 🟢 **DONE** | Bedrock scripts, MCP 2025-11-25 contract test, UI grant controls, standalone siege repo, fresh clone verified |
| **Oct 18** | **Make it Easy to Judge** | 🟢 **DONE** *(Early)* | `JUDGES.md`, limitations disclosures, STRIDE threat matrix, test summary table, offline evidence bundle |
| **Oct 19** | **Test it on a Person** | 🟡 **READY** | Blind-user walk-through of console & phone approval; core path frozen; passkeys parked in roadmap |
| **Oct 20** | **Build the Devpost Entry** | 🟡 **READY** | Devpost draft populated with copy-paste text, built-with tags, gallery canvas screens, repo URLs |
| **Oct 21** | **Record Video Demo** | ⚪ **SCHEDULED** | 2:45 runtime, separate audio voiceover, burned-in captions, simulated caption, mutation moment |
| **Oct 22** | **Submit to Devpost** | ⚪ **SCHEDULED** | Complete submission, public link test in incognito, remote GitHub fresh clone re-check |
| **Oct 23** | **Buffer Only** | ⚪ **SCHEDULED** | Strict freeze: zero code changes; emergency bugfixes only prior to 12:30 AM IST deadline |

---

## Detailed 13-Step Master Checklist

### Day 1: Oct 17 (Remove the Risks) — *Completed*

- [x] **Step 1: Run Bedrock Live Check & Converse Test**
  - **Tooling:** [`scripts/check-bedrock-lifecycle.ts`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/scripts/check-bedrock-lifecycle.ts), [`scripts/test-bedrock-live.ts`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/scripts/test-bedrock-live.ts)
  - **Commands:** `npm run check:bedrock-models`, `npm run test:bedrock`
  - **Evidence:** Real-world model lifecycle documented in [`findings.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/findings.md); offline deterministic fallback active when AWS credentials are absent.
  - **Status:** `DONE`

- [x] **Step 2: Confirm MCP Protocol Version Negotiation (2025-11-25)**
  - **Tooling:** [`packages/warrant-gateway/src/mcp/server.test.ts`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/warrant-gateway/src/mcp/server.test.ts)
  - **Command:** `npm --workspace=packages/warrant-gateway test`
  - **Evidence:** Verified both `GET /mcp` Streamable HTTP headers and `POST /mcp` `initialize` handshake negotiate `protocolVersion: "2025-11-25"`.
  - **Status:** `DONE`

- [x] **Step 3: Check UI Sets the Grant (Screen 5: "Your Limits")**
  - **Tooling:** [`packages/alexa-client/src/app/page.tsx`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/alexa-client/src/app/page.tsx)
  - **Evidence:** Interactive selector chips for budget (`$300-$800`), approval threshold (`$100-$250`), scopes, expiry (`1h-24h`), and undo window (`5s-15s`). Live "Save limits" updates the Assistant Console budget bar.
  - **Status:** `DONE`

- [x] **Step 4: Push Siege Harness to Standalone Public Repo**
  - **Repository:** [`https://github.com/gnshx/warrant-siege.git`](https://github.com/gnshx/warrant-siege.git)
  - **Verification:** Cloned alone in `/tmp/siege-standalone-test` and executed `npx tsx src/cli.ts --target <URL>` against external gateway with 11/11 scenarios green.
  - **Status:** `DONE`

- [x] **Step 5: Clone Main Repo Fresh from GitHub & Run Documented Path**
  - **Repository:** [`https://github.com/gnshx/Amazon-Developer-Hackathon.git`](https://github.com/gnshx/Amazon-Developer-Hackathon.git)
  - **Verification:** Fresh clone into `/tmp/fresh-clone-eval` passed `npm run verify:evidence`, `npm run test:siege` (11/11), and `npm run test:mutation` (3/3) in <16 seconds.
  - **Status:** `DONE`

---

### Day 2: Oct 18 (Make it Easy to Judge) — *Completed Early*

- [x] **Step 6: Add Root `JUDGES.md`, Disclosures, Threat Matrix & Test Summary**
  - **Artifacts:** [`JUDGES.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/JUDGES.md), [`README.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/README.md), [`docs/SUBMISSION.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/SUBMISSION.md), [`examples/evidence/`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/examples/evidence/)
  - **60-Second Command:** `npm run verify:evidence` (verifies scorecard, Ed25519 receipt, and audit chain without starting servers)
  - **Threat Matrix:** STRIDE mapping across all 10 invariants and scenarios S1–S10.
  - **Limitations & Disclosures:** 7 explicit disclosures published.
  - **Status:** `DONE`

- [x] **Step 7: Rewrite Product Feedback & Developer Friction Log**
  - **Artifacts:** [`docs/SUBMISSION.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/SUBMISSION.md), [`docs/FRICTION_LOG.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/FRICTION_LOG.md)
  - **Entries:** 5 authentic entries covering Bedrock Converse streaming chunk schema differences, MCP session state persistence, SQLite WASM / native driver cross-compilation, Next.js hydration, and AWS auth resolution.
  - **Status:** `DONE`

- [x] **Step 8: Draft Feature Requests for the Alexa Team**
  - **Artifact:** [`docs/SUBMISSION.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/SUBMISSION.md)
  - **Requests:** FR-1 (Critical: Native Companion Out-of-Band Step-Up Approval), FR-2 (Important: MCP semantic annotations in Bedrock Converse), FR-3 (Important: Enforced Spoken Summary $\le 300$ chars), FR-4 (Nice-to-have: Cross-region inference profile auto-resolution).
  - **Status:** `DONE`

---

### Day 3: Oct 19 (Test it on a Person) — *Ready for Execution*

- [ ] **Step 9: Blind User Test of Demo Path**
  - **Protocol:**
    1. Show a colleague the Alexa+ Assistant interface ([Screen 1](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/alexa-client/src/app/page.tsx)).
    2. Prompt them to speak or trigger: *"Book the Harbor Inn and 9am Coastal Rail for my Chicago trip."*
    3. Observe if they notice:
       - The plain-language "What Warrant is Doing" action tracker.
       - The Step-Up Approval prompt on the phone ([Screen 2](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/alexa-client/src/app/page.tsx)).
       - The canonical parameter hash lock.
       - The 8-second undo grace window before dispatch.
    4. Note points of confusion; refine UI microcopy only.
  - **Rule:** **Core path frozen.** Do NOT implement passkeys (WebAuthn) or complex new features.
  - **Status:** `READY`

---

### Day 4: Oct 20 (Build the Devpost Entry) — *Ready for Copy-Paste*

- [ ] **Step 10: Create Devpost Project & Populate All Required Fields**
  - **Checklist:**
    - [ ] Project Title: `Warrant: Trust Gateway for Alexa+ Voice Agents`
    - [ ] Short Tagline: `An open-source MCP trust gateway that turns voice assistants from leaky planners into bounded, provably safe actors with cryptographic approval binding and saga rollback.`
    - [ ] Built With Tags: `amazon-bedrock`, `model-context-protocol`, `next.js`, `typescript`, `sqlite`, `ed25519`, `rfc8785`
    - [ ] Track Selection: Alexa+ Track
    - [ ] Mini Challenges:
      - [ ] AWS Builder Mini Challenge (Amazon Bedrock Converse integration + developer feedback)
      - [ ] Open Source Mini Challenge (Standalone `@warrant/siege` test harness repo)
    - [ ] Public GitHub Repos:
      - Main Repo: `https://github.com/gnshx/Amazon-Developer-Hackathon`
      - Siege Harness Repo: `https://github.com/gnshx/warrant-siege`
    - [ ] Gallery Media: Upload 5 rendered canvas boards from `scripts/render-canvas-boards.ts` / artifacts.
    - [ ] Test every link in an incognito/private browser window.
  - **Status:** `READY`

---

### Day 5: Oct 21 (Record Video Demo) — *Script & Cues Frozen*

- [ ] **Step 11: Record, Voiceover, Caption, and Verify Runtime (<3:00)**
  - **Checklist from [`docs/RECORDING_CHECKLIST.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/RECORDING_CHECKLIST.md):**
    - [ ] Runtime target: **2:45** (hard cutoff at 2:59).
    - [ ] Audio: Narrator voice and Assistant voice recorded on clean, isolated audio tracks.
    - [ ] Captions: Burned-in subtitles for both voice lines.
    - [ ] Prototype Disclosure: Persistent caption `[Simulated Alexa+ Assistant Interface — Warrant Gateway MCP]` visible.
    - [ ] **First 30 Seconds:** Voice prompt spoken, plan assembled, budget check displayed.
    - [ ] **Mutation Moment (1:45 - 2:05):** Run `npm run test:mutation`; show S1 & S4 turn RED, then restore to green.
    - [ ] Audio check: Zero copyrighted background music.
    - [ ] Upload to YouTube / Vimeo as Unlisted or Public (1080p).
  - **Status:** `SCHEDULED`

---

### Day 6: Oct 22 (Submit to Devpost) — *Buffer Window Target*

- [ ] **Step 12: Complete Official Submission & Fresh Clone Verification**
  - **Target Time:** 20:00 IST on Oct 22 (28+ hours before deadline).
  - **Verification:**
    - [ ] Submit Devpost form.
    - [ ] Verify video URL plays smoothly without login.
    - [ ] Verify GitHub repositories are Public and accessible.
    - [ ] Re-run clean clone path on external workstation or container:
      ```bash
      git clone https://github.com/gnshx/Amazon-Developer-Hackathon.git
      cd Amazon-Developer-Hackathon
      npm install
      npm run verify:evidence
      npm run test:siege
      ```
  - **Status:** `SCHEDULED`

---

### Day 7: Oct 23 (Buffer Only) — *Strict Freeze*

- [ ] **Step 13: Buffer & Zero Architectural Changes**
  - **Deadline:** Oct 24, 2026 @ 12:30 AM IST (Oct 23 @ 19:00 UTC).
  - **Policy:** **FIXES ONLY.** Zero new features, zero refactoring.
  - **Status:** `SCHEDULED`

---

## The 4 High-Impact Evaluation Anchors

1. **First 30 Seconds Product Demo:** The video immediately shows Alexa+ planning a Chicago trip over MCP Streamable HTTP, displaying real-time constraints and asking for approval.
2. **The Mutation Moment:** Injected defect disables approval hash binding; Scenario S4 immediately turns RED, proving the harness is active and adversarial, not a mock test.
3. **Every Claim Holds Up:** No marketing exaggerations; SQLite single-instance, simulated providers, and simulated Alexa+ client are honestly disclosed in [`JUDGES.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/JUDGES.md) and [`README.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/README.md).
4. **Mini Challenge Alignment:**
   - **AWS Builder Challenge:** Live Bedrock script, Nova Pro configuration, Converse API tool calling, and 5 detailed developer feedback entries.
   - **Open Source Challenge:** Standalone `warrant-siege` repository with reusable GitHub Action, dynamic SVG badge, and zero-dependency CLI runner.
