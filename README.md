# Warrant: A Trust Gateway for Voice Agents

[![Amazon Developer Hackathon: Alexa+ Track](https://img.shields.io/badge/Amazon%20Developer%20Hackathon-Alexa%2B%20Track-FF9900?logo=amazon)](https://devpost.com)
[![Protocol: MCP Streamable HTTP](https://img.shields.io/badge/Protocol-MCP%20Streamable%20HTTP%202025--11--25-0066FF)](https://modelcontextprotocol.io)
[![Agent: Amazon Bedrock](https://img.shields.io/badge/Agent-Amazon%20Bedrock%20Converse%20API-232F3E?logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![Test Suite: 55+ Passing](https://img.shields.io/badge/Tests-55%2B%20Passing-brightgreen)](https://github.com/gnshx/Amazon-Developer-Hackathon)
[![Siege Scorecard: 10/10 Invariants Satisfied](https://img.shields.io/badge/Siege%20Scorecard-10%2F10%20Satisfied-10b981)](#-the-10-safety-invariants--adversarial-attack-suite)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **Amazon Developer Hackathon, Alexa+ Track (16 Oct 2026 – 23 Oct 2026)**  
> **Submission Working Cutoff:** 23 October 2026, 11:59 PM IST (Official deadline: 24 Oct, 12:30 AM IST)  
> **Mini-Challenge Eligibility:** AWS Builder Mini-Challenge (Bedrock Converse API) & Additional Open Source Project Mini-Challenge (`@warrant/siege` MIT)

---

## 1. Problem Statement & Executive Summary

AI agents are starting to book, buy, cancel, and negotiate on people's behalf, and **voice makes this fundamentally riskier because there is no screen to review the action first**. 

Today, there is no standard way to:
- Tell an agent how much authority it has before it acts.
- Cryptographically prove what the agent committed to in external systems.
- Automatically undo side effects when a multi-step sequence fails halfway.
- Check that a third-party service or tool is safe to give an agent access to.

Every brand currently builds its own one-off safeguards—if any—and users are left to trust the voice assistant blindly.

**Warrant's long-term goal is to become the missing trust layer for the agentic economy.** It gives agents limited, revocable authority, produces verifiable proof of every action, handles failure automatically with zero orphan state, and lets anyone test whether a service is safe for agents.

The hackathon MVP demonstrates and proves this core trust loop over the standard Model Context Protocol (MCP Streamable HTTP spec `2025-11-25+`):
- **Scoped & Expiring Grants:** Household administrators issue temporary budgets with strict spend caps in integer minor units (zero float math).
- **Exact Action-Hash Approval Binding:** Risky actions return `PENDING_APPROVAL` with voice-friendly summaries. Approvals are granted out-of-band on a phone-style interface cryptographically bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{params}))$. If prompt injection or model drift alters any argument, the approval is mathematically invalid ($I_3$).
- **Multi-Layer Idempotency:** Guarantees retry storms or duplicate voice submissions never trigger duplicate provider charges ($I_1$).
- **Saga Orchestrator with Clean Residue:** Multi-step plans execute sequentially with a defined compensating action for each step. If step 2 fails, preceding steps are undone in reverse order ($I_4$).
- **Active Timeout Reconciliation:** Ambiguous network outcomes (e.g. dropped sockets) query external provider truth by idempotency key rather than blindly retrying ($I_8$).
- **Detached Ed25519 Action Receipts:** Every confirmed action produces a cryptographically signed receipt verifiable completely offline without trusting server state ($I_9$).
- **Undo Window & Grace Hold:** Reversible pre-settlement hold countdown on high-value plans; out-of-band cancellation aborts with zero provider bookings and zero charges ($I_{10}$).
- **Tamper-Evident Audit Ledger & Merkle Roots:** Append-only SHA-256 chained event log with binary Merkle tree checkpointing and $O(\log N)$ inclusion proof verification ($I_7$).
- **Adversarial Siege Test Harness (`warrant-siege`):** A standalone open-source CLI that subjects the gateway to 10 attack scenarios, generating interactive HTML/JSON scorecards and SVG badges.

### ⚠️ Scope Honesty Notice
The genuine Alexa+ developer environment is currently restricted to select partners. To adhere strictly to hackathon integrity and transparency guidelines:
1. **Simulated Alexa+ Client:** A Next.js 14 web application simulating voice interaction, phone approvals, receipt inspection, and live MCP tool traces.
2. **Simulated Mock Providers:** High-fidelity Hotel, Train, and Restaurant services (Coastal Rail Express, Harbor Inn Hotel) with controllable failure injection endpoints (`TIMEOUT`, `DECLINE`, `SUCCEEDED_BUT_DISCONNECTED`).

Both components are explicitly labeled as simulated in code, documentation, and the demo video.

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
2. **Bedrock Voice Agent:** Autonomous agent loop using the AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`). Operates online with live Claude 3.5 Sonnet / Haiku models or offline with a deterministic zero-credential fallback stub.
3. **Warrant Gateway (MCP Server):** TypeScript MCP server running over Streamable HTTP (spec version `2025-11-25+`) with an SQLite WAL repository, pure deterministic policy engine, RFC 8785 canonical JSON serializer, Ed25519 receipt signer, and chained SHA-256 audit ledger with Merkle root checkpointing.
4. **Mock Providers with Fault Injection:** Autonomous mock Hotel, Train, and Restaurant providers maintaining independent booking state queryable via `GET /admin/providers/:name/bookings`, with fault injection endpoints for `TIMEOUT`, `DECLINE`, and `SUCCEEDED_BUT_DISCONNECTED`.
5. **Warrant Siege Adversarial Harness:** Standalone testing CLI package (`packages/warrant-siege`) with its own MIT License that executes 10 attack scenarios against the gateway and produces machine-verifiable `scorecard.json`, interactive `scorecard.html` reports, and SVG badges.

---

## 3. The 10 Safety Invariants & Adversarial Attack Suite

Every user story and safety requirement maps directly to an architectural invariant ($I_1 - I_{10}$) verified by an attack scenario ($S_1 - S_{10}$) in `warrant-siege`:

| Invariant | Name | Description | Attack Scenario & Verification | Status |
|---|---|---|---|---|
| **$I_1$** | **No Duplicate External Effect** | No state-changing external effect occurs more than once for the same `(grant_id, tool_name, idempotency_key)`. | **S1 (Duplicate Submit Storm):** 10 concurrent execute calls dispatched with the same key. Gateway executes once; mock provider confirms exactly 1 booking. | **✅ SATISFIED** |
| **$I_2$** | **Absolute Spend Cap** | Total confirmed spend under any grant never exceeds `grant.spend_cap_minor`, regardless of agent prompts. | **S3 (Spend Cap Overflow Attack):** Agent proposes plan exceeding available grant budget. Gateway rejects with `Spend Cap Exceeded`; 0 cents spent. | **✅ SATISFIED** |
| **$I_3$** | **Cryptographic Approval Binding** | No $T_2$ action executes without an approval token bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{args}))$. | **S4 & S7 (Parameter Tampering & Bypass):** Altering price or omitting phone approval yields immediate execution rejection. | **✅ SATISFIED** |
| **$I_4$** | **Clean Residue (Saga Rollback)** | Mid-plan failure triggers automatic reverse compensation, restoring provider state to clean baseline. | **S2 (Mid-Plan Failure Rollback):** Train booking declines after hotel succeeds. Orchestrator automatically cancels hotel; 0 orphan bookings remain. | **✅ SATISFIED** |
| **$I_5$** | **Structural Output Containment** | Third-party provider responses cannot elevate privileges, alter active grants, or bypass approvals. | **S5 (Indirect Prompt Injection):** Malicious provider text attempting to call administrative grant-widening tools is blocked by MCP surface isolation. | **✅ SATISFIED** |
| **$I_6$** | **Temporal Authorization Boundary** | Expired or revoked grants authorize zero actions ($T_0, T_1, T_2$), returning deterministic 403 Forbidden. | **S6 (Expired Grant Boundary):** Invoking tools after grant expiration TTL immediately fails with `Grant Expired`. | **✅ SATISFIED** |
| **$I_7$** | **Cryptographic Audit Continuity** | Every state transition appends a SHA-256 chained event verifiable from genesis. | **S1–S10 (Audit Integrity Check):** `GET /admin/audit/verify` re-computes every hash from genesis to tip, confirming zero tampering. | **✅ SATISFIED** |
| **$I_8$** | **Reconciliation over Blind Retries** | Ambiguous network timeouts are actively reconciled against external provider truth. | **S8 (Ambiguous Timeout & Reconciliation):** Provider drops connection after save; reconciler verifies status by idempotency key and avoids dupe booking. | **✅ SATISFIED** |
| **$I_9$** | **Action Authenticity & Receipts** | Every confirmed action produces a detached Ed25519 signed receipt over RFC 8785 canonical metadata. | **S9 (Receipt Tampering Attack):** Mutating spend amount or parameter hash fails Ed25519 signature verification offline. | **✅ SATISFIED** |
| **$I_{10}$** | **Grace-Hold Containment (Undo)** | Actions held in a grace window remain pre-settled; cancellation leaves zero provider side effects and zero spend. | **S10 (Grace-Hold Undo Cancellation):** Cancelling during hold aborts execution with 0 bookings and releases 100% of reserved spend. | **✅ SATISFIED** |

---

## 4. Day-by-Day Hackathon Roadmap

| Day | Goal | Status |
|---|---|---|
| **Oct 16 (Day 1)** | Monorepo scaffolding, MIT & Apache 2.0 licenses, MCP Streamable HTTP skeleton, data model, travel booking vertical. | **✅ COMPLETED** |
| **Oct 17 (Day 2)** | Mock providers with failure injection (timeout, decline, disconnect), tools, idempotency store, audit log. | **✅ COMPLETED** |
| **Oct 18 (Day 3)** | Policy engine, grants, spend caps in integer minor units, approval flow with RFC 8785 canonical hash binding. | **✅ COMPLETED** |
| **Oct 19 (Day 4)** | Saga orchestrator with reverse compensation, active timeout reconciler for ambiguous network outcomes. | **✅ COMPLETED** |
| **Oct 20 (Day 5)** | Simulated Alexa+ Next.js 14 client, Bedrock Converse API agent loop with offline stub, live tool trace inspector. | **✅ COMPLETED** |
| **Oct 21 (Day 6)** | Standalone `warrant-siege` attack harness & HTML/JSON scorecard generator. All 10 scenarios passing. | **✅ COMPLETED** |
| **Oct 22 (Day 7)** | Polish, Docker Compose, fresh-clone test (<10 min), friction log, AWS product feedback, architecture docs. | **✅ COMPLETED** |
| **Oct 23 (Day 8 - Cutoff)** | Record 3-minute demo video, complete Devpost submission package before 11:59 PM IST cutoff. | **READY FOR SUBMISSION** |

### Cut Order Protocol
If delayed at any point, non-critical features are cut in this strict order:
1. Voice microphone STT (keep typed voice simulation with real speech synthesis).
2. Polished approval UI animations (keep functional card view).
3. End-to-end live agent attacks (rely on deterministic protocol-level attacks in `warrant-siege`).
4. Cloud hosting (keep local demo via Docker Compose / `npm run dev`).
*Must never cut: Automatic Saga Rollback ($I_4$) or Action-Hash Approval Binding ($I_3$).*

---

## 5. Demo Video Script (Under 3:00 Minutes)

| Timestamp | Scene | Key Actions & Speaking Points |
|---|---|---|
| **0:00 – 0:20** | **The Problem** | Voice assistants can spend money with no screen to check. One hallucination, timeout, or prompt injection can drain accounts or double-book. Warrant makes voice agent actions safe and auditable. |
| **0:20 – 1:10** | **Happy Path & Approval Binding** | User asks Alexa to book a weekend trip. Bedrock agent searches and proposes plan. Phone approval card displays exact parameters and **RFC 8785 Canonical Hash**. User approves; booking commits; Alexa speaks natural summary ($\le 300$ chars); 1-click audit chain validates green. |
| **1:10 – 1:50** | **Mid-Plan Failure & Rollback** | Train service injected with `DECLINE`. Agent attempts trip booking. Hotel books, train fails. Saga Orchestrator halts forward progress and automatically cancels hotel in reverse order. Zero residue left on providers. |
| **1:50 – 2:30** | **Adversarial Siege (`warrant-siege`)** | Run `npm run test:siege` in terminal. Show all 8 adversarial attack scenarios executing against the live gateway and getting blocked by gateway invariants. |
| **2:30 – 2:50** | **Scorecard & Open Source Deliverables** | Open interactive `scorecard.html` showing 8/8 green badges and cryptographic audit proof. Highlight standalone open-source repo for the mini-challenge. |
| **2:50 – 3:00** | **Roadmap Ahead (Future Work)** | Highlight 3 future post-hackathon directions: signed action receipts with transparency logs, capability tokens for agent-to-agent delegation, and certification built on the harness. |

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
│   │   │   ├── audit/        # Tamper-evident SHA-256 event chaining
│   │   │   ├── providers/    # Autonomous Mock Hotel, Train, Restaurant providers with fault injection
│   │   │   ├── storage/      # SQLite WAL repository layer
│   │   │   └── mcp/          # Express MCP server over Streamable HTTP (2025-11-25)
│   │   └── Dockerfile
│   ├── warrant-siege/        # Standalone adversarial test harness (MIT License)
│   │   ├── src/
│   │   │   ├── cli.ts        # Commander CLI entrypoint
│   │   │   ├── runner.ts     # Scenarios S1 through S8 execution logic
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
Runs unit, integration, and scenario tests across all workspace packages (55+ passing in <5s):
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
Executes all 10 adversarial attack scenarios against the gateway and generates `scorecard.html`, `scorecard.json`, and `scorecard-badge.svg`:
```bash
npm run test:siege
```

### 6. Run Automated Mutation Testing
Injects transient defects into approval binding and idempotency layers to prove that scenarios S1 and S4 fail with red scorecards when protections are weakened:
```bash
npm run test:mutation
```

### 7. Start Full Stack Locally
Spins up Warrant Gateway on `http://localhost:8000` and the Simulated Alexa+ Client on `http://localhost:3000`:
```bash
npm run dev
```

Or using Docker Compose:
```bash
docker compose up --build
```

Open `http://localhost:3000` in your browser to experience the simulated Alexa+ voice assistant, phone approval card, real-time MCP tool inspector, receipt verification modal, undo window countdown, and live audit ledger.

---

## 8. Post-Hackathon Roadmap: What You Can Add Later (Future Work)

> **Notice:** The roadmap items below represent future post-hackathon extensions turning Warrant from a prototype gateway into global trust infrastructure.

### Phase 2: Make It Real (First Weeks Post-Hackathon)
- **Live Provider Integrations:** Real payment sandboxes (Stripe test mode intents) and commercial booking APIs (Amadeus, Sabre, OpenTable).
- **Passkey (WebAuthn) Approvals:** Cryptographic biometric proofs directly from the user's secure hardware enclave (Touch ID, Face ID, YubiKey) replacing simple button presses.
- **Multi-User Accounts & OAuth Grants:** Household role hierarchies with OAuth 2.1 grant negotiation and granular revocation interfaces.
- **Cloud Infrastructure:** Managed PostgreSQL with read replicas and a hosted public sandbox that anyone can try.

### Phase 3: Stronger Trust Guarantees
- **Signed Action Receipts:** Every action produces a detached Ed25519 cryptographically signed receipt that any third party can verify without trusting the gateway.
- **Transparency Log:** Anchor the audit chain into an append-only Merkle tree (RFC 6962 / Sigstore) publishing signed tree heads, guaranteeing historical records cannot be silently rewritten.
- **Capability Tokens (Macaroons / Biscuit Architecture):** Attenuated authority tokens that can only shrink when passed along. Establishes the mathematical foundation for multi-agent delegation: a sub-agent can never hold more power than its parent.
- **Policy as Code (Cedar / OPA):** Express household policies in formal languages (AWS Cedar or Rego) with a shadow simulator testing policy changes against historical audit events.
- **Undo Windows:** Configurable grace periods for high-risk reversible commitments before final settlement (analogous to "undo send").

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
1. **Signed Receipts with a Transparency Log:** Provides mathematically non-repudiable audit proofs that make Warrant an objective trust anchor.
2. **Capability Tokens for Agent-to-Agent Delegation:** Solves the cascading authority problem when autonomous agents hire sub-agents.
3. **Certification Built on the Harness:** Transforms `warrant-siege` into an open testing standard for the entire MCP ecosystem.

---

## 9. Hackathon Submission Highlights

- **Model Context Protocol (MCP) in Actual Code:** Conforms strictly to MCP Streamable HTTP specification `2025-11-25+` via `@modelcontextprotocol/sdk`. Both the Alexa+ client and the Siege CLI communicate over real JSON-RPC 2.0 HTTP endpoints.
- **Additional Open Source Project Mini-Challenge:** `packages/warrant-siege` is structured as an independent package under the MIT License (`packages/warrant-siege/LICENSE`), allowing any developer building MCP tools to test voice safety and generate verifiable scorecards.
- **AWS Builder Mini-Challenge:** Uses the AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) for conversational reasoning and structured tool dispatch, featuring an offline deterministic fallback for environments without live AWS credentials.
- **Developer Friction Log & Product Feedback:** Comprehensive analysis of Bedrock Converse API error ergonomics, empty tool schema validation, and MCP transport authentication documented in [`docs/FRICTION_LOG.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/FRICTION_LOG.md) (earning up to a 10% judging bonus).

---

## 10. License

- Warrant Gateway & Simulated Alexa Client: [Apache License 2.0](LICENSE)
- Warrant Siege Adversarial Test Harness: [MIT License](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/warrant-siege/LICENSE)

