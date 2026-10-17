# Warrant: Alexa+ readiness tasks

For the coding agent. Do the tasks one at a time, in order. Stop after each one and report.

## Ground rules

- Feature freeze applies to the core path. Do not change the approval, saga, idempotency or audit logic except where a task says so.
- Never add an environment variable, flag or option that turns off a protection.
- After every task run: `npm run test`, `npm run test:siege`, `npm run test:mutation`, then a fresh clone from the GitHub URL. All must pass. Commit each task separately.
- Documentation may only claim what a test or a measured number proves. If something is not built, say so.
- Fictional provider names only. No real brands.
- Where a number appears in docs (scenario count, test count, latency), update every file that mentions it: `grep` for the old number before finishing.

Sources to follow: the Alexa+ MCP quickstart (requirements and authentication checklist) and the MCP 2025-11-25 specification (transports, tools, elicitation).

---

## T1. Fix documentation and CI honesty (no code changes to the gateway)

Status: COMPLETED (Commit 6514804)

Do:
1. Rewrite the judging section of `JUDGES.md` to use the four official criteria: Tech Implementation, Design, Potential Impact, Quality of the Idea. Remove the invented 25/25/25/25 rubric. Map existing evidence to each criterion.
2. Replace "64 checks" everywhere with one sentence listing separate counts (unit tests, attack scenarios, mutations, skill checks).
3. Move the siege workflow to `.github/workflows/warrant-siege.yml`. Add a `workflow_call` trigger and a normal `push` trigger.
4. State in the README and JUDGES.md whether `test:skill` runs against the offline stub or a live model. Run it live if credentials exist, otherwise label it "stub".
5. In the client, label the scorecard view "Last run" with a timestamp, or "Sample" if it is static. Confirm "Save Limits" calls the real admin API; if it does not, fix it or label it as a mockup.

Acceptance:
- JUDGES.md contains the four official criteria and no invented percentages.
- The GitHub Actions tab shows one green run of the siege workflow.
- `grep -rn "64 checks"` returns nothing.
- Saving limits in the UI changes the grant returned by the admin API (add a test), or the screen is labelled as a mockup.

---

## T2. Alexa+ authentication behaviour (P1)

Status: COMPLETED

Do:
1. Unauthenticated requests to the MCP endpoint return `401`. Per the Alexa+ checklist, do not rely on a `WWW-Authenticate` header.
2. Serve a Protected Resource Metadata document at the well-known path from RFC 9728, with `resource` set to the server's canonical URI, `authorization_servers`, and `scopes_supported`.
3. Accept the bearer token only in the `Authorization` header. Reject tokens in the query string.
4. Add a small demo authorization server for local and demo use: OAuth 2.1 authorization code flow with PKCE (S256 required), requiring the `resource` parameter on both the authorization and token requests. Serve its metadata at `/.well-known/oauth-authorization-server` with `code_challenge_methods_supported` including `S256`.
5. Label the demo authorization server clearly in code and README as demo-only. Do not claim Alexa+ certification.

Acceptance (all as automated tests):
- No token gives `401`; a valid token works.
- PRM JSON has `resource`, `authorization_servers`, `scopes_supported`.
- Authorization request without PKCE S256 is rejected; without `resource` is rejected; token request without `code_verifier` or `resource` is rejected.
- A token in the query string is rejected.

---

## T3. Bind grants to the user, not the MCP session (P1)

Status: COMPLETED

Why: Alexa+ sessions are based on the customer's conversation history, not an explicit session identifier.

Do:
1. Key grants, plans, approvals and budgets on the authenticated subject from the token.
2. Tool calls must work with no `Mcp-Session-Id`, and with a new session for the same user.
3. Add scenario S11, cross-user isolation: user B cannot read, approve, execute or cancel user A's plan, and cannot spend user A's budget.

Acceptance:
- Two sessions for the same user share one budget; the second session sees spend from the first.
- S11 passes in the siege and fails (red) when the subject check is removed in a mutation test. Add this as a third mutation.
- Scenario count is updated to 11 in every doc and in the scorecard rows.

---

## T4. Latency and protocol contract tests (P1)

Alexa+ requires round trips under 500 ms.

Do:
1. Make sure `execute_plan` returns promptly with a held or pending status when the undo window is active. It must not block for the whole hold. The final result comes from `get_plan_status`.
2. Add a contract test that measures 50 sequential calls each for a search tool, `propose_plan` and `execute_plan`, and records p50 and p95.
3. Add tests: bad `Origin` header returns `403`; unsupported or missing `MCP-Protocol-Version` is handled as the spec says; `initialize` negotiates 2025-11-25.
4. Print measured numbers into a generated file. Quote only those numbers in the docs, with the machine described.

Acceptance:
- p95 under 500 ms for all three call types in the test, and the test fails above that.
- `execute_plan` returns in under 500 ms even with an 8-second undo window.
- Origin and version tests pass.

---

## T5. Tool metadata (P1)

Do:
1. Set a `title` and annotations on every tool: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`.
   - Search tools: read-only.
   - `propose_plan`: read-only (nothing executes).
   - `execute_plan` and `request_cancellation`: destructive, idempotent (they take an idempotency key).
   - `get_plan_status`: read-only.
2. Check tool names against the naming guidance in the 2025-11-25 spec.
3. Keep each tool's `spoken_summary` at or under 300 characters (add a test).

Acceptance:
- `tools/list` output includes the annotations above (snapshot test).
- A test fails if any result's `spoken_summary` exceeds 300 characters.

---

## T6. Alexa+ checklist table in the README (P1, after T2 to T5)

Do: add a table with one row per item in the Alexa+ MCP requirements and authentication checklist. Each row shows Done, Partly, or Not done, with the test name or file as evidence. Include the items Alexa+ says are unsupported (DCR, CIMD, OIDC, step-up authorization, `WWW-Authenticate` on 401) and say Warrant does not need them.

Acceptance: every "Done" row names a passing test or a measured number. No row is ticked without evidence.

---

## Optional tasks (choose at most one, only after T1 to T6 are green)

### T7. Naive vs Warrant before and after
- Add `examples/naive-server`: an intentionally unprotected booking server over the same mock providers, bound to localhost only, labelled insecure.
- Let the siege run against any URL (`--target`) and select scenarios (`--only S1,S2,S3,S4,S5,S6,S7,S8`).
- Generate a side-by-side scorecard: naive server (expected failures) vs Warrant (all pass).
- Acceptance: the naive run fails the scenarios it should, the Warrant run passes, and the README explains the naive server is for demonstration only.

### T8. Spec-native out-of-band approval
- If the client declares URL-mode elicitation in `initialize`, send a URL elicitation pointing to the approval page. Otherwise keep the current behaviour exactly.
- Acceptance: a capability negotiation test, a fallback test showing unchanged behaviour, and no change to the approval hash logic. The Alexa+ docs mention elicitation but not URL mode, so never make this path required.

### T9. Public demo instance
- Only if the admin API can be made safe: the public instance must not expose unauthenticated approval or grant endpoints. Use per-visitor demo sessions or protect admin routes.
- Acceptance: HTTPS, `401` without a token, a health check, rate limiting, no secrets in the repo, and the MCP Inspector connects. If it cannot be made safe, use a tunnel only while recording and judging.

---

## Definition of done for the whole list

- All tasks above (T1 to T6) merged with tests.
- Scenario, test and latency numbers consistent in README, JUDGES.md, SUBMISSION.md and the scorecard.
- Fresh clone from GitHub passes the documented commands.
- Nothing in the docs claims an integration, certification or measurement that has not been done.
