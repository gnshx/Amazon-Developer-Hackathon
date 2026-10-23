# Warrant: Developer Friction Log & Platform Feedback

**Event:** Amazon Developer Hackathon, Alexa+ Track  
**Category:** Developer Experience, Mini Challenge Bonus (Product Feedback & Friction Log)  
**Authors:** Warrant Engineering Team  
**Last Updated:** 23 October 2026  

---

## 1. Overview & Evaluation Target

This document logs practical architectural feedback, ergonomics, failure modes, and developer friction encountered while building **Warrant** across:
1. **Amazon Bedrock Converse API** (`@aws-sdk/client-bedrock-runtime`)
2. **Model Context Protocol (MCP)** Streamable HTTP Transport & TypeScript SDK (`@modelcontextprotocol/sdk`)
3. **Alexa+ Developer Documentation & Interaction Architecture**

---

## 2. Amazon Bedrock Converse API Feedback

### 2.1 Strengths & Wins
- **Unified Tool Calling Interface:** The Bedrock Converse API (`ConverseCommand`) cleanly standardizes message formatting and tool definitions across model providers.
- **Tool Use Metadata:** Structured `toolUse` blocks with unique `toolUseId` make tracing and correlating multi-step tool calls straightforward.
- **Reliable Structured Tool Selection:** In live testing (`us.amazon.nova-pro-v1:0` via us-east-1 cross-region inference), the model consistently selected the correct search tools on turn 1 and proposed multi-step plans on turn 2.

### 2.2 Feature Wishes & Practical Observations
- **Local Mock Runner / Offline Stub:** For local development and automated CI testing without live AWS credentials, developers must construct custom mock/stub implementations. An official local mock runner or client stub in `@aws-sdk/client-bedrock-runtime` would greatly ease developer onboarding and testing.
- **TypeScript Optional Chaining:** Deeply nested command response types often require multiple optional chaining guards (`output?.message?.content?.[0]?.toolUse`).

---

## 3. Model Context Protocol (MCP) Streamable HTTP Feedback

### 3.1 Strengths & Wins
- **Protocol Clarity:** Standardizing `initialize`, `tools/list`, and `tools/call` over JSON-RPC 2.0 provides an open ecosystem where agents can discover capabilities.
- **Streamable HTTP Specification:** Moving from stdio-only to Streamable HTTP enables remote gateways, centralized security proxies, and containerized microservices.

### 3.2 Practical Observations
- **Transport Request Context:** The base MCP TypeScript SDK's server handler does not pass the incoming HTTP request context (headers, remote address) into individual tool handler closures, requiring custom transport context plumbing to read bearer tokens.
- **Canonical Parameter Serialization:** Computing approval hashes over tool arguments requires an explicit canonicalization layer (RFC 8785) because standard JavaScript object key ordering is not deterministic across runtimes.

---

## 4. Grounded Developer Friction Log (3 Empirical Entries)

| # | Task | Steps Taken | Expected Result | Actual Result | Severity | Workaround Applied | Suggestion for AWS / Alexa Teams |
|---|---|---|---|---|---|---|---|
| **FL-1** | Alexa+ Tooling Access | Read Alexa+ MCP quickstart, then checked for `alexa-ai` in PATH and ran install check. | A clear setup path for hackathon participants. | We couldn't tell from the public docs whether participants can use the CLI, so we ran the PATH check (`alexa-ai` not found, public registry 404) and built a simulated client (`examples/evidence/alexa-tooling/cli-check.txt`). | **Medium** | Built a simulated Alexa+ client and test harness (`packages/alexa-client`) to validate the MCP interaction model. | Add a "hackathon participants start here" note stating which tooling is available. |
| **FL-2** | No Explicit Session ID in Alexa+ | Store per-user grants and spending caps in the MCP server. | Key state on an MCP session ID, as in many Streamable HTTP examples. | The Alexa+ docs note sessions follow conversation history rather than an explicit identifier, so state cannot safely key on session IDs alone. | **Medium** | Rebuilt grants and spend caps strictly around the authenticated bearer token subject, and added cross-user test scenario S11. | Document the recommended per-user state storage pattern for multi-tenant MCP servers. |
| **FL-3** | GitHub Token and Workflow Files | Activate CI workflow via git push of `.github/workflows/warrant-siege.yml`. | Standard Personal Access Token pushes workflow files. | Git remote rejected push because the PAT lacked the `workflow` scope. | **Low** | Staged workflow template in `ci/workflows/warrant-siege.yml` and documented adding via GitHub web or updating token scope. | Document token scope requirements for CI templates in project starter guides. |

---

## 5. Gateway Processing Overhead vs. Cloud LLM Inference Time

- **Gateway Overhead on Localhost:** Across 50 calls on localhost with mock providers, Warrant's gateway processing overhead is:
  - `search_hotels`: p95 **3.35 ms**
  - `propose_plan`: p95 **1.71 ms**
  - `execute_plan_undo_hold`: p95 **1.20 ms**  
  (Evidence: [`examples/evidence/latency.json`](../examples/evidence/latency.json) and [`examples/evidence/latency-raw.txt`](../examples/evidence/latency-raw.txt)).
- **Cloud LLM Turn Time:** In contrast, the Amazon Bedrock cloud inference turn took **1,853 ms** (Evidence: [`examples/evidence/bedrock-live/converse.txt`](../examples/evidence/bedrock-live/converse.txt)).
- **Conclusion:** Gateway safety enforcement (policy check, idempotency caching, SHA-256 canonical hashing, Ed25519 signing) accounts for less than 0.2% of the voice agent turn latency, comfortably satisfying the Alexa+ sub-500ms platform SLA.
