# Warrant: A Trust Gateway for Voice Agents

[![Amazon Developer Hackathon: Alexa+ Track](https://img.shields.io/badge/Amazon%20Developer%20Hackathon-Alexa%2B%20Track-FF9900?logo=amazon)](https://devpost.com)
[![Protocol: MCP Streamable HTTP](https://img.shields.io/badge/Protocol-MCP%20Streamable%20HTTP-0066FF)](https://modelcontextprotocol.io)
[![Bedrock Converse API](https://img.shields.io/badge/Agent-Amazon%20Bedrock-232F3E?logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **Amazon Developer Hackathon, Alexa+ Track (16 Oct 2026 – 23 Oct 2026)**  
> **Submission Working Cutoff:** 23 October 2026, 11:59 PM IST (Official deadline: 24 Oct, 12:30 AM IST)

---

## 1. Summary

Voice assistants are evolving from answering queries to executing real-world commitments: booking trips, buying tickets, and reserving tables. However, voice interfaces lack a visual canvas to review complex parameters before execution. A single hallucination, ambiguous network timeout, or prompt injection can lead to irreversible financial loss, double bookings, or orphan state.

**Warrant is a trust gateway for voice agents.** It is an MCP (Model Context Protocol) server running over Streamable HTTP that sits between an AI assistant and real-world services. Warrant makes agent actions provably safe through:
- **Scoped & Expiring Grants:** Household users establish spending limits and permissions out-of-band.
- **Exact Parameter-Hash Approvals:** Approvals bind cryptographically to the RFC 8785 canonical hash of the action. Any parameter mutation invalidates the approval token.
- **Multi-Layer Idempotency:** Prevents duplicate charges and retry storms.
- **Saga Orchestrator with Rollback:** Mid-plan failures automatically trigger reverse compensations, restoring external provider state.
- **Active Reconciliation:** Ambiguous timeouts are queried against provider idempotency records, never blindly retried.
- **Tamper-Evident Audit Ledger:** Cryptographic SHA-256 event chaining with an independent `/audit/verify` integrity check.
- **Adversarial Siege Test Suite (`warrant-siege`):** A standalone harness that attacks the gateway across 8 adversarial scenarios and outputs an automated safety scorecard.

### ⚠️ Scope Honesty
The genuine Alexa+ developer environment is restricted to select partners. To adhere to hackathon transparency guidelines, this project uses:
1. **Simulated Alexa+ Client:** A Next.js 14 web application simulating voice interaction, approval cards, and live tool traces.
2. **Simulated Mock Providers:** Standalone Hotel, Train, and Restaurant services with fault injection endpoints (`TIMEOUT`, `DECLINE`, `DISCONNECT`).

Both are explicitly labelled as simulated in code, documentation, and the demo video.

---

## 2. System Architecture

```
       +----------------------------------------------------------------+
       |                  Household Phone / Mobile Web                  |
       |                   (Out-of-band Approval UI)                    |
       +----------------------------------------------------------------+
                                       |
                                       | Admin API (REST / JSON)
                                       | [Grants & Approvals Channel]
                                       v
+----------------------------- Warrant Gateway -----------------------------+
|                                                                           |
|   +-----------------------+   +-------------------+   +---------------+   |
|   | Streamable HTTP (MCP) |   | Bearer Auth Guard |   | Policy Engine |   |
|   +-----------------------+   +-------------------+   +---------------+   |
|               |                         |                     |           |
|   +-----------------------+   +-------------------+   +---------------+   |
|   |  Idempotency Registry |   |  Saga Orchestrator|   | SHA-256 Audit |   |
|   +-----------------------+   +-------------------+   +---------------+   |
|               |                         |                     |           |
|   +-----------------------+   +-------------------+   +---------------+   |
|   |   RFC 8785 Canonical  |   | Approval Service  |   |  Sanitizer    |   |
|   |   Parameter Hasher    |   |   & Token Issuer  |   |  & Jailbreak  |   |
|   +-----------------------+   +-------------------+   +---------------+   |
|                                                                           |
+---------------------------------------------------------------------------+
        ^                                               |
        | MCP JSON-RPC 2025-11-25                       | HTTP / Control API
        | (Over Streamable HTTP)                        | (Fault Injection)
        |                                               v
+-------------------------------+             +---------------------------+
|  Simulated Alexa+ Client      |             |     Mock Providers        |
|  - Next.js 14 Web App         |             |  - Mock Hotel Service     |
|  - Bedrock Converse Agent Loop|             |  - Mock Train Service     |
|  - Live MCP Tool Trace View   |             |  - Mock Restaurant Service|
+-------------------------------+             +---------------------------+
```

---

## 3. The 8 Safety Invariants & Adversarial Attack Suite

Warrant guarantees 8 mathematical invariants, backed by automated scenarios in the `warrant-siege` harness:

| Invariant | Description | Adversarial Attack Scenario |
|---|---|---|
| **$I_1$** | **No Duplicate External Effect:** Exactly one booking occurs per idempotency key. | **S1:** 10 concurrent requests dispatched with the same key. Expect 1 external booking. |
| **$I_2$** | **Absolute Spend Cap:** Confirmed spend never exceeds grant cap (minor units). | **S3:** Submit plan exceeding remaining budget. Expect `DENY: EXCEEDS_SPEND_CAP`. |
| **$I_3$** | **Cryptographic Approval Binding:** Approvals bound to $\text{SHA-256}(\text{RFC8785}(\text{args}))$. | **S4:** Mutate room price after approval. Expect `APPROVAL_PARAMETER_MISMATCH`. |
| **$I_4$** | **Clean Residue (Saga Rollback):** Partial failure leaves zero orphaned bookings. | **S2:** Mid-plan train failure triggers automatic hotel cancellation compensation. |
| **$I_5$** | **Structural Output Containment:** Downstream text cannot alter grants or limits. | **S5:** Provider description contains prompt injection. Expect containment & flagging. |
| **$I_6$** | **Temporal Authorization:** Expired or revoked grants authorize zero actions. | **S6:** Submit action after grant expiration timestamp. Expect `GRANT_EXPIRED`. |
| **$I_7$** | **Cryptographic Audit Continuity:** Append-only SHA-256 hash chain from genesis. | **S1-S8:** `/audit/verify` traverses the full chain and detects any tampering. |
| **$I_8$** | **Active Reconciliation:** Ambiguous timeouts resolved via idempotency queries. | **S8:** Provider drops connection after save; reconciler verifies status, avoids dupe. |

---

## 4. Repository Structure

```
├── packages/
│   ├── warrant-gateway/     # Core MCP server, policy engine, saga, audit chain, mock providers
│   ├── warrant-siege/       # Standalone adversarial test harness & HTML scorecard generator
│   └── alexa-client/        # Simulated Alexa+ Next.js 14 UI + Bedrock agent loop
├── docs/
│   ├── PRD.md               # Product Requirements Document
│   ├── HLD.md               # High-Level Architecture & Threat Model
│   ├── TEST_PLAN.md         # Invariant specifications & attack scenario catalog
│   └── FRICTION_LOG.md      # AWS Bedrock & MCP SDK developer friction log & feedback
├── AGENTS.md                # AI agent operating rules, commands, and /goal contracts
├── PLAN.md                  # Master roadmap, workstreams, and daily quality gates
└── task_plan.md             # Active working memory and task state
```

---

## 5. Quickstart & Verification (<10 Minutes)

### Prerequisites
- Node.js 20+ and npm 10+
- (Optional) AWS account with Amazon Bedrock access enabled for Claude 3.5 Sonnet / Haiku. Offline deterministic fallback is included by default.

### Setup & Run
```bash
# 1. Clone repository
git clone https://github.com/gnshx/Amazon-Developer-Hackathon.git
cd Amazon-Developer-Hackathon

# 2. Install dependencies
npm install

# 3. Run unit and property tests
npm run test

# 4. Run adversarial siege test suite (verifies 8 invariants)
npm run test:siege

# 5. Start development servers (Gateway on :8000, Client on :3000)
npm run dev
```

---

## 6. Project Documentation & Agent Reference

- **[AGENTS.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/AGENTS.md)**: Authoritative handbook for coding agents and loop engineers.
- **[PLAN.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/PLAN.md)**: 8-day hackathon roadmap and daily gate checklists.
- **[docs/PRD.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/PRD.md)**: Complete functional requirements and acceptance criteria.
- **[docs/HLD.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/HLD.md)**: In-depth technical architecture and security threat model.
- **[docs/TEST_PLAN.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/TEST_PLAN.md)**: Formal invariant definitions and attack scenario matrix.
- **[docs/FRICTION_LOG.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/FRICTION_LOG.md)**: Product feedback on Amazon Bedrock Converse API & MCP SDK.
