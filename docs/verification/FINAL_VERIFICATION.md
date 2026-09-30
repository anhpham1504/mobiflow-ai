# Final V1 verification — M10

Date: 2026-09-30, Asia/Saigon. **FINAL GATE: PASS.** No M11 implementation started.

Release continuation branch `fix/m10-evaluation-stability`; completed M10 baseline `584bd984b1769065479c5904a42bd6cb06411b85`; approved M9 evaluation baseline `c0e7c9520ae4172b28415b609f8e66191d906803` (`v0.9.0-m9`). Historical M10 RED evidence remains retained. The final section records the authorized controlled rerun and current release decision.

## Environment and configuration

Windows host, Node 24.19.0, npm 11.17.0, Docker 29.6.2, Compose v5.3.1; pgvector 0.8.6 with PostgreSQL 17 image. Next.js 16.3.6, NestJS application and Prisma 7.10.0 use the existing npm workspace lockfile. Browser checks use installed Microsoft Edge through Playwright. Actual storage/capability/version checks are retained in `evidence/M10_PREFLIGHT.json`.

Host Ollama CLI observed as 0.34.4. Exact LLM `qwen3:4b-instruct-2507-q4_K_M`; embedding `bge-m3:latest`, actually probed dimension 1024. Native provider origin `http://localhost:11434`; Compose origin `http://host.docker.internal:11434`. Structured-output/retry/sampling contract remains unchanged from M9. Current installed digests and dashboard snapshot identity are recorded in `evidence/M10_DOCKER.json`; historical unrecorded runtime metadata is not inferred.

## Engineering gates

| Gate | Actual evidence |
|---|---|
| Lint/typecheck | PASS: `M10_LINT.json`, `M10_TYPECHECK.json` |
| Unit | PASS: config 7, API 43, web 1, release tooling 5; `M10_UNIT.json` |
| Build | PASS: normal root production build; `M10_BUILD.json` |
| Integration | PASS all database groups; final recommendation/operational/analytics group 33/33; `M10_INTEGRATION_FINAL.json` |
| Clean seed | PASS six migrations, seed twice, history/notifications/SLA/current similarity fixture/least privilege; `M10_INTEGRATION_SEED.json` |
| Browser | M3 2/2; M4 offline 1/1 and online/recovery 2/2; M5–M9 each 1/1; M10 3/3. Timestamps/counts are retained in `M10_FINAL_VERIFICATION.json` |
| Security/AI boundaries | PASS tested invariants; [security audit](SECURITY_AUDIT.md) and [AI-safety audit](AI_SAFETY_AUDIT.md) |
| Dependency audit | PASS, zero production vulnerabilities; `M10_DEPENDENCY_AUDIT.json` |
| Migrations | 6 before / 6 after; no new migration or historical change; Git diff and recorded SHA-256 values |
| Preflight/warmup/ready/reset | PASS actual operations; separate runtime readiness and release result |
| LLM/embedding outage | PASS fresh bounded failure/manual/core/SLA checks, plus retained actual M4 outage/recovery browser evidence |
| Docker/dashboard/final baseline | PASS: postgres/API/web healthy, HTTP 200/200, isolated M10 snapshot `4f2e9f8b-f736-4623-bee0-1042beb23e1f`; `M10_DOCKER.json` |
| Graceful shutdown | PASS: idle SIGTERM→complete in 1,110 ms, exit 0; `M10_GRACEFUL_SHUTDOWN.json` |
| Final diff | PASS: reviewed tracked and untracked M10 source/docs/evidence, whitespace and migration freeze; 17 document link checks with no missing target |

M10 UX evidence covers the programmatically focusable skip target, active navigation, recoverable analytics error, valid degraded-health fixture, corrected footer contrast, 360/768/1440 overflow checks and zero Axe A/AA violations on the tested manager page. The intake reference metric displays “Không áp dụng” for its null applicability/rate; M9/M10 browser checks and production builds were repeated after this final display correction. No rule was disabled. Expected network failure in the retry scenario is distinguished from unexpected browser errors. The corrected M7 test uses the actual human-approved eligible assignee.

The full continuation database runner completed in 221,531 ms; its final group in 175,429.8798 ms. Live R1–R8 succeeded. The earlier M10 run's R5 terminal AI_TIMEOUT after two attempts and R1 repair remain documented and retained in iterations. A passing suite is not a guarantee that every earlier live model request succeeded.

Final restored demo snapshot at `2026-09-29T17:37:31.759Z`: six users, eight requests, 39 status histories, six assignments, three resolutions, two feedback rows, eight notifications, zero AI runs, eight real request embeddings, nine READY knowledge documents and 12 chunks. Six migration names are unchanged. The final reset removed synthetic browser test rows, preserved storage and completed before the last non-destructive `demo:ready`. Warmup measured LLM 4,785 ms and embedding 2,991 ms, with no business mutation. These lightweight probe timings are not the 100-case evaluation latency.

Graceful shutdown was tested at idle; it is not an in-flight termination stress benchmark. Durable lease/replay/late-publication behavior is verified separately in integration. Final application behavior did not change after the final Docker build; later changes are verification tooling/documentation only.

## Historical live AI/RAG release decision

| Run | Exact agreement | Final schema / first / repaired / terminal | Mean / p50 / p95 / max ms |
|---|---|---|---|
| Approved M9 | 68/100 | 100 / 99 / 1 / 0 | 2774.87 / 2704 / 3116 / 6597 |
| M10 contended | 68/100 | 100 / 99 / 1 / 0 | 4942.51 / 4786 / 5621 / 11023 |
| M10 isolated | 69/100 | 100 / 99 / 1 / 0 | 4441.65 / 4377 / 5147 / 9386 |

Dataset `requests.m9.v2`, SHA-256 `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`; model `qwen3:4b-instruct-2507-q4_K_M`; prompt/schema `request-analysis.v4` / `analysis.v1`. Third run NOT RUN under the bounded investigation policy.

At that historical checkpoint, both raw comparisons remained RED. Isolation left two priority pass→fail cases (normal-06/incomplete-06), three fail→pass cases (M9-065/075/085), 83 per-case latency flags, zero increased repairs and no new terminal/schema failure category. Inference/evaluation sources and recorded contract were unchanged; one inter-M10 label variation was observed. Remaining latency attribution was unproven. [Full investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md) preserves why stable-demo release readiness was blocked without changing the comparison semantics.

The first 2026-09-30 blocker-only continuation added evaluation-only observation, not a production fix. It verified 62 source hashes/all labels; each priority target returned MEDIUM 5/5. The fixed warm 10-case sample measured 2638.7/2566/2928 ms mean/p50/p95, with mean generation 2543.087 ms, load 2.661 ms and validation/completion .076 ms. All 20 diagnostic calls were first-attempt schema-valid; disagreements elsewhere in the sample remain visible. Fresh runtime/worker isolation is recorded, not claimed to prove the earlier isolated run invalid. At that checkpoint no further full evaluation was justified or executed. The unchanged comparator recheck exited 1; nine prior evaluation/M9 evidence files remained byte-identical. `M10_EVAL_DIAG_*` records focused tests 6/6 plus lint/typecheck/build PASS; prior unrelated gates were not rerun. API/web were restored after measurement. See the investigation and `M10_EVAL_COMPARATOR_RECHECK.json` for that historical BLOCKED decision.

Real RAG remains separately verified by the clean-DB PDF/TXT upload→bge-m3→pgvector→Ollama citation test, M5/M6/M8 browser/live evidence and final warmup vector retrieval. The final corpus is nine READY documents/12 embedded chunks. No new Hit@k or reference-accuracy metric is invented from the intake evaluation. Prior M5 retrieval metrics retain their original methodology/date.

## Package and evidence review

All eight exact canonical competition files exist under `docs/demo`; [submission index](../demo/COMPETITION_SUBMISSION.md) links them. The [runbook](../demo/DEMO_RUNBOOK.md), [release checklist](../release/M10_RELEASE_CHECKLIST.md), [M10 verification](MILESTONE_10_VERIFICATION.md), security and AI-safety audits form the operational handoff.

`evidence/M10_FINAL_VERIFICATION.json` consolidates actual commands/logs, original browser timestamps, source digest, migration freeze, final runtime counts and the explicit BLOCKED decision. Retained failed attempts and replaced reports in `evidence/iterations/` are intentional review evidence. Build output, generated Prisma artifacts, browser screenshots/traces, uploads, models, private `.env` and database dumps are not release source additions.

Known limitations: synthetic development labels/metrics, no generalized accuracy or semantic-ground-truth assertion, unperformed manual time benchmark, no productivity/ROI claim, process-local scheduler, no distributed exactly-once guarantee, host-sensitive AI latency and local/demo rather than enterprise-scale deployment. Fresh full Internet-disconnection rehearsal, video recording and external penetration test are NOT RUN.

**Historical M10 decision: BLOCKED.** It remains here to preserve the exact state that triggered the V1 remediation.

## V1 controlled continuation and final decision

The release continuation changed only evaluation/verification tooling and documentation. It froze protocol `a2358fbddea4cf10e692e1a694929304d3deb90ea2cff85b71ceefddc554da51`, added identity/environment/provider timing capture and an exclusive one-attempt guard, and kept the production contract, dataset, labels and comparator unchanged. The previous two target regressions were investigated before the full run; `normal-06` and `incomplete-06` each returned the expected MEDIUM priority 5/5.

The one authorized final run (`6d080973-d92f-4ed2-9e7d-d5e071e609a4`) completed all 100 ordered synthetic cases: exact 68, schema-valid 100, first-attempt valid 99, repaired 1, terminal failures 0, mean 2728.38 ms, p50 2653 ms, p95 3085 ms and max 6681 ms. The unchanged `scripts/evaluation/m9-compare.mjs` returned exit 0 with no pass-to-fail, fail-to-pass, latency or other flags. All identities match the installed digest, provider metadata is complete, the journal is complete, and protected files are byte-identical to remediation baseline `584bd984`.

Fresh lint/typecheck/unit/build/database/dependency/security/demo/Docker checks pass. Production/config/lockfile files and all six migrations are unchanged from the completed M10 snapshot. Therefore the still-applicable M10 database integration, outage/recovery and browser results are inherited with their original dates; `V1_FINAL_GATE.json` records that they were not rerun or relabeled. The restored demo has six users, eight requests, 39 histories, six assignments, three resolutions, two feedback rows, eight notifications, zero AI runs, eight request embeddings, nine READY documents and 12 chunks; all three containers are healthy and API/web return HTTP 200.

The earlier RED runs are not deleted or called invalid. M10 had already regenerated `M9_SECURITY_SCAN.json` relative to the M9 tag before the remediation baseline; the V1 work preserves the baseline copy and records both hashes rather than silently restoring it. The unresolved historical mechanism, synthetic-label limitations, host-sensitive latency, lack of a new manual productivity benchmark, process-local scheduling, local/demo scope and absence of an external penetration test remain disclosed. These are limitations, not current canonical release blockers.

**STOPPED AFTER V1 FINALIZATION: YES. FINAL GATE: PASS. M11 IMPLEMENTATION STARTED: NO.**
