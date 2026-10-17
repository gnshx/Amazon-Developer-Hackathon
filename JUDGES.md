# Judge Evaluation Guide · Warrant Trust Gateway

> **Quick Summary for Hackathon Evaluators:**  
> Warrant is a trust gateway that enforces cryptographically sealed economic and safety boundaries on autonomous voice agents (built for Amazon Alexa+ and AWS Bedrock over Model Context Protocol Streamable HTTP).  
> **Zero AWS keys, zero Alexa developer seats, and zero setup required to verify all safety claims.**

---

## ⚡ 60-Second Evaluation Path (Zero Setup Required)

Evaluators do not need an AWS account, Bedrock credentials, an Alexa developer preview seat, or live payment cards. Everything can be verified deterministically from source in under 60 seconds:

```bash
# 1. Run the Adversarial Siege Harness (Executes all 11 attack scenarios in ~2s)
npm run test:siege

# 2. Run the Mutation Test (Intentionally breaks 3 safeguards; proves scorecard turns RED)
npm run test:mutation

# 3. Run Comparative Benchmark (Example unprotected server 0/3 vs Warrant Gateway 3/3)
npm run test:compare

# 4. Run Gateway Processing Latency Benchmark (50 calls/tool on localhost)
npm run test:latency

# 5. Verify Offline Cryptographic Evidence Bundle (<300ms, zero server/db needed)
npm run verify:evidence
```

### What a Pass Looks Like:
1. **`npm run test:siege`** reports `Scorecard: 11/11 Scenarios Passed`, confirms Invariants $I_1 - I_{10}$ satisfied, and generates [`packages/warrant-siege/scorecard.html`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/warrant-siege/scorecard.html).
2. **`npm run test:mutation`** passes its detection check:
   - Baseline clean (11/11 green).
   - Invariant $I_1$ mutated (idempotency disabled) $\to$ **Scenario S1 fails RED** as expected.
   - Invariant $I_3$ mutated (approval hash disabled) $\to$ **Scenario S4 fails RED** as expected.
   - Invariant $I_6$ mutated (user isolation disabled) $\to$ **Scenario S11 fails RED** as expected.
   - Proves the test suite is actively catching attacks rather than vacuously passing.
3. **`npm run test:compare`** tests an intentionally unprotected example server we wrote vs. Warrant under identical attack loads:
   - Unprotected example server fails 0/3 (10 duplicate bookings charged, $120 orphaned hotel residue, budget exceeded).
   - Warrant passes 3/3 (1 deduplicated booking, $0 orphan residue after rollback, budget ceiling enforced).
4. **`npm run test:latency`** measures gateway processing time on localhost across 50 calls per tool:
   - Measured on localhost (12th Gen Intel i7, no network/TLS overhead): search p95 **2.81 ms**, propose p95 **1.64 ms**, execute p95 **1.28 ms**.
5. **`npm run verify:evidence`** cryptographically validates the committed sample bundle in [`examples/evidence/`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/examples/evidence/):
   - Detached **Ed25519 signature** verified over canonical RFC 8785 action parameters ($I_9$).
   - In-memory tamper attempt (mutating \$360.00 to \$36.00) is **cryptographically rejected**.
   - SHA-256 event chaining verified continuous from genesis ($I_7$).

---

## 🎯 Scoring Against the Official Hackathon Criteria

### 1. Technological Implementation
- **Conforms to MCP Streamable HTTP Spec (`2025-11-25`):** Standard JSON-RPC over Streamable HTTP transport, compatible with Anthropic Claude Desktop, Cursor, and AWS Bedrock Agent MCP bridges.
- **RFC 9728 OAuth Protected Resource Metadata:** Live `GET /.well-known/oauth-protected-resource` endpoint returning canonical resource identifier and scopes; returns 401 on unauthenticated calls.
- **User Identity Binding:** Grants and authorizations are bound to authenticated user identity (`userId` / OAuth `sub` claim), not ephemeral client session tokens.
- **Local Gateway Processing Latency:** 50 consecutive calls on localhost measure search p95 **2.81 ms**, propose p95 **1.64 ms**, execute p95 **1.28 ms** (12th Gen Intel i7, no network/TLS overhead; `npm run test:latency`).
- **MCP 2025-11-25 Semantic Tool Annotations:** Tools specify standard `readOnlyHint`, `destructiveHint`, and `idempotentHint`, alongside custom metadata like `riskTier` and companion approval URLs.
- **Cryptographic Parameter Binding ($I_3$):** All high-risk ($T_2$) actions require approvals bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{args}))$. Changing a single date, price, or ID breaks the approval token.
- **Multi-Layer Idempotency ($I_1$):** Dual-indexed in SQLite with in-flight state tracking (`PROCESSING` $\to$ `COMPLETED`). Concurrent voice retry storms execute external side effects exactly once.
- **Compensating Saga Orchestrator ($I_4$):** Multi-step plans execute with strict atomicity; mid-flight failures trigger reverse compensations, guaranteeing zero orphan state or charges ($I_4$).
- **Active Timeout Reconciliation ($I_8$):** Socket disconnects and HTTP timeouts are reconciled against the external provider's truth using the idempotency key, never blindly retried.
- **Detached Ed25519 Signed Receipts ($I_9$):** Every executed action generates a verifiable signed receipt that anyone can audit offline without trusting the gateway.
- **Zero Floating-Point Financial Math:** All currency is denominated strictly in non-negative integer minor units (cents/pence: \$150.00 is `15000`).
- **Amazon Bedrock Converse API Loop:** Autonomous voice agent tool-calling loop with Amazon Nova Pro (`amazon.nova-pro-v1:0`) and deterministic zero-credential fallback stub for CI.

### 2. Design
- **The Voice Dilemma Solved:** Voice assistants cannot present full checkout screens before execution. Warrant solves this by enforcing an out-of-band companion phone approval flow for actions exceeding the household threshold (\$200), with voice-first spoken summaries ($\le 300$ characters).
- **Repositioning Around Alexa Voice Checkout:** Alexa handles voice PIN, payment instrument selection, and purchase confirmation, with documentation emphasizing idempotency. Warrant handles the complementary operational transactional safety layer: keeping multi-step plans within household limits and rolling them back if an intermediate step fails.
- **5-View Companion Experience (Next.js 14):** Pixel-accurate console implementing 5 human-designed views:
  1. *Assistant Console & Live MCP Traces:* Real-time telemetry, tool arguments, and natural speech synthesis.
  2. *Out-of-Band Phone Approval Card:* Exact canonical arguments, price breakdown, and SHA-256 hash.
  3. *Mid-Plan Rollback Inspector:* Visual compensation tree when a step fails mid-flight.
  4. *Adversarial Safety Scorecard:* Live and sample status across the 11 core adversarial scenarios.
  5. *Household Policy & Limits Editor:* Interactive out-of-band admin interface with persistent saving.
- **Pre-Settlement Undo Countdown Bar:** Real-time 8-second grace countdown with one-click reversible cancellation ($I_{10}$).
- **Receipt Verification Inspector:** Cryptographic modal displaying detached Ed25519 signature and canonical payload verification.

### 3. Potential Impact
- **Unlocking High-Stakes Autonomous Voice Commerce:** Solves the core existential friction preventing users and brands from trusting voice assistants with real money: the fear of runaway spend, double-charges, and abandoned mid-plan state.
- **Universal Ecosystem Testing via `@warrant/siege`:** Reusable CLI and GitHub Action that evaluates any third-party MCP tool server for transactional safety before exposing it to Alexa+ users.
- **Relationship to AWS AgentCore Policy (GA March 3, 2026):** AgentCore Policy provides per-call authorization. Warrant targets a different layer (multi-step limits, rollback, receipts) and could sit alongside it. We have not integrated or tested with AgentCore.
- **Bridges to Emerging Protocols (Google AP2):** Bridges payment intent/cart mandates into a distributed systems execution environment with automatic compensation and idempotency.

### 4. Quality of the Idea
- **Novel Synthesis of Distributed Systems & Agent Safety:** Unifies Saga orchestration, RFC 8785 canonical hashing, detached Ed25519 signatures, and active timeout reconciliation into an elegant gateway architecture.
- **Propose-then-Execute Structural Containment (CaMeL Research):** Immunizes against indirect prompt injection at the tool boundary ($I_5$) by physically isolating the data plane from administrative grant widening.
- **Falsifiable Security Proof:** Instead of claiming safety hypothetically, Warrant proves it with 11 attack scenarios in `warrant-siege` and an automated mutation test (`npm run test:mutation`) that breaks 3 distinct safeguards to prove the scorecard turns RED.
- **Portable Agent Skill (`skills/warrant-safe-actions/SKILL.md`):** Defense-in-depth pairing: a cooperative prompt skill that guides conversational agent behavior, enforced by a deterministic gateway boundary that catches any deviation. Evaluated via `npm run test:skill` (executing live against Bedrock when AWS credentials exist, or deterministically labeled as an offline contract stub otherwise).

---

## 🛡️ STRIDE Threat Matrix & Invariant Mapping

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

---

## 📊 Comprehensive Verification Summary

> **Exact Verification Breakdown:**  
> **66 automated unit & integration tests**, **11 adversarial siege attack scenarios** ($S_1 - S_{11}$), **3 architectural mutation tests**, **3 agent skill boundary checks**, **1 latency SLA benchmark** (50 calls per tool type, p95 < 2.7ms), and **1 comparative benchmark** (3 scenarios).

| Verification Suite | Type | Verified Scope | Execution Time | Status |
|:---|:---|:---:|:---:|:---:|
| **`@warrant/gateway`** | Vitest Unit & Integration | 64 unit & integration tests | ~600ms | ✅ 64/64 Passing |
| **`@warrant/alexa-client`** | Vitest Agent Integration | 1 Bedrock agent loop test | ~300ms | ✅ 1/1 Passing |
| **`@warrant/siege`** | Vitest Scenario Runner | 1 scenario suite test | ~1.6s | ✅ 1/1 Passing |
| **`warrant-siege` (CLI)** | Standalone Adversarial Suite | 11 attack scenarios ($S_1 - S_{11}$) | ~1.6s | ✅ 11/11 Passing |
| **`Mutation Suite`** | Architectural Negative Testing | 3 mutations caught RED | ~2.5s | ✅ 3/3 Caught |
| **`Agent Skill Suite`** | Skill Boundary Evaluation | 3 rule boundary checks | ~200ms | ✅ 3/3 Passing |
| **`Gateway Latency Benchmark`** | Local Processing Benchmark | 50 operations/tool (search p95 2.71ms, propose 1.16ms, exec 1.12ms) | ~1.5s | ✅ Local Processing Time Recorded |
| **`Comparative Benchmark`**| Example Unprotected Server vs. Warrant | 3 comparative attack scenarios | ~600ms | ✅ 3/3 Warrant vs 0/3 Unprotected Example |
| **`Audit Chain Verifier`** | SHA-256 Ledger Verification | Genesis-to-tip hash continuity | ~200ms | ✅ Cryptographically Continuous |
| **`Receipt Verifier`** | Ed25519 Offline Validation | Detached signature & tamper check | ~150ms | ✅ Cryptographically Valid |

---

## ⚠️ Limitations & Transparent Disclosures

To preserve uncompromising engineering honesty, the following constraints are explicitly documented:
1. **Simulated Providers & Client:** The official Alexa+ developer preview is currently restricted to select partners. The Alexa+ companion web console is a high-fidelity Next.js simulator, and the hotel/train/restaurant providers are in-memory mock services with controllable fault endpoints (`TIMEOUT`, `DECLINE`, `SUCCEEDED_BUT_DISCONNECTED`).
2. **No Real Financial Settlement:** All transactions are denominated in integer minor units (cents) and settled within mock booking stores; no actual credit card or bank rails are charged.
3. **Model Plan Generation vs. Gateway Damage Limitation:** LLMs can still hallucinate or generate inefficient plans; Warrant's role is not to guarantee LLM conversational brilliance, but to deterministically guarantee that no action executes outside policy bounds, spend caps, or unapproved parameters.
4. **Structural Defense vs. Text Heuristics:** Warrant defends against prompt injection structurally (by separating data plane from out-of-band control plane and validating canonical parameter hashes), rather than relying on brittle regex or heuristic sentiment/prompt-guard classifiers.
5. **Storage Architecture:** Uses SQLite in WAL mode with a repository interface pattern; while ideal for single-node / edge deployment, distributed production environments would swap the repository implementation for PostgreSQL or Amazon DynamoDB.
6. **No External Third-Party Audit:** While verified against 11 automated attack scenarios, property tests, and mutation tests, Warrant has not undergone a formal third-party commercial pen-test.
7. **Prior Work & Open Source Disclosure:** Transparently acknowledges prior architectural concepts in autonomous agent bounding (including the author's previous exploration of passkey-bounded mandates on Monad in `AgentTrust`), adapted and re-architected from scratch for AWS Bedrock, Amazon Alexa+, and Model Context Protocol Streamable HTTP under Apache 2.0 / MIT.

---

## 💻 Full Local Reproduction (From Source)

```bash
# 1. Install dependencies across workspace
npm install

# 2. Build all packages (Gateway, Siege, Client)
npm run build

# 3. Run fast unit and integration tests (<5s)
npm run test

# 4. Run adversarial siege harness (executes 11 attack scenarios)
npm run test:siege

# 5. Run mutation fault test (proves scorecard catches broken invariants)
npm run test:mutation

# 6. Run comparative benchmark (Example unprotected 0/3 vs Warrant 3/3)
npm run test:compare

# 7. Run gateway latency benchmark (50 calls/tool on localhost)
npm run test:latency

# 8. Run agent skill boundary test (proves model obedience to warrant-safe-actions)
npm run test:skill

# 9. Verify cryptographic audit chain integrity
npm run audit:verify

# 10. Verify Ed25519 signed action receipts
npm run receipt:verify

# 11. Start local stack (Gateway on :8000, Web Client on :3000)
npm run dev
```
