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

#### Friction 1: Error Normalization across Regional Endpoints
- **Observation:** If a specific model ID (e.g. `anthropic.claude-3-5-sonnet-20241022-v2:0`) is throttled or pending access approval in a specific region (e.g., `us-east-1` vs `us-west-2`), the error response returned by the SDK wraps internal XML/JSON payloads with ambiguous status codes (`AccessDeniedException` vs `ValidationException`).
- **Recommendation for AWS Team:** Provide a unified diagnostic error payload in the SDK that clearly distinguishes between:
  1. *AWS IAM permission missing*
  2. *Bedrock Model Access agreement unaccepted in account console*
  3. *Model ID unavailable in requested region*
  4. *Account concurrency quota exceeded*

#### Friction 2: Tool Specification Strictness on Empty Parameters
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

### 4.1 Spoken Summary Constraints
- **Observation:** LLMs typically generate verbose textual descriptions when summarizing tool outputs. In a voice environment (Alexa+), output exceeding 2-3 sentences degrades user experience and increases cognitive load.
- **Design Pattern Introduced by Warrant:** Every state-changing tool response in Warrant guarantees a dual-format payload:
  1. `data`: Structured typed JSON for UI canvases, mobile phones, or downstream orchestrators.
  2. `spoken_summary`: Concise, natural speech string restricted to $\le 300$ characters optimized for Alexa text-to-speech (TTS).
- **Recommendation for Alexa+ Platform:** Establish `spoken_summary` as a first-class convention for all Alexa+ skills and tools interacting with voice users.
