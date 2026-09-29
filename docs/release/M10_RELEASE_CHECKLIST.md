# M10 release checklist

Date: 2026-09-30. Branch `feat/m10-release-hardening`; approved baseline and pre-finalization HEAD `c0e7c9520ae4172b28415b609f8e66191d906803` (`v0.9.0-m9`). Git finalization is limited to a branch snapshot and does not approve release.

| Gate | Actual result | Evidence |
|---|---|---|
| Scope/branch | PASS; M10 only; blocked snapshot commit/push authorized separately; no release tag/merge | Git review and M10 verification |
| Competition package | PASS; all eight canonical files | `docs/demo/COMPETITION_SUBMISSION.md` index |
| Runbook/audits | PASS; local runbook, security and AI-safety audits written | `docs/demo/DEMO_RUNBOOK.md`, final audits |
| Lint/typecheck | PASS | `M10_LINT.json`, `M10_TYPECHECK.json` |
| Unit | PASS; config 7, API 43, web 1, release tooling 5 | `M10_UNIT.json` |
| Build | PASS; normal production build, 17 static pages | `M10_BUILD.json`; failed development-env wrapper attempt retained |
| Database | PASS; validate/deploy, six before/six after, no new/changed migration | `M10_DB_VALIDATE.json`, `M10_DB_MIGRATE.json`, migration hashes/diff |
| Seed/reset | PASS; seed twice, history/notifications/chronology/SLA checks, guarded real reset | `M10_INTEGRATION_SEED.json`, `M10_RESET.json` |
| Integration | PASS all groups; final group 33/33, live R1–R8 successful in continuation | `M10_INTEGRATION_FINAL.json`; earlier R5 timeout retained |
| M3–M9 browser | PASS; retained actual post-hardening reports, M4 actual offline then recovery/online | `M10_FINAL_VERIFICATION.json` browser section |
| M10 browser | PASS 3/3; Axe/keyboard/responsive/degraded/retry | `M10_E2E.json`, retained browser summary |
| Preflight/warmup/ready | PASS; real model/vector operations; no warmup business mutation | `M10_PREFLIGHT.json`, `M10_WARMUP.json`, `M10_DEMO_READY.json` |
| LLM/embedding outage | PASS; bounded explicit failure, manual path/core/SLA intact | `M10_RUNTIME_OUTAGE.json`, `M8_RUNTIME_OFFLINE.json` |
| Recovery/replay | PASS; M4 recovery and DB lease/replay/late-publication tests | Browser and integration evidence |
| Docker/current dashboard | PASS; three healthy services, HTTP 200/200, latest isolated M10 snapshot | `M10_DOCKER.json` |
| Graceful shutdown | PASS; idle SIGTERM completed in 1,110 ms, exit 0 | `M10_GRACEFUL_SHUTDOWN.json` |
| M8/M9/M10 security | PASS; no unreviewed secret findings; invariants and six hashes intact | `M8_SECURITY_SCAN.json`, `M9_SECURITY_SCAN.json`, `M10_ADVERSARIAL.json` |
| Production dependencies | PASS; zero vulnerabilities | `M10_DEPENDENCY_AUDIT.json` |
| Live 100-case evaluation | Runner completed; comparison **BLOCKED** | `M10_EVAL_RESULT.json`, `M10_EVAL_REGRESSION.json` |
| Final diff | PASS; M10-only source/docs/evidence, no private env/build artifacts/historical migration change | `M10_FINAL_VERIFICATION.json` |

All JSON paths above are under `docs/verification/evidence/`. Retained browser reports have original timestamps; they are not claimed to have been rerun merely because a summary was regenerated. Later seed changes were verified by the full database suite and focused M10 seed checks. Browser checks affected by staff workload/demo restoration are repeated; unrelated prior browser evidence is retained.

Final snapshot at `2026-09-29T17:37:31.759Z`: six users, eight requests, 39 histories, six assignments, three resolutions, two feedback rows, eight notifications, zero AI runs, eight real request embeddings, nine READY documents and 12 chunks. Warmup: LLM 4,785 ms, embedding 2,991 ms; business mutation NONE. Docker analytics serves isolated run `4f2e9f8b-f736-4623-bee0-1042beb23e1f`, not the obsolete M9 snapshot.

Release blocker: the isolated run still loses exact priority agreement on normal-06/incomplete-06 and exceeds the unchanged per-case 1.5× latency boundary on 83/100 cases. No M10 inference source change was found, but the remaining performance gap is not explained by measured runtime telemetry. See [investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md).

Blocker-only continuation: contract/dataset audit PASS; targets MEDIUM 5/5 each; fixed 10-case warm mean/p50/p95 2638.7/2566/2928 ms. These current diagnostics do not establish the historical cause or a corrective intervention. Original comparator recheck: exit 1, 85 flags (2 priority + 83 latency); nine prior evaluation/M9 evidence files unchanged. Instrumentation-focused tests 6/6, lint/typecheck/build PASS (`M10_EVAL_DIAG_*`); unrelated gates retained rather than repeated. No production behavior, label, threshold or comparator change. Remaining full-run budget unused; release stays BLOCKED.

NOT RUN: third 100-case confirmation, manual operator time benchmark, new video recording, independent penetration test, full fresh Internet-disconnection rehearsal. None is represented as passed. Synthetic exact agreement is not generalized accuracy; process-local scheduling and local/demo scope remain explicit limitations.

**FINAL GATE: BLOCKED.** A branch push preserves this snapshot only. No release tag, merge or M11 implementation. Runtime readiness does not override this gate.
