# Warrant: A Trust Gateway for Voice Agents

[![Amazon Developer Hackathon: Alexa+ Track](https://img.shields.io/badge/Amazon%20Developer%20Hackathon-Alexa%2B%20Track-FF9900?logo=amazon)](https://devpost.com)
[![Protocol: MCP Streamable HTTP](https://img.shields.io/badge/Protocol-MCP%20Streamable%20HTTP%202025--11--25-0066FF)](https://modelcontextprotocol.io)
[![Agent: Amazon Bedrock](https://img.shields.io/badge/Agent-Amazon%20Bedrock%20Converse%20API-232F3E?logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![Test Suite: 60 Passing](https://img.shields.io/badge/Tests-60%20Passing-brightgreen)](https://github.com/gnshx/Amazon-Developer-Hackathon)
[![Siege Scorecard: 11/11 Invariants Satisfied](https://img.shields.io/badge/Siege%20Scorecard-11%2F11%20Satisfied-10b981)](#-the-10-safety-invariants--adversarial-attack-suite)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **Amazon Developer Hackathon, Alexa+ Track (16 Oct 2026 – 23 Oct 2026)**  
> **Submission Working Cutoff:** 23 October 2026, 11:59 PM IST (Official deadline: 24 Oct, 12:30 AM IST)  
> **Mini-Challenge Eligibility:** AWS Builder Mini-Challenge (Bedrock Converse API) & Additional Open Source Project Mini-Challenge (`@warrant/siege` MIT)  
> ⚖️ **For Hackathon Judges:** Reviewing Warrant? See [**`JUDGES.md`**](JUDGES.md) for a 60-second evaluation path, scoring criteria breakdown, and offline verification commands with zero setup or AWS keys needed.

---

## 1. Problem Statement & Executive Summary

AI agents are starting to book, buy, cancel, and negotiate on people's behalf, and **voice makes this fundamentally riskier because there is no screen to review the action first**. 

Today, there is no standard way to:
- Tell an agent how much authority it has before it acts.
- Cryptographically prove what the agent committed to in external systems.
- Automatically undo side effects when a multi-step sequence fails halfway.
- Check that a third-party service or tool is safe to give an agent access to.

Every brand currently builds its own one-off safeguards—if any—and users are left to trust the voice assistant blindly.

**Warrant is a transactional safety layer for agents that act in the real world: bounded authority, exact-action approval, no double-charges, automatic rollback, and receipts anyone can verify, tested by attacks that fail when a protection is removed.**

---

### 🏆 Competitive Landscape & Architectural Positioning

Approval gates and audit logs are common in this track. However, existing submissions take narrow approaches:
- **JudgeGuard** exposes a `judgeguard_verify_action` tool backed by Bedrock models (model-based heuristic policy checking rather than deterministic cryptographic enforcement).
- **alexa-plus** introduces a human-in-the-loop gate strictly in front of smart-home device actions.
- **Northbridge** pairs an append-only audit ledger with escalate-only decisions.

#### What Warrant Has That Others Lack:
1. **True Transactional Safety:** Multi-layer idempotency against duplicate voice retry storms ($I_1$), multi-step saga rollback with zero orphan residue ($I_4$), and active timeout reconciliation against provider truth ($I_8$). This aligns directly with Alexa+'s checkout requirements for distributed transactional resilience.
2. **Cryptographic Approval Binding & Signed Receipts:** High-risk actions are cryptographically bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{params}))$ ($I_3$), generating detached Ed25519 signed receipts ($I_9$) and Merkle inclusion proofs ($I_7$) verifiable completely offline.
3. **Falsifiable Proof (The Adversarial Harness):** A standalone suite (`warrant-siege`) executing 11 attack scenarios ($S_1 - S_{11}$), coupled with automated mutation testing (`npm run test:mutation`) that intentionally breaks 3 safeguards to prove the scorecard turns RED.
4. **Tool-Agnostic, Reusable Testing:** A standalone CLI that can be cloned and run against *any* MCP server over Streamable HTTP.

#### Relationship to Big Players & Academic Research:
- **AWS AgentCore Policy (GA March 3, 2026) — *Complementary, not competing*:** AWS AgentCore Policy evaluates individual tool calls outside the agent's reasoning loop based on caller identity and tool arguments (per-call authorization). However, AgentCore Policy does not track cumulative minor-unit spend budgets across multi-turn conversations, orchestrate compensating saga rollbacks upon mid-plan failure, issue signed receipts, or perform active reconciliation of dropped network sockets. Warrant acts as the transactional execution runtime underneath or alongside AgentCore.
- **Google AP2 (Agent Payment Protocol):** AP2 uses signed intent, cart, and payment mandates. Warrant's out-of-band grant maps to an intent mandate, and parameter-bound approval maps to a cart mandate. While AP2 focuses on payment authorization rails, Warrant provides the missing distributed systems runtime (saga compensation, timeout reconciliation, and zero orphan state).
- **Academic Research (CaMeL):** Research by CaMeL demonstrates that untrusted third-party data must never influence agent control flow. Warrant implements propose-then-execute gateway constraints enforced strictly at the tool boundary, rendering indirect prompt injection incapable of altering administrative authority ($I_5$).
- **Repositioning vs. Alexa Voice Checkout:** Alexa handles voice PIN, payment instrument selection, and purchase confirmation. Warrant handles what happens underneath: multi-step operational transactional safety—holding plans in limits, unwinding previous steps if step 2 fails, reconciling dropped sockets, and generating verifiable receipts.

---

### 🌐 Alexa+ Compatibility & Readiness Checklist

Warrant was engineered to satisfy the real-world operational requirements of the Alexa+ platform:

| Platform Requirement | Alexa+ Developer Specification | Warrant Gateway Implementation | Verification Status |
|:---|:---|:---|:---:|
| **Transport** | MCP Streamable HTTP | Full JSON-RPC 2.0 over Streamable HTTP (`@modelcontextprotocol/sdk`) | **✅ PASS** |
| **Network Reachability** | Remote HTTPS URL | Public tunnel & reverse proxy compatible | **✅ PASS** |
| **OAuth 2.1 Protected Resource** | RFC 9728 Resource Metadata | `GET /.well-known/oauth-protected-resource` returns resource metadata | **✅ PASS** |
| **Auth Challenge** | RFC 6750 / 9728 401 Challenge | 401 on unauthenticated calls; header-only Bearer tokens (query tokens rejected) | **✅ PASS** |
| **Demo OAuth 2.1 Server** | OAuth 2.1 + PKCE S256 + RFC 8707 | Demo authorization code flow for local testing (`/.well-known/oauth-authorization-server`) | **✅ PASS (Demo)** |
| **Latency SLA** | < 500 ms response time | Gateway average **1.58 ms**, p99 **34.68 ms** (`npm run test:latency`) | **✅ PASS (14x margin)** |
| **Identity Binding** | Tied to authenticated user | Grants bound to OAuth `sub` subject / `userId`, not client session | **✅ PASS** |
| **Out-of-Band Elicitation** | MCP 2025-11-25 Elicitation | `propose_plan` returns `elicitation: { mode: "url" }` for phone approval | **✅ PASS** |
| **Tool Annotations** | MCP Semantic Hints | `readOnly`, `destructive`, `idempotent`, `riskTier` annotated on all tools | **✅ PASS** |

---

### MCP Server plus Agent Skill Architecture
Warrant is delivered as a cooperative pair:
1. **Agent Skill ([`skills/warrant-safe-actions/SKILL.md`](skills/warrant-safe-actions/SKILL.md)):** An open skill that instructs the assistant on safe action sequencing—search before you plan, always propose before executing, reuse one idempotency key per user intent, treat third-party provider text as untrusted data (prompt injection immunity), never approve on the user's behalf, and format voice summaries under 300 characters.
2. **Warrant Trust Gateway (MCP Server):** The mathematical enforcement boundary operating over Streamable HTTP (spec `2025-11-25+`). Even if a compromised or hallucinating model disobeys the skill, the gateway deterministically blocks unauthorized spend, tampered parameters, or unapproved actions.

The hackathon MVP demonstrates and proves this core trust loop:
- **Scoped & Expiring Grants:** Household administrators issue temporary budgets with strict spend caps in integer minor units (zero float math).
- **Exact Action-Hash Approval Binding:** Risky actions return `PENDING_APPROVAL` with voice-friendly summaries. Approvals are granted out-of-band on a phone-style interface cryptographically bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{params}))$. If prompt injection or model drift alters any argument, the approval is mathematically invalid ($I_3$).
- **Multi-Layer Idempotency:** Guarantees retry storms or duplicate voice submissions never trigger duplicate provider charges ($I_1$).
- **Saga Orchestrator with Clean Residue:** Multi-step plans execute sequentially with a defined compensating action for each step. If step 2 fails, preceding steps are undone in reverse order ($I_4$).
- **Active Timeout Reconciliation:** Ambiguous network outcomes (e.g. dropped sockets) query external provider truth by idempotency key rather than blindly retrying ($I_8$).
- **Detached Ed25519 Action Receipts:** Every confirmed action produces a cryptographically signed receipt verifiable completely offline without trusting server state ($I_9$).
- **Undo Window & Grace Hold:** Reversible pre-settlement hold countdown on high-value plans; out-of-band cancellation aborts with zero provider bookings and zero charges ($I_{10}$).
- **Tamper-Evident Audit Ledger & Merkle Roots:** Append-only SHA-256 chained event log with binary Merkle tree checkpointing and $O(\log N)$ inclusion proof verification ($I_7$).
- **Adversarial Siege Test Harness (`warrant-siege`):** A standalone open-source CLI that subjects the gateway to 11 attack scenarios, generating interactive HTML/JSON scorecards and SVG badges.

### ⚠️ Limitations & Transparent Scope Disclosures
To maintain uncompromising engineering transparency, the following constraints are explicitly documented:
1. **Simulated Providers & Client:** The official Alexa+ developer preview is currently restricted to select partners. The Alexa+ companion web console is a high-fidelity Next.js simulator, and the hotel/train/restaurant providers are in-memory mock services with controllable fault endpoints (`TIMEOUT`, `DECLINE`, `SUCCEEDED_BUT_DISCONNECTED`).
2. **No Real Financial Settlement:** All transactions are denominated in integer minor units (cents) and settled within mock booking stores; no actual credit card or bank rails are charged.
3. **Model Plan Generation vs. Gateway Damage Limitation:** LLMs can still hallucinate or generate inefficient plans; Warrant's role is not to guarantee LLM conversational brilliance, but to mathematically guarantee that no action executes outside policy bounds, spend caps, or unapproved parameters.
4. **Structural Defense vs. Text Heuristics:** Warrant defends against prompt injection structurally (by separating data plane from out-of-band control plane and validating canonical parameter hashes), rather than relying on brittle regex or heuristic sentiment/prompt-guard classifiers.
5. **Storage Architecture:** Uses SQLite in WAL mode with a decoupled repository interface; while ideal for single-node / edge deployment, distributed production environments would swap the repository implementation for PostgreSQL or Amazon DynamoDB.
6. **No External Third-Party Audit:** While verified against 11 automated attack scenarios, property tests, and mutation tests, Warrant has not undergone a formal third-party commercial pen-test.
7. **Prior Work & Open Source Disclosure:** Transparently acknowledges prior architectural concepts in autonomous agent bounding (including the author's previous exploration of passkey-bounded mandates on Monad in `AgentTrust`), adapted and re-architected from scratch for AWS Bedrock, Amazon Alexa+, and Model Context Protocol Streamable HTTP under Apache 2.0 / MIT.
8. **Simulated Demo OAuth 2.1 Server:** The repository includes a lightweight, simulated OAuth 2.1 authorization server (`/.well-known/oauth-authorization-server`, `GET /oauth/authorize`, `POST /oauth/token`) with PKCE (S256 mandatory) and RFC 8707 Resource Indicators for local testing, evaluation, and CI workflows. It is strictly a demo authorization server for developer evaluation and does not represent official Amazon Alexa+ certification or production identity infrastructure.

### Visual Interface & Safety Flow

| 1. Assistant Console & Live MCP Traces | 2. Out-of-Band Phone Approval Card |
|:---:|:---:|
| ![Assistant Console](docs/assets/1-assistant-console.png) | ![Phone Approval](docs/assets/2-phone-approval.png) |
| **3. Mid-Plan Failure & Saga Rollback** | **4. Adversarial Siege Safety Scorecard (11/11)** |
| ![When Something Fails](docs/assets/3-when-something-fails.png) | ![Safety Scorecard](docs/assets/4-safety-scorecard.png) |

| 5. Your Assistant's Limits (Out-of-Band Household Policy) |
|:---:|
| ![Your Assistant's Limits](docs/assets/5-assistants-limits.png) |

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
2. **Bedrock Voice Agent:** Autonomous agent loop using the AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`). Configured for Amazon Nova Pro (`amazon.nova-pro-v1:0`) or Claude cross-region inference profiles, with a deterministic zero-credential fallback stub for offline testing and automated CI.
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
> **60 automated unit & integration tests**, **11 adversarial siege attack scenarios** ($S_1 - S_{11}$), **3 architectural mutation tests**, **3 agent skill boundary checks**, **1 latency SLA benchmark** (50 requests), and **1 comparative benchmark** (3 scenarios).

| Verification Suite | Type | Verified Scope | Execution Time | Status |
|:---|:---|:---:|:---:|:---:|
| **`@warrant/gateway`** | Vitest Unit & Integration | 58 unit & integration tests | ~500ms | ✅ 58/58 Passing |
| **`@warrant/alexa-client`** | Vitest Agent Integration | 1 Bedrock agent loop test | ~300ms | ✅ 1/1 Passing |
| **`@warrant/siege`** | Vitest Scenario Runner | 1 scenario suite test | ~1.6s | ✅ 1/1 Passing |
| **`warrant-siege` (CLI)** | Standalone Adversarial Suite | 11 attack scenarios ($S_1 - S_{11}$) | ~1.6s | ✅ 11/11 Passing |
| **`Mutation Suite`** | Architectural Negative Testing | 3 mutations caught RED | ~2.5s | ✅ 3/3 Caught |
| **`Agent Skill Suite`** | Skill Boundary Evaluation | 3 rule boundary checks | ~200ms | ✅ 3/3 Passing |
| **`Latency SLA Gate`** | Streamable HTTP SLA Benchmark | 50 operations (avg 1.58ms, p99 34ms) | ~1.5s | ✅ <500ms Passing |
| **`Comparative Benchmark`**| Naive vs. Warrant Attack Run | 3 comparative attack scenarios | ~600ms | ✅ 3/3 Warrant vs 0/3 Naive |
| **`Audit Chain Verifier`** | SHA-256 Ledger Verification | Genesis-to-tip hash continuity | ~200ms | ✅ Cryptographically Continuous |
| **`Receipt Verifier`** | Ed25519 Offline Validation | Detached signature & tamper check | ~150ms | ✅ Cryptographically Valid |

---

## 4. Day-by-Day Hackathon Roadmap

| Day | Goal | Status |
|---|---|---|
| **Oct 16 (Day 1)** | Monorepo scaffolding, MIT & Apache 2.0 licenses, MCP Streamable HTTP skeleton, data model, travel booking vertical. | **✅ COMPLETED** |
| **Oct 17 (Day 2)** | Mock providers with failure injection (timeout, decline, disconnect), tools, idempotency store, audit log. | **✅ COMPLETED** |
| **Oct 18 (Day 3)** | Policy engine, grants, spend caps in integer minor units, approval flow with RFC 8785 canonical hash binding. | **✅ COMPLETED** |
| **Oct 19 (Day 4)** | Saga orchestrator with reverse compensation, active timeout reconciler for ambiguous network outcomes. | **✅ COMPLETED** |
| **Oct 20 (Day 5)** | Simulated Alexa+ Next.js 14 client, Bedrock Converse API agent loop with offline stub, live tool trace inspector. | **✅ COMPLETED** |
| **Oct 21 (Day 6)** | Standalone `warrant-siege` attack harness & HTML/JSON scorecard generator. All 11 scenarios passing. | **✅ COMPLETED** |
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

## 5. Demo Video Script (2:45 Target)

| Timestamp | Scene | Key Actions & Speaking Points |
|---|---|---|
| **0:00 – 0:12** | **The Hook** | *"Voice assistants are starting to book and buy for us, with no screen to check first. Warrant makes every action limited, approved, and undoable."* Displays persistent on-screen prototype caption. |
| **0:12 – 1:00** | **Happy Path & Approval Binding** | User requests weekend trip. Live MCP trace shows Bedrock tool dispatch. Phone approval card displays exact parameters and **RFC 8785 Canonical Hash**. User approves; booking commits; Alexa speaks natural summary ($\le 300$ chars); displays detached **Ed25519 signed action receipt** and **8-second grace hold undo window**. |
| **1:00 – 1:35** | **Mid-Plan Failure & Rollback** | Mock Train service injected with `DECLINE`. Agent attempts trip booking. Hotel books, train fails. Saga Orchestrator halts forward progress and automatically cancels hotel in reverse order. Zero residue left on providers. Audit chain validates green. |
| **1:35 – 2:15** | **Adversarial Proof & Mutation Moment** | Run `npm run test:siege` in terminal showing all 10 adversarial attack scenarios pass green. Then run `npm run test:mutation`: intentionally disable approval hash check, watch Scenario S4 turn RED, restore protection, and return to 100% green. |
| **2:15 – 2:35** | **Scorecard & Open Source Deliverables** | Open interactive `scorecard.html` showing 10/10 green badges, SVG badge, and cryptographic audit proof. Highlight standalone open-source repo for the mini-challenge. |
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
Evaluates model obedience to `warrant-safe-actions` across prompt injection, timeout recovery, and budget boundaries. Executes live against Amazon Bedrock Converse API (`amazon.nova-pro-v1:0`) when AWS credentials are set, or deterministically against the offline agent stub:
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
- **Capability Tokens (Macaroons / Biscuit Architecture):** Attenuated authority tokens that can only shrink when passed along. Establishes the mathematical foundation for multi-agent delegation: a sub-agent can never hold more power than its parent.
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
1. **Signed Receipts with a Transparency Log:** Provides mathematically non-repudiable audit proofs that make Warrant an objective trust anchor.
2. **Capability Tokens for Agent-to-Agent Delegation:** Solves the cascading authority problem when autonomous agents hire sub-agents.
3. **Certification Built on the Harness:** Transforms `warrant-siege` into an open testing standard for the entire MCP ecosystem.

---

## 9. Hackathon Submission Highlights

- **Model Context Protocol (MCP) in Actual Code:** Conforms strictly to MCP Streamable HTTP specification `2025-11-25+` via `@modelcontextprotocol/sdk`. Both the Alexa+ client and the Siege CLI communicate over real JSON-RPC 2.0 HTTP endpoints.
- **Additional Open Source Project Mini-Challenge:** `warrant-siege` is released as a standalone open-source repository at [`github.com/gnshx/warrant-siege`](https://github.com/gnshx/warrant-siege) under the MIT License (`packages/warrant-siege/LICENSE`), allowing any developer building MCP tools to test voice safety and generate verifiable scorecards.
- **AWS Builder Mini-Challenge:** Uses the AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) with default model `amazon.nova-pro-v1:0` for conversational reasoning and structured tool dispatch, featuring an offline deterministic fallback for environments without live AWS credentials.
- **Developer Friction Log & Product Feedback:** Comprehensive analysis of Bedrock Converse API error ergonomics, empty tool schema validation, and MCP transport authentication documented in [`docs/FRICTION_LOG.md`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/FRICTION_LOG.md) (earning up to a 10% judging bonus).

---

## 10. License

- Warrant Gateway & Simulated Alexa Client: [Apache License 2.0](LICENSE)
- Warrant Siege Standalone Harness: [MIT License (github.com/gnshx/warrant-siege)](https://github.com/gnshx/warrant-siege) / [Local License](packages/warrant-siege/LICENSE)

