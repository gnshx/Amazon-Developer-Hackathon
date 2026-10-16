# Agent Operating Handbook: Warrant Trust Gateway

This document governs all AI agents (Antigravity, Claude Code, Codex, and subagents) operating in this repository.

---

## 1. Quick Context Pointers

Read these foundational documents before undertaking architectural changes:
- [PLAN.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/PLAN.md): Master hackathon roadmap, timeline gates, workstreams, and cut order.
- [task_plan.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/task_plan.md): Current working phase, active checklist, and decision log.
- [docs/PRD.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/PRD.md): Product requirements, user personas, and acceptance criteria.
- [docs/HLD.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/HLD.md): System architecture, components, relational schema, and security threat model.
- [docs/TEST_PLAN.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/docs/TEST_PLAN.md): Safety invariants ($I_1 - I_8$), attack scenario catalog ($S_1 - S_8$), and scorecard specs.
- [findings.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/findings.md): Research notes, protocol versions, and environment constraints.
- [progress.md](file:///home/gojo/Desktop/Amazon-Developer-Hackathon/progress.md): Session history, invariant verification state, and gate status.

---

## 2. Core Architectural Invariants

Every agent must preserve these 8 invariants ($I_1 - I_8$). Any code change that compromises an invariant is an automatic rejection:

1. **$I_1$ (No Duplicate External Effect):** No state-changing external provider effect occurs more than once for the same `(grant_id, tool_name, idempotency_key)`.
2. **$I_2$ (Absolute Spend Cap):** Total confirmed expenditure under any grant never exceeds `grant.spend_cap_minor`, regardless of agent instructions or concurrency.
3. **$I_3$ (Cryptographic Approval Binding):** No $T_2$ action ever executes without a valid approval token bound to $\text{SHA-256}(\text{RFC8785Canonical}(\text{args}))$.
4. **$I_4$ (Clean Residue / Saga Rollback):** After a multi-step plan fails mid-execution, all downstream provider state returns to its baseline initial state, unless explicitly reported as `COMPENSATION_FAILED`.
5. **$I_5$ (Structural Output Containment):** No third-party response text or downstream provider payload can elevate privileges, alter active grants, or bypass approvals.
6. **$I_6$ (Temporal Authorization Boundary):** Expired or revoked grants authorize zero actions ($T_0, T_1, T_2$), returning deterministic authorization errors.
7. **$I_7$ (Cryptographic Audit Continuity):** Every action state transition generates an audit record; the SHA-256 event chain verifies successfully from genesis.
8. **$I_8$ (Reconciliation over Blind Retries):** Ambiguous network outcomes (e.g. HTTP timeouts) are actively reconciled against the provider's external truth and never blindly retried.

---

## 3. Positive Engineering Conventions

- **Integer Minor Currency Units:** Represent all monetary values (spend caps, prices, balances) as non-negative integers in minor units (e.g. cents/pence: \$150.00 is `15000`). Floating-point arithmetic for financial calculations is strictly forbidden.
- **Identity from Bearer Token:** Derive identity and authorization strictly from the session token in the HTTP `Authorization: Bearer <token>` header. Never trust tool arguments for user identity or grant IDs.
- **Canonical Serialization (RFC 8785):** Always sort keys lexicographically and normalize whitespace before computing hashes for approval tokens or audit events.
- **Out-of-Band Admin Channel:** Grants and approvals are managed through the internal Admin REST API. Never expose grant creation, budget increases, or approval decision tools to the MCP agent surface.
- **Voice-First Summaries:** Ensure every tool result returns a `spoken_summary` string that is natural, concise, and $\le 300$ characters, alongside structured JSON data.
- **SQLite WAL Mode with Repository Abstraction:** Use SQLite in WAL mode with a decoupled repository interface to enable drop-in PostgreSQL swaps.
- **Pure Deterministic Policy:** Implement policy evaluation as a pure function: $(\text{grant}, \text{action}, \text{spend}) \to \text{decision} + \text{reason}$.

---

## 4. Standard Operational Commands

Run these commands from the workspace root (`/home/gojo/Desktop/Amazon-Developer-Hackathon`):

```bash
# Install dependencies across all workspace packages
npm install

# Build all packages (Gateway, Siege, Client)
npm run build

# Run fast unit and property tests (<5s)
npm run test

# Run adversarial siege test harness (executes 8 attack scenarios)
npm run test:siege

# Verify cryptographic audit chain integrity
npm run audit:verify

# Start the entire stack locally (Gateway, Mock Providers, Alexa Client)
npm run dev
```

---

## 5. Loop Engineer Specifications (/goal Contracts)

When autonomous coding loops (such as `/goal`, Antigravity loop agents, or Claude Code) are launched, use the following standardized 5-part contracts:

### 5.1 Gateway Core Loop Contract
```markdown
**Objective:** Implement the Warrant Gateway MCP server with Streamable HTTP transport, SQLite repository, pure policy engine, RFC 8785 hasher, idempotency store, and SHA-256 chained audit trail.
**Read first:** docs/HLD.md, docs/PRD.md, PLAN.md, findings.md
**Constraints:** Conforms to MCP 2025-11-25 Streamable HTTP; all currency in integer minor units; out-of-band admin API separate from MCP; zero floating-point math; do not delete or weaken existing tests.
**Validate:** `npm --workspace=packages/warrant-gateway test` after each change
**Document:** Write concise, targeted documentation for all changes — create new .md files or update existing docs as needed.
**Checkpoints:** work in checkpoints and log progress briefly in progress.md
**Stop when:** Full gateway test suite passes with 100% green on policy, hashing, idempotency, and audit verification, OR when further changes require human architectural decisions.
```

### 5.2 Mock Providers & Saga Orchestration Loop Contract
```markdown
**Objective:** Implement the mock Hotel, Train, and Restaurant providers with control endpoints for fault injection, the compensating Saga Orchestrator, and active timeout reconciler.
**Read first:** docs/HLD.md, docs/TEST_PLAN.md, packages/warrant-gateway/src/
**Constraints:** Mock providers must maintain independent external booking state verifiable via GET /bookings; rollback must execute compensations in reverse order; timeouts must trigger active reconciliation, never blind retries; do not weaken tests.
**Validate:** `npm test -- saga.test.ts reconciler.test.ts` after each change
**Document:** Write concise, targeted documentation for all changes — create new .md files or update existing docs as needed.
**Checkpoints:** work in checkpoints and log progress briefly in progress.md
**Stop when:** Scenarios S2 (Mid-Plan Rollback) and S8 (Timeout Reconciliation) pass with external mock verification, OR when further changes require human product input.
```

### 5.3 Simulated Alexa+ Client & Bedrock Agent Loop Contract
```markdown
**Objective:** Implement the simulated Alexa+ Next.js 14 client with dark-mode voice assistant UI, phone approval portal, real-time MCP tool trace inspector, and Amazon Bedrock Converse API agent loop with offline stub fallback.
**Read first:** docs/PRD.md, docs/HLD.md, packages/alexa-client/
**Constraints:** Premium aesthetics (dark mode, glassmorphism, responsive mobile + desktop); phone approval view must show exact canonical parameters and hash; Bedrock agent must support offline deterministic fallback when AWS credentials are absent.
**Validate:** `npm --workspace=packages/alexa-client run build && npm --workspace=packages/alexa-client test` after each change
**Document:** Write concise, targeted documentation for all changes — create new .md files or update existing docs as needed.
**Checkpoints:** work in checkpoints and log progress briefly in progress.md
**Stop when:** Client UI runs, renders chat stream, live tool trace, and phone approval flow connected to gateway, OR when further changes require human UX review.
```

### 5.4 Warrant Siege Adversarial Harness Loop Contract
```markdown
**Objective:** Implement the standalone `warrant-siege` CLI test harness executing all 8 core attack scenarios (S1-S8) against the gateway over MCP Streamable HTTP and generating JSON and HTML scorecards.
**Read first:** docs/TEST_PLAN.md, docs/HLD.md, packages/warrant-siege/
**Constraints:** Siege talks to the gateway strictly over MCP and Admin HTTP; all 8 scenarios must execute deterministically; scorecard must verify invariants I1 through I8; do not delete or weaken test assertions.
**Validate:** `npm run test:siege` after each change
**Document:** Write concise, targeted documentation for all changes — create new .md files or update existing docs as needed.
**Checkpoints:** work in checkpoints and log progress briefly in progress.md
**Stop when:** All 8 adversarial scenarios (S1 to S8) pass with green badges and generate a complete scorecard.html, OR when further changes require human input.
```

---

## 6. Pre-Ship Verification Gates

Before presenting any phase as complete, every agent must verify:
1. `npm run test` executes with 0 failures and 0 warnings.
2. `npm run test:siege` reports `8 passed, 0 failed` on the invariant scorecard.
3. `npm run audit:verify` confirms the SHA-256 audit chain is continuous from genesis.
4. `task_plan.md` and `progress.md` are updated with the latest session results.
5. All newly created files include concise docstrings and unit test coverage.
