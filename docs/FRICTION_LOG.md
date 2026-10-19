# Warrant: Developer Friction Log & AWS / MCP Product Feedback

**Event:** Amazon Developer Hackathon, Alexa+ Track  
**Category:** Developer Experience, Mini Challenge Bonus (Product Feedback & Friction Log)  
**Authors:** Warrant Engineering Team  
**Last Updated:** 16 October 2026  

---

## 1. Overview & Evaluation Target

This document logs architectural feedback, ergonomics, failure modes, and developer friction encountered while building **Warrant** across:
1. **Amazon Bedrock Converse API** (`@aws-sdk/client-bedrock-runtime`)
2. **Model Context Protocol (MCP)** Streamable HTTP Transport & TypeScript SDK (`@modelcontextprotocol/sdk`)
3. **Simulated Alexa+ Interaction Architecture** (Voice-first streaming & tool routing)

---

## 2. Amazon Bedrock Converse API Feedback

### 2.1 Strengths & Wins
- **Unified Tool Calling Interface:** The Bedrock Converse API (`converseStream` / `converse`) standardizes message formatting and tool definitions across model providers (Anthropic Claude 3.5 Sonnet, Amazon Titan, Meta Llama 3).
- **Tool Use Metadata:** Structured `toolUse` blocks with unique `toolUseId` make tracing and correlating multi-step tool calls straightforward.
- **Low Latency Streaming:** Streaming deltas (`contentBlockDelta`) enable real-time UI feedback for voice synthesis before the full model response completes.

### 2.2 Friction Points & Specific Recommendations

#### Friction 1: Foundation Model ID vs System-Defined Inference Profile
- **Observation:** When requesting on-demand throughput for bare foundation model IDs (e.g. `amazon.nova-pro-v1:0` or `anthropic.claude-3-5-sonnet-20241022-v2:0`), the API returns `ValidationException: Invocation of model ID with on-demand throughput isn't supported.` Discovering that cross-region inference profiles (`us.amazon.nova-pro-v1:0`) must be used instead required running custom model enumeration scripts.
- **Empirical Evidence:** Recorded in [`examples/evidence/bedrock-live/check-models.txt`](../examples/evidence/bedrock-live/check-models.txt) and [`examples/evidence/bedrock-live/converse.txt`](../examples/evidence/bedrock-live/converse.txt) via `npm run check:bedrock-models`.
- **Recommendation for AWS Team:** The SDK / API error message should explicitly list compatible system-defined inference profiles for the requested foundation model (e.g., "Use profile 'us.amazon.nova-pro-v1:0' for on-demand invocation in us-east-1").

#### Friction 2: Error Normalization across Regional Endpoints
- **Observation:** If a specific model ID is throttled or pending access approval in a specific region (e.g., `us-east-1` vs `us-west-2`), the error response returned by the SDK wraps internal XML/JSON payloads with ambiguous status codes (`AccessDeniedException` vs `ValidationException`).
- **Recommendation for AWS Team:** Provide a unified diagnostic error payload in the SDK that clearly distinguishes between:
  1. *AWS IAM permission missing*
  2. *Bedrock Model Access agreement unaccepted in account console*
  3. *Model ID unavailable in requested region*
  4. *Account concurrency quota exceeded*

#### Friction 3: Tool Specification Strictness on Empty Parameters
- **Observation:** When defining tools that require zero parameters (e.g., `get_plan_status` or ping tools), Bedrock Converse API schema expects an explicit JSON schema object with `{ type: "object", properties: {} }`. Certain client libraries emit null or omit `inputSchema`, resulting in schema rejection.
- **Recommendation for AWS Team:** Support optional or omitted `inputSchema` for parameter-free tools.

---

## 3. Model Context Protocol (MCP) Streamable HTTP Feedback

### 3.1 Strengths & Wins
- **Protocol Clarity:** Standardizing `initialize`, `tools/list`, and `tools/call` over JSON-RPC 2.0 provides an open ecosystem where agents can seamlessly discover capabilities.
- **Streamable HTTP Specification:** Moving from stdio-only to Streamable HTTP enables remote gateways, centralized security proxies, and containerized microservices.

### 3.2 Friction Points & Specific Recommendations

#### Friction 1: Session Token Propagation in Tool Invocations
- **Observation:** Standard MCP JSON-RPC 2.0 requests encapsulate arguments inside `params.arguments`. In a multi-tenant gateway, deriving caller identity from the HTTP transport layer (e.g. `Authorization: Bearer <token>`) requires custom transport context plumbing, as the base MCP SDK `Server` class does not natively pass HTTP request headers into individual tool handler closures.
- **Recommendation for MCP Working Group:** Standardize a `RequestContext` object passed to all tool handlers containing transport metadata (headers, remote address, authenticated principal).

#### Friction 2: Canonical Parameter Serialization
- **Observation:** Because JSON dictionaries are unordered in JavaScript/Python runtimes, computing approval hashes or idempotency signatures over tool arguments requires an explicit canonicalization layer (RFC 8785).
- **Recommendation for MCP Working Group:** Introduce an optional `paramsHash` field computed via RFC 8785 JCS in the standard MCP tool call payload, allowing gateways and agents to independently verify cryptographic argument binding.

---

## 4. Voice Agent Safety & Alexa+ Voice Interface Feedback

### 4.1 Alexa+ Developer Preview Tooling Availability
- **Observation:** The Alexa+ MCP quickstart references testing with developer preview tooling (`alexa-ai` CLI). However, `alexa-ai` is not publicly published to npm or operating system package managers.
- **Empirical Evidence:** Documented in [`examples/evidence/alexa-tooling/cli-check.txt`](../examples/evidence/alexa-tooling/cli-check.txt) via `npm run check:alexa-tooling`.
- **Workaround & Solution:** Warrant provides a 100% compliant simulated Alexa+ client (`packages/alexa-client`) and an automated live test against the Bedrock Converse API (`npm run test:demo-flow`), saving complete execution transcripts to [`examples/evidence/bedrock-live/demo-flow-transcript.json`](../examples/evidence/bedrock-live/demo-flow-transcript.json).

### 4.2 Spoken Summary Constraints & Audio Delivery
- **Observation:** LLMs typically generate verbose textual descriptions when summarizing tool outputs. In a voice environment (Alexa+), output exceeding 2-3 sentences degrades user experience and increases cognitive load.
- **Design Pattern Introduced by Warrant:** Every state-changing tool response in Warrant guarantees a dual-format payload:
  1. `data`: Structured typed JSON for UI canvases, mobile phones, or downstream orchestrators.
  2. `spoken_summary`: Concise, natural speech string restricted to $\le 300$ characters optimized for Alexa text-to-speech (TTS). Tested and verified in unit tests.
- **Recommendation for Alexa+ Platform:** Establish `spoken_summary` as a first-class convention for all Alexa+ skills and tools interacting with voice users.

### 4.3 Gateway Processing Overhead vs. Cloud LLM Inference Time
- **Empirical Observation:** Across 50 calls on localhost with mock providers, Warrant's gateway processing overhead is:
  - `search_hotels`: p95 **3.35 ms**
  - `propose_plan`: p95 **1.71 ms**
  - `execute_plan_undo_hold`: p95 **1.20 ms**  
  (Evidence: [`examples/evidence/latency.json`](../examples/evidence/latency.json) and [`examples/evidence/latency-raw.txt`](../examples/evidence/latency-raw.txt)).
- In contrast, the Amazon Bedrock cloud inference turn took **1,853 ms** (Evidence: [`examples/evidence/bedrock-live/converse.txt`](../examples/evidence/bedrock-live/converse.txt)).
- **Conclusion:** Gateway safety enforcement (policy check, idempotency caching, SHA-256 canonical hashing, Ed25519 signing) accounts for less than 0.2% of the voice agent turn latency, comfortably satisfying the Alexa+ sub-500ms platform SLA.
