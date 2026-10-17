# Warrant: Master Execution Plan & Hackathon Roadmap

**Hackathon:** Amazon Developer Hackathon (Alexa+ Track)  
**Submission Cutoff:** 23 October 2026, 11:59 PM IST (Official deadline: 24 Oct, 12:30 AM IST)  
**Working Window:** 16 October 2026 – 23 October 2026 (8 Days)  
**Project Lead / Orchestration:** Antigravity AI Loop Engineer  

---

## 1. Executive Strategy & Deliverable Architecture

Warrant delivers a provably safe trust gateway for voice assistants interacting with real-world transactional APIs. The project comprises three distinct software packages, a simulated Bedrock agent environment, an adversarial siege test suite, and submission assets:

```
warrant-workspace/
├── packages/
│   ├── warrant-gateway/     # Core MCP Streamable HTTP gateway, policy, saga, audit, mock providers
│   ├── warrant-siege/       # Standalone open-source adversarial test harness and scorecard generator
│   └── alexa-client/        # Simulated Alexa+ client (Next.js 14) + Bedrock Converse agent runner
├── docs/                    # PRD, HLD, Test Plan, Friction Log, Devpost text, Architecture diagrams
├── AGENTS.md                # Agent constitution, commands, invariants, and /goal loop contracts
├── PLAN.md                  # This master execution roadmap
└── docker-compose.yml       # One-command orchestration for entire stack
```

---

## 2. Invariant & Traceability Matrix

Every requirement and user story is tied to an automated invariant test in the adversarial harness:

| Invariant | Name | Functional Req | User Story | Attack Scenario | Verification Check |
|---|---|---|---|---|---|
| **$I_1$** | No Duplicate External Effect | FR-6 | US-5 | S1, S8 | Provider mock reports exactly 1 booking across 10 concurrent requests; same idempotency key returns cached response. |
| **$I_2$** | Absolute Spend Cap | FR-4 | US-1 | S3 | Spend cap in minor units strictly bounds total executed actions. Overscheduled plans are blocked at proposal or execution. |
| **$I_3$** | Cryptographic Approval Binding | FR-5 | US-3 | S4, S7 | Approvals strictly bind to $\text{SHA-256}(\text{RFC8785Canonical}(\text{args}))$. Modifying args or executing unapproved $T_2$ yields immediate rejection. |
| **$I_4$** | Clean Residue (Saga Rollback) | FR-7 | US-4 | S2 | Mid-plan failure triggers automatic reverse compensation. Provider bookings are cancelled, restoring initial state. |
| **$I_5$** | Structural Output Containment | FR-8 | US-1 | S5 | Provider response text is isolated in untrusted fields; prompt injection strings cannot alter grants, limits, or approvals. |
| **$I_6$** | Temporal Authorization | FR-4 | US-1 | S6 | Expired or revoked grants immediately fail all tool calls with deterministic error codes. |
| **$I_7$** | Cryptographic Audit Continuity | FR-9 | US-6 | S1–S10 | Every state change appends a SHA-256 chained event. `GET /audit/verify` confirms genesis-to-tip integrity. |
| **$I_8$** | Active Reconciliation | FR-7 | US-4 | S8 | Dropped sockets and ambiguous timeouts trigger provider status lookup by idempotency key rather than blind retry. |
| **$I_9$** | Action Authenticity & Signed Receipts | FR-14 | US-6 | S9 | Every confirmed action issues an Ed25519 detached signature; spend/param tampering deterministically fails offline verification. |
| **$I_{10}$** | Grace-Hold Containment (Undo Window) | FR-15 | US-4 | S10 | Pre-settlement hold countdown on high-risk actions; out-of-band cancellation aborts with zero provider bookings and zero spend. |

---

## 3. Workstreams & Implementation Breakdown

### Workstream A: Gateway Core & MCP Transport
*Objective: Build the Streamable HTTP MCP server, deterministic policy engine, idempotency store, and audit chain.*
- [x] **A.1 Monorepo & Gateway Skeleton:**
  - Initialize TypeScript monorepo with `packages/warrant-gateway`.
  - Implement MCP Streamable HTTP transport conforming to protocol version `2025-11-25`.
  - Handle `initialize`, `tools/list`, and `tools/call`.
- [x] **A.2 Repository & Storage Layer:**
  - SQLite in WAL mode with a clean repository abstraction layer (`IGrantRepo`, `IPlanRepo`, `IIdempotencyRepo`, `IAuditRepo`).
  - Zero float operations: all financial balances and transactions stored strictly as integers in minor units (`spend_cap_minor`, `spent_minor`).
- [x] **A.3 Pure Deterministic Policy Engine:**
  - Risk tier evaluation ($T_0, T_1, T_2, T_3$).
  - Scope checks, active grant validation, spend cap decrement math.
- [x] **A.4 RFC 8785 Canonical Hasher & Approval Engine:**
  - Canonical JSON serialization algorithm ensuring deterministic hashing regardless of key order or whitespace.
  - Out-of-band Admin REST API for phone client (`POST /admin/grants`, `POST /admin/approvals/:id/decide`).
  - Approval token generation and mathematical binding verification.
- [x] **A.5 Idempotency Registry:**
  - Multi-layer idempotency on `(grant_id, tool_name, idempotency_key)`.
  - Conflict detection for identical key with divergent parameter hash ($409 \text{ Conflict}$).
- [x] **A.6 Cryptographically Chained Audit Trail:**
  - SHA-256 chain: $\text{hash}_n = \text{SHA-256}(\text{prev\_hash} \parallel \dots)$.
  - `/audit/verify` integrity verification endpoint.

### Workstream B: Mock Providers & Saga Orchestration
*Objective: Implement autonomous mock services with fault injection and the compensating saga orchestrator.*
- [x] **B.1 Mock Providers with Fault Control API:**
  - Hotel Service (`search_hotels`, `book_hotel`, `cancel_hotel`).
  - Train Service (`search_trains`, `book_train`, `cancel_train`).
  - Restaurant Service (`search_restaurants`, `reserve_table`, `cancel_reservation`).
  - Control endpoint (`POST /admin/providers/:name/fault`) to inject `TIMEOUT`, `DECLINE`, `DISCONNECT`.
  - External truth inspector (`GET /admin/providers/:name/bookings`) for independent test assertion.
- [x] **B.2 Saga Execution Engine:**
  - Sequential forward execution of plan steps.
  - Reverse compensation stack execution upon downstream failure.
  - Exponential backoff retry logic for compensating tools.
  - Plain English spoken summary generation (`"Hotel was cancelled because train was declined"`).
- [x] **B.3 Active Reconciliation Worker:**
  - Network timeout handling transitioning action to `UNKNOWN`.
  - Out-of-band inquiry by idempotency key resolving `UNKNOWN` to `SUCCEEDED` or `FAILED`.

### Workstream C: Simulated Alexa+ Client & Bedrock Agent Loop
*Objective: Build the high-aesthetic Next.js client, out-of-band mobile approval UI, and Bedrock agent integration.*
- [x] **C.1 Next.js 14 Client Application:**
  - Dark-mode, high-polish voice assistant UI (Inter/Outfit typography, smooth glassmorphism, responsive mobile + desktop views).
  - Audio/Voice interaction simulation (speech synthesis of `spoken_summary`, audio wave visualizer).
- [x] **C.2 Live MCP Execution Trace:**
  - Real-time inspector displaying incoming MCP requests, parameter hashes, risk tiers, and execution latency.
- [x] **C.3 Mobile Out-of-Band Approval Portal:**
  - Phone-friendly card view displaying exact action parameters, computed canonical hash, and Approve/Reject controls.
- [x] **C.4 Visual Cryptographic Audit Timeline:**
  - Interactive blockchain-style ledger visualization with a 1-click "Verify Chain" button and Merkle tree root checkpoints displaying proven green status.
- [x] **C.5 Amazon Bedrock Agent Loop:**
  - Integration with AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`).
  - Real MCP client communicating with the Warrant Gateway over Streamable HTTP.
  - High-fidelity offline stub agent for instant local execution without requiring live AWS credentials.

### Workstream D: Warrant Siege (Adversarial Harness & Scorecard)
*Objective: Build the standalone adversarial attack CLI, 11 attack scenarios, and automated scorecard generator.*
- [x] **D.1 Standalone CLI Runner (`packages/warrant-siege`):**
  - Command: `npm run test:siege` / `tsx src/cli.ts --target <mcp-url> --admin <admin-url>`.
  - Ephemeral gateway auto-spawn for turnkey single-command execution on clean machines.
- [x] **D.2 Core Scenario Implementations (11 Scenarios):**
  - S1: Duplicate Submit & Retry Storm ($I_1$).
  - S2: Mid-Plan Partial Failure & Rollback ($I_4$).
  - S3: Spend Cap Overflow Attack ($I_2$).
  - S4: Approval Parameter Tampering ($I_3$).
  - S5: Indirect Prompt Injection via Provider Output ($I_5$).
  - S6: Expired or Revoked Grant ($I_6$).
  - S7: Unapproved T2 Action Bypass ($I_3$).
  - S8: Ambiguous Timeout & Succeeded-Response-Lost ($I_8, I_1$).
  - S9: Tampered / Forged Action Receipt Rejection ($I_9$).
  - S10: Grace-Hold Undo Window Cancellation ($I_{10}$).
  - S11: Cross-User Plan & Budget Isolation ($I_6$).
- [x] **D.3 Automated Scorecard Generation:**
  - `scorecard.json`: Machine-verifiable summary with timestamps, invariant assertions, and SHA-256 run hash.
  - `scorecard.html`: Self-contained interactive report with pass/fail badges, step-by-step logs, and external provider verification evidence.
  - `scorecard-badge.svg`: Automated SVG pass/fail badge for repository status display.

### Workstream E: Documentation, Polish & Hackathon Submission
*Objective: Create submission documentation, friction logs, architecture diagrams, and demo video script.*
- [x] **E.1 Friction Log & Product Feedback:**
  - Detailed product feedback on AWS Bedrock Converse API, AWS SDK v3, MCP TypeScript SDK, Next.js 14, and SQLite (documented in `docs/SUBMISSION.md` and `docs/FRICTION_LOG.md`).
- [x] **E.2 Architecture & Flow Diagrams:**
  - High-resolution SVG / ASCII architecture and saga rollback diagrams in PRD, HLD, and README.
- [x] **E.3 Fresh-Clone Verification:**
  - End-to-end verification script ensuring clean clone $\to$ `npm install` $\to$ `npm run test` $\to$ `npm run dev` in <10 minutes.
- [x] **E.4 Demo Script (Calibrated to 2:45 Target):**
  - Tight, fast-paced demo script prioritizing technical depth and visual impact in `docs/DEMO_SCRIPT.md`:
    - 0:00–0:12: The Hook (Simulated Alexa+ on-screen caption; voice assistant acting with money).
    - 0:12–1:00: Live Happy Path & Approval Binding (Voice proposal, phone approval with parameter hash, Ed25519 receipt).
    - 1:00–1:35: Mid-Plan Failure & Automatic Rollback (Train declines; hotel cancelled automatically).
    - 1:35–2:15: Adversarial Proof & Mutation Moment (`npm run test:siege` 10/10 + `npm run test:mutation` turning S4 red).
    - 2:15–2:35: Scorecard & Open Source Deliverables (`scorecard.html`, open-source repo).
    - 2:35–2:45: Future Work Roadmap (Macaroons capability tokens, public transparency logs, hardware passkeys).
- [x] **E.5 Devpost Submission Package:**
  - Title, taglines, project story, architectural highlights, Open Source challenge fields, and tool evaluations in `docs/SUBMISSION.md`.

---

## 4. Day-by-Day Hackathon Milestones & Quality Gates (Oct 17 – Oct 23)

### Feature Triage & Priority Matrix

| Feature | Effort | Demo Impact | Risk | Verdict | Target Gate |
|---|---|---|---|---|---|
| **Mutation test script (`npm run test:mutation`)** | ~0.5d | High (shows scorecard turn red on defect) | Low | **DONE** | Gate 0 |
| **Fictional provider names (Coastal Rail / Harbor Inn)** | ~0.2d | High (clean IP & compliance) | Low | **DONE** | Gate 0 |
| **Turnkey auto-spawn siege runner** | ~0.2d | High (one-shot clean machine test) | Low | **DONE** | Gate 0 |
| **Signed action receipts & verify CLI / UI modal** | ~1d | High (offline independent verification) | Low | **DONE** | Gate 1 |
| **Undo window (pre-settlement hold countdown + cancel)** | ~1d | High (intuitive, visual demo impact) | Med | **DONE** | Gate 2 |
| **Harness as reusable GitHub Action with badge** | ~0.5-1d | Med (ecosystem adoption) | Low | **DONE** | Gate 3 |
| **Merkle checkpoints on audit chain tip** | ~1d | Med | Med | **DONE** | Gate 4 |
| **Passkey (WebAuthn) approvals** | 1-2d | High | High | **ROADMAP ONLY** | Post-Hackathon |
| **Capability tokens (Macaroons) / Policy as code** | 2+d | High on paper | High | **ROADMAP ONLY** | Post-Hackathon |

### Daily Execution Schedule

| Date | Focus Area | Deliverables & Gates | Status |
|---|---|---|---|
| **Oct 17** | Review Items & Hardening | Fictional names, mutation test script, turnkey siege auto-spawn, clean clone <15s, Dockerfile fix. | **COMPLETED & TESTED** |
| **Oct 18** | Signed Receipts | Ed25519 action receipts, `npm run receipt:verify` CLI, UI Verify button, Attack Scenario S9. | **COMPLETED & TESTED** |
| **Oct 19** | Undo Window | Grace hold countdown (8s), cancel endpoint, UI cancel button, Attack Scenario S10. | **COMPLETED & TESTED** |
| **Oct 20** | Reusable CI Action | Standalone `@warrant/siege` package, GitHub Action workflow, pass/fail badge generator. | **COMPLETED & TESTED** |
| **Oct 21** | Stretch & Feature Freeze | Merkle checkpoints ($O(\log N)$ proofs); UI card. **Hard feature freeze achieved.** | **COMPLETED & TESTED** |
| **Oct 22** | Video Rehearsal & Script | Demo script calibrated to 2:45 target, exact WPM budgets, on-screen prototype caption. | **COMPLETED & TESTED** |
| **Oct 23** | Early Submission | Complete `docs/SUBMISSION.md`, product feedback on all 5 SDKs, friction log, and Open Source fields. | **COMPLETED & TESTED** |

---

## 5. Scope Management & Strict Safety Rules

To prevent broken demos from half-finished features, every agent and engineer must follow these rules:

1. **Don't Touch Core After Freeze:** After Oct 21 (23:59 IST), zero modifications are permitted to the core demo path (grant issuance, phone approval, booking execution, saga rollback).
2. **Cut Cleanly If Incomplete:** If a feature is not 100% finished, tested, and passing all invariants, cut it entirely. Never present a half-working feature in the video or Devpost.
3. **Honest Documentation:** All fully tested capabilities go in "Features"; anything planned goes in "Roadmap".
4. **Step-by-Step Gated Execution:** Execute one feature at a time. After each feature:
   - Run unit tests: `npm run test` (0 failures).
   - Run siege harness: `npm run test:siege` (all scenarios pass).
   - Run mutation test: `npm run test:mutation` (all defects detected).
   - Verify fresh clone in isolated directory.

---

## 6. Demo Script (Calibrated to 2:45 Target)

Follows `docs/DEMO_SCRIPT.md` strictly under 3:00 minutes with natural ~138 WPM comfortable speech:
- **0:00–0:12 (Hook):** "Voice assistants are starting to book and buy for us, with no screen to check first. Warrant makes every action limited, approved and undoable." Shows on-screen "Simulated Alexa+" prototype caption.
- **0:12–1:00 (Happy Path & Approval):** Request trip, show live MCP trace, phone approval with RFC 8785 canonical parameter hash, booking with spoken summary, Ed25519 signed receipt, and 8-second grace hold undo countdown.
- **1:00–1:35 (Rollback):** Train declines, hotel is cancelled automatically in reverse, screen shows "Nothing charged, no bookings left", and SHA-256 audit chain verifies green.
- **1:35–2:15 (Adversarial Proof & Mutation Moment):** Run `npm run test:siege` for 10/10 green. Then run `npm run test:mutation`: intentionally disable approval hash check, watch Scenario S4 turn RED, restore protection, and return to green.
- **2:15–2:35 (Scorecard & Open Source):** Show generated `scorecard.html` and open-source repository.
- **2:35–2:45 (Roadmap — Future Work):** One slide labeled "Roadmap: Future Work" highlighting capability tokens (Macaroons), public transparency logs, and hardware-secured biometric passkeys.

---

## 7. Submission Details & Mini-Challenge Strategy

- **MCP in Actual Code:** Gateway serves MCP tools over Streamable HTTP protocol version `2025-11-25+`; Alexa client and Siege CLI connect over live HTTP.
- **Additional Open Source Project Mini-Challenge:** `@warrant/siege` is maintained as an independent package under the MIT License (`packages/warrant-siege/LICENSE`) so it cleanly qualifies as the additional open-source project.
- **AWS Builder Mini-Challenge:** Bedrock Converse API integration documented with live tool calling and deterministic offline fallback.
- **Developer Friction Log & Tool Feedback:** Full feedback on all 5 SDKs and friction log documented in `docs/SUBMISSION.md` and `docs/FRICTION_LOG.md` (earning up to a 10% judging bonus).

---

## 8. Post-Hackathon Strategic Roadmap (Phases 2 – 5)

> **Notice:** Signed Action Receipts ($I_9$) and Grace-Hold Undo Windows ($I_{10}$) have been shipped in this release. The long-term architectural trajectory evolves Warrant into global trust infrastructure:

### Phase 2: Make It Real (First Weeks Post-Hackathon)
- **Real Provider Integrations:** Stripe test mode payment intents, followed by live airline/hotel APIs.
- **Passkey (WebAuthn) Approvals:** Replace button taps with secure hardware biometric proofs (Touch ID, Face ID, YubiKey).
- **Multi-User Accounts & OAuth Grants:** Multi-tenant hierarchy with household role management.
- **Postgres & Hosted Trial:** Managed cloud deployment for community sandbox testing.

### Phase 3: Stronger Trust Guarantees
- **Public Transparency Log:** Anchor audit chains to an append-only Merkle tree (RFC 6962 / Sigstore) with signed tree heads to guarantee history cannot be rewritten.
- **Capability Tokens (Macaroons / Biscuit):** Attenuated authority tokens that can only shrink when passed to sub-agents, solving the cascading delegation problem.
- **Policy as Code:** Cedar / OPA policy definitions with historical simulation on past audit logs.
- **Multi-Cloud Trust Anchors:** Distribute Merkle audit checkpoints across independent cloud providers for Byzantine fault tolerance.

### Phase 4: Smarter Protection
- **Anomaly Detection:** Behavioral modeling detecting atypical spend velocity, timing, or geographical destinations.
- **Plan Dry-Runs:** Complete preview of financial commitments and compensation guarantees before plan submission.
- **Voice Step-Up Auth:** Multi-factor authentication required for highest-risk voice invocations.
- **Privacy Controls:** Automated PII redaction and local policy evaluation.

### Phase 5: Ecosystem & Standards
- **Provider SDK:** Drop-in middleware allowing any brand to wrap their MCP tools in Warrant with <10 lines of code.
- **Ecosystem Certification:** Badges earned via `warrant-siege` scores, with CI GitHub Actions running scorecards on PRs.
- **Continuous Red-Teaming:** Dynamic LLM attack swarms and schema fuzzing against public tool registries.
- **Standards Proposals:** Standardizing voice consent, approval binding, and receipts across the MCP community.

### Household & Care Use Cases
- **Shared Household Grants:** Multi-tier family rules (parents administer caps; children have category-locked allowances).
- **Caregiver Dual Approval:** Vulnerable or elderly assistant transactions automatically trigger co-approvals.
- **Contextual Multi-Device Prompting:** Approvals routed intelligently to TV canvas, smartwatch, or mobile.

### Core Strategic Differentiators
1. **Signed receipts with transparency logs:** Provable non-repudiation for agent actions.
2. **Attenuated capability tokens:** Mathematically bounds agent-to-agent delegation authority.
3. **Automated ecosystem certification:** Positions `warrant-siege` as the safety benchmark for all agent tools.

