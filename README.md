# Warrant

A safety layer for voice agents that act in the real world: limits you set, approval tied to the exact action, no double-charges, automatic rollback, and receipts anyone can verify.

Built for the Amazon Developer Hackathon, Alexa+ track. [Demo Video](docs/DEMO_SCRIPT.md)

[![Tests: 66 Passing](https://img.shields.io/badge/Tests-66%20Passing-brightgreen)](https://github.com/gnshx/Amazon-Developer-Hackathon)
[![Siege Scorecard: 11/11 Invariants Satisfied](https://img.shields.io/badge/Siege%20Scorecard-11%2F11%20Satisfied-10b981)](#-the-10-safety-invariants--adversarial-attack-suite)
[![Protocol: MCP Streamable HTTP](https://img.shields.io/badge/Protocol-MCP%20Streamable%20HTTP%202025--11--25-0066FF)](https://modelcontextprotocol.io)
[![Agent: Amazon Bedrock](https://img.shields.io/badge/Agent-Amazon%20Bedrock%20Converse%20API-232F3E?logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![License: Apache 2.0 / MIT](https://img.shields.io/badge/License-Apache%202.0%20%2F%20MIT-blue.svg)](LICENSE)

---

## What you will see

Five screens (images in [`docs/assets`](docs/assets)): the assistant console with a plain-language view of what Warrant is doing, the phone approval card, a failed plan rolling back, the safety scorecard, and the limits screen.

| 1. Assistant Console & Live MCP Traces | 2. Out-of-Band Phone Approval Card |
|:---:|:---:|
| ![Assistant Console](docs/assets/1-assistant-console.png) | ![Phone Approval](docs/assets/2-phone-approval.png) |
| **3. Mid-Plan Failure & Saga Rollback** | **4. Adversarial Siege Safety Scorecard (11/11)** |
| ![When Something Fails](docs/assets/3-when-something-fails.png) | ![Safety Scorecard](docs/assets/4-safety-scorecard.png) |

| 5. Your Assistant's Limits (Household Out-of-Band Policy) |
|:---:|
| ![Your Assistant's Limits](docs/assets/5-assistants-limits.png) |

---

## Verify it in about a minute

```bash
npm install
npm run test:siege      # run the 11 attack scenarios and write a scorecard
npm run test:mutation   # break a protection and watch the matching scenario turn red
npm run verify:evidence # check the committed receipt and audit proofs offline
```

No AWS keys are needed. To run the full app with the simulated Alexa+ client, use `npm run dev`.

---

## What is real and what is simulated

- **Real**: the MCP gateway, approvals, idempotency, rollback, receipts and audit chain
- **Simulated**: the Alexa+ client, the hotel, train and restaurant providers, and the demo OAuth server
- **Not done**: a public HTTPS endpoint, a real Alexa+ device, an external security audit

---

## More

- [JUDGES.md](JUDGES.md): the short evaluation path
- [examples/evidence/](examples/evidence/INDEX.md): empirical proof index, live Bedrock transcripts, and benchmarks
- [docs/](docs/): product requirements, design, test plan and demo script
- [packages/warrant-siege](packages/warrant-siege/): the standalone harness, MIT license
- [skills/warrant-safe-actions](skills/warrant-safe-actions/): the Agent Skill

---

## License

Apache 2.0 for the gateway and client. MIT for warrant-siege.


---

## 2. Architecture Overview

```
                                  +-----------------------------------------------+
                                  |         Household Phone / Mobile Web          |
                                  |           (Out-of-band Approval UI)           |
                                  +-----------------------------------------------+
                                                          |
                                                          | Admin API (REST / JSON)
                                                          | [Grants & Approvals Channel]
                                                          v
+--------------------------------------- Warrant Trust Gateway ---------------------------------------+
|                                                                                                     |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|   | Streamable HTTP (MCP) |     |  Bearer Identity Auth  |     |  Pure Policy Engine (T0-T3)   |   |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|               |                             |                                  |                    |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|   |  Idempotency Registry |     |    Saga Orchestrator   |     |    Tamper-Evident SHA-256      |   |
|   |     (Key + Hash)      |     |  (Reverse Compensation)|     |         Audit Chain            |   |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|               |                             |                                  |                    |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|   |   RFC 8785 Canonical  |     |  Approval Token Issuer |     |   Active Timeout Reconciler    |   |
|   |    Parameter Hasher   |     |    (Cryptographic)     |     |   (External Provider Truth)    |   |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|               |                             |                                  |                    |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|   |    Receipt Service    |     |  Undo Window Manager   |     |      Merkle Tree Prover        |   |
|   |   (Ed25519 Signer)    |     |   (Pre-Settlement)     |     |     (O(log N) Verification)    |   |
|   +-----------------------+     +------------------------+     +--------------------------------+   |
|                                                                                                     |
+-----------------------------------------------------------------------------------------------------+
        ^                                                                  |
        | MCP JSON-RPC 2025-11-25                                          | HTTP / Fault Injection Control
        | (Over Streamable HTTP)                                           | (Mock Provider Bookings)
        |                                                                  v
+------------------------------------+                         +--------------------------------------+
|  Simulated Alexa+ Client           |                         |   Autonomous Mock Providers          |
|  - Next.js 14 Web UI (Dark Mode)   |                         |   - Coastal Rail Express (Train)     |
|  - Amazon Bedrock Converse Loop    |                         |   - Harbor Inn Hotel (Hotel)         |
|  - Real-Time MCP Tool Inspector    |                         |   - Fictional Bistro (Restaurant)    |
|  - Phone Out-of-Band Approval Card |                         |   - Fault Injection Control API      |
|  - Cryptographic Receipt Modal     |                         +--------------------------------------+
+------------------------------------+
```

### The 5 Core Pillars

1. **Simulated Alexa+ Client (Next.js 14):** Modern dark-mode UI with glassmorphic cards, voice synthesis of `spoken_summary` fields ($\le 300$ chars), real-time MCP tool call inspection, receipt inspector modal, undo grace countdown bar, and an out-of-band phone approval portal displaying exact RFC 8785 parameter hashes.
2. **Bedrock Voice Agent:** Autonomous agent loop using the AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`). Configured for Amazon Nova Pro (`us.amazon.nova-pro-v1:0`) or Claude cross-region inference profiles, with a deterministic zero-credential fallback stub for offline testing and automated CI.
3. **Warrant Gateway (MCP Server):** TypeScript MCP server running over Streamable HTTP (spec version `2025-11-25+`) with an SQLite WAL repository, pure deterministic policy engine, RFC 8785 canonical JSON serializer, Ed25519 receipt signer, and chained SHA-256 audit ledger with Merkle root checkpointing.
4. **Mock Providers with Fault Injection:** Autonomous mock Hotel, Train, and Restaurant providers maintaining independent booking state queryable via `GET /admin/providers/:name/bookings`, with fault injection endpoints for `TIMEOUT`, `DECLINE`, and `SUCCEEDED_BUT_DISCONNECTED`.
5. **Warrant Siege Adversarial Harness:** Standalone testing CLI package (`packages/warrant-siege`) with its own MIT License that executes 11 attack scenarios against the gateway and produces machine-verifiable `scorecard.json`, interactive `scorecard.html` reports, and SVG badges.

---

## 3. The 10 Safety Invariants & Adversarial Attack Suite

Every user story and safety requirement maps directly to an architectural invariant ($I_1 - I_{10}$) verified by an attack scenario ($S_1 - S_{11}$) in `warrant-siege`:

| Invariant | Name | Description | Attack Scenario & Verification | Status |
|---|---|---|---|---|
| **$I_1$** | **No Duplicate External Effect** | No state-changing external effect occurs more than once for the same `(grant_id, tool_name, idempotency_key)`. | **S1 (Duplicate Submit Storm):** 10 concurrent execute calls dispatched with the same key. Gateway executes once; mock provider confirms exactly 1 booking. | **✅ SATISFIED** |
| **$I_2$** | **Absolute Spend Cap** | Total confirmed spend under any grant never exceeds `grant.spend_cap_minor`, regardless of agent prompts. | **S3 (Spend Cap Overflow Attack):** Agent proposes plan exceeding available grant budget. Gateway rejects with `Spend Cap Exceeded`; 0 cents spent. | **✅ SATISFIED** |
| **$I_3$** | **Cryptographic Approval Binding** | No $T_2$ action executes without an approval token bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{args}))$. | **S4 & S7 (Parameter Tampering & Bypass):** Altering price or omitting phone approval yields immediate execution rejection. | **✅ SATISFIED** |
| **$I_4$** | **Clean Residue (Saga Rollback)** | Mid-plan failure triggers automatic reverse compensation, restoring provider state to clean baseline. | **S2 (Mid-Plan Failure Rollback):** Train booking declines after hotel succeeds. Orchestrator automatically cancels hotel; 0 orphan bookings remain. | **✅ SATISFIED** |
| **$I_5$** | **Structural Output Containment** | Third-party provider responses cannot elevate privileges, alter active grants, or bypass approvals. | **S5 (Indirect Prompt Injection):** Malicious provider text attempting to call administrative grant-widening tools is blocked by MCP surface isolation. | **✅ SATISFIED** |
| **$I_6$** | **Temporal Authorization & Isolation Boundary** | Expired/revoked grants authorize zero actions ($T_0, T_1, T_2$); plans, grants, and budgets are strictly isolated across users. | **S6 & S11 (Expired Boundary & Cross-User Isolation):** Invoking tools after grant expiration TTL fails with 403; User B cannot read, execute, or cancel User A's plan. | **✅ SATISFIED** |
| **$I_7$** | **Cryptographic Audit Continuity** | Every state transition appends a SHA-256 chained event verifiable from genesis. | **S1–S11 (Audit Integrity Check):** `GET /admin/audit/verify` re-computes every hash from genesis to tip, confirming zero tampering. | **✅ SATISFIED** |
| **$I_8$** | **Reconciliation over Blind Retries** | Ambiguous network timeouts are actively reconciled against external provider truth. | **S8 (Ambiguous Timeout & Reconciliation):** Provider drops connection after save; reconciler verifies status by idempotency key and avoids dupe booking. | **✅ SATISFIED** |
| **$I_9$** | **Action Authenticity & Receipts** | Every confirmed action produces a detached Ed25519 signed receipt over RFC 8785 canonical metadata. | **S9 (Receipt Tampering Attack):** Mutating spend amount or parameter hash fails Ed25519 signature verification offline. | **✅ SATISFIED** |
| **$I_{10}$** | **Grace-Hold Containment (Undo)** | Actions held in a grace window remain pre-settled; cancellation leaves zero provider side effects and zero spend. | **S10 (Grace-Hold Undo Cancellation):** Cancelling during hold aborts execution with 0 bookings and releases 100% of reserved spend. | **✅ SATISFIED** |

### STRIDE Threat Matrix & Invariant Mapping

| STRIDE Category | Threat Description | Architectural Defense | Invariant | Tested By | Status |
|:---|:---|:---|:---:|:---:|:---:|
| **Spoofing** | Rogue agent claims identity of user or elevates scopes | Bearer token auth derived strictly from HTTP header; MCP cannot create grants | $I_5$, $I_6$ | **S5, S6** | ✅ Passing |
| **Tampering** | LLM alters approved booking price, dates, or recipient | RFC 8785 canonical JSON-LD serialization + SHA-256 parameter hash binding | $I_3$ | **S4, S7** | ✅ Passing |
| **Repudiation** | Provider or agent disputes that an action was authorized | Detached Ed25519 signature over canonical metadata produced on every execution | $I_9$ | **S9** | ✅ Passing |
| **Information Disclosure** | Third-party provider injection alters active grant limits | Structural output containment; MCP response payload strictly isolated from grant store | $I_5$ | **S5** | ✅ Passing |
| **Denial of Service** | Unstable network dropped socket causes repeated charges | Active reconciliation by idempotency key against external provider before retrying | $I_8$ | **S8** | ✅ Passing |
| **Elevation of Privilege** | Agent calls admin tools to increase budget or auto-approve | Out-of-band admin channel; grant creation and approvals not registered on MCP surface | $I_2$, $I_5$ | **S3, S5** | ✅ Passing |
| **Replay Attack** | Network retry storm or duplicate voice submits multi-fire | Multi-layer idempotency cache with request parameter fingerprinting | $I_1$ | **S1** | ✅ Passing |
| **State Residue** | Multi-step booking fails mid-flight, leaving orphaned bookings | Compensating Saga Orchestrator executes reverse cancellations with clean baseline | $I_4$ | **S2** | ✅ Passing |
| **Accidental Commitment**| User changes mind immediately after voice confirmation | Grace-hold undo window (8s delay) allows out-of-band cancellation before provider settlement | $I_{10}$ | **S10** | ✅ Passing |
| **Isolation Violation** | User B attempts to access User A's plans or spend budget | Strict subject binding on plans and grants; shared budget across user's sessions | $I_6$ | **S11** | ✅ Passing |

### Comprehensive Verification Summary

> **Exact Verification Breakdown:**  
> **66 automated unit & integration tests**, **11 adversarial siege attack scenarios** ($S_1 - S_{11}$), **3 architectural mutation tests**, **3 agent skill boundary checks**, **1 latency SLA benchmark** (50 calls per tool type, p95 < 4ms), and **1 comparative benchmark** (3 scenarios).

| Verification Suite | Type | Verified Scope | Execution Time | Status |
|:---|:---|:---:|:---:|:---:|
| **`@warrant/gateway`** | Vitest Unit & Integration | 64 unit & integration tests | ~600ms | ✅ 64/64 Passing |
| **`@warrant/alexa-client`** | Vitest Agent Integration | 1 Bedrock agent loop test | ~300ms | ✅ 1/1 Passing |
| **`@warrant/siege`** | Vitest Scenario Runner | 1 scenario suite test | ~1.6s | ✅ 1/1 Passing |
| **`warrant-siege` (CLI)** | Standalone Adversarial Suite | 11 attack scenarios ($S_1 - S_{11}$) | ~1.6s | ✅ 11/11 Passing |
| **`Mutation Suite`** | Architectural Negative Testing | 3 mutations caught RED | ~2.5s | ✅ 3/3 Caught |
| **`Agent Skill Suite`** | Skill Boundary Evaluation | 3 rule boundary checks | ~200ms | ✅ 3/3 Passing |
| **`Gateway Latency Benchmark`** | Local Processing Benchmark | 50 operations/tool (search p95 3.35ms, propose 1.71ms, exec 1.20ms; gateway processing time on localhost with mock providers) | ~1.5s | ✅ Local Processing Time Recorded |
| **`Comparative Benchmark`**| Example Unprotected Server vs. Warrant | 3 comparative attack scenarios | ~600ms | ✅ 3/3 Warrant vs 0/3 Unprotected Example |
| **`Audit Chain Verifier`** | SHA-256 Ledger Verification | Genesis-to-tip hash continuity | ~200ms | ✅ Cryptographically Continuous |
| **`Receipt Verifier`** | Ed25519 Offline Validation | Detached signature & tamper check | ~150ms | ✅ Cryptographically Valid |

---

## 4. Development & Build History

Warrant's first commit was Oct 16, 2026. The system was designed, built, and tested from scratch during the hackathon:
- **Core Architecture:** Monorepo scaffolding, MIT & Apache 2.0 licenses, MCP Streamable HTTP server, SQLite WAL repository, and integer-minor-unit currency models.
- **Provider & Resilience Engine:** Mock travel providers with failure injection (timeout, decline, disconnect), compensating saga orchestrator, and active timeout reconciler.
- **Security & Authorization Boundary:** Deterministic policy engine, out-of-band admin API, RFC 8785 canonical argument hashing, detached Ed25519 receipts, and Merkle audit prover.
- **User Interface & Tooling:** Next.js 14 companion console with live MCP trace inspection, out-of-band phone approval cards, and offline deterministic agent stub for test execution.
- **Adversarial Verification:** Standalone `@warrant/siege` CLI and test harness attacking the gateway across 11 adversarial scenarios ($S_1 - S_{11}$) with HTML/JSON scorecards.

---

## 5. Demo Video Script (2:45 Target)

| Timestamp | Scene | Key Actions & Speaking Points |
|---|---|---|
| **0:00 – 0:12** | **The Hook** | *"Voice assistants are starting to book and buy for us, with no screen to check first. Warrant makes every action limited, approved, and undoable."* Displays persistent on-screen prototype caption. |
| **0:12 – 1:00** | **Happy Path & Approval Binding** | User requests weekend trip. Live MCP trace shows Bedrock tool dispatch. Phone approval card displays exact parameters and **RFC 8785 Canonical Hash**. User approves; booking commits; Alexa speaks natural summary ($\le 300$ chars); displays detached **Ed25519 signed action receipt** and **8-second grace hold undo window**. |
| **1:00 – 1:35** | **Mid-Plan Failure & Rollback** | Mock Train service injected with `DECLINE`. Agent attempts trip booking. Hotel books, train fails. Saga Orchestrator halts forward progress and automatically cancels hotel in reverse order. Zero residue left on providers. Audit chain validates green. |
| **1:35 – 2:15** | **Adversarial Proof & Mutation Moment** | Run `npm run test:siege` in terminal showing all 11 adversarial attack scenarios pass green. Then run `npm run test:mutation`: intentionally disable approval hash check, watch Scenario S4 turn RED, restore protection, and return to 100% green. |
| **2:15 – 2:35** | **Scorecard & Open Source Deliverables** | Open interactive `scorecard.html` showing 11/11 green badges, SVG badge, and cryptographic audit proof. Highlight standalone open-source repo for the mini-challenge. |
| **2:35 – 2:45** | **Roadmap Ahead (Future Work)** | Highlight 3 future post-hackathon directions: public transparency logs, attenuated capability tokens (Macaroons) for agent delegation, and hardware-secured biometric passkeys. |

---

## 6. Monorepo Structure

```
Amazon-Developer-Hackathon/
├── packages/
│   ├── warrant-gateway/      # Core MCP server, policy engine, saga orchestrator, audit chain, mock providers
│   │   ├── src/
│   │   │   ├── crypto/       # RFC 8785 canonical JSON serializer & SHA-256 hasher
│   │   │   ├── policy/       # Pure deterministic policy engine (T0-T3 risk tiers, spend caps)
│   │   │   ├── saga/         # Compensating saga orchestrator & active timeout reconciler
│   │   │   ├── approval/     # Out-of-band approval token issuer and verification service
│   │   │   ├── idempotency/  # Multi-layer idempotency registry
│   │   │   ├── receipt/      # Ed25519 action receipt signer and offline validator
│   │   │   ├── audit/        # Tamper-evident SHA-256 event chaining & Merkle root prover
│   │   │   ├── providers/    # Autonomous Mock Hotel, Train, Restaurant providers with fault injection
│   │   │   ├── storage/      # SQLite WAL repository layer
│   │   │   └── mcp/          # Express MCP server over Streamable HTTP (2025-11-25)
│   │   └── Dockerfile
│   ├── warrant-siege/        # Standalone adversarial test harness (MIT License)
│   │   ├── src/
│   │   │   ├── cli.ts        # Commander CLI entrypoint
│   │   │   ├── runner.ts     # Scenarios S1 through S10 execution logic
│   │   │   └── reporter.ts   # Interactive HTML & JSON scorecard generators
│   │   └── LICENSE           # Standalone MIT License
│   └── alexa-client/         # Simulated Alexa+ client (Next.js 14)
│       ├── src/
│       │   ├── app/          # Glassmorphic dark-mode dashboard, phone approval card, audit ledger
│       │   └── lib/          # Bedrock Converse API agent loop with offline fallback & MCP client
│       └── Dockerfile
├── docs/
│   ├── PRD.md                # Product Requirements Document
│   ├── HLD.md                # High-Level Architecture & Threat Model
│   ├── TEST_PLAN.md          # Invariant specifications & attack scenario catalog
│   ├── DEMO_SCRIPT.md        # Official 3-minute demo video script
│   └── FRICTION_LOG.md       # AWS Bedrock & MCP SDK developer friction log (judging bonus)
├── docker-compose.yml        # One-command orchestration
├── package.json              # Monorepo workspaces configuration
└── README.md                 # This master document
```

---

## 7. Quickstart (<10 Minutes)

### Prerequisites
- Node.js 20+ and npm 10+
- (Optional) AWS account credentials with Bedrock Converse API access. (An offline deterministic fallback agent is bundled by default for zero-setup execution).

### 1. Install Dependencies
```bash
git clone https://github.com/gnshx/Amazon-Developer-Hackathon.git
cd Amazon-Developer-Hackathon
npm install
```

### 2. Run All Automated Tests
Runs unit, integration, and scenario tests across all workspace packages (66 passing in <5s):
```bash
npm run test
```

### 3. Verify Cryptographic Audit Chain
Verifies SHA-256 event chaining integrity from genesis to tip:
```bash
npm run audit:verify
```

### 4. Verify Cryptographic Action Receipts (Ed25519)
Demonstrates offline cryptographic verification of action receipts:
```bash
npm run receipt:verify
```

### 5. Run Adversarial Siege Test Suite
Executes all 11 adversarial attack scenarios against the gateway and generates `scorecard.html`, `scorecard.json`, and `scorecard-badge.svg`:
```bash
npm run test:siege
```

### 6. Run Automated Mutation Testing
Injects transient defects into approval binding, idempotency, and user isolation layers to prove that scenarios S1, S4, and S11 fail with red scorecards when protections are weakened:
```bash
npm run test:mutation
```

### 7. Run Alexa+ Latency SLA Benchmark (<500ms Platform Gate)
Verifies 50 consecutive operations over Streamable HTTP against the official Alexa+ <500ms latency ceiling:
```bash
npm run test:latency
```

### 8. Run Comparative Benchmark (Naive Unprotected vs. Warrant)
Executes 3 adversarial scenarios (duplicate storm, mid-plan failure, spend cap overflow) side-by-side against an unprotected server vs. Warrant:
```bash
npm run test:compare
```

### 9. Run Agent Skill Boundary Evaluation
Evaluates model obedience to `warrant-safe-actions` across prompt injection, timeout recovery, and budget boundaries. Executes live against Amazon Bedrock Converse API (`us.amazon.nova-pro-v1:0`) when AWS credentials are set, or deterministically against the offline agent stub:
```bash
npm run test:skill
```

### 10. Start Full Stack Locally
Spins up Warrant Gateway on `http://localhost:8000` and the Simulated Alexa+ Client on `http://localhost:3000`:
```bash
npm run dev
```

*(Note: `docker-compose.yml` and `Dockerfile` are provided in the repository, but are marked as untested on this host due to the absence of a local Docker daemon. The primary verified path is `npm install && npm run test && npm run dev` from a clean clone).*

Open `http://localhost:3000` in your browser to experience the simulated Alexa+ voice assistant, phone approval card, real-time MCP tool inspector, receipt verification modal, undo window countdown, and live audit ledger.

---

## 8. Post-Hackathon Roadmap: What You Can Add Later (Future Work)

> **Notice:** Signed Action Receipts ($I_9$) and Grace-Hold Undo Windows ($I_{10}$) have been shipped in this release. The roadmap items below represent future post-hackathon extensions turning Warrant from a prototype gateway into global trust infrastructure.

### Phase 2: Make It Real (First Weeks Post-Hackathon)
- **Live Provider Integrations:** Real payment sandboxes (Stripe test mode intents) and commercial booking APIs (Amadeus, Sabre, OpenTable).
- **Passkey (WebAuthn) Approvals:** Cryptographic biometric proofs directly from the user's secure hardware (Touch ID, Face ID, YubiKey) replacing simple button presses.
- **Multi-User Accounts & OAuth Grants:** Household role hierarchies with OAuth 2.1 grant negotiation and granular revocation interfaces.
- **Cloud Infrastructure:** Managed PostgreSQL with read replicas and a hosted public sandbox that anyone can try.

### Phase 3: Stronger Trust Guarantees
- **Public Transparency Log:** Anchor the audit chain and action receipts into an append-only Merkle tree (RFC 6962 / Sigstore) publishing signed tree heads, guaranteeing historical records cannot be silently rewritten by any party.
- **Capability Tokens (Macaroons / Biscuit Architecture):** Attenuated authority tokens that can only shrink when passed along. Establishes the cryptographic foundation for multi-agent delegation: a sub-agent can never hold more power than its parent.
- **Policy as Code (Cedar / OPA):** Express household policies in formal languages (AWS Cedar or Rego) with a shadow simulator testing policy changes against historical audit events.
- **Multi-Cloud Trust Anchors:** Distribute Merkle audit checkpoints across independent cloud providers for Byzantine fault tolerance.

### Phase 4: Smarter Protection
- **Behavioral Anomaly Detection:** Real-time flagging of unusual spend velocity, execution timing, or abnormal booking destinations with automatic escalation to phone confirmation.
- **Plan Dry-Runs:** Deterministic previews outlining side effects, provider fees, and compensation guarantees before plan submission.
- **Voice Step-Up Authentication:** Multi-factor step-up for high-risk vocal commands protecting against acoustic spoofing, deepfakes, or background overhearing.
- **Privacy & PII Redaction:** Automated tokenization and redaction of personal identifiable information before writing to audit ledgers.

### Phase 5: Ecosystem & Standards
- **Provider SDK / Middleware:** Lightweight middleware allowing brands to wrap their existing MCP servers in Warrant with fewer than 10 lines of code.
- **Safety Certification & CI Action:** Public trust badges for services passing `warrant-siege`, with a GitHub Action running scorecards on pull requests.
- **Continuous Red-Teaming:** Dynamic LLM-generated attack scenarios, tool schema fuzzing, and a growing public corpus of prompt injections.
- **Standards Proposals:** Proposing consent, approval, and receipt conventions to the Model Context Protocol (MCP) community as shared standards.

### Household & Care Use Cases
- **Shared Household Grants:** Multi-tier family rules (parents hold administrative caps; children hold category-locked micro-allowances).
- **Caregiver Co-Approval:** Dual-approval flows where an elderly person's assistant requires designated family confirmation for large transactions.
- **Context-Aware Multi-Device Approvals:** Intelligent routing of confirmations across home devices (TV canvas, smartwatch, or mobile notification).

### 🌟 Core Architectural Differentiators
The three most defensible and foundational ideas in Warrant are:
1. **Signed Receipts with a Transparency Log:** Provides cryptographically non-repudiable audit proofs that make Warrant an objective trust anchor.
2. **Capability Tokens for Agent-to-Agent Delegation:** Solves the cascading authority problem when autonomous agents hire sub-agents.
3. **Certification Built on the Harness:** Transforms `warrant-siege` into an open testing standard for the entire MCP ecosystem.

---

## 9. Hackathon Submission Highlights

- **Model Context Protocol (MCP) in Actual Code:** Conforms strictly to MCP Streamable HTTP specification `2025-11-25+` via `@modelcontextprotocol/sdk`. Both the Alexa+ client and the Siege CLI communicate over real JSON-RPC 2.0 HTTP endpoints.
- **Additional Open Source Project Mini-Challenge:** `warrant-siege` is released as a standalone open-source repository at [`github.com/gnshx/warrant-siege`](https://github.com/gnshx/warrant-siege) under the MIT License (`packages/warrant-siege/LICENSE`), allowing any developer building MCP tools to test voice safety and generate verifiable scorecards.
- **AWS Builder Mini-Challenge:** Uses the AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) with default model `us.amazon.nova-pro-v1:0` for conversational reasoning and structured tool dispatch, featuring an offline deterministic fallback for environments without live AWS credentials.
- **Developer Friction Log & Product Feedback:** Comprehensive analysis of Bedrock Converse API error ergonomics, empty tool schema validation, and MCP transport authentication documented in [`docs/FRICTION_LOG.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/FRICTION_LOG.md) (earning up to a 10% judging bonus).

---

## 10. License

- Warrant Gateway & Simulated Alexa Client: [Apache License 2.0](LICENSE)
- Warrant Siege Standalone Harness: [MIT License (github.com/gnshx/warrant-siege)](https://github.com/gnshx/warrant-siege) / [Local License](packages/warrant-siege/LICENSE)

