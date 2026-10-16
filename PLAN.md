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

## 4. Day-by-Day Hackathon Milestones & Quality Gates

```
+-----------------------------------------------------------------------------------------+
| TIMELINE & QUALITY GATES                                                                |
+------------+-------------------------------------------------------------+--------------+
| Date       | Daily Goal                                                  | Hard Gate    |
+------------+-------------------------------------------------------------+--------------+
| 16 Oct     | Repos & Monorepo Scaffold; MCP Streamable HTTP skeleton;    | Gate 0: Pass |
| (Today)    | Data models; Docs and Agent contracts initialized.          | MCP ping     |
+------------+-------------------------------------------------------------+--------------+
| 17 Oct     | Mock Providers with fault injection; read/search tools;     | Gate 1a: Mock|
|            | Idempotency store; SHA-256 audit chaining.                  | faults work  |
+------------+-------------------------------------------------------------+--------------+
| 18 Oct     | Pure Policy Engine; Grants; Spend caps; RFC 8785 Hasher;    | GATE 1: Pass |
|            | Out-of-band approval engine and phone API.                  | Approval Flow|
+------------+-------------------------------------------------------------+--------------+
| 19 Oct     | Saga Orchestrator; Compensations; Timeout Reconciler.       | GATE 2: Pass |
|            | Verify S2 (Rollback) & S8 (Reconciliation).                 | S2 & S8      |
+------------+-------------------------------------------------------------+--------------+
| 20 Oct     | Next.js Simulated Alexa+ Client; Phone approval portal;     | GATE 3: Pass |
|            | Bedrock Converse Agent loop; live tool trace.               | End-to-End UI|
+------------+-------------------------------------------------------------+--------------+
| 21 Oct     | Warrant Siege Harness; Execute 8 attack scenarios;          | GATE 4: Pass |
|            | HTML/JSON scorecard generation; fix edge-case bugs.         | 8/8 Green    |
+------------+-------------------------------------------------------------+--------------+
| 22 Oct     | Fresh-clone automated test (<10 min); Product feedback &   | GATE 5: Pass |
|            | friction logs; README & architecture diagrams.              | Fresh-Clone  |
+------------+-------------------------------------------------------------+--------------+
| 23 Oct     | Record demo video (<3 min); Final rehearsal; Devpost       | SUBMISSION   |
| (Cutoff)   | submission finalized before midnight.                       | READY        |
+------------+-------------------------------------------------------------+--------------+
```

---

## 5. Scope Management & Cut Order Protocol

If behind schedule at any gate, features are prioritized according to the strict cut-order:

### Must Never Cut (The Core Safety Thesis)
- Parameter-hash approval binding ($I_3$)
- Saga rollback with mock provider verification ($I_4$)
- Multi-layer idempotency ($I_1$)
- Streamable HTTP MCP server conformance
- Adversarial test harness with automated scorecard ($I_1 - I_8$)

### Cut Order (If Behind Schedule)
1. **Live speech recognition / microphone audio input:** Fallback to typed voice simulation with real speech synthesis output (`spoken_summary`).
2. **Third mock provider (Restaurant):** Reduce travel vertical to Hotel + Train (sufficient for 100% of saga and rollback proofs).
3. **Hosted cloud deployment:** Rely on local Docker Compose / `npm run dev` with fresh-clone verification.
4. **Live Bedrock AWS execution in demo video:** Switch to deterministic Bedrock agent recording fixture if AWS quota or network latency issues arise.
