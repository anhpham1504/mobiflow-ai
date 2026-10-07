# MOBIFLOW AI V1.3 — EVIDENCE DECISION REMEDIATION REPORT

## BASELINE

Branch: fix/v1.3-local-ai-demo-stability  
Start SHA: b3f39f6b858ef32b2aafef07ea99b1ab254ba583  
End SHA: b3f39f6b858ef32b2aafef07ea99b1ab254ba583  
Working tree at start: 21 dirty files; exact snapshots/diff retained before changes.  
Working tree at end: 30 dirty files; uncommitted; cached diff empty.  

## ROOT CAUSE

Current owner before fix: LLM, inside the sufficient/insufficient native union.  
Exact defect: both branches remained valid with a relevant SOP supplied; parser/publication checked self-consistency but no independent sufficiency decision.  
Why M15-061 selected wrong evidence branch: implementation allowed it. Hidden model rationale UNKNOWN; do not infer it from latency.  
Evidence supporting diagnosis: Phase 1 A–I audit; prior actual 8199 ms, one-attempt output; red regression 0 PASS/2 FAIL on the old implementation before production edits. No provider/timeout/parser/schema/reference failure in that captured run.  

## IMPLEMENTATION

Files changed:

- `apps/api/src/ai/prompts/recommendation.ts`
- `apps/api/src/ai/recommendation-evidence-decision.ts`
- `apps/api/src/ai/recommendation-output.ts`
- `apps/api/src/ai/recommendation-snapshot.ts`
- `apps/api/src/ai/recommendation.service.ts`
- `apps/api/src/requests/request-state-machine.service.ts`
- `apps/api/test/helpers/m15-reliability-fixture.mjs`
- `apps/api/test/helpers/recommendation-v2-fixture.mjs`
- `apps/api/test/recommendation-v2.integration.test.mjs`
- `apps/api/test/recommendation-v2.test.mjs`
- `docs/specs/AI_BEHAVIOR_SPEC.md`
- `docs/specs/RAG_SPEC.md`
- `docs/v1.3/EVIDENCE_DECISION_REMEDIATION_2026_10_06_VERIFICATION.md`
- `docs/v1.3/M24_DEMO_RUNBOOK.md`
- `docs/v1.3/evidence/EVIDENCE_DECISION_REMEDIATION_2026_10_06.json`
- `docs/verification/MILESTONE_24_VERIFICATION.md`
- `scripts/evaluation/m14-recommendation-evaluate.mjs`
- `scripts/evaluation/m15-prompt.test.mjs`
- `scripts/evaluation/m15-recommendation-evaluate.mjs`
Owner changed: pure recommendation-domain `decideRecommendationEvidence`, called before generation; independent generation and transactional publication guards.  
New/changed invariants: eligible live retrieval + positive applicable procedure scope/instruction; titles, IDs and similarity alone cannot establish authority. Select nearest eligible procedure with stable source-ID tie-break. Missing fields/candidates/SLA remain independent. Native format and both bounded attempts share one immutable decision. Recompute/check decision and output before any artifact invalidation/publication. Preserve all existing reference, warning, privacy, authorization and human-control rules.  
Public API changed: NO  
DB schema changed: NO  
Migration added: NO (13 retained)  
Model changed: NO  
Embedding changed: NO  
Dataset/oracle changed: NO  

## M15-061 BEFORE

Evidence status: INSUFFICIENT_EVIDENCE  
Action: REQUEST_USER_INFO  
Missing fields: location  
Procedure sources: empty despite supplied applicable MOBILE_NETWORK SOP, distance 0.2/score 0.8.  
Violation: EXPECTED_EVIDENCE_STATUS_MISMATCH  

## M15-061 AFTER

Evidence status: SUFFICIENT  
Action: REQUEST_USER_INFO  
Missing fields: location  
Procedure sources: KD-a1500003-0000-4000-8000-000000000002-G1-C0  
Violations: 0  
Targeted live: 3/3 PASS; 31619/25540/23572 ms; one attempt each, zero retries; third observed warm (resident=true/load 2.715 ms). First targeted cold status was not measured immediately before the call. Do not relabel it as a proven cold benchmark.  

## TARGETED TESTS

Evidence decision tests: T1–T14 plus negative applicability, irrelevant/wrong category, weak/unavailable/duplicate source, stable selection, immutable decision and repair context.  
Recommendation tests: 52 affected API tests PASS; 64 evaluation/schema/dataset/oracle tests PASS.  
Validator tests: mismatch both directions, invented/unselected source/candidate, incomplete question, forged/missing decision blocked.  
Legacy compatibility: V1 publication/approval and historical V2 read/review PASS on real PostgreSQL. Automated fixture reviews do not count as independent human review.  
M15-061 targeted: 3 live executions PASS, no mutation; evaluator correctly labels these PARTIAL, not a full M15 gate.  
PostgreSQL integration: 9 new checks targeted PASS, then complete scoped runbook gate 50 Node tests PASS (2 M2 + 38 M14 + 10 recovery; includes two parent tests).  

## STATIC GATES

Lint: PASS, max-warnings=0  
Typecheck: PASS  
Unit: PASS 247 (7 config + 154 API + 3 Web + 83 release/evaluation), zero failure/skip.  
Build: PASS API/Web. Standard build TLS download failure retained; private local build reused verified Prisma 7.10.0 schema engine, commit 0edf323efd1d98336f3f0a68684b56f689b900d3, SHA 29557c21d47da6f1695ec1a747cb6c607dade5e44e8b3e4fa687bd4dc226956d. Tracked Dockerfile/dependencies unchanged; no TLS bypass. 408 compiled API files match tested builder, serving API and native evaluator.  

## FULL M15

Evaluation cases: 100  
Consistency calls: 30  
Execution failures: 0  
Validation failures: 0  
Retries: 0  
Semantic violations: 0  
M15-061: PASS, 11853 ms, 1 provider attempt; supplied procedure remains bound, staff=null, MISSING_INFORMATION only  
Dataset SHA: d011105c106711cf7848e20d757099aa62c4152336fc2672a5e09719c01ba6e9  
Dataset unchanged: YES; dataset, loader, oracle, protected tests and public contract hashes retained  
Model digest unchanged: YES d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641  
Embedding digest unchanged: YES 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab  
Watched source hashes unchanged: YES 12 full-M15 source hashes plus 31 broader integrated source/config/spec files; exact compiled identity of 408 API files retained  
Latencies/cold-warm: {"modelRun":{"count":100,"minMs":8958,"maxMs":20091,"p50Ms":14636,"p95Ms":17764,"quantileMethod":"NEAREST_RANK"},"endToEndRun":{"count":100,"minMs":8960,"maxMs":20099,"p50Ms":14639,"p95Ms":17774,"quantileMethod":"NEAREST_RANK"},"firstAttempt":{"count":100,"minMs":8960,"maxMs":20099,"p50Ms":14639,"p95Ms":17774,"quantileMethod":"NEAREST_RANK"},"retryAttempt":{"count":0,"minMs":null,"maxMs":null,"p50Ms":null,"p95Ms":null,"quantileMethod":"NEAREST_RANK"},"allAttempts":{"count":100,"minMs":8960,"maxMs":20099,"p50Ms":14639,"p95Ms":17774,"quantileMethod":"NEAREST_RANK"},"providerInvocation":{"count":100,"minMs":8958,"maxMs":20091,"p50Ms":14636,"p95Ms":17764,"quantileMethod":"NEAREST_RANK"},"firstProviderInvocation":{"count":100,"minMs":8958,"maxMs":20091,"p50Ms":14636,"p95Ms":17764,"quantileMethod":"NEAREST_RANK"},"retryProviderInvocation":{"count":0,"minMs":null,"maxMs":null,"p50Ms":null,"p95Ms":null,"quantileMethod":"NEAREST_RANK"},"latencyGate":"NONE"}; cold/warm paired case: evaluation/M15-001-iot-gateway-offline/1: residentBefore=false, end-to-end=18665 ms, provider=18652 ms, load=5082.644 ms, tokens=779; consistency/M15-001-iot-gateway-offline/1: residentBefore=true, end-to-end=16011 ms, provider=16006 ms, load=12.543 ms, tokens=779; consistency/M15-001-iot-gateway-offline/2: residentBefore=true, end-to-end=15176 ms, provider=15170 ms, load=8.312 ms, tokens=779; consistency/M15-001-iot-gateway-offline/3: residentBefore=true, end-to-end=15693 ms, provider=15683 ms, load=7.055 ms, tokens=779; same input/format hashes retained. Observed latency is not an SLO or proof of a causal performance change.  

## OPERATIONAL

Runtime: READY, API33701/Web33700/PG55426 loopback, exact existing synthetic project mobiflow-v130-demo-20261005; HTTP200 API readiness and Web login  
RAG health: READY at handoff, 9 READY documents/12 same-identity chunks. Smoke-end cached health showed REQUEST_INDEX_INCOMPLETE during version updates; final read-only coverage is 49/49 and fresh RAG health READY without API restart. Exact intermediate completion time was not measured.  
Vectors: 49/49 current; 1024 dimensions; zero duplicate identity/context/input-version groups  
M8 Summary: PASS 1/1 first attempt, no repair, 18396 ms, fact/source/event-order validators hold  
M8 Copilot: PASS 8/8, all six actions, firstAttemptValid=8, no repair; p50=1388 ms/p95=8898 ms  
5 workflow smoke: PASS 5/5 full actual API/provider/PostgreSQL workflows; 24/25 first-attempt AI runs, 1 retry, 0 terminal failure; no-retry stability FAIL; MF-2026-000038 CLOSED v12/MET 110046 ms; MF-2026-000039 CLOSED v12/MET 42060 ms; MF-2026-000040 CLOSED v12/MET 42059 ms; MF-2026-000041 CLOSED v12/MET 45203 ms; MF-2026-000042 CLOSED v12/MET 46678 ms. Per-purpose timing and all HTTP outcomes retained.
Role path: USER create/intake → MANAGER advisory and separate predefined manual approval → STAFF work/info → USER information → STAFF resolution → USER close → MANAGER analytics. No human AI review fabricated.  

## SECURITY

RBAC: PASS within unchanged scoped real PostgreSQL negatives and actual smoke HTTP role checks  
Ownership: PASS within original scoped predicates and real unassigned-staff/public privacy negatives  
ExpectedVersion: PASS within scoped stale/race PostgreSQL checks and current-version smoke transitions  
AI tool write permissions: NONE; fixed READ_ONLY tools retained.  
Human control: protected business decisions remain explicit manager/staff/user commands; AI remains advisory.  
Invented IDs: NONE observed in full frozen M15, targeted validator/PG negatives or actual operational source checks  
Unauthorized sources: NONE observed within those tested scopes  
Privacy: PASS on final report/source/built-Web scan of 62 files, 8 actual credential variants, zero findings. Final formatting/evidence audits are retained separately at audit-final-after-format.json and privacy-final-after-format.json; hashes avoid circular self-reference. Raw synthetic/private operator artifacts remain ignored; no exhaustive secret-audit claim.  

## PRESERVATION

Developer baseline: independent pre-existing FAIL retained; no developer startup/DB connection/SQL/reset/migrate/reseed/volume mount by this remediation.  
Initiator: UNKNOWN (retained prior startup investigation).  
Current volume hash: not remeasured in this task; latest prior read-only observation f9df7d943ff4b409bc47e143d1faf09b18aef34269ae003008cded7a609ac220. Original baseline 752f0e551986ec86d68789e05462b751f0623c6ea5ca2d1383679a9ed26a3805 differs. Stable later hash does not prove original/logical preservation.  
Status: FAIL  
Accepted exception created by this task: NO  
Demo: original nine requests and ten table hashes/counts preserved; seven SLA rows retained with pre-existing seed hash discrepancy. A new 35-second read-only observation verifies canonical SLA monitor changes only in that interval; no original SLA byte-equality claim. Only separate demo/test DBs used.  
Existing work: all 21 starting dirty files saved exactly; unrelated dirty content and original checkout 26 files/69 artifacts/env preserved. Prior reports unchanged. Scoped overlaps documented in delta audit.  

## GIT

Commit created: NO  
Push: NO  
Merge: NO  
Tag: NO (v1.3.0 retained)  
Deploy: NO (local demo API/Web rebuilt; production NOT_RUN)  

## REMAINING BLOCKERS

- Real workflow Copilot GENERATE_CHECKLIST had one provider-reported length truncation rejected by the adapter before parser/public schema, then bounded repair succeeded. First-attempt stability FAIL: 24/25 runs,26 provider attempts,1 retry,0 terminal failures. Copilot/provider owners match task baseline; causality to the evidence-decision patch is NOT_PROVEN. No output/timeout increase or selective rerun was used.
- Developer baseline preservation remains independent FAIL; original baseline differs from the latest prior offline hash; later start initiator/logical/per-file preservation unproved. No developer DB access or new accepted exception in this task.
- Independent human review NOT_RUN. Native regex presentation enforcement is incomplete: retained M15-061 wording omits the longer assignment/start prefix while retaining manager approval; no permission/business-state bypass observed.
- Conservative documented V1 applicability grammar and frozen synthetic oracle are bounded. No general accuracy, production SLO, retrieval-ranking or exhaustive language-meaning certification.
- Exact evaluator interruption cause UNKNOWN; retain incomplete 100+2 run separately. Later host reboot is observed, without proof of the prior process exit cause.

## FINAL GATE

AI QUALITY: FAIL for full local demo first-attempt stability: retained Copilot truncation/retry; full frozen M15 and scoped M8 evaluations PASS separately  
FUNCTIONAL: PASS  
RUNTIME: READY  
DEVELOPER PRESERVATION: FAIL  
HUMAN REVIEW: NOT_RUN  
OVERALL: FAIL  

NEXT SAFE ACTION:
Review the uncommitted evidence-decision delta and perform independent human language review. For the separately observed Copilot truncation, audit its existing output-budget owner and add a real regression before any scoped V1.3 fix; do not raise the frozen token/timeout limits or weaken source validation. Developer preservation needs a separately authorized data-safe investigation with an appropriate historical baseline/backup. No automatic commit/merge/tag/production/V1.4.

Evidence, methods and retained failures:
[Sanitized evidence](evidence/EVIDENCE_DECISION_REMEDIATION_2026_10_06.json) records 123 artifacts with SHA256, exact argv/results, source/contract/config hashes and all retained successful/failed command evidence. Ignored evidence root: `artifacts/v130-evidence-decision-20261006`. Raw synthetic outputs and private env are not committed. Human review remains NOT_RUN.

The first full run is NOT_COMPLETED: 100 evaluation +2 consistency/102 successful attempts, zero recorded failures, no terminal summary or exit code. Last provider evidence 2026-10-06T04:58:27.443Z. Host reboot recorded 06Oct13:18:15 Asia/Saigon; exact prior evaluator exit cause UNKNOWN. Same accepted runtime/exact demo container IDs/images restored, with no reset/migration/seed or developer access. This complete replay uses a separate evidence/transport directory and all 100+30, not selective retry.

Retained setup failures: initial workspace-relative PDF fixture mismatch and five conservative-scope test-fixture failures; standard Prisma engine download TLS failure; offline helper newline assertion; three duplicate synthetic uploads rejected by existing uniqueness on first full integration; audit-helper literal/allowlist/status parsing errors; interrupted-run helper ECONNREFUSED while Ollama was stopped. Corrections and evidence are in [operator notes](../../artifacts/v130-evidence-decision-20261006/operator-notes.md). Original assertions/security gates were retained; no invalid live semantic result is discarded.  

Exact command evidence (UTC timestamps; local timezone Asia/Saigon is UTC+7):

| Started UTC | Exit | Elapsed ms | Command | Evidence |
|---|---:|---:|---|---|
| 2026-10-06T03:12:41.292Z | 1 | not captured | `node --test --test-name-pattern=M15-061 regression scripts/evaluation/m15-prompt.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/red.log) |
| 2026-10-06T03:28:16.767Z | 0 | 15491 | `docker build --target api-build -t mobiflow-v130-evidence-decision-20261006-builder -f docker/Dockerfile .` | [log](../../artifacts/v130-evidence-decision-20261006/builder-build.log) |
| 2026-10-06T03:28:55.664Z | 1 | 14315 | `docker run --rm --network none -w /app mobiflow-v130-evidence-decision-20261006-builder node --test scripts/evaluation/m15-prompt.test.mjs scripts/evaluation/m15-dataset.test.mjs scripts/evaluation/m15-evaluation.test.mjs apps/api/test/recommendation-v2.test.mjs apps/api/test/recommendation.test.mjs apps/api/test/knowledge.test.mjs apps/api/test/m15-reliability.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/targeted.log) |
| 2026-10-06T03:35:12.673Z | 0 | 13240 | `docker build --target api-build -t mobiflow-v130-evidence-decision-20261006-builder -f docker/Dockerfile .` | [log](../../artifacts/v130-evidence-decision-20261006/builder-build-attempt2.log) |
| 2026-10-06T03:37:41.687Z | 1 | 125312 | `docker build --target api-build -t mobiflow-v130-evidence-decision-20261006-builder -f docker/Dockerfile .` | [log](../../artifacts/v130-evidence-decision-20261006/builder-build-attempt3.log) |
| 2026-10-06T03:39:10.665Z | 0 | 1399 | `docker run --rm --network none -w /app mobiflow-v130-evidence-decision-20261006-builder node --test scripts/evaluation/m15-prompt.test.mjs scripts/evaluation/m15-dataset.test.mjs scripts/evaluation/m15-evaluation.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-evaluation.log) |
| 2026-10-06T03:39:12.066Z | 0 | 7953 | `docker run --rm --network none -w /app/apps/api mobiflow-v130-evidence-decision-20261006-builder node --test test/recommendation-v2.test.mjs test/recommendation.test.mjs test/knowledge.test.mjs test/m15-reliability.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-api.log) |
| 2026-10-06T03:42:13.643Z | 0 | 19637 | `docker build --target api-build -t mobiflow-v130-evidence-decision-20261006-builder -f artifacts/v130-evidence-decision-20261006/Dockerfile .` | [log](../../artifacts/v130-evidence-decision-20261006/builder-build-attempt4.log) |
| 2026-10-06T03:42:49.920Z | 0 | 1382 | `docker run --rm --network none -w /app mobiflow-v130-evidence-decision-20261006-builder node --test scripts/evaluation/m15-prompt.test.mjs scripts/evaluation/m15-dataset.test.mjs scripts/evaluation/m15-evaluation.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-evaluation-attempt2.log) |
| 2026-10-06T03:42:51.305Z | 0 | 7738 | `docker run --rm --network none -w /app/apps/api mobiflow-v130-evidence-decision-20261006-builder node --test test/recommendation-v2.test.mjs test/recommendation.test.mjs test/knowledge.test.mjs test/m15-reliability.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-api-attempt2.log) |
| 2026-10-06T03:43:06.424Z | 0 | 32318 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env scripts/evaluation/m15-recommendation-evaluate.mjs --evidence-root=artifacts/v130-evidence-decision-20261006/targeted-live-1 --case-ids=M15-061-triaged-no-candidate-missing --skip-consistency` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-live-1.log) |
| 2026-10-06T03:43:44.519Z | 0 | 26120 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env scripts/evaluation/m15-recommendation-evaluate.mjs --evidence-root=artifacts/v130-evidence-decision-20261006/targeted-live-2 --case-ids=M15-061-triaged-no-candidate-missing --skip-consistency` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-live-2.log) |
| 2026-10-06T03:45:14.076Z | 0 | 24129 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env --import=./artifacts/v130-evidence-decision-20261006/observe.mjs scripts/evaluation/m15-recommendation-evaluate.mjs --evidence-root=artifacts/v130-evidence-decision-20261006/targeted-live-3 --case-ids=M15-061-triaged-no-candidate-missing --skip-consistency` | [log](../../artifacts/v130-evidence-decision-20261006/targeted-live-3.log) |
| 2026-10-06T03:46:37.174Z | 0 | 9118 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m14.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test --test-name-pattern=V1.3 real PostgreSQL evidence decision apps/api/test/recommendation-v2.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/evidence-decision-postgres.log) |
| 2026-10-06T03:47:12.057Z | 0 | 3095 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m2.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test --test-name-pattern=M6 real PostgreSQL tools\|M6 .*validation\|M8 Copilot apps/api/test/recommendation.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/m2-integration.log) |
| 2026-10-06T03:47:15.351Z | 1 | 29366 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m14.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test apps/api/test/recommendation-v2.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/m14-integration.log) |
| 2026-10-06T03:48:56.932Z | 0 | 10971 | `docker build --target api-build -t mobiflow-v130-evidence-decision-20261006-builder -f artifacts/v130-evidence-decision-20261006/Dockerfile .` | [log](../../artifacts/v130-evidence-decision-20261006/builder-build-attempt5.log) |
| 2026-10-06T03:49:59.626Z | 0 | 9011 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m14.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test --test-name-pattern=V1.3 real PostgreSQL evidence decision apps/api/test/recommendation-v2.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/evidence-decision-postgres-attempt2.log) |
| 2026-10-06T03:50:09.330Z | 0 | 2902 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m2.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test --test-name-pattern=M6 real PostgreSQL tools\|M6 .*validation\|M8 Copilot apps/api/test/recommendation.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/m2-integration-attempt2.log) |
| 2026-10-06T03:50:12.443Z | 0 | 29985 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m14.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test apps/api/test/recommendation-v2.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/m14-integration-attempt2.log) |
| 2026-10-06T03:50:42.610Z | 0 | 1197 | `docker run --rm --network container:7639217d1e3383693fbf37d8ea0ff479700cecc804c1da19d9038a7be94cfb1e --env-file artifacts/v130-evidence-decision-20261006/m2.env -e EVIDENCE_DECISION_DATABASE_PATH=/app/docs/evidence-decision-postgres.json --mount type=bind,source=C:\Users\AnhPhamPC\.codex\worktrees\v130-stability-followup\MobiFlow AI\artifacts\v130-evidence-decision-20261006\integration-output,target=/app/docs -w /app mobiflow-v130-evidence-decision-20261006-builder node --test apps/api/test/ai-stability.integration.test.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/recovery-integration.log) |
| 2026-10-06T03:51:02.107Z | 0 | 10252 | `docker run --rm --network none -w /app mobiflow-v130-evidence-decision-20261006-builder npm run lint` | [log](../../artifacts/v130-evidence-decision-20261006/lint.log) |
| 2026-10-06T03:51:12.363Z | 0 | 11826 | `docker run --rm --network none -w /app mobiflow-v130-evidence-decision-20261006-builder npm run typecheck` | [log](../../artifacts/v130-evidence-decision-20261006/typecheck.log) |
| 2026-10-06T03:51:24.191Z | 0 | 18496 | `docker run --rm --network none -w /app mobiflow-v130-evidence-decision-20261006-builder npm run test` | [log](../../artifacts/v130-evidence-decision-20261006/test.log) |
| 2026-10-06T03:52:00.485Z | 0 | 378 | `docker compose --env-file artifacts/v130-evidence-decision-20261006/demo.env -p mobiflow-v130-demo-20261005 -f docker-compose.yml config --quiet` | [log](../../artifacts/v130-evidence-decision-20261006/compose-config.log) |
| 2026-10-06T03:52:00.866Z | 0 | 15559 | `docker compose --env-file artifacts/v130-evidence-decision-20261006/demo.env -p mobiflow-v130-demo-20261005 -f docker-compose.yml -f artifacts/v130-evidence-decision-20261006/build-override.yml build api web` | [log](../../artifacts/v130-evidence-decision-20261006/api-web-build.log) |
| 2026-10-06T03:52:57.331Z | 0 | 7378 | `docker compose --env-file artifacts/v130-evidence-decision-20261006/demo.env -p mobiflow-v130-demo-20261005 -f docker-compose.yml up -d --no-deps --wait api web` | [log](../../artifacts/v130-evidence-decision-20261006/api-web-start.log) |
| 2026-10-06T06:23:08.659Z | 0 | 1917810 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env --import=./artifacts/v130-evidence-decision-20261006/observe.mjs scripts/evaluation/m15-recommendation-evaluate.mjs --evidence-root=artifacts/v130-evidence-decision-20261006/m15-replay-after-interruption` | [log](../../artifacts/v130-evidence-decision-20261006/m15-full-attempt2.log) |
| 2026-10-06T07:01:04.872Z | 0 | 23430 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env --import=./artifacts/v130-evidence-decision-20261006/observe.mjs scripts/evaluation/m8-summary-evaluate.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/m8-summary-evaluation.log) |
| 2026-10-06T07:01:28.306Z | 0 | 22346 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env --import=./artifacts/v130-evidence-decision-20261006/observe.mjs scripts/evaluation/m8-copilot-evaluate.mjs` | [log](../../artifacts/v130-evidence-decision-20261006/m8-copilot-evaluation.log) |
| 2026-10-06T07:07:38.969Z | 0 | 287022 | `node --env-file=artifacts/v130-evidence-decision-20261006/demo.env artifacts/v130-evidence-decision-20261006/smoke.mjs --batch=smoke-final` | [log](../../artifacts/v130-evidence-decision-20261006/smoke-final.log) |

All five complete workflow outcomes:

| Round | Synthetic request | End state | SLA | Workflow ms | AI runs | Retry | Human review |
|---:|---|---|---|---:|---:|---:|---|
| 1 | MF-2026-000038 | CLOSED v12 | MET | 110046 | 9 | 1 | NOT_RUN |
| 2 | MF-2026-000039 | CLOSED v12 | MET | 42060 | 4 | 0 | NOT_RUN |
| 3 | MF-2026-000040 | CLOSED v12 | MET | 42059 | 4 | 0 | NOT_RUN |
| 4 | MF-2026-000041 | CLOSED v12 | MET | 45203 | 4 | 0 | NOT_RUN |
| 5 | MF-2026-000042 | CLOSED v12 | MET | 46678 | 4 | 0 | NOT_RUN |

AI run latencies by purpose (ms): `{"ANALYSIS":{"n":5,"min":6402,"p50":6534,"p95":11449,"max":11449,"unit":"ms"},"COPILOT":{"n":10,"min":1595,"p50":5798,"p95":32602,"max":32602,"unit":"ms"},"RECOMMENDATION":{"n":5,"min":14896,"p50":17679,"p95":18764,"max":18764,"unit":"ms"},"RESOLUTION_SUMMARY":{"n":5,"min":9180,"p50":9377,"p95":9443,"max":9443,"unit":"ms"}}`. All 398 HTTP outcomes matched their expected status, including 35 authorization/privacy/stale negatives. Full run start/end timestamps and elapsed time are retained in the M15 manifest/summary and command evidence.  

Limits: M15 is a frozen synthetic, bounded semantic oracle, not exhaustive entailment, retrieval-ranking benchmark or production accuracy. Conservative V1 applicability grammar may reject unsupported wording; model language is constrained by native format and validators. Five live smokes are functional stability checks, not a replacement for quality evaluation. Default Ollama discovery/CUDA fallback root cause remains UNKNOWN from the previous task; this task keeps the accepted process-local Vulkan runtime. No V1.4 or production work began.  

Retained presentation limit: the actual full M15-061 action text conditions the suggestion on manager approval but omits the longer exact native prefix naming assignment/start. The public parser and frozen semantic oracle accept it; no actor invention, executed-business claim or permission/state-machine bypass was observed. Do not claim that the provider enforces every native regex or that this synthetic gate replaces independent language review. See the retained native-presentation-observation.md evidence.  

Runtime/configuration and exact measured environment:
Ollama 0.35.0; Qwen qwen3:4b-instruct-2507-q4_K_M / d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641; BGE bge-m3:latest / 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab; dimension1024/revisionm5.v1/identity a6cd9ebb83b4c9c07a14cb63e4cbef8789a7dabd3257d35cbed412ead4b621d9. Temperature0, seed42, context16384, output1200, attempt120000 ms, run300000 ms, max2 attempts; RAG_TOP_K=5, RAG_MAX_DISTANCE=0.50, context chars=6000. Accepted process-only Vulkan profile restored unchanged after host reboot, no driver/global environment change. Win11 Pro26200, i7-13650HX14 cores/20 logical, 24952696 KiB memory, RTX4060 Laptop8GiB, driver616.92. Node24.19.0, npm workspaces, PostgreSQL/pgvector 0.8.6. Timestamped backend/residency/GPU observations are separate from response timing and do not determine hidden model reasoning.
