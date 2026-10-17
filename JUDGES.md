# Judge Evaluation Guide · Warrant Trust Gateway

> **Quick Summary for Hackathon Evaluators:**  
> Warrant is a trust gateway that enforces cryptographically sealed economic and safety boundaries on autonomous voice agents (built for Amazon Alexa+ and AWS Bedrock over Model Context Protocol Streamable HTTP).  
> **Zero AWS keys, zero Alexa developer seats, and zero setup required to verify all safety claims.**

---

## ⚡ 60-Second Evaluation Path (Zero Setup Required)

Evaluators do not need an AWS account, Bedrock credentials, an Alexa developer preview seat, or live payment cards. Everything can be verified deterministically from source in under 60 seconds:

```bash
# 1. Run the Adversarial Siege Harness (Executes all 10 attack scenarios in ~2s)
npm run test:siege

# 2. Run the Mutation Test (Intentionally breaks 2 safeguards; proves scorecard turns RED)
npm run test:mutation

# 3. Run Comparative Benchmark (Naive unprotected server 0/3 vs Warrant Gateway 3/3)
npm run test:compare

# 4. Run Alexa+ Latency SLA Benchmark (Verifies sub-500ms response over Streamable HTTP)
npm run test:latency

# 5. Verify Offline Cryptographic Evidence Bundle (<300ms, zero server/db needed)
npm run verify:evidence
```

### What a Pass Looks Like:
1. **`npm run test:siege`** reports `Scorecard: 10/10 Scenarios Passed`, confirms Invariants $I_1 - I_{10}$ satisfied, and generates [`packages/warrant-siege/scorecard.html`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/packages/warrant-siege/scorecard.html).
2. **`npm run test:mutation`** passes its detection check:
   - Baseline clean (10/10 green).
   - Invariant $I_1$ mutated (idempotency disabled) $\to$ **Scenario S1 fails RED** as expected.
   - Invariant $I_3$ mutated (approval hash disabled) $\to$ **Scenario S4 fails RED** as expected.
   - Proves the test suite is actively catching attacks rather than vacuously passing.
3. **`npm run test:compare`** tests an unprotected naive server vs. Warrant under identical attack loads:
   - Naive server fails 0/3 (10 duplicate bookings charged, $120 orphaned hotel residue, budget exceeded).
   - Warrant passes 3/3 (1 deduplicated booking, $0 orphan residue after rollback, budget ceiling enforced).
4. **`npm run test:latency`** executes 50 consecutive calls over MCP Streamable HTTP:
   - Average: **1.58 ms**, p99: **34.68 ms**, easily beating Alexa+'s < 500 ms SLA ceiling by a 14x margin.
5. **`npm run verify:evidence`** cryptographically validates the committed sample bundle in [`examples/evidence/`](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/examples/evidence/):
   - Detached **Ed25519 signature** verified over canonical RFC 8785 action parameters ($I_9$).
   - In-memory tamper attempt (mutating \$360.00 to \$36.00) is **cryptographically rejected**.
   - SHA-256 event chaining verified continuous from genesis ($I_7$).

---

## 🎯 Scoring Against the Hackathon Criteria

### 1. Technical Execution & Architecture (25%)
- **Conforms to MCP Streamable HTTP Spec (`2025-11-25`):** Standard JSON-RPC over Streamable HTTP transport, compatible with Anthropic Claude Desktop, Cursor, and AWS Bedrock Agent MCP bridges.
- **RFC 9728 OAuth Protected Resource Metadata:** Live `GET /.well-known/oauth-protected-resource` endpoint and RFC 6750/9728 401 challenges with `WWW-Authenticate: Bearer resource_metadata="..."`.
- **User Identity Binding:** Grants and authorizations are bound to authenticated user identity (`userId` / OAuth `sub` claim), not ephemeral client session tokens.
- **MCP 2025-11-25 Semantic Tool Annotations:** Tools specify `readOnly`, `destructive`, `idempotent`, and `riskTier` hints, plus `mode: "url"` elicitation for out-of-band approvals.
- **Cryptographic Parameter Binding ($I_3$):** All high-risk ($T_2$) actions require approvals bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{args}))$. Changing a single date, price, or ID breaks the approval token.
- **Multi-Layer Idempotency ($I_1$):** Dual-indexed in SQLite with in-flight state tracking (`PROCESSING` $\to$ `COMPLETED`). Concurrent voice retry storms execute external side effects exactly once.
- **Compensating Saga Orchestrator ($I_4$):** Multi-step plans execute with strict atomicity; mid-flight failures trigger reverse compensations, guaranteeing zero orphan state or charges ($I_4$).
- **Active Timeout Reconciliation ($I_8$):** Socket disconnects and HTTP timeouts are reconciled against the external provider's truth using the idempotency key, never blindly retried.
- **Detached Ed25519 Signed Receipts ($I_9$):** Every executed action generates a verifiable signed receipt that anyone can audit offline without trusting the gateway.
- **Grace-Hold Undo Window ($I_{10}$):** 8-second reversible pre-settlement holding window; user cancellation aborts execution with \$0 spent.
- **Zero Floating-Point Financial Math:** All currency is denominated strictly in non-negative integer minor units (cents/pence: \$150.00 is `15000`).

### 2. Voice & Bedrock Innovation (Alexa+ Track) (25%)
- **The Voice Dilemma Solved:** Voice assistants cannot present full checkout screens before execution. Warrant solves this by enforcing an out-of-band companion phone approval flow for actions exceeding the household threshold (\$200), with voice-first spoken summaries ($\le 300$ characters).
- **Repositioning Around Alexa Voice Checkout:** Alexa handles voice PIN, payment instrument selection, and purchase confirmation. Warrant handles the complex multi-step operational transactional safety underneath: ensuring multi-step itineraries stay within cumulative limits and unwind cleanly if step 2 fails.
- **Amazon Bedrock Converse API Agent:** Full tool-calling loop connecting Bedrock models (Amazon Nova Pro, Claude 3.5 Sonnet) to the Warrant MCP gateway, featuring deterministic offline fallback for offline evaluation.
- **Agent Skill (`warrant-safe-actions`):** Formal Agent Skill (`skills/warrant-safe-actions/SKILL.md`) tested via `npm run test:skill`, instructing the model on proper action sequencing, out-of-band approval expectations, prompt injection immunity, and concise spoken summaries.

### 3. Real-World Practicality & Ecosystem Relationship (25%)
- **Complementary to AWS AgentCore Policy (GA March 3, 2026):** AWS AgentCore Policy provides per-call authorization (caller identity + tool arguments) outside the agent's reasoning loop. Warrant complements AgentCore by providing cumulative minor-unit spend budgets across conversations, multi-step saga rollbacks upon mid-plan failure, detached signed receipts, and active reconciliation of dropped network connections.
- **Relationship to Google AP2:** Extends mandate concepts (intent and cart mandates) into a full distributed systems runtime with saga compensations.
- **Prompt Injection Defense (CaMeL Research):** Implements propose-then-execute structural containment at the tool boundary, guaranteeing third-party provider responses cannot elevate permissions or modify grants ($I_5$).
- **10 Core Adversarial Scenarios ($S_1 - S_{10}$):** Tests realistic failure modes: prompt injection privilege escalation, spend cap bypass, approval parameter tampering, socket timeouts, and retry storms.
- **Out-of-Band Admin Channel:** Grants, spend caps, and approval decisions exist strictly on an internal REST API (`/admin`). The LLM tool surface (`/mcp`) has zero tools to alter budgets or self-approve.

### 4. Design, Developer Experience & Open Source (25%)
- **`@warrant/siege` CLI:** Standalone open-source adversarial test harness generating interactive HTML reports and SVG status badges.
- **5-View Alexa+ Companion UI:** Pixel-accurate Next.js 14 console implementing 5 human-designed screens (Assistant Console, Phone Approval, Mid-Plan Rollback, Safety Scorecard, Household Limits).
- **Alexa+ Compatibility Table:** All platform checklist items verified (Streamable HTTP, RFC 9728 metadata, <500ms latency, user binding, URL elicitation).

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

---

## 📊 Comprehensive Test Summary (69 Total Checks)

| Package / Test Suite | Scope | Checks / Tests | Execution Time | Status |
|:---|:---|:---:|:---:|:---:|
| **`@warrant/gateway`** | Policy Engine, RFC 8785 Hasher, Idempotency, Saga, Merkle, Receipts, DB | 51 unit & integration tests | ~500ms | ✅ 51/51 Passing |
| **`@warrant/alexa-client`** | Bedrock Converse Agent Loop & MCP Client Execution | 1 end-to-end integration test | ~300ms | ✅ 1/1 Passing |
| **`@warrant/siege`** | 10 Core Adversarial Attack Scenarios (S1 – S10) | 10 scenario invariants ($I_1 - I_{10}$) | ~1.6s | ✅ 10/10 Passing |
| **`Mutation Suite`** | Architectural Negative Fault Injection (Idempotency & Approval) | 2 mutations caught RED | ~2.5s | ✅ 2/2 Caught |
| **`Audit Verifier`** | SHA-256 chained event log verification from genesis | 53 events verified | ~200ms | ✅ Tip Continuous |
| **`Receipt Verifier`** | Detached Ed25519 signature & parameter integrity | Signature & tamper check | ~150ms | ✅ Cryptographically Valid |
| **`Offline Evidence`** | Standalone verification of committed evidence bundle | 3 cryptographic checks | ~250ms | ✅ Zero Setup Green |
| **`Latency SLA Gate`** | Streamable HTTP SLA Verification (<500ms platform limit) | 50 operations (avg 1.58ms, p99 34ms) | ~1.5s | ✅ <500ms Passing |
| **`Comparative Benchmark`**| Naive Unprotected Server vs. Warrant Gateway | 3 comparative attack scenarios | ~600ms | ✅ 3/3 Warrant vs 0/3 Naive |
| **Total Test Suite** | **Full Workspace Verification** | **69 checks & scenarios** | **<8s** | **100% Green** |

---

## ⚠️ Limitations & Transparent Disclosures

To preserve uncompromising engineering honesty, the following constraints are explicitly documented:
1. **Simulated Providers & Client:** The official Alexa+ developer preview is currently restricted to select partners. The Alexa+ companion web console is a high-fidelity Next.js simulator, and the hotel/train/restaurant providers are in-memory mock services with controllable fault endpoints (`TIMEOUT`, `DECLINE`, `SUCCEEDED_BUT_DISCONNECTED`).
2. **No Real Financial Settlement:** All transactions are denominated in integer minor units (cents) and settled within mock booking stores; no actual credit card or bank rails are charged.
3. **Model Plan Generation vs. Gateway Damage Limitation:** LLMs can still hallucinate or generate inefficient plans; Warrant's role is not to guarantee LLM conversational brilliance, but to mathematically guarantee that no action executes outside policy bounds, spend caps, or unapproved parameters.
4. **Structural Defense vs. Text Heuristics:** Warrant defends against prompt injection structurally (by separating data plane from out-of-band control plane and validating canonical parameter hashes), rather than relying on brittle regex or heuristic sentiment/prompt-guard classifiers.
5. **Storage Architecture:** Uses SQLite in WAL mode with a repository interface pattern; while ideal for single-node / edge deployment, distributed production environments would swap the repository implementation for PostgreSQL or Amazon DynamoDB.
6. **No External Third-Party Audit:** While verified against 10 automated attack scenarios, property tests, and mutation tests, Warrant has not undergone a formal third-party commercial pen-test.
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

# 4. Run adversarial siege harness (executes 10 attack scenarios)
npm run test:siege

# 5. Run mutation fault test (proves scorecard catches broken invariants)
npm run test:mutation

# 6. Run comparative benchmark (Naive 0/3 vs Warrant 3/3)
npm run test:compare

# 7. Run Alexa+ latency benchmark (<500ms SLA gate)
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
