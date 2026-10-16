# Task Plan: Warrant Implementation & Hackathon Execution

## Goal
Build and deliver Warrant (a provably safe trust gateway for voice agents over MCP Streamable HTTP, with saga rollback, cryptographic approval binding, and adversarial siege test harness) for the Amazon Developer Hackathon (Alexa+ Track) by 23 October 2026.

## Current Phase
Phase 7: Precision Hardening & High-Impact Extensions (Workstream F)

## Feature Triage & Gate Plan (Oct 17 – Oct 23)

| Feature | Effort | Demo Impact | Risk | Verdict | Target Date |
|---|---|---|---|---|---|
| Mutation Test Script (`npm run test:mutation`) | ~0.5d | High (proves red scorecard on defect) | Low | **DONE** | Oct 17 |
| Fictional Provider Names (Coastal Rail / Harbor Inn) | ~0.2d | High (zero trademark risk) | Low | **DONE** | Oct 17 |
| Turnkey Siege Runner (Auto-spawn ephemeral gateway) | ~0.2d | High (clean machine execution) | Low | **DONE** | Oct 17 |
| Signed Action Receipts + CLI Verify + UI Inspector | ~1d | High (independent 3rd-party proof) | Low | **DONE** | Oct 18 |
| Undo Window (Grace countdown before settlement + S10) | ~1d | High (visual and intuitive) | Med | **DONE** | Oct 19 |
| Reusable CI GitHub Action + Pass/Fail Badge | ~0.5d | Med (ecosystem adoption) | Low | **DONE** | Oct 20 |
| Merkle Checkpoints on Audit Chain | ~1d | Med | Med | **DONE** | Oct 21 |
| Passkey (WebAuthn) Approvals | 1-2d | High | High | **ROADMAP** | Post-Hackathon |
| Capability Tokens (Macaroons) / Policy as Code | 2+d | High on paper | High | **ROADMAP** | Post-Hackathon |

---

## Detailed Step-by-Step Schedule

### Milestone 1: Baseline Verification & Clean Hygiene (Oct 17)
- [x] Replace trademarked brand names with fictional services across client UI and transcripts
- [x] Build automated mutation test script (`scripts/test-mutation.ts` / `npm run test:mutation`)
- [x] Enable turnkey auto-spawn in `warrant-siege` for clean-machine test runs
- [x] Fix Dockerfile multi-package workspace copies for clean `npm ci`
- [x] Document real Bedrock Converse API invocation vs. offline testing fallback
- **Status:** completed

### Milestone 2: Signed Action Receipts & Offline Verification (Oct 18)
- [x] Implement Ed25519 keypair generation and receipt signing in Gateway on completed actions
- [x] Add receipt verification CLI: `npm run receipt:verify` / `warrant-verify`
- [x] Add "Verify Receipt" inspector and modal to Alexa client UI
- [x] Add Attack Scenario S9 (Forged / Altered Receipt Rejection) to `warrant-siege`
- [x] Verify Gate: all unit tests passing, S1–S9 passing green, fresh-clone <15s
- **Status:** completed

### Milestone 3: Undo Window & Reversible Hold (Oct 19)
- [x] Implement configurable grace countdown (e.g. 8-second hold) before irreversible dispatch
- [x] Add out-of-band cancellation endpoint (`POST /admin/plans/:id/undo`)
- [x] Add visual Undo countdown bar and "Cancel Booking" button in Alexa client UI
- [x] Add Attack Scenario S10 (Cancelled Action Never Reaches Downstream Provider)
- [x] Verify Gate: all unit tests passing, S1–S10 passing green, clean compensation check
- **Status:** completed

### Milestone 4: Standalone Packaging & CI GitHub Action (Oct 20)
- [x] Configure standalone package structure for `@warrant/siege` for separate OSS publishing
- [x] Create reusable GitHub Action workflow (`ci/workflows/warrant-siege.yml`, copyable to `.github/workflows/`)
- [x] Generate dynamic SVG/Markdown pass/fail badge for repository READMEs (`scorecard-badge.svg`)
- **Status:** completed

### Milestone 5: Stretch Feature & Feature Freeze (Oct 21)
- [x] Implement Merkle root checkpointing on audit chain tip with $O(\log N)$ inclusion proof verification
- [x] Expose Merkle endpoints (`GET /admin/audit/merkle-root`, `GET /admin/audit/merkle-proof/:seq`, `POST /admin/audit/merkle-verify`)
- [x] Integrate Merkle Root Checkpoint card into Audit tab in Alexa client UI
- [x] **HARD FEATURE FREEZE achieved:** Zero new architectural changes permitted; all 10 invariants satisfied
- **Status:** completed

### Milestone 6: Video Demo Recording & Production (Oct 22)
- [x] Calibrate demo script to exact 2:45 runtime with natural ~138 WPM comfortable speech (`docs/DEMO_SCRIPT.md`)
- [x] Add on-screen persistent prototype caption directive: `[On-Screen: "Simulated Alexa+ Assistant Interface — Warrant Gateway MCP"]`
- [x] Integrate high-impact mutation moment (disable approval hash -> S4 turns RED -> restore -> green)
- [ ] Record voiceover and export crisp 1080p MP4
- **Status:** in_progress (script & cues ready for recording)

### Milestone 7: Final Verification & Early Submission (Oct 23)
- [x] Complete comprehensive submission package in `docs/SUBMISSION.md`
- [x] Document required product feedback on all 5 SDKs (Bedrock, AWS SDK, MCP, Next.js, SQLite)
- [x] Complete developer friction log with 5 detailed real-world entries (eligible for 10% bonus)
- [x] Complete Open Source challenge fields and pre-hackathon non-existence confirmation
- [x] Execute fresh-clone verification and audit continuity checks
- [ ] Publish video and submit Devpost package before 23:59 IST
- **Status:** in_progress (all text & criteria ready for form submission)

## Key Questions
1. **Vertical selection:** Travel booking (hotel + train + dining) selected as the primary vertical because it naturally demonstrates high-value irreversible commitments, multi-step dependencies, and clear compensation semantics.
2. **Bedrock access:** AWS credentials will be supported via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`), with an offline deterministic agent simulator bundled for environments without active AWS credentials.
3. **Repository structure:** Monorepo with npm workspaces providing unified setup, with discrete packages (`packages/gateway`, `packages/siege`, `packages/alexa-client`) enabling separate open-source publishing.

## Decisions Made
| Decision | Rationale |
|---|---|
| RFC 8785 JSON Canonicalization | Prevents approval tampering through dictionary reordering or whitespace mutations |
| Out-of-band Admin API | Prevents agent or prompt injection from widening scopes or approving high-risk steps |
| Integer Minor Currency Units | Eliminates floating point rounding errors in financial transactions |
| SQLite WAL + Repository Interface | Zero-dependency rapid local development with seamless PostgreSQL compatibility |
| Streamable HTTP MCP Transport | Conforms to modern MCP standard (2025-11-25) suitable for low-latency voice gateways |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Sandbox not available with IDE command terminal | 1 | Enabled `BypassSandbox: true` for local terminal operations |

## Notes
- Update phase status as work progresses: `pending` → `in_progress` → `complete`.
- Re-read this plan before major architectural decisions.
- Maintain strict invariant enforcement ($I_1 - I_8$) across all components.
