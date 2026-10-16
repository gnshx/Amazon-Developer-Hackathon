# Warrant: Product Requirements Document (PRD)

**Project:** Warrant — A Trust Gateway for Voice Agents  
**Hackathon:** Amazon Developer Hackathon, Alexa+ Track  
**Date:** 16 October 2026  
**Deadline:** 24 October 2026, 12:30 AM IST (Working cutoff: Night of 23 October 2026)  
**Status:** Approved Draft v1.0  

---

## 1. Executive Summary

Warrant is a trust gateway for voice agents. It is an MCP (Model Context Protocol) server running over Streamable HTTP that sits between an AI assistant (such as Amazon Alexa+ or an Amazon Bedrock-powered agent) and real-world services. 

Voice interactions lack a persistent visual canvas to inspect fine-grained parameters before execution. Consequently, a single hallucinations, ambiguous tool call, or prompt injection can lead to irreversible financial loss, double bookings, or orphan state. Warrant makes voice agent actions provably safe through:
- Scoped and expiring grants
- Hard spend caps (tracked strictly in minor currency units)
- Exact parameter-hash bound approvals
- Strict multi-layer idempotency
- Saga orchestration with automatic compensation/rollback
- Tamper-evident SHA-256 chained audit trail
- An adversarial siege test harness (`warrant-siege`) that generates an automated, reproducible safety scorecard

### Scope Honesty
The genuine Alexa+ developer environment is restricted to select partners. To adhere to hackathon transparency guidelines, this submission uses a simulated Alexa+ client (built with Next.js) and simulated service providers (Hotel, Train, Restaurant). Both are clearly labelled as simulated in code, documentation, and the demo video.

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
- **FR-13 Adversarial Harness:** Declarative YAML attack scenarios executing automated probes against the gateway and outputting verified safety scorecards.

---

## 7. Non-Functional Requirements

- **NFR-1 Latency:** Gateway overhead <100 ms at p95 (excluding downstream provider simulated delay).
- **NFR-2 Memory & Storage:** SQLite in WAL mode with a decoupled repository pattern to permit drop-in PostgreSQL migration.
- **NFR-3 Currency Precision:** All financial figures stored strictly as integers in minor units (e.g. cents/pence/paise: $150.00 = 15000) — zero floating point arithmetic.
- **NFR-4 Deterministic Testing:** Core policy, idempotency, saga, and audit unit tests run offline in <5 seconds without requiring live LLM or AWS credentials.
- **NFR-5 Developer Experience:** Single-command setup (`npm run dev` or `docker compose up`) to a fully running demonstration in under 10 minutes from a clean clone.
