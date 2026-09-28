# Milestone 4 Verification

Verified 2026-09-28 on Windows, against the explicit M4 execution request and frozen master-plan M4 gate. Starting working tree was clean at `6247b6ee9e068c7e139a846131d43f3d9f42bc9e` on `main`. Changes remain uncommitted; [source fingerprints](evidence/M4_SOURCE_SHA256.json) identify the implemented source rather than claiming the baseline commit contains M4. No M5 work was started.

## Scope implemented

- Real local Ollama provider behind an injectable provider boundary; bounded, non-streamed structured inference, abort, normalized errors and one retry at most.
- Automatic atomic request creation plus queued intake; explicit analyze/retry; durable lifecycle, post-start version binding, expiry recovery, cancellation and reauthorization before publication.
- Strict analysis schema, controlled taxonomy, immutable validated AiAnalysis, safe run metadata and SYSTEM state transitions. Actual category, priority, staff, assignment and SLA remain human-controlled.
- Role-projected APIs and minimal progress/failure/retry UI; missing information and uncalibrated confidence are visible to the appropriate role.
- Fixed 50-case synthetic evaluation, deterministic failure tests, actual PostgreSQL integration, native/Docker inference and browser verification.

The repository, schema, migrations, seed, auth/RBAC, state/SLA/audit/notification code, existing tests, all relevant specs and M1–M3 reports were inspected before implementation. The [implementation checklist](M4_IMPLEMENTATION_CHECKLIST.md) records the extracted scope. No dependency, framework upgrade or migration was needed.

## Architecture

Controllers validate/delegate through existing auth and workflow guards. `RequestStateMachineService` owns enqueue eligibility, request locking, reauthorization and all Request.status writes. `AnalysisWorker` claims persisted work, invokes `AiProvider` outside transactions, and returns the validated result to the state machine for atomic publication. `AnalysisQueryService` applies backend scope before projecting a response.

Creation and QUEUED AiRun insertion share a transaction. Claim locks the request and transitions NEW → AI_ANALYZING, increments the request version, and records that resulting version in AiRun.contextVersion. Inference holds no DB row lock. Publication locks/reloads and checks live initiating identity, ownership/role, active run, current version and deadline. Success writes AiAnalysis, run success, request pointer/status, SYSTEM audit and history together, then transitions to TRIAGED. It never copies proposed fields into approved Request fields.

Failure transitions the matching active request to NEW and records a controlled failed run. A message during inference makes output stale: the new message survives and cleanup uses the latest version. Cancel wins over a late result; replay is inert. One active run per request/purpose is enforced by the existing DB index and transaction. A local worker processes one generation at a time. A persisted deadline/lease permits expired queued/running jobs to be recovered after interruption. If both publication and failure persistence are unavailable, the lease remains for recovery; success is not reported.

Context contains the original title/description and up to 50 newest complete messages that fit, returned chronologically. It records message IDs and an explicit historyTruncated flag. Mandatory context overflow fails; JSON is never silently truncated. No prompt transcript, raw completion, provider reasoning trace or hidden chain-of-thought is stored or logged.

## Files/modules changed

- `apps/api/src/ai/`: provider contract, Ollama adapter, prompt v3, bounded execution, worker, query projection and controller.
- `apps/api/src/requests/request-state-machine.service.ts`: atomic scheduling/claim/publication/failure and missing-critical-information approval guard; `workflow.guard.ts`: five AI triggers/minute/actor, including automatic-intake creation.
- `packages/contracts/src/analysis.ts`, shared exports, typed environment configuration, `.env.example`, Compose and API wiring/OpenAPI.
- `apps/web/src/components/analysis-panel.tsx`, request detail/manual approval, scoped-cache clearing, error text and focused checkbox/analysis styles.
- Unit/config/health/real DB tests; M3 and M4 browser scenarios; `playwright.m4.config.mjs`; runtime/evaluation scripts and fixed dataset under `datasets/ai-evaluation/`.
- Root scripts, README, checklist, this report and sanitized evidence.

Direct M4 baseline fixes: unconfigured embedding remains NOT_CONFIGURED even when the Ollama server is offline; protected request/analysis content clears after access loss; approval exposes explicit missing-fact acknowledgment. M3 browser tests now wait for automatic intake and acknowledge missing facts, while preserving all original lifecycle/conflict assertions. The isolated M3 integration explicitly disables automatic intake to retain its AI-independent gate.

## Database changes

**No schema/migration changes.** Existing AiRun, AiAnalysis, request pointers, audit/history and constraints are used. Frozen specifications, original migrations, seed and package lock are unchanged. All three migrations and pgvector 0.8.6 were verified on a clean, dedicated `mobiflow_m2_test` DB; the integration command drops only that disposable database. The main demo DB/volume was not reset or erased. Browser/runtime tests leave synthetic requests as evidence. No embedding/vector columns or dimension guesses were added.

## API changes

| Endpoint under `/api/v1` | Contract |
|---|---|
| POST `/requests/:id/ai/analyze` | Owner USER or MANAGER, expectedVersion, eligible NEW; returns 202 job; matching active run is reused |
| POST `/requests/:id/ai/retry` | Same authority/version rules; explicit retry for failed intake in NEW |
| GET `/requests/:id/ai/explanation` | Owner progress/missing facts; currently authorized STAFF extracted facts; MANAGER validated advisory analysis |
| GET `/ai/runs/:id` | Owner/MANAGER scoped ANALYSIS job polling; STAFF denied |

OpenAPI 0.4.0 documents bodies, response schemas, authorization, 400/401/403/404/409/429 and asynchronous failure semantics. AI transport/timeout/schema failures are FAILED jobs rather than fabricated synchronous success. The existing approval endpoint returns 422 MISSING_ACKNOWLEDGMENT when a manager has not acknowledged missing critical location/time. Out-of-scope records remain 404; wrong role remains 403; stale mutations remain 409.

## UI changes

Owner/manager see bounded QUEUED/RUNNING progress, success, safe failure and explicit retry. Polling backs off from 2 to 5 seconds and stops after 330 seconds, offering manual reload. A 409 does not silently resubmit. Terminal events refresh the parent request, including completion before the first poll. Owner does not receive manager reasoning/model metadata; staff has no intake trigger or internal job panel. Manager sees proposed category/priority, extracted facts, missing facts and clearly uncalibrated confidence. React renders model text as text.

Manual draft/review remains authoritative. Missing-fact consent can be given at approval without bypassing the backend guard. Accessible checkbox labels, focus styles, status live region, Vietnamese AI timeline labels and 360/768/1440 layouts were verified. Navigation/access failures clear protected detail and AI data.

## AI changes

### Runtime, versions and configuration

| Item | Actual value |
|---|---|
| Provider | Ollama, host Windows service, API version 0.34.4 |
| Model | `qwen3:4b-instruct-2507-q4_K_M` |
| Installed digest | `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641` |
| Native / Docker origins | `http://localhost:11434` / `http://host.docker.internal:11434` |
| Embedding | `unconfigured`; NOT_CONFIGURED, no inference or dimension claimed |
| Prompt / schema | `request-analysis.v3` / `analysis.v1` |
| Default attempts / limits | 120,000 ms per attempt, 300,000 ms per run, maximum 2 attempts with 1-second retry backoff |
| Default generation | temperature 0, seed 42, num_predict 1200, num_ctx 16384, stream false, think false |
| Bounds | 24,000-character assembled context; 32 KiB structured content; 64 KiB chat envelope; 1 MiB tags response |
| Node / npm | 24.19.0 / 11.17.0 |
| Existing core libraries | Nest 12.1.0, Swagger 12.0.2, Next 16.3.6, React 19.3.0, TypeScript 6.0.3, Prisma 7.10.0, Zod 4.6.5, pg 8.23.0, Playwright 1.63.0 |
| Infrastructure | Docker Compose 5.3.1; `pgvector/pgvector:0.8.6-pg17`; services postgres/api/web |

No new dependency was installed. Native fetch and existing Zod suffice. [Complete installed dependency tree](evidence/M4_DEPENDENCIES.txt); Docker builds also ran the unchanged lock through npm ci. Adapter construction followed the official [Ollama chat API](https://docs.ollama.com/api/chat) and [structured-output documentation](https://docs.ollama.com/capabilities/structured-outputs), then was verified on the actual local runtime. No cloud API or model download was used.

New validated environment keys are AI_AUTO_ANALYZE (default true), AI_ATTEMPT_TIMEOUT_MS (100–120000), AI_RUN_TIMEOUT_MS (1000–300000), AI_TEMPERATURE (0–1), AI_MAX_OUTPUT_TOKENS (128–4096). Existing AI_PROVIDER must be ollama; base URL and exact model come from environment. Invalid startup values produce key-only diagnostics. Production rejects test provider/worker overrides. All non-AI M1–M3 environment settings remain unchanged.

### Structured output and failure handling

The exact eight top-level fields are intent, category, subcategory, prioritySuggestion, entities, missingFields, confidence and reasonSummary. Strict validation rejects unknown keys, missing/wrong types, incompatible taxonomy, duplicate missing fields, nonfinite/out-of-range confidence, oversized strings/output and present-entity/missing contradictions. NETWORK/IOT require absent location/time to be flagged. Ollama's JSON schema additionally constrains valid category/subcategory pairs; Zod validates again before persistence. The second attempt receives bounded trusted schema diagnostics, never the previous raw model response as instructions.

Offline/disconnect/HTTP failures are normalized; known missing model does not retry; timeout/invalid output retries at most once. Abort/cancel stops generation where supported. A second invalid result persists no AiAnalysis. PostgreSQL trigger injection proved publication rollback and recovery on actual DB write failure. Liveness/core readiness remain 200 when AI is unavailable; DB/vector failure still follows the existing 503 contract. With embedding unconfigured, aggregate AI readiness is degraded even while LLM health is UP; this is intentional and truthful.

### Evaluations

Final actual command: `npm run eval:ai:m4`, exit 0. Dataset SHA-256 `24382350fdd79ef03da5edf1063d7f1da8f2f2a3566af6a3caa7c129b692d76b`. Labels were written before predictions and were not changed to improve scores. See [dataset method](../../datasets/ai-evaluation/README.md) and [complete sanitized results](evidence/M4_AI_EVAL.json).

| Measurement | Observed |
|---|---|
| Cases | 50: 30 normal, 10 incomplete, 5 ambiguous, 5 noisy Vietnamese |
| Final schema-valid / completed | 50/50 (100%) |
| First-attempt valid | 49/50 (98%); one repaired result |
| Category agreement | 46/50 (92%) |
| Priority agreement | 42/50 (84%) |
| Labeled missing-information targets found | 11/11 (recall only; extra flags are not counted as false positives in this metric) |
| Exact entity agreement | customer 7/10, location 10/10, affectedCount 9/10, startedAt 8/10 |
| Latency, all 50 and successful 50 | mean 2772.12 ms; p50 2735 ms; p95 3195 ms |

Timing includes provider identity lookup, inference, parse/validation and retry/backoff where applicable; no prewarm is performed by the harness. Invalid/failed cases stay in denominators. The two earlier unsuccessful iterations are retained: [initial](evidence/M4_AI_EVAL_INITIAL.json) 48/50 valid, 46/50 category, 44/50 priority; [v2](evidence/M4_AI_EVAL_V2.json) 48/50 valid, 46/50 category, 40/50 priority. Their commands exited 1. Changes addressed null/missing consistency and constrained taxonomy generation; labels stayed fixed. No generalized accuracy or calibrated confidence claim is made. Master M4 defines demonstrations and measured evaluation, not a numeric category/priority acceptance threshold.

## Security considerations

Reviewed scoped query predicates, roles, actor revalidation, expectedVersion, locks, explicit ORM field mapping, immutable audit behavior, limits and sanitized logging. User content is delimited JSON data, separated from a fixed system prompt. Injection cases cannot create tool calls or protected mutations because no tool execution exists in M4. A constrained valid JSON result is still semantically untrusted; human review remains required.

Only safe run IDs/status/provider/model/duration/retry/error metadata is logged. No auth token, credential, full private prompt, raw response or reasoning field is returned. [Production browser bundle scan](evidence/M4_BUNDLE_SCAN.json) checked 19 emitted JS files against actual configured secret values: zero matches. Docker app services remain non-root with no-new-privileges, resource limits and loopback-only published ports. DB uses the restricted runtime role; no owner credentials enter containers/browser. [Dependency audit](evidence/M4_DEPENDENCY_AUDIT.txt): zero vulnerabilities. No finding blocks the local M4 scope; this is not a public production release audit.

## Tests executed

All PASS rows below were actually run and exited 0; the long-running dev server was instead booted, exercised and intentionally stopped.

| Command | Actual result |
|---|---|
| `npm run lint` | PASS; zero warnings |
| `npm run typecheck` | PASS; shared packages, generated Prisma, API and Next |
| `npm run test` | PASS; 29 tests: config 5, API 23, web 1; none skipped |
| `npm run build` | PASS; API and Next production build |
| `npm run db:validate` | PASS |
| `npm run db:migrate` | PASS; three existing migrations, no pending changes |
| `npm run demo:seed` | PASS; idempotent synthetic users/teams/skills/SLA, no reset |
| `npm run test:integration` | PASS; M1/M2 live health/runtime plus 1 M2, 3 M3 and 5 M4 PostgreSQL suites |
| `npm run test:e2e:m3` | PASS; 2 real-browser scenarios |
| `$env:M4_E2E_MODE='offline'; npm run test:e2e:m4` | PASS; 1 actual unreachable-provider browser scenario |
| `npm run test:e2e:m4` after restoring normal origin | PASS; 2 online/recovery scenarios |
| `npm run eval:ai:m4` | PASS on v3; 50 actual provider calls/cases, metrics above |
| `$env:M4_RUNTIME_TARGET='native'; npm run verify:runtime:m4` | PASS; four actual persisted request analyses |
| `npm run verify:runtime:m4` | PASS; Docker host-Ollama inference for four cases |
| `$env:M4_RUNTIME_MODE='offline'; npm run verify:runtime:m4` | PASS; real unreachable origin, failed run, manual approval/assignment/staff start |
| `npm run dev` | BOOT/RUNTIME VERIFIED; Next ready, HTTP 200, native API/inference verified; owned watch process tree stopped intentionally |
| `docker compose config --quiet` | PASS |
| `docker compose build api web` | PASS; final UI additionally rebuilt with `docker compose build web` |
| `docker compose -f docker-compose.yml -f artifacts/m4-offline.compose.yml up -d api web` | PASS; override only sets API Ollama origin to loopback port 1 |
| `docker compose up -d api web` | PASS; restored host.docker.internal and healthy stack |
| `npm ls --depth=0` | PASS; no new packages |
| `npm audit --omit=dev --audit-level=high` | PASS; zero vulnerabilities |
| `git diff --check` | PASS |
| `pwsh -NoProfile -File scripts/verification/Verify-M0.ps1` | FAIL as expected for the historical M0-only command: 8 scaffold-presence assertions; all other documentation assertions passed. Not an M4 application gate; unchanged frozen checker explicitly rejects post-M0 scaffolding. |

Evidence: [unit](evidence/M4_TEST.txt), [integration](evidence/M4_INTEGRATION.txt), [M3 browser](evidence/M4_E2E_M3.txt), [M4 online](evidence/M4_E2E_ONLINE.txt), [M4 offline](evidence/M4_E2E_OFFLINE.txt), [browser summary](evidence/M4_BROWSER_RESULTS.json), [lint](evidence/M4_LINT.txt), [types](evidence/M4_TYPECHECK.txt), [build](evidence/M4_BUILD.txt), [historical checker failure](evidence/M4_HISTORICAL_M0_CHECK.txt). Build/DB/seed/native logs also remain in ignored `artifacts/m4-*.log`.

### Behavioral coverage

- Deterministic strict-parser/taxonomy/unknown key/null/missing/bounds tests; prompt data separation/oversize; real HTTP fixture tests for model absence, malformed envelope, disconnect, timeout, truncation, abort and reasoning discard; bounded retry.
- PostgreSQL: atomic automatic queue, duplicate start dedupe, explicit retry, successful advisory persistence, projections for all three roles, foreign owner/unknown IDs, bad DTOs, stale commands, message during inference, cancel versus completion, deactivated initiator, expired lease/replay and injected publication failure rollback.
- Failed provider/schema output produces no successful analysis. AI does not set operational fields, assignment, SLA or recommendation. Missing-critical consent is enforced by backend; manual triage cancels queued work.
- M0–M3 regression: frozen docs/schema/migrations unchanged, auth/refresh/session/RBAC tests, AI-disabled full manual workflow, concurrency/rollback, checklist/SLA, request lifecycle, notifications, 403/404 and stale-version browser protection.
- Browser: actual offline fail/retry, restored real provider retry, progress/success/reload persistence, role visibility, keyboard focus/activation, protected content clearance after revoked access, responsive widths and no page errors. Only the access-loss UI negative uses a labeled intercepted 404; actual inference/offline gates use the real API/provider.

Iteration failures were not hidden: integration initially could not connect while Postgres was stopped; native verification initially found unavailable Ollama and was once interrupted by a dev watch restart. Services were started and stable verification rerun. The unconfigured-embedding offline status bug was fixed with regression coverage. M3 browser initially stopped at the new missing-fact consent guard; approval UI and the human test action were corrected, then the complete original workflow passed. Evaluation failures and final measured errors are retained above.

## Manual verification

Reviewed the actual validated results, persisted run identity, state/operational-field assertions and browser screenshots. The five required master-plan demonstrations are evidenced as follows:

| Demonstration | Actual Docker run / result |
|---|---|
| IoT outage, ABC/17 SIM/KCN Amata | `674e3c2d-fa1c-4977-83ca-728a2e0ed2ae`; NETWORK/IOT_CONNECTIVITY, HIGH suggestion, explicit entities; 2835 ms |
| Billing complaint | `23d9c0bf-84f9-443f-93d4-0f73b3e6a22a`; BILLING; 2968 ms |
| Missing location | `5f6f95d7-38a1-4724-934c-73c5056bcb95`; location null and flagged; 2679 ms |
| Ambiguous request | `eadaede4-7c6a-4969-9ade-b14f7a2e2b42`; OTHER/UNSPECIFIED, missing details; 2365 ms. Priority was LOW rather than labeled MEDIUM; this semantic error is retained. |
| Offline and recovery | Real Docker unreachable-origin run failed AI_PROVIDER_UNAVAILABLE; manual path reached IN_PROGRESS. Browser failed request was retried after restoration and succeeded, including reload persistence. |

[Docker online runtime](evidence/M4_RUNTIME_DOCKER_ONLINE.json), [native online runtime](evidence/M4_RUNTIME_NATIVE_ONLINE.json), [Docker offline runtime](evidence/M4_RUNTIME_DOCKER_OFFLINE.json), [offline browser request](evidence/M4_BROWSER_OFFLINE.json), [offline container health](evidence/M4_DOCKER_OFFLINE.json), [restored container health](evidence/M4_DOCKER_ONLINE.json). Native runs independently verified all four scenarios with the same installed model. Browser screenshots at `artifacts/m4/analysis-360.png`, `analysis-768.png`, `analysis-1440.png` and `offline.png` were generated; mobile/desktop images were visually inspected. No required local manual gate remains. Extended screen-reader/cross-browser testing was not performed.

## Known limitations

- Model semantics are imperfect despite valid JSON. Customer/count/time extraction and priority can be wrong. The browser example misread an arbitrary title as a customer and interpreted 17 SIM as one device; the runtime ambiguous case suggested LOW. These were observed, not corrected by hardcoded answers. Original text remains visible, human review controls actual decisions, and confidence is explicitly uncalibrated. M4 PASS is an infrastructure/lifecycle/demonstration gate, not a claim of error-free extraction.
- The 50-case specification-labeled synthetic set is not independent human adjudication, a holdout corpus or a general production accuracy estimate. Only ten cases have complete entity labels. Missing-target recall does not measure false-positive missing flags. M9 owns broader evaluation/benchmarking.
- One local API worker and in-memory actor limits; distributed workers/global rate limiting are outside current scope. Long queue waits count toward the run deadline. Run metadata may remain RUNNING during a total DB outage until lease recovery is possible.
- No embeddings configured; aggregate AI readiness stays degraded although the LLM is usable. No RAG, retrieved procedural grounding or recommendation is claimed.
- Browser verification requires installed Microsoft Edge and synthetic seeded data. Online recovery E2E requires the preceding offline run. Tests preserve synthetic main-DB records. Native/Docker should not compete for ports or shared evaluation capacity.
- A malformed model result can be structurally rejected but semantic truth is not decidable by the schema. No automated assignment/approval/category/priority/SLA writes are permitted from AI output.

## Deferred items

M5 ingestion/chunking/embeddings/vector retrieval/RAG; M6 tools/similarity/grounded recommendations; M7 AI-bound manager review; M8 Copilot, AI checklist adoption, SLA warning scheduling, factual summary and feedback; M9 expanded evaluation/benchmark/analytics; M10 complete release/demo/security hardening. Optional AI-generated title is not implemented. No production deployment, cloud service, autonomous tool or later-milestone feature was added.

## Release blockers

No blocker remains for the authorized local M4 gate. Full V1 release remains blocked on M5–M10. Model-quality limitations above require continued human review and later evaluation; they must not be presented as automated decision reliability. No user confirmation or manual service setup remains pending for this milestone. Docker is restored to normal host-Ollama configuration with all services healthy.

## Gate

**PASS — M4 complete.** Required schema/failure/version/authority/persistence behavior, native/Docker real inference, five demonstrations, 50-case measured evaluation, offline manual workflow, M3/M4 browser gates and requested quality commands are verified. The historical M0-only scaffold check is reported honestly and remains unchanged. Execution stops before M5; explicit approval is required to begin it.
