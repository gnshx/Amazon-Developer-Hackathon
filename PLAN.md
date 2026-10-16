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
| **$I_7$** | Cryptographic Audit Continuity | FR-9 | US-6 | S1–S8 | Every state change appends a SHA-256 chained event. `GET /audit/verify` confirms genesis-to-tip integrity. |
| **$I_8$** | Active Reconciliation | FR-7 | US-4 | S8 | Dropped sockets and ambiguous timeouts trigger provider status lookup by idempotency key rather than blind retry. |

---

## 3. Workstreams & Implementation Breakdown

### Workstream A: Gateway Core & MCP Transport
*Objective: Build the Streamable HTTP MCP server, deterministic policy engine, idempotency store, and audit chain.*
- [ ] **A.1 Monorepo & Gateway Skeleton:**
  - Initialize TypeScript monorepo with `packages/warrant-gateway`.
  - Implement MCP Streamable HTTP transport conforming to protocol version `2025-11-25`.
  - Handle `initialize`, `tools/list`, and `tools/call`.
- [ ] **A.2 Repository & Storage Layer:**
  - SQLite in WAL mode with a clean repository abstraction layer (`IGrantRepo`, `IPlanRepo`, `IIdempotencyRepo`, `IAuditRepo`).
  - Zero float operations: all financial balances and transactions stored strictly as integers in minor units (`spend_cap_minor`, `spent_minor`).
- [ ] **A.3 Pure Deterministic Policy Engine:**
  - Risk tier evaluation ($T_0, T_1, T_2, T_3$).
  - Scope checks, active grant validation, spend cap decrement math.
- [ ] **A.4 RFC 8785 Canonical Hasher & Approval Engine:**
  - Canonical JSON serialization algorithm ensuring deterministic hashing regardless of key order or whitespace.
  - Out-of-band Admin REST API for phone client (`POST /admin/grants`, `POST /admin/approvals/:id/decide`).
  - Approval token generation and mathematical binding verification.
- [ ] **A.5 Idempotency Registry:**
  - Multi-layer idempotency on `(grant_id, tool_name, idempotency_key)`.
  - Conflict detection for identical key with divergent parameter hash ($409 \text{ Conflict}$).
- [ ] **A.6 Cryptographically Chained Audit Trail:**
  - SHA-256 chain: $\text{hash}_n = \text{SHA-256}(\text{prev\_hash} \parallel \dots)$.
  - `/audit/verify` integrity verification endpoint.

### Workstream B: Mock Providers & Saga Orchestration
*Objective: Implement autonomous mock services with fault injection and the compensating saga orchestrator.*
- [ ] **B.1 Mock Providers with Fault Control API:**
  - Hotel Service (`search_hotels`, `book_hotel`, `cancel_hotel`).
  - Train Service (`search_trains`, `book_train`, `cancel_train`).
  - Restaurant Service (`search_restaurants`, `reserve_table`, `cancel_reservation`).
  - Control endpoint (`POST /control/inject-fault`) to inject `TIMEOUT`, `DECLINE`, `SUCCEEDED_BUT_DISCONNECTED`.
  - External truth inspector (`GET /bookings`) for independent test assertion.
- [ ] **B.2 Saga Execution Engine:**
  - Sequential forward execution of plan steps.
  - Reverse compensation stack execution upon downstream failure.
  - Exponential backoff retry logic for compensating tools.
  - Plain English spoken summary generation (`"Hotel was cancelled because train was declined"`).
- [ ] **B.3 Active Reconciliation Worker:**
  - Network timeout handling transitioning action to `UNKNOWN`.
  - Out-of-band inquiry by idempotency key resolving `UNKNOWN` to `SUCCEEDED` or `FAILED`.

### Workstream C: Simulated Alexa+ Client & Bedrock Agent Loop
*Objective: Build the high-aesthetic Next.js client, out-of-band mobile approval UI, and Bedrock agent integration.*
- [ ] **C.1 Next.js 14 Client Application:**
  - Dark-mode, high-polish voice assistant UI (Inter/Outfit typography, smooth glassmorphism, responsive mobile + desktop views).
  - Audio/Voice interaction simulation (speech synthesis of `spoken_summary`, audio wave visualizer).
- [ ] **C.2 Live MCP Execution Trace:**
  - Real-time inspector displaying incoming MCP requests, parameter hashes, risk tiers, and execution latency.
- [ ] **C.3 Mobile Out-of-Band Approval Portal:**
  - Phone-friendly card view displaying exact action parameters, computed canonical hash, and Approve/Reject controls.
- [ ] **C.4 Visual Cryptographic Audit Timeline:**
  - Interactive blockchain-style ledger visualization with a 1-click "Verify Chain Integrity" button displaying cryptographically proven green status.
- [ ] **C.5 Amazon Bedrock Agent Loop:**
  - Integration with AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`).
  - Real MCP client communicating with the Warrant Gateway over Streamable HTTP.
  - High-fidelity offline stub agent for instant local execution without requiring live AWS credentials.

### Workstream D: Warrant Siege (Adversarial Harness & Scorecard)
*Objective: Build the standalone adversarial attack CLI, 8 attack scenarios, and automated scorecard generator.*
- [ ] **D.1 Standalone CLI Runner (`packages/warrant-siege`):**
  - Command: `npx warrant-siege --target <mcp-url> --admin <admin-url>`.
  - Declarative YAML scenario specifications with deterministic seed control.
- [ ] **D.2 Core Scenario Implementations:**
  - S1: Duplicate Submit & Retry Storm ($I_1$).
  - S2: Mid-Plan Partial Failure & Rollback ($I_4$).
  - S3: Spend Cap Overflow Attack ($I_2$).
  - S4: Approval Parameter Tampering ($I_3$).
  - S5: Indirect Prompt Injection via Provider Output ($I_5$).
  - S6: Expired or Revoked Grant ($I_6$).
  - S7: Unapproved T2 Action Bypass ($I_3$).
  - S8: Ambiguous Timeout & Succeeded-Response-Lost ($I_8, I_1$).
- [ ] **D.3 Automated Scorecard Generation:**
  - `scorecard.json`: Machine-verifiable summary with timestamps, invariant assertions, and SHA-256 run hash.
  - `scorecard.html`: Self-contained interactive report with pass/fail badges, step-by-step logs, and external provider verification evidence.

### Workstream E: Documentation, Polish & Hackathon Submission
*Objective: Create submission documentation, friction logs, architecture diagrams, and demo video script.*
- [ ] **E.1 Friction Log & Product Feedback:**
  - Detailed product feedback on AWS Bedrock Converse API, AWS SDK v3, and MCP TypeScript SDK (earns judging bonus up to 10%).
- [ ] **E.2 Architecture & Flow Diagrams:**
  - High-resolution SVG / ASCII architecture and saga rollback diagrams.
- [ ] **E.3 Fresh-Clone Verification:**
  - End-to-end verification script ensuring clean clone $\to$ `npm install` $\to$ `npm test` $\to$ `npm run dev` in <10 minutes.
- [ ] **E.4 Demo Script (<3:00 Minutes):**
  - Tight, fast-paced demo script prioritizing technical depth and visual impact:
    - 0:00–0:45: The Problem & The Gateway (Voice agent acting with money; grant & cap setup).
    - 0:45–1:30: Live Happy Path & Approval Binding (Voice proposal, phone approval with parameter hash).
    - 1:30–2:15: Mid-Plan Failure & Automatic Rollback (Train declines; hotel cancelled automatically).
    - 2:15–3:00: Adversarial Siege & Verified Scorecard (Running `warrant-siege`; 8/8 green scorecard; audit verification).
- [ ] **E.5 Devpost Submission Package:**
  - Title, taglines, project story, architectural highlights, and open-source contribution links.

---

## 4. Day-by-Day Hackathon Milestones & Quality Gates (Oct 17 – Oct 23)

### Feature Triage & Priority Matrix

| Feature | Effort | Demo Impact | Risk | Verdict | Target Gate |
|---|---|---|---|---|---|
| **Mutation test script (`npm run test:mutation`)** | ~0.5d | High (shows scorecard turn red on defect) | Low | **DONE (Oct 17)** | Gate 0 |
| **Fictional provider names (Coastal Rail / Harbor Inn)** | ~0.2d | High (clean IP & compliance) | Low | **DONE (Oct 17)** | Gate 0 |
| **Turnkey auto-spawn siege runner** | ~0.2d | High (one-shot clean machine test) | Low | **DONE (Oct 17)** | Gate 0 |
| **Signed action receipts & verify CLI / UI modal** | ~1d | High (offline independent verification) | Low | **DO (Oct 18)** | Gate 1 |
| **Undo window (pre-settlement hold countdown + cancel)** | ~1d | High (intuitive, visual demo impact) | Med | **DO (Oct 19)** | Gate 2 |
| **Harness as reusable GitHub Action with badge** | ~0.5-1d | Med (ecosystem adoption) | Low | **DO (Oct 20)** | Gate 3 |
| **Merkle checkpoints on audit chain tip** | ~1d | Med | Med | **STRETCH (Oct 21)**| Gate 4 |
| **Passkey (WebAuthn) approvals** | 1-2d | High | High | **ROADMAP ONLY** | Post-Hackathon |
| **Capability tokens (Macaroons) / Policy as code** | 2+d | High on paper | High | **ROADMAP ONLY** | Post-Hackathon |

### Daily Execution Schedule

| Date | Focus Area | Deliverables & Gates | Status |
|---|---|---|---|
| **Oct 17 (Today)** | Review Items & Hardening | Fictional names, mutation test script, turnkey siege auto-spawn, clean clone <15s, Dockerfile fix. | **COMPLETED & TESTED** |
| **Oct 18** | Signed Receipts | Ed25519 action receipts, `npm run receipt:verify` CLI, UI Verify button, Attack Scenario S9. | **Next Up** |
| **Oct 19** | Undo Window | Grace hold countdown (8s), cancel endpoint, UI cancel button, Attack Scenario S10. | Scheduled |
| **Oct 20** | Reusable CI Action | Standalone `@warrant/siege` package, GitHub Action workflow, pass/fail badge generator. | Scheduled |
| **Oct 21** | Stretch & Feature Freeze | Merkle checkpoints (if ahead); otherwise final polish. **Hard feature freeze at 23:59 IST.** | Scheduled |
| **Oct 22** | Video Rehearsal & Recording | Rehearse 2:50 demo script; record break-and-fix scorecard shot; export final 1080p MP4. | Scheduled |
| **Oct 23** | Early Submission | Fresh-clone sanity check, secret scan (`git ls-files \| grep env`), submit on Devpost before 23:59 IST. | Submission Day |

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

## 6. Demo Script (Under 3 Minutes)

- **0:00–0:20 (The Problem):** An assistant that can spend your money by voice with no screen to check.
- **0:20–1:10 (Happy Path & Approval):** Book a trip, approve it on the phone with canonical parameter hash, show the live tool trace and tamper-evident audit trail.
- **1:10–1:50 (Rollback):** A train booking fails halfway; saga orchestrator automatically cancels the hotel in reverse, leaving zero residue.
- **1:50–2:30 (Attack Suite):** Run `warrant-siege` against the gateway, showing all 8 adversarial attacks blocked by gateway invariants.
- **2:30–3:00 (Scorecard & Open Source):** Show the generated HTML scorecard with green verification badges and highlight the standalone open-source repo.

---

## 7. Submission Details & Mini-Challenge Strategy

- **MCP in Actual Code:** Gateway serves MCP tools over Streamable HTTP protocol version `2025-11-25+`; Alexa client and Siege CLI connect over live HTTP.
- **Additional Open Source Project Mini-Challenge:** `warrant-siege` is maintained with its own standalone package and open-source license (MIT) so it cleanly qualifies as the additional open-source project.
- **AWS Builder Mini-Challenge:** Bedrock Converse API integration documented with live tool calling.
- **Friction Log (Up to 10% Judging Bonus):** Maintained in `docs/FRICTION_LOG.md` tracking real friction encountered with Bedrock and MCP SDKs.

---

## 8. Post-Hackathon Strategic Roadmap (Phases 2 – 5)

The hackathon MVP proves the core trust loop. The long-term architectural trajectory evolves Warrant into global trust infrastructure:

### Phase 2: Make It Real (First Weeks Post-Hackathon)
- **Real Provider Integrations:** Stripe test mode payment intents, followed by live airline/hotel APIs.
- **Passkey (WebAuthn) Approvals:** Replace button taps with Secure Enclave cryptographic biometric proofs.
- **Multi-User Accounts & OAuth Grants:** Multi-tenant hierarchy with household role management.
- **Postgres & Hosted Trial:** Managed cloud deployment for community sandbox testing.

### Phase 3: Stronger Trust Guarantees
- **Signed Action Receipts:** Every action produces a detached Ed25519 signed receipt verifiable offline by third parties.
- **Transparency Log:** Anchor audit chains to an append-only Merkle tree (RFC 6962 / Sigstore) with signed tree heads.
- **Capability Tokens (Macaroons / Biscuit):** Attenuated authority tokens that can only shrink when passed to sub-agents.
- **Policy as Code:** Cedar / OPA policy definitions with historical simulation on past audit logs.
- **Undo Windows:** Configurable grace periods before final settlement for reversible actions.

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

