# Task Plan: Warrant Implementation & Hackathon Execution

## Goal
Build and deliver Warrant (a provably safe trust gateway for voice agents over MCP Streamable HTTP, with saga rollback, cryptographic approval binding, and adversarial siege test harness) for the Amazon Developer Hackathon (Alexa+ Track) by 23 October 2026.

## Current Phase
Phase 1: Project Scaffolding, Governance & Planning Architecture

## Phases

### Phase 1: Project Scaffolding, Governance & Planning Architecture
- [x] Document and structure PRD, HLD, and Test Plan in `docs/`
- [x] Establish working memory files (`task_plan.md`, `findings.md`, `progress.md`)
- [ ] Author master execution roadmap (`PLAN.md`)
- [ ] Author authoritative agent handbook and loop engineering contracts (`AGENTS.md`)
- [ ] Initialize monorepo workspace configuration (`package.json`, TypeScript, shared configs)
- **Status:** in_progress

### Phase 2: Gateway Core & MCP Transport (Workstream A)
- [x] Implement MCP Streamable HTTP transport conforming to protocol version 2025-11-25
- [x] Implement SQLite repository layer (WAL mode, transactions, clean interface for Postgres swap)
- [x] Build pure deterministic Policy Engine (T0-T3 tiers, spend caps in minor units, scopes, expiry)
- [x] Implement RFC 8785 canonical JSON serializer and SHA-256 parameter hasher
- [x] Build Out-of-Band Admin Channel & Approval Token Issuer
- [x] Implement Multi-layer Idempotency registry
- [x] Build Tamper-Evident SHA-256 chained audit logger with `/audit/verify`
- **Status:** complete

### Phase 3: Mock Providers & Saga Orchestrator (Workstream B)
- [x] Implement Mock Hotel, Train, and Restaurant providers with control endpoints for fault injection
- [x] Build Saga Orchestrator with reverse compensation execution
- [x] Implement Active Reconciliation for ambiguous network outcomes (timeouts)
- [x] Verify Gate 1 & Gate 2 milestones (Scenarios S2 and S8 passing)
- **Status:** complete

### Phase 4: Simulated Alexa+ Client & Bedrock Agent Loop (Workstream C)
- [ ] Build Next.js 14 client application with premium voice assistant aesthetics
- [ ] Implement phone approval view (out-of-band channel)
- [ ] Implement real-time MCP tool call inspection stream
- [ ] Implement visual cryptographic audit timeline
- [ ] Implement Bedrock Agent loop using AWS Bedrock Converse API with fallback stub
- [ ] Verify Gate 3 milestone (live voice/chat trip planning flow)
- **Status:** pending

### Phase 5: Adversarial Harness `warrant-siege` & Scorecard (Workstream D)
- [ ] Implement declarative YAML scenario loader and execution runner
- [ ] Implement 8 core adversarial attack scenarios (S1 through S8)
- [ ] Implement automated JSON & interactive HTML scorecard generator
- [ ] Verify Gate 4 milestone (8/8 scenarios green)
- **Status:** pending

### Phase 6: Polish, Documentation, Fresh-Clone Test & Submission (Workstream E)
- [ ] Verify fresh clone to running demo in <10 minutes
- [ ] Finalize AWS Bedrock & MCP product feedback and friction logs
- [ ] Produce architecture diagrams and README
- [ ] Draft Devpost submission text and demo script (<3:00 min)
- **Status:** pending

## Key Questions
1. **Vertical selection:** Travel booking (hotel + train + dining) selected as the primary vertical because it naturally demonstrates high-value irreversible commitments, multi-step dependencies, and clear compensation semantics.
2. **Bedrock access:** AWS credentials will be supported via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`), with an offline deterministic agent simulator bundled for environments without active AWS credentials.
3. **Repository structure:** Monorepo with npm workspaces providing unified setup, with discrete packages (`packages/gateway`, `packages/siege`, `packages/alexa-client`) enabling separate open-source publishing.

## Decisions Made
| Decision | Rationale |
|---|---|
| RFC 8785 JSON Canonicalization | Prevents approval tampering through dictionary reordering or whitespace mutations |
| Out-of-band Admin API | Prevents agent or prompt injection from widening scopes or approving high-risk steps |
| Integer Minor Currency Units | Eliminates floating point rounding errors in financial transactions |
| SQLite WAL + Repository Interface | Zero-dependency rapid local development with seamless PostgreSQL compatibility |
| Streamable HTTP MCP Transport | Conforms to modern MCP standard (2025-11-25) suitable for low-latency voice gateways |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Sandbox not available with IDE command terminal | 1 | Enabled `BypassSandbox: true` for local terminal operations |

## Notes
- Update phase status as work progresses: `pending` → `in_progress` → `complete`.
- Re-read this plan before major architectural decisions.
- Maintain strict invariant enforcement ($I_1 - I_8$) across all components.
