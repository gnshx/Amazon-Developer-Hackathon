# Warrant: Devpost Submission & Hackathon Strategy

**Hackathon:** Amazon Developer Hackathon (Alexa+ Track)  
**Submission Cutoff:** 23 October 2026, 11:59 PM IST (Official deadline: 24 Oct, 12:30 AM IST)  
**Architecture:** Monorepo containing core MCP Trust Gateway, Simulated Alexa+ Client, and modular Adversarial Test Harness (`@warrant/siege`).

---

## 1. Project Title & Taglines

- **Project Title:** Warrant — A Trust Gateway for Voice Agents
- **Elevator Pitch (1 sentence):** Warrant is a transactional safety layer for agents that act in the real world: bounded authority, exact-action approval, no double-charges, automatic rollback, and receipts anyone can verify, tested by attacks that fail when a protection is removed.
- **Demo Video URL (YouTube):** [https://youtu.be/OY3wq0Rrdk4](https://youtu.be/OY3wq0Rrdk4) *(80s studio-grade walkthrough, 1080p, ElevenLabs voice narration)*
- **Track Selection:** Alexa+ Track
- **Mini-Challenge Selections:**
  1. **Additional Open Source Project Mini-Challenge:** `@warrant/siege` is a modular, standalone open-source testing CLI (MIT License) that runs 11 attack scenarios against Warrant's tool interface and produces a scorecard. Running it against arbitrary MCP servers is future work.
  2. **AWS Builder Mini-Challenge:** Native integration with Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) for autonomous voice agent tool calling, with offline deterministic stub fallback and in-depth developer feedback.

---

## 2. Open Source Challenge Submission Fields

To satisfy all requirements for the Additional Open Source Project Mini-Challenge:
- **Dedicated Open Source Project Repository:** `https://github.com/gnshx/warrant-siege`
- **Primary Hackathon Monorepo:** `https://github.com/gnshx/Amazon-Developer-Hackathon`
- **Open Source Contribution URL:** `https://github.com/gnshx/warrant-siege`
- **GitHub Username:** `gnshx`
- **Project License:** [MIT License](https://github.com/gnshx/warrant-siege/blob/main/LICENSE)
- **Short Description:** `warrant-siege` is an independent, reusable security and adversarial test harness for Model Context Protocol (MCP) servers. It executes 11 attack scenarios against Warrant's tool interface (concurrency storms, parameter tampering, spend cap exhaustion, prompt injection, expired tokens, ambiguous timeouts, receipt fraud, cancellation races, and cross-user isolation) over Streamable HTTP and generates interactive HTML and JSON scorecards and SVG badges.
- **Standalone Verification:** Completely decoupled from monorepo dependencies. Verified standalone via:
  ```bash
  git clone https://github.com/gnshx/warrant-siege.git
  cd warrant-siege && npm install && npm run build
  node dist/cli.js --target http://localhost:8000/mcp --admin http://localhost:8000/admin
  ```
  Evaluates all 11 core adversarial scenarios ($S_1 - S_{11}$) with 11/11 green scorecard output.
- **Pre-Hackathon Non-Existence Confirmation:**  
  *Warrant is a new codebase; its first commit was on Oct 16, 2026. No code was copied from our earlier hackathon project AgentTrust, where we first explored limiting what an agent may spend.*

---

## 3. Scope Honesty & Transparency Statement

> **Mandatory Transparency Disclosure for Hackathon Judges:**  
> The genuine Alexa+ developer environment is restricted to select preview partners. In full alignment with hackathon scope-honesty guidelines, this submission discloses:
> 1. **Simulated Alexa+ Client:** The official Alexa+ developer preview is currently restricted to select partners. The Alexa+ companion web console is a high-fidelity Next.js simulator with speech synthesis, approval cards, and live MCP tool traces.
> 2. **Simulated Mock Providers:** Standalone Hotel, Train, and Restaurant mock services (Harbor Inn Hotel, Coastal Rail Express) with control endpoints for simulating faults (`TIMEOUT`, `DECLINE`, `DISCONNECT`).
> 3. **No Real Financial Settlement:** All transactions are denominated in integer minor units (cents) and settled within mock booking stores; no actual credit card or bank rails are charged.
> 4. **Model Plan Generation vs. Gateway Damage Limitation:** LLMs can still hallucinate or generate inefficient plans; Warrant's role is not to guarantee LLM conversational brilliance, but to deterministically guarantee that no action executes outside policy bounds, spend caps, or unapproved parameters.
> 5. **Structural Defense vs. Text Heuristics:** Warrant defends against prompt injection structurally (by separating data plane from out-of-band control plane and validating canonical parameter hashes), rather than relying on brittle regex or heuristic sentiment/prompt-guard classifiers.
> 6. **Storage Architecture & Scalability:** Uses SQLite in WAL mode with a decoupled repository interface; while ideal for single-node / edge deployment, distributed production environments would swap the repository implementation for PostgreSQL or Amazon DynamoDB.
> 7. **No External Third-Party Audit & Prior Work Disclosure:** While verified against 11 automated attack scenarios, property tests, and 3 mutation tests, Warrant has not undergone a formal third-party commercial pen-test. The author previously explored economic agent bounding in an open-source research project on Monad (`AgentTrust`, MIT License), which was EVM smart-contract based. No code was copied from our earlier hackathon project AgentTrust, where we first explored limiting what an agent may spend. Warrant was conceptualized, architected, and built entirely anew in TypeScript for the Model Context Protocol (MCP 2025-11-25 Streamable HTTP), Amazon Bedrock Converse API, and Alexa+ ecosystem.
> 
> *For an instant evaluation path and full scoring rubric mapping, see [**`JUDGES.md`**](../JUDGES.md).*

---

## 4. Submission Artifacts Checklist

- [x] **Public Git Repository:** Complete monorepo source code with verified quickstart instructions.
- [x] **MCP in Code:** Streamable HTTP MCP server targeting specification `2025-11-25+`.
- [x] **Public Demo Video:** [https://youtu.be/OY3wq0Rrdk4](https://youtu.be/OY3wq0Rrdk4) (1m 20s, 1080p, ElevenLabs voice narration, on-screen "Simulated" prototype disclosure, 0 copyrighted audio/assets).
- [x] **Product Feedback on Tools & SDKs:** Detailed feedback covering all required prompts for Bedrock Converse API, AWS SDK v3, MCP SDK, Next.js 14, and SQLite.
- [x] **Developer Friction Log:** Detailed table covering task, steps, expected vs actual, severity, workaround, and concrete suggestions (eligible for 10% bonus).
- [x] **Scorecard Evidence:** Both machine-readable `scorecard.json` and styled `scorecard.html` generated by `warrant-siege` showing 11/11 green passed scenarios and 10/10 invariants.
- [x] **Automated Mutation Test:** `npm run test:mutation` proving that disabling idempotency, approval verification, or user isolation causes scenarios S1, S4, and S11 to turn RED (3/3 caught).
- [x] **Comparative Benchmark:** `npm run test:compare` demonstrating an intentionally unprotected example server fails 3 of 3 vs 3/3 passing on Warrant.
- [x] **Gateway Processing Latency:** `npm run test:latency` measuring gateway processing time on localhost with mock providers across 50 calls/tool (search p95 3.35ms, propose p95 1.71ms, exec p95 1.20ms).
- [x] **Verified Clean Path:** `npm install && npm run test && npm run dev` tested and confirmed in <5 minutes.

---

### Visual Interface & Safety Canvas (5 Core Screens)

| 1. Assistant Console & Live MCP Traces | 2. Out-of-Band Phone Approval Card |
|:---:|:---:|
| ![Assistant Console](assets/1-assistant-console.png) | ![Phone Approval](assets/2-phone-approval.png) |
| **3. Mid-Plan Failure & Saga Rollback** | **4. Adversarial Siege Safety Scorecard (11/11)** |
| ![When Something Fails](assets/3-when-something-fails.png) | ![Safety Scorecard](assets/4-safety-scorecard.png) |

| 5. Your Assistant's Limits (Household Out-of-Band Policy) |
|:---:|
| ![Your Assistant's Limits](assets/5-assistants-limits.png) |

---

## 5. Official Devpost Story Text (~500 Words)

### Warrant: a safety layer for voice agents that spend money

Voice assistants are starting to book and buy for us, with no screen to check first. A wrong guess, a retry, or one malicious line in a hotel description can turn into a real charge.

#### What it does
You set limits on your phone: a total budget, the amount above which the assistant must ask you, which actions are allowed, and when access expires. The assistant can read these limits but cannot change them through any tool it has.

When it plans a trip, anything above your threshold needs your approval on your phone. That approval is tied to the exact details, so if anything changes afterwards, it stops working. If the second step fails, the first is undone automatically. A retry does not book twice (tested). After each action you get a signed receipt you can verify offline, and a short window to undo.

For brands, Warrant is an MCP server over Streamable HTTP (spec 2025-11-25) plus an Agent Skill that teaches an assistant how to use it safely. A separate open-source tool, warrant-siege, runs 11 attack scenarios against Warrant's tool interface and produces a scorecard. Running it against arbitrary MCP servers is future work.

#### How we built it
• A TypeScript MCP gateway with a deterministic policy engine, SQLite storage, and money held as integer cents  
• Approvals bound to a SHA-256 hash of the exact action, using RFC 8785 canonical JSON  
• Ed25519 signed receipts, and a hash-chained audit log with Merkle checkpoints  
• A multi-step saga orchestrator that compensates in reverse order, plus reconciliation of unknown outcomes by idempotency key  
• A simulated Alexa+ client in Next.js, driven by the Amazon Bedrock Converse API (`us.amazon.nova-pro-v1:0`)  
• Mock hotel, train and restaurant services with fault injection  

#### How we know it works
• 11 attack scenarios: duplicate submits, mid-plan failure, over-budget plans, tampered approvals, injected instructions, expired grants, missing approvals, ambiguous timeouts, altered receipts, undo, and cross-user access  
• A mutation script that disables a protection and shows the matching scenario turn red (3 mutations)  
• A comparison: an intentionally unprotected example server we wrote fails 3 of 3 scenarios, and Warrant passes them  
• Gateway processing time of under 4 ms p95 (search 3.35 ms, propose 1.71 ms, execute 1.20 ms on localhost with mock providers, 50 calls per tool)  

#### Alexa+ fit
The gateway behaves the way Alexa+ MCP quickstart describes: unauthenticated calls get a 401, it serves protected resource metadata, tokens are accepted only in the Authorization header, and grants are tied to the signed-in user, not to a session. Tool annotations and 300-character spoken summaries are tested. Not yet done: a public HTTPS endpoint and a run on a real Alexa+ device.

#### Honest scope
The Alexa+ client and the providers are simulated, because we did not have access to a real Alexa+ device or add-on environment. No real money moves. The OAuth server is a demo and is not Alexa+ certified. The model can still propose a bad plan; the gateway limits the damage it can do. There has been no external security audit. Warrant is a new codebase; its first commit was on Oct 16, 2026. No code was copied from our earlier hackathon project AgentTrust, where we first explored limiting what an agent may spend.

#### What's next
• Passkey-signed approvals  
• A public transparency log for receipts  
• Delegation tokens that can only narrow authority  

#### Built with
TypeScript, Node.js, Express, Model Context Protocol, Amazon Bedrock, AWS SDK for JavaScript, Next.js, React, SQLite, Vitest


---

## 6. Required Product Feedback & Tool Evaluation

*(Hackathon rules mandate structured feedback on all tools, APIs, and SDKs utilized in the submission.)*

### 1. Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`)
- **What it was used for:** Invoking Amazon Bedrock (`us.amazon.nova-pro-v1:0` through a cross-region inference profile in `us-east-1`) to drive the simulated Alexa+ voice assistant loop in `packages/alexa-client/src/lib/bedrock-agent.ts`. In our end-to-end demo flow (`npm run test:demo-flow`), Bedrock autonomously executed a two-turn travel planning workflow: in Turn 1, it analyzed a natural spoken prompt and called `search_hotels` and `search_trains`; in Turn 2, it processed candidate listings and proposed a two-step booking plan with reverse compensations (`propose_plan`) strictly within household spend caps. Complete raw execution proof, timestamps, tool-use IDs, and token metrics are documented in `examples/evidence/bedrock-live/` (`converse-proof.json`, `demo-flow-transcript.json`, `demo-flow-trace.txt`, `skill-test.txt`).
- **What worked:** The unified Converse API interface (`ConverseCommand`) cleanly separates tool specifications (`toolConfig`) from message history, making it straightforward to pass JSON schema definitions for our travel tools.
- **Feature wish:** An official local mock runner or client stub in `@aws-sdk/client-bedrock-runtime` would ease local testing and CI when credentials are not configured.
- **Onboarding experience:** The TypeScript SDK types are comprehensive, though accessing nested tool parameters requires multiple optional chaining guards (`output?.message?.content?.[0]?.toolUse`).
- **Would you use it again?** Yes. For structured agent tool calling on AWS, the Converse API provides a clean multi-model contract.

### 2. AWS SDK for JavaScript v3 (`@aws-sdk/*`)
- **What it was used for:** Client communication with AWS services, specifically `@aws-sdk/client-bedrock-runtime`.
- **What worked:** Modular v3 package structure keeps bundle sizes small. TypeScript types are first-class, and modern Promise-based command dispatch (`client.send(new ConverseCommand({...}))`) is predictable.
- **What needs work:** Deeply nested command response types often require cumbersome optional chaining (`response.output?.message?.content?.[0]?.toolUse`).
- **Onboarding experience:** Straightforward with `npm install @aws-sdk/client-bedrock-runtime`.
- **Would you use it again?** Yes, it is the standard for AWS development in TypeScript.

### 3. Model Context Protocol (MCP) TypeScript SDK (`@modelcontextprotocol/sdk`)
- **What it was used for:** Implementing the Warrant Trust Gateway over Streamable HTTP (spec 2025-11-25) and client MCP connections.
- **What worked:** Standardized JSON-RPC 2.0 tool discovery (`tools/list`) and invocation (`tools/call`) allowed clean separation between agent reasoning and tool execution.
- **What needs work:** The SDK's server handler does not pass the incoming HTTP request context (headers, remote address) into individual tool closures, requiring custom transport context plumbing to read bearer tokens.
- **Onboarding experience:** The JSON-RPC abstractions are clear once set up, though Streamable HTTP documentation is still evolving.
- **Would you use it again?** Yes, MCP is rapidly emerging as the universal bridge for agent tooling.

### 4. Alexa+ MCP Documentation
- **What it was used for:** Used as the requirements checklist for our MCP server implementation (unauthenticated 401s, Authorization header token extraction, protected resource metadata). The Alexa+ CLI itself was untested as hackathon participant access was unavailable.
- **What worked:** Clear guidance on transport expectations, 401 challenge semantics, and token-based bearer authentication.
- **What needs work:** Clarifying in the docs whether hackathon developers can install and use `@alexa-ai/cli` or whether it requires partner role delegation.
- **Would you use it again?** Yes, it was our primary reference for aligning Warrant with Alexa+ transport standards.

### 5. Next.js 14 App Router
- **What it was used for:** Front-end simulated Alexa+ assistant interface, phone approval card view, live tool trace telemetry, and audit trail visualization.
- **What worked:** React Server Components combined with client components provided high performance. Fast refresh and built-in CSS styling enabled rapid iteration on glassmorphic design. Web Speech API integration provides natural voice playback without external audio services.
- **What needs work:** Hydration mismatches can occur when rendering timestamps or client-side crypto keys if not carefully guarded with `mounted` state checks.
- **Onboarding experience:** Flawless. Standard `npx create-next-app` provides an immediate working dev environment.
- **Would you use it again?** Absolutely.

### 6. SQLite with `better-sqlite3`
- **What it was used for:** In-process ACID transactional storage for grants, active plans, idempotency locks, approvals, Ed25519 action receipts, and SHA-256 audit events.
- **What worked:** Synchronous execution model in WAL mode makes atomic database transactions trivial without async race conditions. Zero external service dependencies makes local evaluation instantaneous.
- **What needs work:** C++ native compilation can require `build-essential` on some minimal Linux environments, and rebuilding native addons when Node versions change (`npm rebuild better-sqlite3`).
- **Onboarding experience:** Excellent. Very fast setup and reliable.
- **Would you use it again?** Yes, the ideal embedded engine for gateways and local agents.

### 7. Agent Skills Format (`skills/warrant-safe-actions/SKILL.md`)
- **What it was used for:** Authoring the portable `warrant-safe-actions` agent skill, guiding conversational models (Amazon Nova Pro, Claude Code, Alexa+) on safe action sequencing, out-of-band approval expectations, idempotency key persistence, and concise spoken summaries.
- **What worked:** Clean Markdown frontmatter with clear behavioral rules, failure case handling, and voice-first spoken guidelines. Easy to load directly into the Bedrock Converse API `system` prompt array or pass into autonomous agent frameworks.
- **What needs work:** Agent Skills rely on model compliance rather than cryptographic enforcement at runtime. Warrant solves this by combining the Agent Skill with an MCP trust gateway that deterministically validates every parameter, approval token, and spend cap.
- **Onboarding experience:** Simple and expressive.
- **Would you use it again?** Yes. Pairing an MCP server with an Agent Skill creates defense-in-depth: the skill guides the agent's cooperative intent, and the gateway enforces the hard security boundary.

---

## 7. Official Feature Requests for the Alexa+ & AWS Teams

*(Grounding enhancements directly in our development experience and published platform documentation)*

| Request ID | Urgency Level | Proposed Feature | Problem Solved | Recommended Implementation |
|---|:---:|---|---|---|
| **FR-1** | **🚨 CRITICAL** | **Native Companion App Out-of-Band Step-Up Approval Protocol** | Alexa+'s MCP quickstart lists step-up authorization as not yet supported, so Warrant routes high-value approvals to a companion phone page. | Provide an official Alexa Skill / Bedrock Agent primitive that dispatches an interactive push card to the user's Alexa smartphone app with cryptographic parameter binding (e.g., WebAuthn biometric assertion or signed hash confirmation), pausing agent execution until the companion token returns. |
| **FR-2** | **⚠️ IMPORTANT** | **First-Class Support for MCP Tool Semantic Annotations in Bedrock Converse API** | As far as we could tell, Bedrock Converse API `toolConfig` treats all tool definitions as generic JSON schemas, preventing the runtime from differentiating read-only queries from irreversible financial transfers before execution. | Allow tool definitions in Bedrock Converse API to include MCP-aligned annotations (`destructive: true`, `idempotent: true`, alongside custom metadata like `riskTier: "T2"`). This enables the LLM runtime to automatically require confirmation before proposing destructive calls. |
| **FR-3** | **💡 NICE-TO-HAVE** | **Standardized MCP Application Error Codes for Voice-Assistant Interventions** | When an MCP tool call fails due to policy (e.g. approval required, budget exceeded, or session expired), there is no standardized JSON-RPC error code convention in MCP or Bedrock, forcing agents to parse unstructured error strings. | Standardize JSON-RPC application error codes (e.g., `-32001` for `APPROVAL_REQUIRED`, `-32002` for `BUDGET_EXCEEDED`) so agents can react deterministically without brittle string parsing. |

---

## 8. Developer Friction Log (10% Bonus Documentation)

| # | Task | Steps Taken | Expected Result | Actual Result | Severity | Workaround Applied | Suggestion for AWS / Alexa Teams |
|---|---|---|---|---|---|---|---|
| **FL-1** | Alexa+ Tooling Access | Read Alexa+ MCP quickstart, then checked for `alexa-ai` in PATH and ran install check. | A clear setup path for hackathon participants. | We couldn't tell from the public docs whether participants can use the CLI, so we ran the PATH check (`alexa-ai` not found, public registry 404) and built a simulated client (`examples/evidence/alexa-tooling/cli-check.txt`). | **Medium** | Built a simulated Alexa+ client and test harness (`packages/alexa-client`) to validate the MCP interaction model. | Add a "hackathon participants start here" note stating which tooling is available. |
| **FL-2** | No Explicit Session ID in Alexa+ | Store per-user grants and spending caps in the MCP server. | Key state on an MCP session ID, as in many Streamable HTTP examples. | The Alexa+ docs note sessions follow conversation history rather than an explicit identifier, so state cannot safely key on session IDs alone. | **Medium** | Rebuilt grants and spend caps strictly around the authenticated bearer token subject, and added cross-user test scenario S11. | Document the recommended per-user state storage pattern for multi-tenant MCP servers. |
| **FL-3** | GitHub Token and Workflow Files | Activate CI workflow via git push of `.github/workflows/warrant-siege.yml`. | Standard Personal Access Token pushes workflow files. | Git remote rejected push because the PAT lacked the `workflow` scope. | **Low** | Staged workflow template in `ci/workflows/warrant-siege.yml` and documented adding via GitHub web or updating token scope. | Document token scope requirements for CI templates in project starter guides. |

---

## 9. Official Devpost Form Fields & Ready-to-Paste Data

*(Copy-paste directly into the Devpost submission portal)*

- **Project Title:** Warrant — A Trust Gateway for Voice Agents
- **Tagline (1 sentence):** Warrant is a transactional safety layer for agents that act in the real world: bounded authority, exact-action approval, no double-charges, automatic rollback, and receipts anyone can verify, tested by attacks that fail when a protection is removed.
- **Track Selection:** Alexa+ Track
- **Mini-Challenge Selections:**
  - Additional Open Source Project Mini-Challenge (`@warrant/siege` MIT)
  - AWS Builder Mini-Challenge (Amazon Bedrock Converse API)
- **Built With:**
  `typescript`, `amazon-bedrock`, `aws-sdk`, `model-context-protocol`, `mcp`, `streamable-http`, `nextjs`, `react`, `sqlite`, `vitest`, `ed25519`, `sha256`, `express`, `nodejs`
- **GitHub Repository Links:**
  - Monorepo: `https://github.com/gnshx/Amazon-Developer-Hackathon`
  - Standalone Open Source Challenge: `https://github.com/gnshx/warrant-siege`
- **"Did this project exist before the hackathon?" Field:**
  > *Warrant's first commit was Oct 16, 2026. All packages in this repository (`@warrant/gateway`, `@warrant/siege`, `@warrant/alexa-client`) were created from scratch during the hackathon.*
  > *Prior Work Disclosure: The author previously explored economic agent bounding in an open-source research project on Monad (`AgentTrust`, MIT License), which was EVM smart-contract based. No code was reused from AgentTrust. Warrant is an entirely new codebase written from scratch in TypeScript under the MIT / Apache 2.0 license for the Model Context Protocol (MCP 2025-11-25 Streamable HTTP), Amazon Bedrock Converse API, and Alexa+ voice ecosystem with new runtime primitives (Saga Orchestration, Active Timeout Reconciliation, Detached Ed25519 Signed Receipts, and the Grace-Hold Undo Window).*
- **Collaborator Instructions:**
  The repository is public; no collaborator access is needed. If the repository is ever switched to private, access will be granted to the official evaluators: `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`, and `testing@devpost.com`.

---

## 10. Post-Hackathon Roadmap (Future Work)

*The following features represent unbuilt future architecture planned for Warrant's open-source evolution beyond the hackathon:*

1. **Attenuated Capability Tokens (Macaroons / Biscuits):** Enable agents to delegate sub-tasks to child agents with cryptographic attenuation: authority can only shrink, never grow, preventing privilege escalation across multi-agent swarms.
2. **Public Transparency Logs:** Anchor Merkle tree roots to an open, append-only transparency log (RFC 6962 / Sigstore) to enable third-party verification across independent brands without trusting any central server.
3. **Biometric Hardware-Bound Passkeys:** Move phone approval signing into the device's secure hardware (WebAuthn / Passkeys), making approval keys completely unexportable even under operating system compromise.
4. **Policy as Code with AWS Cedar / OPA:** Declarative, formally verifiable policy definitions that support shadow-mode evaluation against historical audit logs before activating new household rules.
5. **Caregiver & Enterprise Multi-Party Approvals:** Configurable dual-authorization workflows for senior care, parental controls, and corporate purchasing thresholds.
