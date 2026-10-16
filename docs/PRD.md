# Warrant: Product Requirements Document (PRD)

**Project:** Warrant — A Trust Gateway for Voice Agents  
**Hackathon:** Amazon Developer Hackathon, Alexa+ Track  
**Date:** 16 October 2026  
**Deadline:** 24 October 2026, 12:30 AM IST (Working cutoff: Night of 23 October 2026)  
**Status:** Approved Draft v1.0  

---

## 1. Executive Summary & Product Vision

AI agents are transitioning from informational assistants into autonomous actors that book, buy, cancel, and negotiate on people's behalf. Voice makes this fundamentally riskier because there is no visual canvas or screen to review actions and parameters before money is spent. 

Today, there is **no standard way** to:
1. Define how much authority an agent has before it acts.
2. Cryptographically prove what the agent actually committed to.
3. Automatically undo or compensate side effects when a multi-step sequence fails midway.
4. Verify whether a third-party service is safe for an agent to access.

Every brand currently builds its own ad-hoc, one-off safeguards—if any—leaving users forced to trust the voice assistant blindly.

**Warrant's long-term goal is to become the missing trust infrastructure for the agentic economy.** It provides agents with limited, revocable authority, produces verifiable cryptographic proof of every action, handles failures automatically with zero orphan state, and empowers anyone to independently test whether a service is safe for agents.

The hackathon MVP proves this core safety loop over the standard Model Context Protocol (MCP Streamable HTTP).

### Core Safety Mechanisms
- **Scoped & Expiring Grants:** Household users establish spending limits and permissions out-of-band.
- **Hard Spend Caps:** Financial caps tracked strictly in integer minor units (zero float math).
- **Exact Action-Hash Bound Approvals:** Risky actions require out-of-band mobile confirmation bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{params}))$.
- **Strict Multi-Layer Idempotency:** Prevents duplicate charges and retry storms ($I_1$).
- **Saga Orchestration with Automatic Rollback:** Partial failures trigger reverse compensations, leaving zero residue ($I_4$).
- **Active Timeout Reconciliation:** Dropped connections actively query provider truth by idempotency key ($I_8$).
- **Tamper-Evident SHA-256 Chained Audit Trail:** Verifiable from genesis to tip ($I_7$).
- **Adversarial Siege Test Harness (`warrant-siege`):** Standalone CLI that subjects the gateway to 8 attack scenarios ($S_1 - S_8$) and generates automated HTML/JSON scorecards.

### Scope Honesty
The genuine Alexa+ developer environment is restricted to select partners. To adhere to hackathon transparency guidelines, this submission uses a simulated Alexa+ client (Next.js 14) and simulated service providers (Hotel, Train, Restaurant with fault injection). Both are clearly labelled as simulated in code, documentation, and the demo video. All MCP and Admin communications execute over real network protocols (Streamable HTTP, JSON-RPC 2.0).

---

## 2. Deliverables

1. **`warrant-gateway`**: MCP server (Streamable HTTP), deterministic policy engine, saga orchestrator, audit chain, and mock providers with fault injection.
2. **`warrant-siege`**: Adversarial test harness executing 8 attack scenarios, generating JSON and HTML safety scorecards (standalone open-source license).
3. **`alexa-client`**: Simulated Alexa+ client with a Bedrock-powered agent loop (AWS Bedrock Converse API), chat interface, live tool execution trace, phone approval view, and audit timeline.
4. **Demo Video**: Under 3 minutes showcasing the happy path, attack scenarios, rollback, and the generated safety scorecard.
5. **Devpost Submission**: Submission text, architecture diagrams, product feedback, and friction logs for AWS Bedrock and MCP SDKs.

---

## 3. Goals & Non-Goals

### Goals
- **G1:** An assistant can act in the real world without ever exceeding the authority granted by the user.
- **G2:** Partial failure leaves zero residue: completed steps are compensated/rolled back and the user is informed plainly.
- **G3:** Every safety claim is backed by a named, automated, repeatable test.
- **G4:** The MCP surface is cleanly standardized so external brands can adopt and expose safe tools with zero changes to agent reasoning.

### Non-Goals
- Integration with real, closed-partner Alexa+ APIs or production banking/payment rails.
- Multi-tenant enterprise SSO, multi-organization billing, or SOC2 compliance certification.
- Automatic speech recognition (ASR) acoustic tuning or custom LLM pre-training/fine-tuning.
- Guaranteeing the LLM never generates a flawed proposal. The gateway guarantees that flawed proposals cannot exceed grants or bypass approval.

---

## 4. User Personas

1. **Household Voice User:** Interacts primarily through voice with Alexa+. Sets financial and scope boundaries on mobile. Reviews high-risk confirmations on mobile out-of-band.
2. **Brand Developer:** Exposes transactional APIs (travel, tickets, dining) to voice assistants and needs proof that agent calls cannot cause double charges or orphaned resources.
3. **Hackathon Judge:** Evaluates technical depth, architectural rigor, Alexa+ relevance, and invariant proof within 3 minutes.

---

## 5. User Stories & Acceptance Criteria

| ID | Persona | Story | Acceptance Criteria |
|---|---|---|---|
| **US-1** | Household User | As a user, I set a grant (scopes, spend cap, expiry) on my phone before the assistant acts. | Agent cannot create or widen a grant via MCP; remaining budget is dynamically enforced; grant expiry prevents all subsequent execution. |
| **US-2** | Household User | As a user, I ask by voice for a trip; the assistant searches and proposes a plan with total cost. | Each step displays risk tier (T0-T3); spoken summary is concise (≤2 sentences / ≤300 chars); no real actions execute during proposal. |
| **US-3** | Household User | As a user, high-risk steps require my explicit confirmation on my phone. | Phone approval screen displays exact canonical parameters; mutating any parameter invalidates the approval token. |
| **US-4** | Household User | As a user, if a booking step fails, all preceding bookings are rolled back. | Providers return to baseline state; user is plainly notified via spoken summary; state marked `compensated` or `compensation_failed`. |
| **US-5** | Brand Developer | As a developer, retried network calls never duplicate bookings. | Repeated idempotency key returns cached result; same key with different payload is rejected with HTTP 409 Conflict. |
| **US-6** | Brand Developer | As a developer/auditor, I can inspect what happened and verify the log was not altered. | Per-plan audit timeline; SHA-256 chain verification tool returns cryptographically verified `PASS` or `FAIL`. |
| **US-7** | Brand Developer | As an external developer, I can run the adversarial harness against my own MCP server. | Single command `npx warrant-siege --target <url>` produces JSON and HTML scorecard. |
| **US-8** | Hackathon Judge | As a judge, I want to see the attack suite and verification scorecard live. | All 8 attack scenarios execute on screen, showing real-time invariant enforcement and clean scorecard pass. |

---

## 6. Functional Requirements

- **FR-1 Protocol Conformance:** MCP Streamable HTTP transport (JSON-RPC 2025-11-25 or later) with `initialize`, `tools/list`, and `tools/call`.
- **FR-2 Read Tools (T0):** `search_hotels`, `search_trains`, `search_restaurants` returning structured data and `spoken_summary`.
- **FR-3 Plan Tools:** `propose_plan` (cost aggregation, tier assignment, approval generation), `execute_plan` (policy check, approval verification, saga dispatch), `get_plan_status`, `request_cancellation`.
- **FR-4 Policy Engine:** Pure deterministic evaluation of scopes, spend caps (minor units), expiry, revocation, and risk tiers (T0-T3).
- **FR-5 Approval Binding:** Approval token mathematically bound to the SHA-256 hash of the RFC 8785 canonical JSON representation of action parameters.
- **FR-6 Idempotency Layer:** Multi-layer idempotency on `(grant_id, tool, idempotency_key)` preventing duplicate external effects.
- **FR-7 Saga Orchestration:** Sequential action execution with automated reverse compensation upon failure, and active reconciliation of network timeouts.
- **FR-8 Output Sanitization:** External provider payload schema validation; truncation of free text; structural segregation of untrusted output.
- **FR-9 Audit Trail:** Append-only hash-chained ledger (`prev_hash` + canonical event = `hash`) with a verifiable integrity check endpoint.
- **FR-10 Voice-Optimized Responses:** Spoken summaries formatted specifically for speech synthesis (concise, natural, ≤300 characters).
- **FR-11 Client Interface:** Next.js web application with chat stream, phone approval inbox, real-time MCP tool call inspector, and audit log viewer.
- **FR-12 Bedrock Agent:** Autonomous agent loop leveraging Amazon Bedrock (Converse API with Claude 3.5 Sonnet / Claude 3 Haiku) connected to the MCP gateway via Streamable HTTP.
- **FR-13 Adversarial Harness:** Declarative YAML attack scenarios executing automated probes against the gateway and outputting verified safety scorecards (10 core scenarios).
- **FR-14 Action Receipts (Ed25519):** Every confirmed action produces a detached Ed25519 digitally signed receipt over RFC 8785 canonical metadata, verifiable completely offline by third parties ($I_9$).
- **FR-15 Grace-Hold Undo Window:** Configurable countdown hold before irreversible provider dispatch; out-of-band cancellation aborts execution with zero provider residue ($I_{10}$).
- **FR-16 Merkle Audit Checkpointing:** Binary Merkle tree root calculation over audit events with $O(\log N)$ inclusion proof generation and verification.

---

## 7. Non-Functional Requirements

- **NFR-1 Latency:** Gateway overhead <100 ms at p95 (excluding downstream provider simulated delay).
- **NFR-2 Memory & Storage:** SQLite in WAL mode with a decoupled repository pattern to permit drop-in PostgreSQL migration.
- **NFR-3 Currency Precision:** All financial figures stored strictly as integers in minor units (e.g. cents/pence/paise: $150.00 = 15000) — zero floating point arithmetic.
- **NFR-4 Deterministic Testing:** Core policy, idempotency, saga, and audit unit tests run offline in <5 seconds without requiring live LLM or AWS credentials.
- **NFR-5 Developer Experience:** Single-command setup (`npm run dev` or `docker compose up`) to a fully running demonstration in under 10 minutes from a clean clone.

---

## 8. Post-Hackathon Roadmap: What You Can Add Later

The hackathon MVP demonstrates and proves the core trust loop. The roadmap below outlines the systematic evolution from a prototype gateway into foundational trust infrastructure.

### Phase 2: Make It Real (First Weeks Post-Hackathon)
- **Production Payment & Booking Sandboxes:** Real provider integrations, starting with Stripe test mode payment intents, followed by production GDS/Amadeus/Sabre travel and OpenTable/Resy APIs.
- **Passkey (WebAuthn) Approvals:** Replace simple button taps with hardware-backed WebAuthn biometric proofs from the user's secure enclave (TouchID, FaceID, YubiKey).
- **Multi-User Accounts & OAuth Grants:** Multi-tenant account hierarchy with household role management and OAuth 2.1 grant negotiation.
- **Managed Cloud Infrastructure:** Hosted PostgreSQL deployment with read replicas, high availability, and public trial sandboxes.

### Phase 3: Stronger Trust Guarantees
- **Signed Action Receipts:** Every completed action produces a detached cryptographically signed receipt containing the canonical parameters, timestamps, and provider confirmation, verifiable offline by third parties without trusting the gateway.
- **Transparency Log:** Anchor the audit hash chain into an append-only Merkle tree (RFC 6962 / Sigstore model) publishing signed tree heads (STHs) so that historical records cannot be silently rewritten even by the server operator.
- **Capability Tokens (Macaroons / Biscuit Architecture):** Attenuated authority tokens that can only shrink in scope when passed along. Establishes the mathematical foundation for multi-agent delegation: a primary agent delegating tasks to a sub-agent can never grant more authority than it holds.
- **Policy as Code (Cedar / OPA):** Express complex household policies in formal languages (e.g. AWS Cedar or Open Policy Agent), accompanied by historical simulators demonstrating how policy revisions would have affected past decisions.
- **Undo Windows:** Time-delayed commit windows for high-risk reversible commitments, allowing users a grace period to cancel actions before final settlement (analogous to "undo send").

### Phase 4: Smarter Protection
- **Behavioral Anomaly Detection:** Real-time statistical analysis flagging atypical spend spikes, unusual execution timing, or abnormal booking destinations, automatically escalating risk tiers to explicit phone confirmation.
- **Plan Dry-Runs & Simulation:** The assistant renders deterministic dry-runs outlining all expected costs, provider side effects, and compensation guarantees before submitting a binding plan.
- **Voice Step-Up Authentication:** Multi-factor step-up for high-risk vocal commands to protect against acoustic spoofing, deepfakes, or background speech overhearing.
- **Privacy & PII Redaction:** Automated tokenization and redaction of sensitive personal identifiable information (PII) before writing to audit logs, with local policy evaluation wherever possible.

### Phase 5: Ecosystem, Certification & Standards
- **Provider SDK & Drop-In Middleware:** Lightweight SDK allowing any existing MCP server or API brand to wrap their tools with Warrant safeguards in fewer than 10 lines of code.
- **Safety Certification Badge & CI Action:** Public certification scoring MCP services on their resilience against the adversarial harness, with automated GitHub Actions running scorecards on every pull request.
- **Continuous Red-Teaming Swarm:** Dynamic LLM-generated attack scenarios, schema fuzzers, and a growing public corpus of prompt injections continuously executed against registered gateways.
- **Open Standards Collaboration:** Formally propose voice consent, approval binding, and receipt conventions to the Model Context Protocol (MCP) community to establish an open industry standard.

### Household & Care Use Cases
- **Shared Household Grants:** Tiered household authority with role-based restrictions (e.g., parents hold administrative caps; children hold constrained micro-allowances with strict category locks).
- **Caregiver Co-Approval:** Delegated oversight flows where actions requested by an elderly or vulnerable user automatically route dual-approval requests to designated family caregivers.
- **Context-Aware Multi-Device Approvals:** Intelligent routing of confirmation prompts across domestic surfaces (e.g., smart TV canvas, smartwatch, or mobile notification) based on room presence and activity context.

### Strategic Differentiators (Core Highlights)
The three most defensible and foundational innovations in Warrant are:
1. **Signed Action Receipts with Transparency Logs:** Providing mathematical non-repudiation that transforms Warrant from an execution proxy into an auditable trust anchor.
2. **Attenuated Capability Tokens for Agent-to-Agent Delegation:** Solving the cascading authority problem when autonomous agents hire sub-agents.
3. **Automated Ecosystem Certification:** Leveraging `warrant-siege` as an objective safety standard for the entire MCP developer ecosystem.

