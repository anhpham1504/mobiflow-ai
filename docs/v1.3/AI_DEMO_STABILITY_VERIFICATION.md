# V1.3 local AI demo stability verification

**Remediation verified — READY FOR PUBLICATION WITH ACCEPTED EXCEPTION.** Independent technical, AI evaluation, regression, demo, source and browser gates PASS for the tested candidate. The original BASELINE_PRESERVATION measurement remains FAIL. The user explicitly accepted its unprovable developer DB equality as **ACCEPTED EXCEPTION — USER AUTHORIZED** on2026-10-05 and authorized ordinary fix-branch commit/push. No preservation PASS is claimed. Actual publication, SHA equality and CLEAN state are recorded after commit/push in ignored publication evidence and the final handoff.

Evidence root used below: `artifacts/ai-demo-stability/20261005-1138/` in the candidate worktree. Timestamps in JSON/logs are UTC; user-facing date is 2026-10-05, Asia/Saigon. Historical evidence under `C:/Code/MobiFlow AI/artifacts/local-demo-20261005/` and `artifacts/v130-stability-20261005/` is retained unchanged. Sanitized immutable metadata is in [evidence manifest](evidence/ai-demo-stability/20261005-1138-final/manifest.json), with [reporter-aware test counts](evidence/ai-demo-stability/20261005-1138-counts/test-counts.json). Raw prompts, credentials, HTTP bodies and screenshots stay ignored. No prior run's artifacts were overwritten.

## 1. Scope implemented and baseline

The user's explicit EXECUTE request authorizes all Part 2 work: diagnosis and fixes for recommendation references, resolution-summary fidelity/attribution and request-vector recovery; regression/integration/build/security/privacy gates; fresh AI evaluation and five new live synthetic workflows; evidence and ordinary commit/push only when all required gates pass and blockers are zero. It does not authorize merging main, a new tag, production deployment or V1.4.

| Identity | Verified baseline / target |
|---|---|
| Release HEAD/main/origin main at preflight | `56e97f1e522f2bef2340fd9986e0507f6c2bc172` |
| Existing v1.3.0 annotated object | `b1e2c3364ce205493871f84331cd6061c70f5918` |
| Existing v1.3.0 peeled commit | Release HEAD above |
| Candidate branch | `fix/v1.3-local-ai-demo-stability` |
| Candidate worktree | `C:/Users/AnhPhamPC/.codex/worktrees/ai-demo-stability/MobiFlow AI` |
| Original checkout | `C:/Code/MobiFlow AI`; unchanged release HEAD, detached to free the existing fix branch; original dirty files/index preserved |
| Owned verification target | `mobiflow-ai-stability-20261005`; Web 33800, API 33801, PostgreSQL 55427 |
| Existing demo | `mobiflow-v130-demo-20261005`; Web 33700, API 33701, PostgreSQL 55426 |

Preflight at 2026-10-05T04:38:23.373Z recorded Windows win32, Node 24.19.0, Docker 29.6.2 and Compose 5.3.1, exact target ports/volumes, developer container IDs/images/state, environment/migration hashes and runtime inventory. Original pre-existing changes were copied only after scope review; unrelated historical reports and browser artifacts were not staged into the repair. [Implementation plan](AI_DEMO_STABILITY_IMPLEMENTATION_PLAN.md) freezes the verification protocol before new candidate inference.

## 2. Files/modules changed and owner rationale

| Owner / paths | Resulting behavior |
|---|---|
| `apps/api/src/ai/prompts/recommendation.ts` | Native V2 generation binds each selected SOP subset, required KNOWLEDGE evidence and permitted checklist IDs. Public parser remains authoritative. |
| `apps/api/src/ai/resolution-summary-facts.ts`, `operational-ai.service.ts`, `prompts/copilot.ts` | Explicit STAFF attribution, whole quoted facts and exact public-event labels; actor/context validation; latest fifty allowed audits before resolution; generated event/text pairing and chronology validated. |
| `apps/api/src/requests/request-state-machine.service.ts` | New summary scheduling uses the summary owner's shared prompt-version constant. No new transition or approval rule. |
| `apps/api/src/ai/tools/request-vectors.ts`, `analysis-worker.ts`, `apps/api/src/http.ts` | Fair single-candidate scan, classified bounded retry/lifecycle/permanent errors, safe failure/recovery telemetry, cancellation/identity/version checks; existing database-unavailable classifier reused. |
| `apps/api/src/knowledge/rag-health.ts` | RAG readiness detects missing compatible current-version request vectors and blocked indexing. |
| API unit/integration tests, `scripts/evaluation/m15-prompt.test.mjs` | Cross-procedure/summary provenance/negation/long-field tests; provider/database/stale/cancel/fairness/identity/readiness regression; real PostgreSQL coverage. Existing integration setup aligns to thirteen release migrations and current SLA-monitor ownership. The HTTP-adapter functional fixture's timeout is separated from its deliberately nonresponding timeout case. |
| M15/M8 evaluator scripts; new `ai-demo-stability-targeted.mjs` and `ai-demo-stability-workflow.mjs` | Isolated evidence roots, source-frozen live protocols, actual provider attempts, synthetic role workflow and protected-state evidence. M8 summary uses the same factual projection and shared overall deadline. |
| AI/RAG owner specs; four new stability documents | Current contracts and honest repair/gate/publication state; historical reports unchanged. |

The copied existing `m8-copilot-evaluate.mjs` changes align event actions/scoped similar-case inputs and isolated output paths; Copilot product prompt remains `copilot.m8.v2`. Product source inventory passed for195files; the candidate path review covers only the source/tests/evaluators/specs and four new stability reports/evidence. The original handoff was not staged while preservation blocked publication; the subsequent explicit user exception now permits staging only the reviewed allowlist. No UI presentation, authentication policy or arbitrary runtime tool is added.

## 3. Database/schema changes

Application schema, dependency versions, lockfile and all historical migration files are unchanged. There is no new migration or vector dimension/model change. The owned verification PostgreSQL instance has new synthetic databases `mobiflow`, `mobiflow_m2_test` and `mobiflow_m14_test`; migration owner/runtime credentials are separate and private. No developer reset/reseed/migration was executed by this repair.

`node artifacts/ai-demo-stability/20261005-1138/operator.mjs database` selected only the owned target and ran the guarded existing release seed routine. `database-migrate-seed.json` records exit 0, completion at 04:43:04.290Z, elapsed 3,011 ms; `release-seed-report.json` records thirteen migrations and unchanged repeat-seed counts, including eight Requests. Separate M2/M14 test databases were migrated and seeded through `test-dbs.mjs prepare`; their target/container manifest is `test-targets.json`.

Real corpus ingestion completed at 04:52:54.980Z: nine READY synthetic documents and twelve chunks, with actual bge-m3 digest/dimension1024 recorded per generation in `corpus-retry.json`. Earlier ingestion outcomes are retained: wrong relative import (`ingest.log`) and host embedding unavailability (`ingest-attempt2.log`, `corpus.json`), followed by a separate successful reindex/ingestion run (`ingest-attempt3.log`). Separate `runtime-lifecycle.json` and `runtime-handoff.json` measurements confirm16/16eligible Requests indexed at their exact current model/dimension/inputVersion/contextVersion, production vector retrieval of five real indexed cases, and unchanged protected rows for the five completed workflows.

## 4. API/UI changes

REST `/api/v1`, three login roles, existing output schemas, expectedVersion transport, RBAC/IDOR/session/CSRF/rate/media guards and human business commands remain. RAG readiness uses existing fields: it can report NOT_READY/REQUEST_INDEX_INCOMPLETE while provider is UP and knowledge is READY. Core/manual API readiness and HTTP status retain their existing contract; top-level READY does not substitute for RAG/quality checks.

No frontend source or public response shape changed. Candidate Web production build uses `http://localhost:33801` as the API target. Existing demo33700 has not been promoted by this repair and must not be described as the candidate or pristine original release: its API had already been modified/restarted by prior uncommitted work. Representative candidate browser acceptance passed the actual role/source/summary/loading/error/retry observations described below; the historical twenty-eight responsive/Axe scans are not new execution evidence.

## 5. AI identity and revisions

| Identity | Actual accepted value / candidate change |
|---|---|
| Completion tag/digest | `qwen3:4b-instruct-2507-q4_K_M` / `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641` |
| Embedding tag/digest | `bge-m3:latest` / `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab` |
| Embedding dimension/revision/key | 1024 / `m5.v1` / `a6cd9ebb83b4c9c07a14cb63e4cbef8789a7dabd3257d35cbed412ead4b621d9` |
| Recommendation prompt/public schema | historical `grounded-recommendation.v2.10` → candidate `grounded-recommendation.v2.11`; `recommendation.v2` unchanged |
| Summary prompt/public schema | historical free-text summary → adopted uncommitted v4 → candidate `resolution-summary.m8.v5`; `resolution-summary.m8.v3` unchanged |
| Copilot prompt | `copilot.m8.v2` unchanged |
| Measured Ollama runtime | 0.35.0; no pull, upgrade/downgrade or GPU/driver change by this repair |
| Bounds | temperature0, 1,200 output tokens, two attempts, 120,000 ms attempt / 300,000 ms run; embedding worker call30,000 ms / backoff cap60,000 ms |

The summary v5 revision accounts for actor/latest-event projection and prompt changes; queue/retry metadata shares its constant. Source identity is byte-based, not inferred from the revision name. `targeted-live-2/manifest.json` records normalized-LF SHA-256 for recommendation prompt `23daf39ea51eecd51588bdde934851e34d11ab453ec639a9c528aca293640061`, copilot/summary prompt file `e07640cf683d4b8942e0ff2f6962f91a8500e7d4910fff0aaa4075543b9f5fc5`, and summary fact owner `4c882500e7c6a4dc2f462bf8b57fa3b63e262d3da392c1242420b1081c5a9802`. Source coverage passed at07:24:54.735Z for195current product/config files, with test/evaluator runner identities retained per applicable manifest. A subsequent product/config/prompt edit requires renewed coverage and affected checks.

## 6. Diagnosis and fix for each defect

[Diagnosis](AI_DEMO_STABILITY_DIAGNOSIS.md) includes historical artifact locators/hashes, owning functions, independent causal reproductions and remaining uncertainty.

- Recommendation: v2.10 independent global ID enums allowed a real retrieved checklist source outside the selected procedure set. The unchanged parser correctly rejected it. V2.11 binds those selections. Literal REC-01 captured raw replay is NOT AVAILABLE; the equivalent deterministic A/B schema/parser regression is separately labeled. The exact historical offending source pair is unknown.
- Summary: free model text was validated only by schema/event membership/order, allowing a false claim that AI verified the cause before STAFF later supplied it. V5 binds exact attributed facts/action labels, actor provenance and chronology, preserves all resolution fields and excludes private context. It is constrained factual generation, not a benchmark of unconstrained summarization.
- Embedding: release code permanently paused backfill after any exception. Controlled transient/stale tests establish this defect; the original swallowed demo exception remains NOT_RECORDED. Candidate distinguishes local stale, transient, lifecycle, configuration and unexpected failures; fair scan/retry/revalidation and safe observability remove the known global pause failure mode. Real PG ten-test recovery, separate idle API lifecycle and live compatible16/16index/retrieval/protected-state checks PASS; fixture and live measurements remain distinguished.

## 7. Executed tests and retained failed iterations

All commands run from the candidate worktree unless a row identifies `apps/api` cwd. Existing command JSON records persist exact argv, completion timestamp, elapsed time, exit code and log; operator technical records also contain normalized source inventory/sourceUnchanged. A separate exact wall-clock start was not persisted by the earlier wrapper; its completion time and measured duration must not be presented as an independently captured start timestamp. Final fresh gate records are retained in the rows below.

| Actual command / selection | Recorded outcome and evidence |
|---|---|
| `npm ci` using unchanged lockfile; host typecheck and API build | PASS logs `npm-ci.log`, `host-typecheck.log`, `host-api-build.log`; no new dependency |
| Root-cwd targeted API unit invocation | FAIL: PDF fixture ENOENT due wrong operator cwd; preserved `targeted-unit.log` |
| `node --test test/knowledge.test.mjs test/operational.test.mjs`, cwd `apps/api` | PASS20 (13knowledge+7operational), zero fail/skip; `targeted-api-unit-correct-cwd.log` |
| `node --test scripts/evaluation/m15-prompt.test.mjs` | PASS9; `recommendation-unit.log` |
| `docker compose --env-file artifacts/ai-demo-stability/20261005-1138/verification.env -p mobiflow-ai-stability-20261005 -f docker-compose.yml build api web` | PASS exit0; 04:41:58.577Z;47,890ms; `production-build.json/log` |
| `docker run --rm --network none -w /app mobiflow-ai-stability-20261005-builder npm run lint` | PASS exit0;04:43:07.040Z;13,295ms; `lint.json/log` |
| Same isolated builder `npm run typecheck` | PASS exit0;04:43:21.891Z;14,392ms; `typecheck.json/log` |
| Same isolated builder `npm run test` | First FAIL exit1;04:43:40.444Z;18,249ms; one HTTP-adapter fixture AI_TIMEOUT at its100ms bound,152API pass/1fail; `test.json/log` retained |
| Same isolated builder `npm test` after builds | Log records228pass (7config+153API+2Web+66evaluation),0fail/skip; `test-after-builds.log`. Exit/source metadata was interrupted, so this log is not the final gate. Separate `test-attempt2.json/log` records the fresh final228PASS/exit0/sourceUnchanged=true |
| `node artifacts/ai-demo-stability/20261005-1138/test-dbs.mjs integration`, M2 pattern `M6 real PostgreSQL tools|M6 .*validation|M8 Copilot` | PASS2, exit0;04:44:16.220Z;5,624ms; `integration-m2.json/log`; owning PG tests only, not all historical M2 suites |
| Same integration operator, `apps/api/test/recommendation-v2.integration.test.mjs` | PASS26, exit0;04:44:45.911Z;29,680ms; `integration-m14.json/log` |
| `node artifacts/ai-demo-stability/20261005-1138/test-dbs.mjs recovery` | Prior PASS9 including parent, exit0;04:44:10.063Z;2,923ms wrapper; `recovery-m2.json/log`. Expanded EMB-04 case run PASS10, exit0;07:09:05.465Z;1,916ms wrapper; `recovery-m2-1.json/log`; all prior output retained |
| Final lint after workflow runner changes | Retained FAIL `final-lint.json/log`: runner `structuredClone` no-undef. Qualification to `globalThis.structuredClone` only; `npm run lint` rerun exit0 at07:11:53.855Z, `final-lint-2.json/log` |
| Final isolated builder `npm run typecheck` | Exit0 at07:12:23.250Z; `final-typecheck.json/log`; final195-file source coverage PASS |
| Final isolated builder `npm test` before fixture scheduling correction | FAIL exit1 at07:12:27.523Z; `final-test.json/log`; same100ms functional HTTP fixture timeout retained. Test-only correction is described below |
| `docker build --target api-build -t mobiflow-ai-stability-20261005-builder -f docker/Dockerfile .` | Rebuild after test-only correction exit0 at07:14:54.822Z; `builder-final-2.json/log`; earlier builder-final also retained |
| `docker run --rm --network none -e NEXT_PUBLIC_API_BASE_URL=http://localhost:33801/api/v1 -e NEXT_TELEMETRY_DISABLED=1 -w /app mobiflow-ai-stability-20261005-builder npm run build` | Exit0 at07:16:43.475Z; `final-build.json/log`; correct candidate API base, final195-file coverage PASS |
| Fresh isolated operator gates: `npm run lint`, `npm run typecheck`, `npm run test` | All exit0/sourceUnchanged=true: `lint-attempt3.json/log` at07:16:31.016Z,15,588ms; `typecheck-attempt2.json/log` at07:16:51.445Z,20,134ms; `test-attempt2.json/log` at07:17:12.888Z,21,148ms. Root228testsPASS (7+153+2+66),0fail/skip |

The integration runner uses owned PostgreSQL container networking and `m2.env`/`m14.env`, and mounts output only into isolated `integration-output`; historical documentation/evidence is not overwritten. The repeat HTTP-adapter failure occurred in a functional success fixture whose100ms startup/network budget was shared with the intentional timeout negative. `apps/api/test/analysis.test.mjs` now uses2,000ms for functional responses while its deliberately nonresponding fixture still uses100ms and asserts AI_TIMEOUT. Product attempt/run deadlines remain unchanged; no test/assertion is disabled. Fresh228-test execution passes with that correction. The workflow qualification is harness-only; the exact executed workflows-4 runner is preserved as `runner-tested.mjs`. Product/M15/targeted source bytes did not change for those two corrections. Lint/typecheck/unit/integration/build plus completed source/privacy/security review are **PASS** on the recorded candidate; staged/prepublication source/diff/secret review follows the explicit user-authorized preservation exception; product source has not changed.

## 8. Live evaluation protocol and current outcomes

The accepted authority is the current M15 dataset/runner/metrics, with all100 ordered synthetic cases and ten representative cases ×3 consistency runs (30). The evaluator uses production V2 parsing and accepted bounded fact/reference/authority oracles; final schema/contract/action/bounds/missing-information validity must hold, accepted fabricated references/facts, unsupported execution and known causal/SLA/conflict probe violations must be zero. Thresholds, labels, comparator and dataset were not relaxed after observing candidate outcomes. V1 comparator is NOT RUN per accepted protocol; this is not a composite score.

The current manifest's dataset is `m15.recommendation.synthetic.v2`,100cases, raw-file SHA-256 `d011105c106711cf7848e20d757099aa62c4152336fc2672a5e09719c01ba6e9`. Historical supplied hash is `e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290`. `source-coverage.json` verifies CRLF→LF normalized current hash equals that historical hash and the exact release Git blob hash; normalizedEqual=true, no logical dataset change. The raw Windows file hash remains distinct and recorded, rather than silently substituted. Per-run manifests freeze model/prompt/schema/config/source hashes, case order, platform and embedding probe.

| New run / exact entry point | Recorded state |
|---|---|
| `node artifacts/ai-demo-stability/20261005-1138/operator.mjs quality`; M15 run `2026-10-05T04-41-22-825Z-73e7716c-ae20-4561-aa07-25f5efda92dd` | Interrupted after23 completed cases; `m15-evaluation.log`, results and separate `interruption-observation.json` preserved; incomplete, not accepted PASS |
| Separate `m15-complete/2026-10-05T04-50-08-918Z-5d481a7f-9bcd-4229-b09d-0b3f67702899` attempt | Setup NOT_RUN0 due unavailable host fetch; summary/setup error retained |
| `m15/2026-10-05T04-51-01-365Z-00a92e90-1d22-4596-9578-34ffdce3845a`; `m15-evaluation-attempt2.log` | Interrupted/incomplete execution; retain every row; does not satisfy full suite |
| Fresh operator quality attempt3; `m15/2026-10-05T07-00-22-273Z-2bdc6b4a-8e8b-4de3-b393-1bc2ddaa0273`; start07:00:22.273Z | PASS100+30; end07:44:10.150Z; operator exit0 at07:44:10.202Z,2,629,792ms. All130first-attempt successes/130attempts/0retry/0findings. `m15-evaluation-attempt3.log/json` and summary retained; exact evaluated source reconciliation described below |
| `node --env-file=artifacts/ai-demo-stability/20261005-1138/verification.env scripts/evaluation/ai-demo-stability-targeted.mjs artifacts/ai-demo-stability/20261005-1138/targeted-live-1` | Interrupted partial; retained manifest/raw `results.jsonl` and log; no complete40-run PASS |
| Same targeted runner → fresh `targeted-live-2`; start07:00:42.728Z/end07:22:19.875Z | PASS40/40: recommendation20/20 and summary20/20, all first attempts valid, forty attempts total, zero first failures. Twelve recommendation outputs selected two procedures. Frozen fixture hash `33dfa83b98c1ba726fdee01824a60e87149824de96b085b2e5b12198b520543b`; covered source equality asserted and final hashes retained in summary |
| Accepted `scripts/evaluation/m8-summary-evaluate.mjs` on new request `077237e9-f0b9-417f-a96d-d4abedb18dc7`, isolated `AI_EVAL_EVIDENCE_ROOT=m8-summary-1` and explicit `M8_SUMMARY_REQUEST_ID` | PASS1/1, first attempt,36,863ms, end07:14:00.372Z; `m8-summary-command.json` exit0 and `m8-summary-1/M8_SUMMARY_EVAL.json` |
| `scripts/evaluation/m8-copilot-evaluate.mjs`, isolated `AI_EVAL_EVIDENCE_ROOT=m8-copilot-1` | PASS8/8, all first-attempt schema/reference valid; end07:18:41.545Z; `m8-copilot-command.json` exit0 and `m8-copilot-1/M8_COPILOT_EVAL.json`. Covers unchanged six actions over synthetic supplied current-state fixtures; not general answer accuracy |

Targeted recommendation fixtures include demo-equivalent five-source, two-source multi-procedure, similar-source alternative, no-SOP and malicious/source-scope variants. Summary fixtures include AI classification then STAFF resolution, unresolved cause/negation, manager versus USER provenance, simulated verification, wait/resume and private-note canary. Native generation and factual validators are the production owners. Targeted snapshots themselves are synthetic supplied contexts, not a claim of live retrieval or endpoint authorization. Those boundaries have separate integration/workflow evidence. TARGETED_REGRESSION_GATE is **PASS for the frozen40-run protocol**; full accepted AI_EVALUATION_GATE is **PASS** for100cases plus30consistency calls. Final schema/contract/action/bounds100%; accepted/attempted fabricated references, protected-fact and business-execution violations0; missing-information21/21exact; all10consistency case groups preserve all registered invariants. Earlier partial/setup/failure evidence remains separate and retained.

The M15 operator's broader inventory records `sourceUnchanged=false`. `m15-source-reconciliation.json` proves its only changed path is `apps/api/test/analysis.test.mjs`, the unrelated functional fixture correction; the final builder/test/lint/typecheck gates were rebuilt and rerun after that correction. All eight M15-covered product/prompt/provider/parser/config/evaluator/metrics files and exact dataset bytes match their frozen raw hashes. The evaluator also asserts those identities and model inventory after all130calls before returning exit0. This distinction is retained in public evidence; the broad false is not changed into true. The first final observation consolidator used an incorrect `readiness.ai.status` path and failed after a separately successful runtime probe; its script/TypeError metadata remains in `final-observation-attempt1.*`. The corrected consolidation checks the actual `coreReady`/`aiReady` booleans and retains the original successful runtime snapshot.

## 9. Latency and cold/warm limits

Completed sample aggregates below are computed from saved results, in milliseconds. M15 all130end-to-end runner samples are complete, with0failed samples. Per-call cold/warm state was not instrumented for M15 and remains unmeasured. No percentiles/SLO or unobserved phase split is invented. Accepted and targeted scripts retain every attempt's duration/error and first-failure status. A repaired run does not become a first-attempt success. Workflow records additionally capture HTTP/end-to-end timings, stored AiRun latency/retryCount and index convergence.

| Measured sample | n | Min | Median | Max | Outcome/conditions |
|---|---:|---:|---:|---:|---|
| M15 complete runner, evaluation plus consistency | 130 | 8,721 | 15,276 | 51,959 | 130success/0failure,130attempts, no retry; per-call loaded state unmeasured |
| M15 primary evaluation runner | 100 | 12,661 | 16,629.5 | 51,959 | 100first-attempt success |
| M15 consistency runner | 30 | 8,721 | 13,745 | 16,252 | 30first-attempt success |
| Targeted recommendation end-to-end runner | 20 | 23,430 | 34,551 | 47,837 | 20success/0failure,20attempts; loadedBefore=true for all20 |
| Targeted summary end-to-end runner | 20 | 16,392 | 28,428.5 | 52,227 | 20success/0failure,20attempts; loadedBefore=true for all20 |
| Five workflow intake API AiRun latency | 5 | 25,579 | 26,529 | 36,869 | All first-attempt success |
| Five workflow recommendation API AiRun latency | 5 | 40,942 | 47,236 | 56,610 | All first-attempt success |
| Five workflow FIND_SOP API AiRun latency | 5 | 27,273 | 28,772 | 33,017 | All first-attempt success |
| Five workflow summary API AiRun latency | 5 | 31,951 | 40,252 | 45,633 | All first-attempt success |
| Complete workflow runner wall time | 5 | 141,922 | 148,578 | 173,065 | All PASS; synthetic role/API actions and waits |
| Current-version index observation after closing | 5 | 1,506 | 1,512 | 1,514 | All within frozen180,000ms bound; polling interval affects observation |
| Retained first workflow-iteration failures | 2 | 94,170 | 110,104.5 | 126,039 | Observer/SLA-monitor mismatch; failed outcomes retained, excluded from successful five-run sample |
| Accepted M8 single-summary call | 1 | 36,863 | 36,863 | 36,863 | First attempt; one synthetic resolution, no percentile inference |

Preflight `/api/ps` at04:38:23.373Z showed bge-m3 loaded and completion absent. This is a natural unloaded-completion observation, not proof that a specific later call was cold: concurrent tasks may load the model before it starts. All forty completed targeted attempts observed completion loaded immediately before their calls and are warm by the frozen definition. Verified cold inference is NOT RUN for this sample; no unload/restart of shared Ollama was used to manufacture it. This is a disclosed measurement limitation, not an invented cold result.

M15, targeted inference and candidate workflows share the local host. Queue/cache/concurrency therefore influence durations; these are not isolated hardware benchmarks or a new business SLO. Current M15 manifest records seed42/contextTokens16384 and unchanged attempt bounds. Provider/API phases can be separated only where existing instrumentation records them; no guessed retrieval/provider split or general accuracy result is derived from these samples.

## 10. Recovery/backfill and protected-state evidence

Prior deterministic recovery passed nine tests with real isolated PostgreSQL, twelve new synthetic Requests and a controllable embedding fixture. It demonstrated stale no-write, fair convergence past a repeatedly changing request, transient backoff then automatic recovery, permanent digest/dimension rejection, concurrent deduplication, CANCELED no-write, actual AnalysisWorker lifecycle cancellation and truthful missing-index readiness. Unit cases cover prolonged database outage cap and unexpected safe logging. Test clocks are controlled; these durations are not a measured180-second live provider-recovery SLO.

The expanded EMB-04 test executes provider DOWN→UP while preserving manual commands and RAG readiness against real PG; the current complete ten-test recovery run is **PASS**, exit0 in `recovery-m2-1.json/log`. Actual verification API-container lifecycle is separately **PASS** in `runtime-lifecycle.json` at07:21:21.125Z: owned API stop completed exit0 in750ms, restart reused the same container ID/image and returned healthy. This OS/container test stopped an idle API; active inference shutdown remains the deterministic worker lifecycle case. Restart is a separate consistency exercise, not the transient-recovery fix. Shared Ollama was not restarted for the test.

Live corpus vectors are real compatible bge-m3 output. Runtime verification records16eligible/16indexed with the exact current model/dimension/input identity, an111ms live embedding probe and production parameterized `RequestVectors.similar` retrieval over real PG returning five compatible cases (truncated=true,43,200-minute configured query window). Protected hash for the five completed workflow Requests/business rows is identical before/after lifecycle and read-only retrieval: `6b85bbbd2571fc89b1be092128df53a30dc31572ea05e1ba8603f063213b35d6`. `runtime-lifecycle-command.json` records the runtime-verification lifecycle entry point exit0; raw identities/queries/results are in `runtime-lifecycle.json`. Coverage is the actual owned N=16, not a fabricated8/8.

New workflow runs compare Request and business rows around read-only recommendation/review/Copilot/backfill. Runner v1 initially treated the independent canonical SLA monitor's assessedAt/version refresh as an unauthorized mutation and recorded failures. Revised checks retain the SLA row and validate only the monitor's exact permitted field set and `assessSla` math/cadence; they do not drop SLA from the comparison or permit assignment/status/priority changes. The five completed workflows record protected checks and current-index observation within1,514ms after closure. Deterministic and live indexing/retrieval/lifecycle subgates are PASS; final source/privacy review remains separate.

## 11. Workflow/browser/operator verification and review provenance

The workflow manifest freezes five new requests; USER creates/live intake, MANAGER generates/rejects advisory then explicitly authors/submits/approves a predefined manual plan, STAFF starts/FIND_SOP/wait/checklist/resolve, USER provides information/confirms. Reject/manual commands are agent-operated synthetic role actions; they are not an external human acceptance. No historical CLOSED request is reset, no SLA target is increased and real SLA states are reported.

| Workflow iteration | Actual retained state |
|---|---|
| `workflows-1` | Two recorded FAIL rows, FLOW-1/FLOW-2: protected snapshot mismatch on independent SLA monitor assessedAt/version. Runner-original.mjs and row/raw HTTP evidence preserved. Partial/interrupted; not five completed workflows |
| `workflows-2` | Partial/interrupted HTTP/manifest evidence retained; no complete summary; NOT accepted PASS |
| `workflows-3` | Setup FAIL ECONNREFUSED127.0.0.1:55427 during runtime interruption, before completed workflows; log/manifest retained |
| `node --env-file=artifacts/ai-demo-stability/20261005-1138/verification.env scripts/verification/ai-demo-stability-workflow.mjs artifacts/ai-demo-stability/20261005-1138/workflows-4` | PASS5/5; frozen start07:06:34.130Z/end07:19:24.014Z, case hash `04cfd9b89f0bac62c301019d158171b800e63024197fde27949596c249a00b9e`; twenty AiRuns SUCCEEDED with retryCount0 and no first-attempt failures. All Requests CLOSED v12/SLA MET; index observations1,506–1,514ms. Actual request IDs/version/facts/role commands/attempts retained per FLOW record |

Candidate browser at33800 was operated in an independent Playwright session. MANAGER opened the actual workflow source (`browser-source-manager.png`); STAFF and USER viewed the attributed/simulated summary (`browser-staff-summary.png`, `browser-user-summary.png`). USER attribution/simulation/private-canary check recorded PASS at07:18:11.548Z in `browser-user-check.log`, and USER manager-route denial is retained in `browser-user-manager-denial.yml`.

Loading/error/retry browser acceptance **PASS** at07:31:05.138Z in `browser-retry-2.log` (start07:30:55.425Z). A browser-only route fixture returned HTTP503 for the Copilot action to exercise the visible safe error; this made no backend fault or failed AiRun. After removing the route fixture, a separate real local Ollama FIND_SOP call showed the loading status and a real SOP-IOT-04 source in the result. Screenshots `browser-controlled-error.png`, `browser-live-loading.png` and `browser-live-retry-result.png` retain these states. This is UI transport-state coverage plus a separate live call, not provider-outage recovery evidence. First harness attempt timed out looking for fixture message text instead of the actual safe product alert; `browser-retry.log` preserves that locator mismatch. Its correction uses the visible contract text and does not change product behavior or erase the failed operator attempt.

Current request/console logs retain refresh401 after logout/session revocation; earlier auth refresh200 responses are also present. STAFF and USER logout each captured204 then one refresh401; repeated logged-out USER observations over several minutes showed no increase in the refresh-request count, so no refresh loop was observed in that measured window. The manager logout returned to the logged-out UI, but its network count was not captured and is not asserted. Revoked-session denial and role-specific UI/RBAC checks showed no session reuse in the exercised paths; this is bounded observed behavior, not a general proof of no possible session leak. The 401 and controlled503 remain console errors, so console is not called clean. Historical six refresh401 events remain unchanged. No UI code change requires a full historical responsive/Axe matrix replay.

Technical semantic/security self-review: **PASS for the recorded agent review**, with no actionable product defect found in `security-privacy.json`; final overall closure review waits for remaining gates. Independent external human review: **NOT RUN**. Its absence is recorded separately and is not fabricated as PASS or made into an extra approval gate without owner authority.

## 12. Security/privacy, source and preservation checks

The selected real PostgreSQL recommendation/operational tests passed role/ownership, source/reference, stale/currentness, bounded failure, transaction and artifact-only review checks. All five completed workflows exercised USER manager/internal denial, unassigned STAFF404, unauthenticated401, STAFF approval403, stale message409, incomplete checklist422, scoped source quotes and private-note canary exclusion. Guards/rate/session/media/CSRF policy were not disabled for inference.

`source-security-command-2.json` records `node artifacts/ai-demo-stability/20261005-1138/source-security.mjs` exit0 at07:25:07.408Z. `security-privacy.json` PASS at07:25:07.396Z lists1,739tracked/untracked repository files and scans eligible text extensions plus25running Web JavaScript bundles, findings0, unchanged critical public schema/provider/embedding/tool-registry/dependency owners and local packaging checks (loopback, non-root, read-only, cap-drop, no-new-privileges/resource limits/no Docker socket). The old record's total-file field is not a count of binary files read. Post-public-snapshot `source-security-handoff-command.json` separately records exit0 and195product files still equal the tested builder/production source; `security-privacy-handoff.json` accurately distinguishes1,752listed files from1,716text files scanned, plus25bundles/findings0. Final docs are additionally covered by `source-security-final-command.json`/`security-privacy-final.json`; actual timestamps/counts remain in those records. This is a conservative credential/configured-secret scan and focused review, not exhaustive vulnerability proof. The earlier source audit FAIL due missing `.npmrc` in its inventory is preserved in `source-security.log`/command record. The corrected audit includes195product files; `.npmrc` additionally matches the release Git blob and builder bytes, so its historical manifest omission is recorded rather than hidden. Source coverage also proves normalized dataset equality. Current source/security/privacy and unstaged path review are PASS; historical preservation measurements remain FAIL; subsequent ACCEPTED EXCEPTION — USER AUTHORIZED removes that discrepancy as a publication blocker without altering those records. The staged publication checks have separate fresh records.

Preservation check at2026-10-05T07:06:33.832Z (`preservation-check.json`) reports:

| Resource | Observation |
|---|---|
| Original files, including pre-existing changes/reports/browser artifacts | Listed hashes unchanged |
| Developer `.env`, package lock and thirteen migrations | Hashes unchanged |
| Existing tags and main | Unchanged |
| Developer container IDs/images | Unchanged; baseline running/stopped states restored after interruption |
| Developer PostgreSQL volume bytes | **FAIL**: baseline `752f0e551986ec86d68789e05462b751f0623c6ea5ca2d1383679a9ed26a3805`, current `8375a84c8e36392a52f1b59d5beeb333fdb1e8cb82302138c432d3cdb642f71a` |

Docker state records developer PostgreSQL started at07:04:44.19509315Z and stopped at07:04:45.585227508Z (14:04:44–14:04:45 Asia/Saigon). The repair did not issue a developer start/reset/reseed command; however, the cause/authorization of that observed external/session event is not established. A short PostgreSQL start can change storage bytes; that possibility is not proof of harmlessness or data equality. At the initial handoff, clarification/evidence was pending and BASELINE_PRESERVATION was FAIL/BLOCKED. The later direct user instruction accepts the inability to prove bitwise/logical equality: **ACCEPTED EXCEPTION — USER AUTHORIZED**. Original BASELINE_PRESERVATION stays **FAIL**, never PASS; no destructive restoration or baseline hash replacement is performed. See [authorization evidence](evidence/ai-demo-stability/20261005-1138-publication/accepted-exception.json).

Final `preservation-check-3.json` retains the same mismatch. Read-only offline inspection at07:42:26Z (`preservation-storage-impact.json`) identified nine post-baseline mtimes, all07:04:44–45, in control/WAL/transaction metadata/statistics/postmaster options; no base relation file appears in that mtime set. Logs show automatic recovery, an end-of-recovery checkpoint of two buffers and a shutdown checkpoint of zero buffers; offline state is shut down, latest checkpoint07:04:45Z/LSN0/4EEB3538. The read-only/network-none helper did not start PostgreSQL or issue SQL, and the hash remained unchanged by inspection. Without a per-file baseline or logical dump, these observations do not establish baseline data equality or harmlessness. The raw offline control output remains private; public evidence references its private record hash only.

## 13. Gate status, limitations and actual blockers

| Gate | Final recorded status | Reason / remaining work |
|---|---|---|
| RUNTIME_READINESS | READY at07:38:53.741Z | runtime-handoff: coreReady/aiReady=true, RAG READY, all six componentsUP, current16/16index; protected five-workflow hash equals prior lifecycle observation |
| BASELINE_PRESERVATION | FAIL; ACCEPTED EXCEPTION — USER AUTHORIZED | Original mismatch/equality uncertainty retained. The user accepts this discrepancy for checkpoint publication; original files/env/migrations/tags checks pass |
| DIAGNOSIS | Causal evidence established | Detailed source/reproductions and honest historical uncertainty retained |
| TECHNICAL_GATE | PASS for recorded candidate | Current lint/typecheck/test228/build/integration/security/privacy/source coverage PASS; earlier failures retained; final prepublication check separate |
| REC_REGRESSION | PASS for targeted protocol | Negative parser/schema and20livefirst-attempt outputs pass; accepted M15 alsoPASS; literal captured REC-01 unavailable |
| SUM_REGRESSION | PASS for affected protocol | Deterministic provenance/fact cases,20targeted and accepted M8 single-summary pass |
| EMB_RECOVERY | PASS for executed protocol | Deterministic realPG10tests, actual idle API lifecycle, live16/16/request retrieval/protected-state checks pass |
| AI_EVALUATION_GATE | PASS | M15 fresh100+30, all130first-attempt successes; accepted M8 summary1/1 and Copilot8/8; interrupted/setup outcomes retained |
| TARGETED_REGRESSION_GATE | PASS | Fresh20+20 first-attempt live executions,40attempts,0firstfailures; source-frozen |
| DEMO_REPEATABILITY_GATE | PASS | workflows-4 executed5/5,20first-attempt AiRuns, protected-state/role/source/facts/index checks; earlier failures retained |
| SOURCE_COVERAGE | PASS at07:24:54.735Z |195product/config files match tested builder/production identity; runner differences/normalized dataset proof recorded |
| INDEPENDENT_HUMAN_REVIEW | NOT RUN | No external authorized reviewer evidence |
| CHECKPOINT_PUBLICATION | READY / USER AUTHORIZED | Ordinary publication after source/staged diff/secret checks; actual result belongs to post-publication evidence |

No preservation closure blocker remains after the explicit user-authorized exception. Independent mandatory execution is complete; publication still requires actual staged checks, ordinary push, SHA equality and CLEAN verification. Known limits: exact historical recommendation payload and embedding exception unavailable; constrained generation/limited synthetic oracles do not prove general accuracy; controlled recovery clock/provider is separate from live inference; historical evidence is not fresh evaluation; concurrency and cold measurement limits are disclosed; final human review is absent. No V1.4/prod work has started.

## 14. Candidate/demo runtime, rollback and cleanup

Verification uses only `mobiflow-ai-stability-20261005`, private `verification.env`, root `docker-compose.yml`, loopback33800/33801/55427 and named `${project}_postgres_data`/`${project}_knowledge_data` volumes. Do not use generic compose/down/prune or remove shared/developer/demo volumes. The target ownership manifest must be checked before any fault/restart/cleanup. Preserve synthetic requests/corpus and raw failure evidence until verification is complete.

The existing demo33700 was not replaced by this repair; no candidate rollback of that demo is needed. Candidate rollback is selecting a verified prior API/Web image under this exact owned compose project, without resetting data or touching tags/models; capture current image IDs/data state before an actual rollback. Do not roll a synthetic database backward through migrations or use restart as the transient-recovery fix. Final handoff is recorded in runtime-handoff.json: candidate Web http://localhost:33800, API http://localhost:33801, project mobiflow-ai-stability-20261005, API image sha256:cd7c54c010101f7acf4b610277356cdd1e70cd8c5f95fac32d88d9bb80a53495, core/AI/RAG READY and16/16current index at07:38:53Z. Shared Ollama is not stopped/unloaded for fault injection. No verification volume cleanup has been authorized/performed by this execution.

## 15. Checkpoint closure/publication relation

[Checkpoint closure](AI_DEMO_STABILITY_CHECKPOINT_CLOSURE.md) records **READY FOR PUBLICATION WITH ACCEPTED EXCEPTION** at document freeze. The user authorized ordinary commit/push after accepting the documented preservation exception. The branch is symbolic here; the actual post-commit SHA, push result, local/remote equality, CLEAN state and CLOSED disposition belong to ignored publication evidence and final handoff. This avoids predicting outcomes or a self-SHA commit loop. A failed push remains COMMITTED=YES/PUSHED=NO until an actual verified push succeeds.

Pre-publication document snapshot: `COMMITTED=NO`, `PUSHED=NO`; actual statuses are established by publication evidence after these operations. `MERGED_MAIN=NO`, `NEW_TAG=NO`, `PRODUCTION_DEPLOYMENT=NOT_RUN`, `V1.4=NOT_STARTED`. Overall checkpoint closure is permitted with the explicit accepted exception only after actual source/staged checks, ordinary publication and clean/ref verification succeed.

Final `git-handoff.json` confirms local candidate HEAD is still the release baseline, the exact fix branch has no remote ref, main/tag refs remain unchanged and neither original nor agent index has staged paths. Original index content is preserved as unstaged; binary index bytes were not independently frozen. Final diff/path evidence and public snapshot hash checks are in `handoff-review.json`. Retained credentials live only in the ignored operator environment; use the existing local seed/account runbook rather than copying passwords into reports. The later direct user acceptance resolves the preservation closure blocker as an authorized exception, without proving equality. Actual publication uses the reviewed allowlist plus the explicit authorization record; main/tags and original work remain protected.
