# Milestone 10 Verification

Verification date: 2026-09-30 (Asia/Saigon; evidence timestamps use UTC).
Current continuation branch: `fix/m10-evaluation-stability`, based on completed M10 snapshot `584bd984b1769065479c5904a42bd6cb06411b85`.
The original M10 report and its BLOCKED decision are retained below as historical evidence. The authorized V1 release continuation at the end of this document is the current gate decision.

## Scope implemented

Release preflight, safe synthetic reset, real LLM/embedding/vector warmup, non-destructive demo-ready orchestration, richer coherent demo history, configuration/browser/container hardening, graceful shutdown, UI accessibility/responsiveness fixes, security/AI-safety audits and all eight canonical competition documents. Existing M9 work was preserved; no later milestone was started.

## Files/modules changed

- `scripts/demo`: release guards/checks, seed history, preflight/reset/warmup/ready and refusal/timeout tests; `scripts/dev/seed.mjs` delegates to the shared idempotent seed.
- `scripts/verification`: M10 seed/adversarial/evaluation/shutdown/final evidence checks, sanitized capture with retained iterations.
- `packages/config`: secret placeholder/entropy validation with key-only diagnostics and tests.
- API bootstrap: security headers/Swagger description and bounded signal shutdown; no business route/AI behavior change.
- Web shell/layout/styles, request empty states, analytics retry, M7 dynamic approved-assignee test, M10 Playwright/Axe tests.
- Compose app service restrictions, root scripts and development-only `@axe-core/playwright@4.13.0` with compatible Playwright peer dependency. Existing axe-core is reused; production dependency graph is not expanded by this tool.
- README, implementation status, release/runbook/audits/evaluation investigation and the eight `docs/demo` competition files.

## Database changes

Six migrations before, six after. No M10 migration; historical migration SQL is unchanged from `v0.9.0-m9` and its hashes are recorded in `M10_ADVERSARIAL.json`.

Seed has six users, four teams, five skills, five memberships, seven staff skills, four policies and eight requests. Clean seed twice produces 39 histories, six assignments, three resolutions, two feedback rows and eight notifications, without fabricated vectors. Tests assert no future history, current status/version aligned with final history, resolved SLA MET/hold consistency, and two related IoT cases inside 30 minutes of reference time. A subsequent real reset generates eight bge-m3 request embeddings. Seed records its reference time; repeated seed preserves history. Runtime audit UPDATE is denied.

Reset refuses an active API, missing exact marker, non-demo/non-loopback/non-allowlisted target, mismatched owner/runtime target, missing embedding capability or unexpected migration state. It previews and clears only enumerated application tables in the dedicated synthetic demo DB; migration/storage remain. The writer check is local, not a distributed exclusion lock. Interrupted post-truncate reseeding requires the documented guarded retry.

## API changes

No new public business API. Existing controllers continue validation/delegation and backend role/ownership checks. Browser response headers were strengthened. Shutdown stops app/workers, closes database clients, and has a 15-second deadline. Core readiness remains independent of AI availability; model/index failure is reported as degraded without falsely claiming AI readiness.

## UI changes

Programmatically focusable `main` fixes skip-link activation. Footer contrast was corrected from a measured 4.21:1 failure to an Axe-passing color. Navigation has active `aria-current`, logout busy/error feedback, role-aware empty states, analytics retry and reduced-motion support. The intake reference metric now displays “Không áp dụng” for a null applicability/rate rather than a misleading zero count. M10 checks 360/768/1440 widths, keyboard focus, zero Axe WCAG A/AA violations on the tested manager surface, and clean unexpected console/page errors. The intentional aborted-network retry test excludes only its expected `ERR_FAILED` message. Degraded health uses a schema-compliant labeled fixture; it is not called a real outage test. M7 follows the actual human-approved eligible assignee instead of assuming Network Specialist. These are automated browser findings, not a claim of an exhaustive manual accessibility audit.

## AI changes

No inference/evaluation contract change from M9: dataset/hash/labels, prompt/schema, adapter, context/routing, structured output, stream/think flags, sampling, token limits, attempts and retry code are unchanged. Config diff changes only secret validation. Reset/warmup use real embeddings/generation, not canned outputs.

Two completed M10 intake runs are retained. Approved M9 exact agreement is 68/100; contended M10 68/100; isolated M10 69/100. All have schema 100/100, first-valid 99, repaired 1, terminal 0. Isolated mean/p50/p95/max: 4441.65/4377/5147/9386 ms. Comparator remains red: normal-06/incomplete-06 priority pass→fail; M9-065/M9-075/M9-085 fail→pass; 83 per-case latency regressions above 1.5×; zero new failure/repair/schema regressions. `normal-21` differs between M10 runs, showing live variability. Historical telemetry does not prove all differences are nondeterminism or contention. Third run NOT RUN under the bounded policy. See [investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md).

Blocker-only investigation on 2026-09-30 verified 62 source hashes and all 100 frozen labels. Evaluation-only instrumentation observed MEDIUM 5/5 for each target and a predeclared 10-case sample at mean/p50/p95 2638.7/2566/2928 ms. Warm generation dominated; no large application overhead, repeated cold loads or repair occurred in the 20 diagnostic calls. This does not explain historical results or constitute a production correction. The unchanged CLI still exits 1 (2 pass→fail, 83 latency flags), with prior M9/evaluation evidence protected. No additional full run was justified. Focused observer tests 6/6, lint, typecheck and build passed; unrelated gates were not rerun. New evidence: `M10_EVAL_CONTRACT_DIFF`, `M10_EVAL_PRIORITY_REPLAY`, `M10_EVAL_LATENCY_DIAGNOSTIC`, `M10_OLLAMA_RUNTIME`, `M10_EVAL_MICROBENCHMARK`, `M10_EVAL_COMPARATOR_RECHECK` and `M10_EVAL_DIAG_*` under evidence.

## Security considerations

[SECURITY_AUDIT](SECURITY_AUDIT.md) covers auth/session revocation, role escalation, IDOR, stale assignee/version, uploads, CORS/XSS, least-privilege SQL, analytics privacy, reset guard and secret/migration scans. [AI_SAFETY_AUDIT](AI_SAFETY_AUDIT.md) covers request/tool/SOP injection, arbitrary prompt/tool denial, fabricated IDs/references, human approval and bounded failure. Runtime app images are non-root/read-only with tmpfs, cap_drop ALL, no-new-privileges and resource limits. Evidence excludes secrets/raw prompts/hidden reasoning. Existing local demo credentials remain explicitly synthetic.

## Tests executed

| Command | Result |
|---|---|
| `npm run lint` | PASS; zero warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS: config 7, API 43, web 1, release 5 |
| `npm run build` | PASS, 17 static pages; latest timing in `M10_BUILD.json`; repeated after reference-applicability display fix |
| `npm run db:validate` / `npm run db:migrate` | PASS; six migrations, none pending |
| `npm run test:integration:m10` | PASS; real fresh DB, seed twice, notifications/chronology/SLA/permissions |
| `npm run test:integration` (earlier M10) | PASS declared suite; R1 repaired and R5 terminal AI_TIMEOUT after two attempts retained |
| `node --env-file=.env scripts/verification/m2-integration.mjs` (continuation) | PASS all groups: 1+3+5+5+33 test results including nested cases; final group 175,429.8798 ms; live R1–R8 all succeeded |
| `npm run test:e2e:m3` | PASS 2/2 retained M10 report |
| `M4_E2E_MODE=offline npm run test:e2e:m4` | PASS 1/1 after real Ollama stop |
| `M4_E2E_MODE=online npm run test:e2e:m4` | PASS 2/2, including explicit recovery |
| `npm run test:e2e:m5` / `m6` / `m7` / `m8` / `m9` | PASS 1/1 each; M7 corrected approved-assignee selection |
| `npm run test:e2e:m10` | PASS 3/3; keyboard/Axe/responsive/retry/degraded state |
| `npm run verify:runtime:m8` | PASS fresh LLM and embedding outage checks |
| `npm run demo:reset` | PASS actual guarded lifecycle; active-API refusal also observed earlier |
| `npm run demo:ready` | PASS real ingestion, warmup and preflight; earlier idempotent rerun also passed |
| `npm run demo:warmup` / `npm run demo:preflight` | PASS; real models/vector query, no business mutation |
| `docker compose build` / `docker compose up -d` | PASS hardened images rebuilt, including newest evaluation snapshots |
| `node scripts/verification/m10-shutdown.mjs` | PASS idle SIGTERM, 1,110 ms, exit 0; API restarted |
| `node --env-file=.env scripts/verification/m10-final-snapshot.mjs` | PASS three healthy containers, HTTP 200/200, exact eight-request baseline and current evaluation run ID |
| `npm run verify:security:m8` / `m9` / `npm run verify:adversarial:m10` | PASS; no unreviewed secret finding; historical migration hashes match |
| `npm audit --omit=dev --audit-level=high` | PASS; zero vulnerabilities |
| `npm run eval:compare:m9 -- <approved-M9> <isolated-M10>` | FAIL/RED, exit 1; 2 priority pass→fail + 83 latency flags |
| `node --env-file=.env scripts/verification/m10-evaluation-review.mjs` | PASS audit execution; explicitly BLOCKED decision preserved |
| `git diff --exit-code v0.9.0-m9 -- apps/api/prisma/migrations` | PASS, no changes |
| `git diff --check` | PASS; final repeat recorded in final evidence |

Exact capture commands/timestamps/logs live in `docs/verification/evidence/M10_*.json` and `iterations/`. Passing earlier M10 reports are retained rather than rerun without a relevant change. Final snapshot/shutdown and final diff details are consolidated in [FINAL_VERIFICATION](FINAL_VERIFICATION.md).

Failed attempts are intentional evidence: initial integration prerequisite failure with Ollama stopped; Windows npm invocation false-block before correction; invalid degraded-state test fixture; skip-target and real contrast failures before fixes; M4 recovery attempted after reset removed its old offline request, then passed after correctly ordered offline/online runs; M7 hardcoded-assignee failure before correction; credential-shaped test literal flagged before correction; and continuation build wrapper inherited development NODE_ENV, then normal production build passed. Neither 100-case comparison failure was relabeled or removed.

## Manual verification

Inspected Git baseline/diffs, actual Docker/process state, model inventory/configuration, migration history, terminal outputs, browser reports and the 1440-pixel analytics screenshot (including the reference-applicability correction). The canonical competition files and owning specs were cross-checked; 17 local documentation files have no missing linked target. Final snapshot has exactly eight requests, 39 histories, eight notifications, zero AI runs, eight real request embeddings and nine READY documents/12 chunks; no arbitrary E2E request remains. Outage/recovery, keyboard, responsive and accessibility claims above are scoped to automated scenarios. No new operator time benchmark, full disconnected-Internet rehearsal, video capture or external penetration test was performed.

## Known limitations

100 synthetic specification-labeled cases are development evidence; exact disagreement is not semantic ground truth and 68/100 is not generalized accuracy. No operator productivity/time-saving claim. Scheduling remains process-local, without distributed exactly-once infrastructure. Model/runtime latency varies; the longitudinal performance gap remains unresolved. Reference membership does not prove every generated statement is correct. Two related demo cases age out of the 30-minute window, so reset shortly before presentation. Docker evaluation snapshots require rebuilding after a new evaluation.

## Deferred items

Third M10 full confirmation run remains NOT RUN after the bounded diagnostics: no production defect was corrected and no specific reproducibility defect invalidated the isolated run. Manual benchmark execution, new video recording, distributed/enterprise deployment and additional providers were not implemented or claimed. No M11 work.

## Release blockers

Unresolved longitudinal live-evaluation result: two priority pass→fail cases and 83 severe per-case latency flags in isolation. The new warm diagnostics did not reproduce the two priority failures or the broad slowdown, but historical actual predictions and provider/host telemetry are missing. An unexplained improvement is not a verified fix or a waiver. The canonical stable-demo/no-blocker gate remains unsatisfied.

## Historical M10 gate

**FAIL — BLOCKED for release.** M10 implementation, documentation and runnable demo are available for review. A subsequent branch commit/push preserves this blocked snapshot; it is not a release approval. No release tag or merge is authorized. Stop after M10 verification.

## V1 release continuation

The previous blocker was the isolated run's two priority pass-to-fail cases and 83 latency flags. Investigation found no production-contract change and did not waive or relax the comparator. The official evaluation harness lacked provider identity/timing data and an enforceable warmup/isolation/order/attempt protocol, so evaluation-only tooling was corrected and frozen before any new live call. Historical RED evidence remains unchanged.

The priority study returned MEDIUM 5/5 for both `normal-06` and `incomplete-06`. The one authorized full run (`6d080973-d92f-4ed2-9e7d-d5e071e609a4`) then produced 68 exact matches, 100 schema-valid results, 99 first-attempt-valid results, one repair, zero terminal failures, and 2728.38/2653/3085/6681 ms mean/p50/p95/max. The unchanged comparator returned exit 0 with zero pass-to-fail, zero fail-to-pass and zero latency regressions. All protected files are unchanged from remediation baseline `584bd984`; the final gate separately records that M10 had already regenerated `M9_SECURITY_SCAN.json` relative to the M9 tag before this continuation.

Fresh focused gates pass: lint, typecheck, all unit suites, production build, database validate/migrate, dependency audit, M8/M9/M10 security scans, guarded synthetic reset, Docker build/start, demo-ready, final runtime snapshot and diff/secret checks. There are still six migrations and no historical migration change. Because production/config/lockfile behavior is byte-identical to snapshot `584bd984`, the approved M10 PostgreSQL integration, actual outage/recovery and M3–M10 browser evidence was retained with original timestamps rather than misrepresented as rerun.

Final demo state is six synthetic users, eight intended requests, 39 histories, six assignments, three resolutions, two feedback rows, eight notifications, zero AI runs, eight real request embeddings, nine READY knowledge documents and 12 embedded chunks. PostgreSQL/API/web are healthy and the dashboard serves the final run ID.

## Current gate

**PASS — M10/V1 release requirements are satisfied.** The historical slowdown mechanism remains unknown and local inference latency remains hardware-sensitive, but no mandatory blocker remains under the unchanged release comparator. No M11 work was started.
