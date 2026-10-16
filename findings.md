# Warrant Project Findings & Research Notes

**Created:** 16 October 2026  
**Status:** Active  

---

## 1. Technical Baseline & Environment Findings

- **Environment:** Linux x86_64, Node.js `v20.18.0`, npm `10.8.2`.
- **Git State:** Clean git repository initialized on `main` branch.
- **Protocol Requirements:**
  - MCP (Model Context Protocol) Streamable HTTP transport targeting specification `2025-11-25` or later.
  - JSON-RPC 2.0 messages exchanged over Streamable HTTP with Server-Sent Events (SSE) or chunked responses.
  - Session auth via HTTP `Authorization: Bearer <session_token>`.
- **Bedrock Integration:**
  - Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`).
  - Targeted model: `anthropic.claude-3-5-sonnet-20241022-v2:0` or `anthropic.claude-3-haiku-20240307-v1:0`.
  - Fallback stub mode implemented for offline testing and automated CI without live AWS credentials.

---

## 2. Cryptographic & Idempotency Specifics

- **RFC 8785 JSON Canonicalization Scheme (JCS):**
  - Standardized JSON canonicalization ensures keys are sorted in lexicographical order (UTF-16 code units), numbers are formatted without exponential notation where applicable, whitespace is removed, and string escaping is normalized.
  - Using canonical JSON guarantees that `SHA-256(canonical_json(args))` is 100% deterministic regardless of formatting or dictionary key ordering.
- **Audit Chaining (Tamper-Evidence):**
  - Event $n$: `hash_n = SHA-256(prev_hash + seq + timestamp + event_type + canonical_payload)`.
  - Genesis event: `prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"`.
  - Any retroactively modified row fails verification when recalculating hashes from row 0 to $N$.
- **Financial Precision:**
  - Strict integer representation: amounts stored as integer cents / minor units ($150.00 $\to$ `15000`). Float math is strictly disallowed in business logic.

---

## 3. Package & Monorepo Architecture

To satisfy both the Hackathon submission requirements and clean open-source separation:
- `packages/gateway`: Warrant Gateway MCP server, policy engine, saga orchestrator, audit chain, mock providers.
- `packages/siege`: Warrant Siege adversarial harness, scenario runner, HTML/JSON scorecard generator.
- `packages/alexa-client`: Simulated Alexa+ Next.js 14 client, phone approval portal, live MCP inspector, Bedrock agent loop.
- `docs/`: PRD, HLD, Test Plan, Friction Log, Devpost submission drafts.

Root `package.json` with npm workspaces orchestrates building, running, and testing all packages with single commands.
