# M10 release checklist

Date: 2026-09-30. Current branch `fix/m10-evaluation-stability`; completed M10 baseline `584bd984b1769065479c5904a42bd6cb06411b85`; approved M9 evaluation baseline `c0e7c9520ae4172b28415b609f8e66191d906803` (`v0.9.0-m9`). Historical BLOCKED results remain preserved; this checklist records the current V1 gate.

| Gate | Actual result | Evidence |
|---|---|---|
| Scope/branch | PASS; evaluation stability and V1 finalization only; no M11 | Git review and `V1_FINAL_GATE.json` |
| Competition package | PASS; all eight canonical files | `docs/demo/COMPETITION_SUBMISSION.md` index |
| Runbook/audits | PASS; local runbook, security and AI-safety audits written | `docs/demo/DEMO_RUNBOOK.md`, final audits |
| Lint/typecheck | PASS; fresh | `M10_V1_LINT.json`, `M10_V1_RELEASE_LINT.json`, `M10_V1_TYPECHECK.json` |
| Unit | PASS; fresh config 7, API 43, web 1, release tooling 19 | `M10_V1_UNIT.json` |
| Build | PASS; fresh normal production build, 17 static pages | `M10_V1_BUILD.json`; inherited-development-env failure retained |
| Database | PASS; fresh validate/deploy, six before/six after, no new/changed migration | `M10_V1_DB_VALIDATE.json`, `M10_V1_DB_MIGRATE.json`, migration diff |
| Seed/reset | PASS; guarded real reset and exact synthetic target/state | `V1_RESET_TARGET.json`, `V1_RESET.json`, `M10_V1_RESET.json` |
| Integration | PASS; inherited unchanged M10 production/config/test evidence, not rerun | `M10_INTEGRATION_FINAL.json`, `M10_INTEGRATION_SEED.json`, `V1_FINAL_GATE.json` |
| M3–M9 browser | PASS; retained actual post-hardening reports, M4 actual offline then recovery/online | `M10_FINAL_VERIFICATION.json` browser section |
| M10 browser | PASS 3/3; Axe/keyboard/responsive/degraded/retry | `M10_E2E.json`, retained browser summary |
| Preflight/warmup/ready | PASS; fresh real model/vector operations; no warmup business mutation | `V1_PREFLIGHT.json`, `V1_WARMUP.json`, `M10_V1_DEMO_READY.json` |
| LLM/embedding outage | PASS; bounded explicit failure, manual path/core/SLA intact | `M10_RUNTIME_OUTAGE.json`, `M8_RUNTIME_OFFLINE.json` |
| Recovery/replay | PASS; M4 recovery and DB lease/replay/late-publication tests | Browser and integration evidence |
| Docker/current dashboard | PASS; fresh images, three healthy services, HTTP 200/200, final V1 snapshot | `M10_V1_DOCKER_BUILD.json`, `M10_V1_DOCKER_START.json`, `V1_DOCKER.json` |
| Graceful shutdown | PASS; idle SIGTERM completed in 1,110 ms, exit 0 | `M10_GRACEFUL_SHUTDOWN.json` |
| M8/M9/M10 security | PASS; fresh scans, no unreviewed secret findings | `V1_SECURITY_M8.json`, `V1_SECURITY_M9.json`, `V1_SECURITY_M10.json` |
| Production dependencies | PASS; fresh audit, zero vulnerabilities | `M10_V1_DEPENDENCY_AUDIT.json` |
| Priority stability | PASS; normal-06 and incomplete-06 MEDIUM 5/5 each | `V1_PRIORITY_STABILITY.json` |
| Live 100-case evaluation | PASS; exactly one final attempt, unchanged comparator exit 0, zero flags | `V1_AI_EVALUATION.json`, `V1_EVAL_REGRESSION.json`, `V1_EVAL_COMPLETION.json` |
| Final diff | PASS; no production/config/lockfile change, secret finding or migration change | `V1_FINAL_GATE.json` |

All JSON paths above are under `docs/verification/evidence/`. Retained integration, outage/recovery and browser reports keep their original timestamps and are explicitly marked `reexecuted: false`; production/config/lockfile behavior is unchanged from the completed M10 snapshot. Historical RED runs and failed attempts in `iterations/` remain review evidence.

Final V1 snapshot: six users, eight requests, 39 histories, six assignments, three resolutions, two feedback rows, eight notifications, zero AI runs, eight real request embeddings, nine READY documents and 12 chunks. Warmup and bound vector retrieval pass with business mutation NONE. Docker analytics serves final run `6d080973-d92f-4ed2-9e7d-d5e071e609a4`.

Previous blocker: the isolated historical run lost exact priority agreement on normal-06/incomplete-06 and exceeded the unchanged per-case 1.5× latency boundary on 83/100 cases. No production inference change was found. See [investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md).

Correction and controlled run: evaluation-only instrumentation closed the identity/timing/protocol evidence gap before live work; no production behavior, label, threshold or comparator changed. The predeclared targets were MEDIUM 5/5 each. The one guarded full run produced 68 exact, 100 schema-valid, 99 first-attempt valid, one repair, zero terminal failures and 2728.38/2653/3085/6681 ms mean/p50/p95/max. The original comparator returned exit 0 with zero pass-to-fail, fail-to-pass or latency flags. Protected files are unchanged from remediation baseline `584bd984`; the preexisting M10 regeneration of `M9_SECURITY_SCAN.json` relative to the M9 tag is disclosed in final evidence.

NOT RUN: any additional 100-case confirmation, manual operator time benchmark, new video recording, independent penetration test, full fresh Internet-disconnection rehearsal. None is represented as passed. Synthetic exact agreement is not generalized accuracy; process-local scheduling, hardware-sensitive latency and local/demo scope remain explicit limitations.

**FINAL GATE: PASS.** The previous blocker is resolved by complete controlled evidence that passes the unchanged authoritative comparator. Release integration/tagging is authorized by the task only after a clean remediation commit and final Git review. No M11 implementation.
