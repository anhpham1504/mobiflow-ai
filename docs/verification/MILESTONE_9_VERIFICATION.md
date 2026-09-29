# Milestone 9 Verification

Verification date: 2026-09-29
Branch: `feat/m9-evaluation-analytics`
M8 baseline: `9a9e506eb95393b53b3bf6f4eefac2e5eaee4fad` (`v0.8.0-m8`)

## Scope implemented

- Expanded the synthetic intake evaluation dataset from 50 to 100 specification-labeled cases, preserving the original M4 50-case prefix and adding taxonomy, Vietnamese/no-accent, ambiguity, missing-data, duplicate, injection and stale-history coverage.
- Added a repeatable `npm run ai:evaluate` live-Ollama runner with bounded existing provider behavior, per-case timing/attempts, safe failure classification, exact category/priority/team assertions, machine-readable history and a Markdown report.
- Added deterministic regression comparison for pass-to-fail, schema/reference regression, repair growth, new failure classification and severe latency growth. The recorded self-baseline verifies the comparison mechanism only; it is not longitudinal evidence.
- Added manager-only database-backed operational/SLA/AI analytics and sanitized evaluation history.
- Added a responsive, keyboard-usable manager quality dashboard with explicit provenance/limitations.
- Documented a 20-case counterbalanced manual-time benchmark protocol. No operator timing was fabricated or claimed.

## Files/modules changed

- `apps/api/src/analytics`: aggregate/query service, narrow controller and pure metric/regression helpers.
- `packages/contracts/src/analytics.ts`: strict response/evaluation schemas.
- `apps/web/src/app/manager/analytics` and `apps/web/src/components/analytics-dashboard.tsx`: manager dashboard.
- `datasets/ai-evaluation`: 100-case versioned dataset and semantics.
- `scripts/evaluation`: dataset preparation, live evaluation and baseline comparison.
- Unit/integration/E2E/security scripts, Docker packaging for sanitized evaluation snapshots, evidence and documentation.

## Database changes

No M9 migration. Existing `Request`, `SlaInstance`, `AiRun`, `AiRecommendation` and related indexes are sufficient. Migration count before/after is 6/6; historical migrations are byte-unchanged. Clean-database deploy and seed twice passed in the final integration run.

## API changes

`GET /api/v1/analytics?windowDays=1..365` returns bounded manager-only operational, SLA, AI-run and sanitized evaluation history data. USER/STAFF/unauthenticated access is denied. The response excludes request content, prompts, retrieval snapshots and generated payloads. Controllers validate/delegate; no model-execution endpoint was added.

## UI changes

`/manager/analytics` shows operational counts, SLA states, AI success/failure/repair/latency, safe failure and purpose breakdowns, recommendation workflow decisions and the latest live evaluation snapshot. Synthetic evaluation, stored operational telemetry and recommendation acceptance are not merged into an “accuracy” score. Loading, error and no-evaluation states are implemented; 360/768/1440 widths, focus and browser-console cleanliness passed.

## Evaluation architecture

Dataset labels never enter prompts. The runner checks actual Ollama health/model identity, uses the production analysis provider and existing two-attempt bound, retains failures in denominators, and stores no input text/raw prompt/raw model output in M9 result evidence. Classification/routing assertions are deterministic; no model judge is used. RAG reference metrics remain separately owned by M5 and Copilot reference metrics by M8; the intake run reports reference validity as not applicable rather than inventing a value.

Dataset version/hash: `requests.m9.v2` / `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`.

## Live model/provider

- Provider: Ollama `/api/chat`, structured output, `stream=false`, `think=false` through the existing adapter.
- LLM: `qwen3:4b-instruct-2507-q4_K_M`.
- Embedding regression model: `bge-m3:latest`.
- Prompt/schema: `request-analysis.v4` / `analysis.v1`.

## Metrics and methodology

100/100 cases reached a valid terminal result. Exact category+priority+deterministic-team agreement was 68/100 (68%). Schema validity was 100/100; first-attempt validity 99/100; repaired success 1/100; terminal failures 0/100; average attempts 1.01. Latency mean/p50/p95/max was 2,774.87/2,704/3,116/6,597 ms. These are synthetic development measurements, not generalized accuracy, calibrated confidence or production prevalence.

Recommendation accepted/modified/rejected counts are computed from reviewed database rows and labeled workflow metrics only. The manual-time benchmark protocol exists at `docs/evaluation/MANUAL_TIME_BENCHMARK.md`; operator timings were not performed, so no productivity claim is made.

## Security considerations

- Backend `@Roles('MANAGER')` and active-user reauthorization protect analytics.
- Query window is bounded to 1–365 days and row reads to finite limits.
- No arbitrary prompt/model execution, URL, shell, SQL or dynamic tool route was introduced.
- Closed six-action Copilot contract and source/event/case membership validation remain unchanged.
- Integration tests deny USER/STAFF access and prove no request text, prompt field, retrieval snapshot or result payload leaks.
- M9 security scan inspected 619 files, found no real secret pattern and confirmed all six migration hashes.

## Tests executed

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: config 6, API 43, web 1 |
| `npm run build` | PASS; API and 17-route Next.js build |
| `npm run db:validate` | PASS |
| `npm run db:migrate` | PASS; six migrations, none pending |
| `npm run demo:seed` twice | PASS both times |
| `npm run test:integration:m9` | PASS: clean six-migration DB, seed twice, authorization/privacy/history/bounds |
| `npm run test:integration` final rerun | PASS: 33/33 in 305,583 ms |
| `npm run test:e2e:m3` | PASS 2/2 |
| `M4_E2E_MODE=offline npm run test:e2e:m4` | PASS 1/1 after actually stopping Ollama |
| `M4_E2E_MODE=online npm run test:e2e:m4` | PASS 2/2 including recovery |
| `npm run test:e2e:m5` | PASS 1/1 |
| `npm run test:e2e:m6` | PASS 1/1 |
| `npm run test:e2e:m7` | PASS 1/1 |
| `npm run test:e2e:m8` | PASS 1/1 complete live lifecycle |
| `npm run test:e2e:m9` | PASS 1/1 |
| `npm run ai:evaluate` | PASS: real 100-case Ollama run; metrics above |
| `npm run eval:compare:m9 -- <run> <same-run>` | PASS mechanism verification, 100 cases, zero self-regressions |
| `npm run verify:runtime:m8` | PASS LLM and embedding outages |
| `npm run verify:security:m9` | PASS |
| `docker compose config --quiet` | PASS |
| `docker compose up -d --build` | PASS; postgres/API/web healthy; API/web HTTP 200 |
| `npm ls --depth=0` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS, zero vulnerabilities |
| `git diff --check` | PASS |
| `git diff --exit-code -- apps/api/prisma/migrations` | PASS |

Two failed verification attempts are retained honestly: the first M4-offline attempt ran while Ollama was online and therefore completed AI analysis; it passed after a real outage. An earlier full integration run failed on an overbroad test assertion matching safe `promptVersion`, and the next run hit a browser-forbidden ephemeral test port. The assertion was narrowed to the actual `prompt` field, test servers now use deterministic safe high ports, the targeted gates passed, and the final uninterrupted full integration rerun passed 33/33.

## Manual verification

- Confirmed the dashboard displays the exact live dataset/model snapshot in the production Docker stack.
- Confirmed no horizontal page overflow at 360, 768 or 1440 px and keyboard focus leaves the body.
- Confirmed Docker postgres/API/web health and API/web HTTP 200.
- Confirmed actual Ollama tags include the required LLM and embedding model.
- Stopped Ollama for the browser outage scenario, observed explicit safe failure, then restored it for online suites.

## Sanitized evidence paths

- `docs/evaluation/AI_EVALUATION_REPORT.md`
- `docs/evaluation/results/m9-2026-09-29T14-17-47-313Z.json`
- `docs/verification/evidence/M9_EVAL_RESULT.json`
- `docs/verification/evidence/M9_EVAL_REGRESSION.json`
- `docs/verification/evidence/M9_RUNTIME_OFFLINE.json`
- `docs/verification/evidence/M9_SECURITY_SCAN.json`

## Known limitations

- The 100 cases are synthetic development evidence with specification-authored labels, not independent adjudication or generalized accuracy.
- Exact-match disagreement does not establish that either every label or every model response is semantically correct; no model judge was used.
- Intake has no source references, so reference validity is explicitly not applicable; M5/M8 report their own membership metrics.
- The self-baseline regression artifact validates the comparison mechanism only. Future runs should choose a prior approved M9 result for longitudinal comparison.
- The manual-time protocol has not been performed by an operator; no time-saved claim is made.
- Evaluation snapshots are packaged read-only into the local API image at build time; running `ai:evaluate` requires an image rebuild before Docker displays the new snapshot.

## Deferred M10 work

Competition packaging, preflight/reset/warmup, final adversarial audit and broader UX polish remain M10. M10 was not started.

## Release blockers

None for the M9 implementation gate. The absent operator time study is clearly labeled and produces no unsupported claim; the canonical M9 gate requires a documented methodology, which is present.

## Gate

PASS
