# Milestone 8 Verification

Verification date: 2026-09-29
Branch: `feat/m8-copilot-operations`
Baseline: `19395c9ff950ec667dabc658292814b3dadadd8c` (`v0.7.0-m7`)

## Scope implemented

- Request-scoped Copilot for the current STAFF assignee in ASSIGNED, IN_PROGRESS, WAITING_USER and RESOLVED, with exactly six fixed actions and no free prompt.
- Explicit human adoption of generated checklist drafts with expected-version, current-assignee, provenance, source-membership and duplicate validation. Human edit, waive and complete rules remain authoritative.
- Deterministic SLA monitoring every 30 seconds in production, a 200-row sweep bound, the frozen 20% remaining risk boundary, exact due-time behavior and deduplicated current-assignee/active-manager notifications.
- Asynchronous factual resolution summaries bound to the effective resolution cycle. Generation failure is non-blocking, retry is explicit and reopen cancels the old cycle.
- Owner-only, one-time immutable 1–5 service feedback after CLOSED.

The reported live Copilot contract failure was reproduced, preserved and fixed inside M8. M9 evaluation analytics and M10 release/deployment work were not started.

## Files/modules changed

- `apps/api/src/ai`: provider boundary, native structured-output handling, per-action schemas/prompts, Copilot and summary orchestration, and worker processing.
- `apps/api/src/requests`: request queries/controller/state-machine integration, transition rules and deterministic SLA monitor.
- `apps/web/src/components` and `apps/web/src/app/globals.css`: Copilot, checklist adoption, SLA, summary/feedback states and responsive presentation.
- `packages/contracts/src/workflow.ts`: closed M8 transport contracts.
- API/unit/integration tests, Playwright M8 coverage, live evaluation scripts, offline/runtime/security verifiers and sanitized evidence.
- Root scripts and README documentation for the M8 gates.

## Database changes

No M8 migration was required. The six existing migrations already contain the reserved persistence and uniqueness constraints. All six files have hashes identical to the M7 baseline, `db:validate` passes, `db:migrate` reports no pending migrations, and the clean disposable integration database applied all six migrations and accepted the seed twice.

## API changes

- Added endpoints to schedule/view fixed-action Copilot runs, retry the current failed resolution summary and submit feedback.
- Checklist adoption uses the existing versioned request mutation boundary.
- Controllers validate/delegate; state writes continue through `RequestStateMachineService`.
- Role, ownership/request scope and current-assignee predicates apply on reads and writes. Stale request versions, stale runs and stale assignments publish or mutate nothing.

## UI changes

- The assigned STAFF request view exposes the six Copilot actions, async states, evidence/warnings and explicit checklist adoption.
- Adoption now propagates its busy state to the request page, preventing a second versioned mutation before adoption finishes.
- Resolution summaries poll in the background without replacing the request with a loading screen.
- Request detail exposes deterministic SLA state, clearly labels AI output, and shows the closed-request feedback form only to the owner.
- Live browser coverage checks 360, 768 and 1440 pixel viewports for overflow and page errors.

## AI changes

### Previous blocker

Live Ollama Copilot strict output validation failed with `AI_INVALID_OUTPUT`, which blocked the real M8 browser gate.

### Root cause

The original live Copilot failure is retained in `docs/verification/evidence/M8_COPILOT_LIVE_FAILURE.json`. Run `3c0d73b4-f90c-45d1-ad62-ba0b6440a554` returned HTTP 200 but `done_reason=length`; 4,403 raw bytes were syntactically incomplete after a 7,189-character context and 1,295-character generic all-actions schema at the 1,200-token cap. It is classified as `TRUNCATED_GENERATION`, not an authorization, retrieval-reference or business-state failure.

The M8 browser run later exposed a separate summary-length boundary. The retained `M8_SUMMARY_LIVE_FAILURE.json` records run `34a856d0-4ecd-46df-bd3b-5a3272d1f5ba`: both attempts were truncated because the internal schema allowed up to 50 timeline items for 26 eligible events.

### Remediation

The remediation replaces the generic union with a small strict schema for the requested action, passes that schema through Ollama `/api/chat` `format`, and uses `stream=false` and `think=false`. The parser performs only syntactic BOM/single-outer-fence cleanup. It never normalizes semantic content, accepts unknown fields or fabricates IDs. A run has at most two attempts; the only possible retry receives the actual action schema, safe validation category, transient invalid output and exact allowed IDs. `done_reason=length` is a retryable truncation classification. Context remains bounded to 24,000 characters, output to 32 KiB/1,200 tokens, and tools to at most three read-only calls.

The public summary response contract was preserved; the internal `resolution-summary.m8.v3` schema now requests 1–8 unique key events, an executive summary no longer than 800 characters and event summaries no longer than 240 characters. Exact root cause, resolution, verification and backend-computed resolution seconds are copied from human facts rather than invented by the model.

### Final live result

The final Copilot prompt/schema is `copilot.m8.v2`. The live seven-case development evaluation succeeded 7/7, all seven on the first attempt, with 7/7 schema-valid and 7/7 reference-valid outputs, zero repairs, p50 2,854 ms and p95 17,869 ms. Cases cover factual summary, procedure retrieval, SLA next step, missing evidence, Vietnamese without accents, prompt/tool-output injection and current approved state overriding an older recommendation. The final live summary passed on its first attempt in 14,672 ms with three chronological, schema/reference-valid timeline items. The complete real-Ollama M8 browser lifecycle passed.

Provider/model: Ollama on the Windows host using `qwen3:4b-instruct-2507-q4_K_M`; retrieval uses the configured `bge-m3:latest` embedding model. Request/tool content is explicitly untrusted, and current human-approved category, priority and status override older AI suggestions.

## Security considerations

- The Copilot DTO is a closed six-action enum; there is no arbitrary prompt, URL, tool, shell or SQL surface.
- AI cannot approve, assign, reprioritize, change status, close, delete, change roles or automatically adopt/complete a checklist.
- Model output is untrusted and schema-validated, and every returned source, event and similar-case ID must belong to the authorized run snapshot.
- Current-assignee/owner/backend scope predicates and optimistic versions prevent stale or IDOR writes; integration tests include authorization negatives.
- The injection live case passed without escaping the allowlisted contract.
- `verify:security:m8` scanned 512 files, found no real-secret finding, confirmed all six migration hashes and passed the no-shell/unsafe-SQL, closed DTO, membership, assignee and prompt-boundary invariants. Reviewed database strings are local demo/test placeholders only.

## Tests executed

| Command | Result |
|---|---|
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS: config 6, API 39, web 1 |
| `npm run build` | PASS: API and Next.js production builds |
| `npm run db:validate` | PASS |
| `npm run db:migrate` | PASS: six migrations, none pending |
| `npm run demo:seed` (twice) | PASS both times |
| `npm run test:integration:m8` | PASS: clean six-migration database, seed twice, one full M8 scenario in 2,495 ms |
| `npm run test:integration` | PASS: 32/32 M2–M8 integration tests in 320,189 ms |
| `npm run eval:copilot:m8` | PASS: 7/7 live cases, 7 first-attempt valid, 0 repairs, p50 2,854 ms, p95 17,869 ms |
| `npm run eval:summary:m8` | PASS: first-attempt, schema/reference/chronology valid, 14,672 ms |
| `npm run verify:runtime:m8` | PASS: controlled LLM and embedding outages |
| `npm run verify:security:m8` | PASS: 512 files and six frozen migrations checked |
| `npm run test:e2e:m3` | PASS: 2/2 |
| `M4_E2E_MODE=offline npm run test:e2e:m4` | PASS: 1/1 |
| `M4_E2E_MODE=online npm run test:e2e:m4` | PASS: 2/2, including offline-request recovery |
| `npm run test:e2e:m5` | PASS: 1/1 |
| `npm run test:e2e:m6` | PASS: 1/1 |
| `npm run test:e2e:m7` | PASS: 1/1 |
| `npm run test:e2e:m8` | PASS: 1/1 complete live lifecycle in about 1.1 minutes |
| `M6_RUNTIME_TARGET=native M6_RUNTIME_MODE=online npm run verify:runtime:m6` | PASS: native real analysis/recommendation/sources/RBAC |
| `docker compose config --quiet` | PASS |
| `docker compose up -d --build` and health checks | PASS: postgres, API and web healthy; API/web HTTP 200 |
| `npm ls --depth=0` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS: zero vulnerabilities |
| `git diff --check` | PASS |
| `git diff --exit-code -- apps/api/prisma/migrations` | PASS |

The full integration harness was corrected to drain its bounded FIFO queue until the M8 run under test becomes terminal. The earlier failure processed a queued M6/M7 job left by the same regression process; it was test-lifecycle coupling, not a product contract failure. The final 32-test run was uninterrupted.

## Manual verification

- Confirmed the user feedback describes frozen M8 behavior and does not expand product scope.
- Reproduced and preserved both live-model failures before changing the contract.
- Exercised the real host Ollama language and embedding models through native and Docker-backed flows.
- Completed the browser lifecycle from Copilot generation and human checklist adoption through SLA, resolution summary, closure and feedback.
- With an unreachable language-model endpoint, liveness/core readiness and the manual workflow remained usable; Copilot and summary failed truthfully with `AI_PROVIDER_UNAVAILABLE`, SLA stayed deterministic/deduplicated and resolution remained RESOLVED.
- With an unreachable embedding endpoint, Copilot retrieval failed closed with `EMBEDDING_UNAVAILABLE` while readiness, manual status and SLA behavior remained intact.
- Verified the final Docker stack reports postgres, API and web healthy.

Sanitized evidence:

- `docs/verification/evidence/M8_COPILOT_LIVE_FAILURE.json`
- `docs/verification/evidence/M8_COPILOT_EVAL.json`
- `docs/verification/evidence/M8_SUMMARY_LIVE_FAILURE.json`
- `docs/verification/evidence/M8_SUMMARY_EVAL.json`
- `docs/verification/evidence/M8_RUNTIME_OFFLINE.json`
- `docs/verification/evidence/M8_SECURITY_SCAN.json`

No raw private prompt, source excerpt, credential, hidden reasoning or model text is retained in this evidence.

## Known limitations

- The seven Copilot cases and one summary case are a synthetic development set, not a generalized accuracy or calibrated-quality claim.
- Schema/reference validity proves contract conformance and allowlisted membership, not complete semantic entailment of every generated sentence.
- The V1 SLA scheduler is process-local. Database uniqueness deduplicates recipient/instance/level notifications, but this is not a distributed exactly-once scheduler.
- The local 4B model can still require the single bounded repair on unseen inputs; failures remain explicit and do not mutate business state.

## Deferred items

- M9 expanded datasets, evaluation analytics, dashboards and generalized quality reporting.
- M10 release, deployment and competition hardening.

## Release blockers

None for the M8 gate.

No commit, push or tag was created. The working tree and retained failed-iteration evidence were preserved.

## Gate

PASS — M8 complete.
