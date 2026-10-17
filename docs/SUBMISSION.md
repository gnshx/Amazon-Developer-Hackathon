# Warrant: Devpost Submission & Hackathon Strategy

**Hackathon:** Amazon Developer Hackathon (Alexa+ Track)  
**Submission Cutoff:** 23 October 2026, 11:59 PM IST (Official deadline: 24 Oct, 12:30 AM IST)  
**Architecture:** Monorepo containing core MCP Trust Gateway, Simulated Alexa+ Client, and modular Adversarial Test Harness (`@warrant/siege`).

---

## 1. Project Title & Taglines

- **Project Title:** Warrant — A Trust Gateway for Voice Agents
- **Elevator Pitch (1 sentence):** An open-source MCP trust gateway that makes voice agent actions safe and auditable through scoped grants, cryptographic approval binding, automatic saga rollback, detached Ed25519 receipts, and an adversarial attack scorecard.
- **Track Selection:** Alexa+ Track
- **Mini-Challenge Selections:**
  1. **Additional Open Source Project Mini-Challenge:** `@warrant/siege` is a modular, standalone open-source testing CLI (Apache 2.0 / MIT) that attacks any MCP server with 10 standard adversarial scenarios and generates an automated safety scorecard.
  2. **AWS Builder Mini-Challenge:** Native integration with Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) for autonomous voice agent tool calling, with offline deterministic stub fallback and in-depth developer feedback.

---

## 2. Open Source Challenge Submission Fields

To satisfy all requirements for the Additional Open Source Project Mini-Challenge:
- **Dedicated Open Source Project Repository:** `https://github.com/gnshx/warrant-siege`
- **Primary Hackathon Monorepo:** `https://github.com/gnshx/Amazon-Developer-Hackathon`
- **Open Source Contribution / Monorepo Source:** `https://github.com/gnshx/Amazon-Developer-Hackathon/tree/main/packages/warrant-siege`
- **GitHub Username:** `gnshx`
- **Project License:** [MIT License](https://github.com/gnshx/warrant-siege/blob/main/LICENSE)
- **Short Description:** `warrant-siege` is an independent, reusable security and adversarial test harness for Model Context Protocol (MCP) servers. It executes 10 attack scenarios (concurrency storms, parameter tampering, spend cap exhaustion, prompt injection, expired tokens, ambiguous timeouts, receipt fraud, and cancellation races) over Streamable HTTP and generates interactive HTML and JSON scorecards and SVG badges.
- **Standalone Verification:** Completely decoupled from monorepo dependencies. Verified standalone via:
  ```bash
  git clone https://github.com/gnshx/warrant-siege.git
  cd warrant-siege && npm install && npm run build
  node dist/cli.js --target http://localhost:8000/mcp --admin http://localhost:8000/admin
  ```
  Evaluates all 10 core adversarial scenarios ($S_1 - S_{10}$) with 10/10 green scorecard output.
- **Pre-Hackathon Non-Existence Confirmation:**  
  *We explicitly affirm that this project and all associated packages (`@warrant/gateway`, `@warrant/siege`, `@warrant/alexa-client`) were created from scratch during the hackathon period and did not exist prior to the official hackathon start date.*

---

## 3. Scope Honesty & Transparency Statement

> **Mandatory Transparency Disclosure for Hackathon Judges:**  
> The genuine Alexa+ developer environment is restricted to select preview partners. In full alignment with hackathon scope-honesty guidelines, this submission discloses:
> 1. **Simulated Alexa+ Client:** The official Alexa+ developer preview is currently restricted to select partners. The Alexa+ companion web console is a high-fidelity Next.js simulator with speech synthesis, approval cards, and live MCP tool traces.
> 2. **Simulated Mock Providers:** Standalone Hotel, Train, and Restaurant mock services (Harbor Inn Hotel, Coastal Rail Express) with control endpoints for simulating faults (`TIMEOUT`, `DECLINE`, `DISCONNECT`).
> 3. **No Real Financial Settlement:** All transactions are denominated in integer minor units (cents) and settled within mock booking stores; no actual credit card or bank rails are charged.
> 4. **Model Plan Generation vs. Gateway Damage Limitation:** LLMs can still hallucinate or generate inefficient plans; Warrant's role is not to guarantee LLM conversational brilliance, but to mathematically guarantee that no action executes outside policy bounds, spend caps, or unapproved parameters.
> 5. **Structural Defense vs. Text Heuristics:** Warrant defends against prompt injection structurally (by separating data plane from out-of-band control plane and validating canonical parameter hashes), rather than relying on brittle regex or heuristic sentiment/prompt-guard classifiers.
> 6. **Storage Architecture & Scalability:** Uses SQLite in WAL mode with a decoupled repository interface; while ideal for single-node / edge deployment, distributed production environments would swap the repository implementation for PostgreSQL or Amazon DynamoDB.
> 7. **No External Third-Party Audit & Prior Work Disclosure:** While verified against 10 automated attack scenarios, property tests, and mutation tests, Warrant has not undergone a formal third-party commercial pen-test. We transparently acknowledge prior architectural concepts in autonomous agent bounding (including the author's previous exploration of passkey-bounded mandates on Monad in `AgentTrust`), adapted and re-architected from scratch for AWS Bedrock, Amazon Alexa+, and Model Context Protocol Streamable HTTP under Apache 2.0 / MIT.
> 
> *For an instant evaluation path and full scoring rubric mapping, see [**`JUDGES.md`**](../JUDGES.md).*

---

## 4. Submission Artifacts Checklist

- [x] **Public Git Repository:** Complete monorepo source code with verified quickstart instructions.
- [x] **MCP in Code:** Streamable HTTP MCP server targeting specification `2025-11-25+`.
- [x] **Public Demo Video:** Under 2:45 on YouTube/Vimeo with no copyrighted audio, no third-party trademark violations, and on-screen "Simulated" prototype disclosure (follows `docs/DEMO_SCRIPT.md`).
- [x] **Product Feedback on Tools & SDKs:** Detailed feedback covering all 5 required prompts for Bedrock Converse API, AWS SDK v3, MCP SDK, Next.js 14, and SQLite.
- [x] **Developer Friction Log:** Detailed table covering task, steps, expected vs actual, severity, workaround, and concrete suggestions (eligible for 10% bonus).
- [x] **Scorecard Evidence:** Both machine-readable `scorecard.json` and styled `scorecard.html` generated by `warrant-siege` showing 10/10 green passed invariants.
- [x] **Automated Mutation Test:** `npm run test:mutation` proving both idempotency and approval tamper mutations turn scenarios RED.
- [x] **Verified Clean Path:** `npm install && npm run test && npm run dev` tested and confirmed in <5 minutes.

---

### Visual Interface & Safety Canvas (5 Core Screens)

| 1. Assistant Console & Live MCP Traces | 2. Out-of-Band Phone Approval Card |
|:---:|:---:|
| ![Assistant Console](assets/1-assistant-console.png) | ![Phone Approval](assets/2-phone-approval.png) |
| **3. Mid-Plan Failure & Saga Rollback** | **4. Adversarial Siege Safety Scorecard (10/10)** |
| ![When Something Fails](assets/3-when-something-fails.png) | ![Safety Scorecard](assets/4-safety-scorecard.png) |

| 5. Your Assistant's Limits (Household Out-of-Band Policy) |
|:---:|
| ![Your Assistant's Limits](assets/5-assistants-limits.png) |

---

## 5. Official Devpost Story Text

### Inspiration & Problem Statement
AI agents are transitioning from answering trivia to executing high-stakes real-world commitments: booking trips, purchasing tickets, and negotiating reservations. Voice interfaces make this fundamentally perilous because there is no persistent screen to review fine-grained details before money is debited. 

Today, there is no standard way to define how much authority an agent holds, to cryptographically prove what action occurred, to automatically undo side effects when a multi-step plan fails halfway, or to evaluate whether a tool is safe to expose to voice assistants. Every brand builds its own fragile, one-off safeguards—if any—forcing users to trust their assistant blindly. We built **Warrant** to be the missing trust layer for the agentic economy.

### What It Does
Warrant is an open-source trust gateway operating over the Model Context Protocol (MCP Streamable HTTP). It intercepts every agent tool call and enforces 10 safety invariants tested by 10 adversarial scenarios:
1. **Scoped & Expiring Authority ($I_6$):** Household administrators configure spend caps (in integer minor units) and time-limited scopes out-of-band.
2. **Exact Action-Hash Approval Binding ($I_3$):** High-risk ($T_2$) actions return `PENDING_APPROVAL` with voice-friendly summaries ($\le 300$ chars). Approvals are granted on a mobile phone interface cryptographically bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{params}))$. If prompt injection or model drift alters any argument, the approval is invalid.
3. **Multi-Layer Idempotency ($I_1$):** Prevents retry storms or duplicate voice requests from double-charging.
4. **Automatic Saga Rollback ($I_4$):** If step 2 of a multi-step booking fails, completed step 1 is automatically cancelled in reverse order, leaving zero orphan state.
5. **Structural Output Containment ($I_5$):** Prevents third-party provider descriptions or injected strings from escalating grant authority.
6. **Active Timeout Reconciliation ($I_8$):** Dropped connections actively query provider truth by idempotency key rather than blindly retrying.
7. **Detached Ed25519 Action Receipts ($I_9$):** Every confirmed action produces a digitally signed receipt verifiable completely offline without trusting the server.
8. **Grace-Hold Undo Window ($I_{10}$):** Configurable countdown hold before irreversible provider dispatch; cancellation leaves zero provider bookings and zero charges.
9. **Cryptographic Audit Continuity & Merkle Roots ($I_7$):** Append-only SHA-256 event chain verifiable from genesis, with binary Merkle tree root checkpoints allowing $O(\log N)$ inclusion verification.
10. **Adversarial Siege Test Suite (`@warrant/siege`):** A standalone modular CLI attacking the gateway across 10 attack scenarios, generating verified HTML and JSON scorecards and SVG badges.

### How We Built It
- **Gateway Core:** TypeScript MCP server conforming to Streamable HTTP spec `2025-11-25+`, with an SQLite WAL repository layer, pure deterministic policy engine, Ed25519 receipt signer, and Merkle tree audit prover.
- **Client & Voice Agent:** Next.js 14 dark-mode glassmorphic UI integrated with the **Amazon Bedrock Converse API** (`@aws-sdk/client-bedrock-runtime`) for autonomous tool dispatch, featuring receipt inspection, undo countdown, and offline deterministic fallback.
- **Mock Services:** Autonomous Hotel, Train, and Restaurant providers (Harbor Inn Hotel, Coastal Rail Express) with control endpoints for simulating timeouts, declines, and lost connections.
- **Adversarial Harness & CI Action:** Independent workspace package (`@warrant/siege`) with interactive scorecard generation and a reusable GitHub Actions workflow template.

---

## 6. Required Product Feedback & Tool Evaluation

*(Hackathon rules mandate structured feedback on all tools, APIs, and SDKs utilized in the submission.)*

### 1. Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`)
- **What it was used for:** Driving the multi-turn conversational voice agent loop, translating natural language user trip requests into structured MCP tool calls (`propose_plan`, `execute_plan`), and generating natural spoken summaries.
- **What worked:** The unified Converse API interface (`ConverseCommand`) dramatically simplifies message history formatting compared to model-specific invoke schemas. Tool configuration (`toolConfig`) with JSON schema definitions is clean, and tool-use blocks return reliably.
- **What needs work:** Foundation model lifecycles and regional routing require careful diligence. Older model IDs (such as Claude 3 Haiku `anthropic.claude-3-haiku-20240307-v1:0`) have entered legacy or retired states across regions, while newer models (such as Claude 3.5 Sonnet v2) require cross-region inference profile IDs (`us.anthropic...`) rather than raw model IDs. Clearer error messaging and an automated model lifecycle verification helper in the SDK would streamline adoption.
- **Onboarding experience:** Model access must be explicitly requested in the AWS Bedrock Console before API keys will function. The offline deterministic fallback mode was essential for CI/CD and automated testing without incurring cloud fees or failing when credentials are absent.
- **Would you use it again?** Yes. For agentic tool calling in AWS environments, Converse API is the best multi-model abstraction available.

### 2. AWS SDK for JavaScript v3 (`@aws-sdk/*`)
- **What it was used for:** Client communication with AWS services, specifically `@aws-sdk/client-bedrock-runtime` and `@aws-sdk/client-bedrock`.
- **What worked:** Modular v3 package structure keeps bundle sizes small. TypeScript types are first-class, and modern Promise-based command dispatch (`client.send(new ConverseCommand({...}))`) is predictable.
- **What needs work:** Deeply nested command response types often require cumbersome optional chaining (`response.output?.message?.content?.[0]?.toolUse`).
- **Onboarding experience:** Straightforward with `npm install @aws-sdk/client-bedrock-runtime`.
- **Would you use it again?** Yes, it is the standard for AWS development in TypeScript.

### 3. Model Context Protocol (MCP) TypeScript SDK
- **What it was used for:** Implementing the Warrant Trust Gateway over Streamable HTTP (spec 2025-11-25) and client MCP connections.
- **What worked:** Standardized JSON-RPC 2.0 tool discovery (`tools/list`) and invocation (`tools/call`) allowed clean separation between agent reasoning and tool execution.
- **What needs work:** Streamable HTTP specification transitions have created version divergence between older Stdio transports and newer HTTP SSE endpoints. Better official reference examples for long-lived Express server hosting would help developers.
- **Onboarding experience:** Initial concepts are clear, but rapid spec iterations require checking GitHub discussions for authoritative schemas.
- **Would you use it again?** Yes, MCP is rapidly emerging as the universal bridge for agent tooling.

### 4. Next.js 14 App Router
- **What it was used for:** Front-end simulated Alexa+ assistant interface, phone approval card view, live tool trace telemetry, and audit trail visualization.
- **What worked:** React Server Components combined with client components provided high performance. Fast refresh and built-in CSS styling enabled rapid iteration on glassmorphic design. Web Speech API integration provides natural voice playback without external audio services.
- **What needs work:** Hydration mismatches can occur when rendering timestamps or client-side crypto keys if not carefully guarded with `mounted` state checks.
- **Onboarding experience:** Flawless. Standard `npx create-next-app` provides an immediate working dev environment.
- **Would you use it again?** Absolutely.

### 5. SQLite with `better-sqlite3`
- **What it was used for:** In-process ACID transactional storage for grants, active plans, idempotency locks, approvals, Ed25519 action receipts, and SHA-256 audit events.
- **What worked:** Synchronous execution model in WAL mode makes atomic database transactions trivial without async race conditions. Zero external service dependencies makes local evaluation instantaneous.
- **What needs work:** C++ native compilation can require `build-essential` on some minimal Linux environments, and rebuilding native addons when Node versions change (`npm rebuild better-sqlite3`).
- **Onboarding experience:** Excellent. Very fast setup and reliable.
- **Would you use it again?** Yes, the ideal embedded engine for gateways and local agents.

### 6. Alexa+ Developer Preview & Model Context Protocol (MCP) Ecosystem
- **What it was used for:** Architectural target for voice agent safety, companion approvals, and tool orchestration over the official MCP Streamable HTTP specification (`2025-11-25+`).
- **What worked:** The concept of connecting LLM reasoning engines (like Bedrock Converse API) to standardized tool endpoints over MCP eliminates custom, brittle integrations. Ambient voice-first commerce is the most exciting frontier for autonomous agents.
- **What needs work:** The genuine Alexa+ developer preview is currently restricted to select partners, which required us to build high-fidelity simulated models of the voice assistant interface, phone approval push flow, and travel service providers. Clearer documentation on how external MCP Streamable HTTP servers will bridge to future Alexa+ skills and partner accounts is needed.
- **Onboarding experience:** The MCP TypeScript SDK has evolved rapidly between stdio transports and newer Streamable HTTP SSE endpoints; providing official production reference architectures for long-lived Express server hosting would accelerate adoption.
- **Would you use it again?** Absolutely. Warrant was engineered specifically to be the foundational security layer for the Alexa+ ecosystem.

---

## 7. Official Feature Requests for the Alexa+ & AWS Teams

*(To demonstrate ecosystem depth and satisfy hackathon criteria, we propose four concrete platform enhancements with urgency classifications)*

| Request ID | Urgency Level | Proposed Feature | Problem Solved | Recommended Implementation |
|---|:---:|---|---|---|
| **FR-1** | **🚨 CRITICAL** | **Native Companion App Out-of-Band Step-Up Approval Protocol** | High-value ($T_2$) voice transactions currently require 4-digit voice PINs (vulnerable to acoustic overhearing) or skill aborts. | Provide an official Alexa Skill / Bedrock Agent primitive that dispatches an interactive push card to the user's Alexa smartphone app with cryptographic parameter binding (e.g., WebAuthn biometric assertion or signed hash confirmation), pausing agent execution until the companion token returns. |
| **FR-2** | **⚠️ IMPORTANT** | **First-Class Support for MCP Tool Semantic Annotations (`readOnly`, `destructive`, `idempotent`) in Bedrock Converse API** | Bedrock `toolConfig` treats all tools identically; the runtime cannot distinguish read-only queries from irreversible financial transfers. | Allow tool definitions in Bedrock Converse API to include MCP-aligned annotations (`destructive: true`, `idempotent: true`, `riskTier: "T2"`). This enables the LLM runtime to automatically require confirmation before proposing destructive calls. |
| **FR-3** | **⚠️ IMPORTANT** | **Enforced Voice-First Spoken Summary Budget Guidelines ($\le 300$ characters)** | LLMs frequently return verbose, paragraph-length responses after tool calls that sound unnatural and tedious when read aloud by Alexa. | Introduce a token/character budget constraint in Converse API tool-use responses specifically designated for speech synthesis (e.g., maximum 300 characters of natural spoken summary alongside rich JSON data). |
| **FR-4** | **💡 NICE-TO-HAVE** | **Automatic Cross-Region Inference Profile Resolution in `@aws-sdk/client-bedrock-runtime`** | Newer flagship models (e.g. Claude 3.5 Sonnet v2) require cross-region inference profile IDs (`us.anthropic.claude-3-5-sonnet-20241022-v2:0`) instead of direct model IDs, causing confusing 400 errors for developers. | Have the AWS Bedrock SDK or runtime automatically resolve a base model ID to the nearest accessible cross-region inference profile if direct regional invocation is deprecated. |

---

## 8. Developer Friction Log (10% Bonus Documentation)

| # | Task | Steps Taken | Expected Result | Actual Result | Severity | Workaround Applied | Suggestion for AWS / MCP Teams |
|---|---|---|---|---|---|---|---|
| **FL-1** | Streamable HTTP Session Token Passing | Tried passing grant session token via standard MCP tool parameters. | Agent should pass token to identify caller. | Agent hallucinated or stripped session tokens; tool params cannot be trusted for identity. | **High** | Extracted caller identity strictly from HTTP `Authorization: Bearer <token>` header, ignoring tool arguments. | Formalize HTTP authorization header handling in MCP Streamable HTTP specification. |
| **FL-2** | Cross-Platform Parameter Hash Mismatch | Evaluated JSON hashes of tool arguments between client and gateway. | `JSON.stringify(args)` should produce identical hashes. | Key order divergence (e.g. `{a:1, b:2}` vs `{b:2, a:1}`) caused approval verification to fail. | **Critical** | Enforced RFC 8785 Canonical JSON serialization with lexicographical key sorting. | Provide an official canonical hashing utility inside the core MCP SDK. |
| **FL-3** | Bedrock Model Deprecation & Regional Routing | Tested Bedrock Converse API against older tutorial model IDs (`anthropic.claude-3-haiku-20240307-v1:0`) and Claude 3.5 Sonnet. | Bedrock should execute tool calling inference directly. | Legacy models returned deprecation/sunset errors, and Sonnet v2 failed without cross-region inference profile IDs (`us.anthropic...`). | **Medium** | Migrated default model to Amazon's flagship `amazon.nova-pro-v1:0` with support for cross-region inference profiles and built a model lifecycle audit script (`npm run check:bedrock-models`). | Provide automatic cross-region inference profile resolution in `@aws-sdk/client-bedrock-runtime`. |
| **FL-4** | Non-Integer Currency Floating Point Drift | Calculated split-booking prices in floating-point dollars. | 0.1 + 0.2 equals 0.3. | 0.30000000000000004 breached strict spend cap checks. | **High** | Mandated integer minor currency units (`cents`, integer minor units) across all types and APIs. | Include monetary calculation guidelines in agent developer documentation. |
| **FL-5** | Ambiguous Network Timeouts During Booking | Injected 10-second network drop on train booking request. | Gateway should know if booking succeeded or failed. | Blind retry created a duplicate booking on mock provider. | **High** | Implemented active provider reconciliation: query provider truth by idempotency key prior to retry. | Add active reconciliation pattern guidance to distributed agent tool architectures. |

---

## 9. Official Devpost Form Fields & Ready-to-Paste Data

*(Copy-paste directly into the Devpost submission portal)*

- **Project Title:** Warrant — A Trust Gateway for Voice Agents
- **Tagline (1 sentence):** Enforcing cryptographic approvals, spend caps, automatic saga rollback, and offline Ed25519 receipts for autonomous voice agents on Amazon Alexa+ and AWS Bedrock over MCP.
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
  > *Warrant and all packages in this repository (`@warrant/gateway`, `@warrant/siege`, `@warrant/alexa-client`) were created from scratch during the Amazon Developer Hackathon period (Oct 16 – Oct 23, 2026).*
  > *In full transparency and adherence to open-source integrity, the architectural concept of economic agent bounding draws inspiration from the author's previous open-source research on EVM-level passkey mandates (`AgentTrust` on Monad, MIT License). That project operated on smart contracts and blockchain testnets. For this hackathon, Warrant was conceptualized, architected, and built entirely anew in TypeScript for the Model Context Protocol (MCP 2025-11-25 Streamable HTTP), Amazon Bedrock Converse API, and Amazon Alexa+ ecosystem with new primitives (Saga Orchestration, Active Timeout Reconciliation, Detached Ed25519 Signed Receipts, and the Grace-Hold Undo Window).*
- **Collaborator Instructions:**
  The repository is public at `https://github.com/gnshx/Amazon-Developer-Hackathon`, allowing evaluators direct access without requiring GitHub organization invites. If the repository is ever switched to private, the five official hackathon evaluators will be invited: `alexa-dev-1`, `alexa-dev-2`, `amazon-eval-1`, `amazon-eval-2`, `amazon-dev-judge`.

---

## 10. Post-Hackathon Roadmap (Future Work)

*The following features represent unbuilt future architecture planned for Warrant's open-source evolution beyond the hackathon:*

1. **Attenuated Capability Tokens (Macaroons / Biscuits):** Enable agents to delegate sub-tasks to child agents with cryptographic attenuation: authority can only shrink, never grow, preventing privilege escalation across multi-agent swarms.
2. **Public Transparency Logs:** Anchor Merkle tree roots to an open, append-only transparency log (RFC 6962 / Sigstore) to enable third-party verification across independent brands without trusting any central server.
3. **Biometric Hardware-Bound Passkeys:** Move phone approval signing into the device's secure hardware (WebAuthn / Passkeys), making approval keys completely unexportable even under operating system compromise.
4. **Policy as Code with AWS Cedar / OPA:** Declarative, formally verifiable policy definitions that support shadow-mode evaluation against historical audit logs before activating new household rules.
5. **Caregiver & Enterprise Multi-Party Approvals:** Configurable dual-authorization workflows for senior care, parental controls, and corporate purchasing thresholds.
