# M16 Release Hardening & Demo Readiness verification

Authority: [M16 user request](M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md), 2026-10-01 Asia/Saigon. This is the implementation-verification snapshot before checkpoint closure. M15 checkpoint and HEAD at verification: `310b6db40e8b42189baa665eb04958e999eec0dc`. Branch: `feat/v1.2-release-hardening-demo-readiness`. Initial working tree was clean. No commit/push/tag/merge/deployment occurred during implementation; M17 NOT STARTED. The subsequent user request supplies separate [checkpoint closure authorization](M16_CHECKPOINT_CLOSURE.md); spec wording is preserved with only trailing-space/final-newline normalization.

**M16 PASS — READY FOR HUMAN REVIEW. M17 NOT STARTED.** All required local gates completed; the isolated rehearsal project is now stopped and its data retained.

## Environment and evidence

Run ID: `2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57`; separate Compose project `mobiflow-m16-46d0cd57`; loopback PostgreSQL 54616, API 31601, web 31600. Dedicated fresh PostgreSQL/knowledge volumes and ignored source candidate under `artifacts/m16/runs/<run-id>/candidate`. The candidate excludes developer `.env`, node_modules, generated Prisma code, `.next`, runtime storage and Git metadata. An unchanged-lockfile install creates private credentials through existing `env:setup`.

Safe [command ledger](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/SETUP.json) records actual exit codes, times, source hashes and relative private log locations. Private `.env`, command logs and browser traces remain ignored. Only new sanitized M16 JSON is reviewable. Historical M0–M15 verification/evaluation remains unchanged.

The original `mobiflow-ai` developer project uses web 2500, API 2501 and PostgreSQL 5432. A read-only check at 2026-10-01 10:09 Asia/Saigon returned web 200, liveness 200 and readiness 200/READY, coreReady=true, aiReady=true, RAG READY (9 documents/12 chunks). All three original containers remained healthy; M16 never targeted this database/project for seed, migrations, outage, reset or shutdown.

After final packaging review, `npm run verify:release:m16 -- --shutdown` stopped only `mobiflow-m16-46d0cd57`; all three owned containers are exited and no volume was deleted. [FINAL_STACK_STATE.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/FINAL_STACK_STATE.json), measured 2026-10-01 10:29:59 Asia/Saigon, confirms the original project's three containers remain running/healthy, web/liveness/readiness 200, core+AI+RAG READY. The two Docker Desktop rows are separate Compose projects on the same Docker engine. The stopped M16 row remains visible when stopped projects are shown.

## Confirmed defects and repairs

| Measured defect | Final repair and evidence |
|---|---|
| Preflight/reset still expected six migrations after M14 introduced the seventh | Compare exact successful repository migration names and reject failed/extra/missing history. Reset's synthetic target, explicit demo, marker and stopped-writer guards remain. No actual reset was performed. |
| Fixed published ports/corpus Origin prevented isolated rehearsal | Optional loopback host ports and configured `WEB_ORIGIN`; separate project/volumes. Existing defaults remain. |
| Repeat seed updated resolved request timestamps and could replace a later resolution link | Link a seeded resolution only when currentResolutionId is null; real PostgreSQL snapshots show repetition preserves Request/history/assignment/feedback/password fingerprints. |
| API printed startup failure but retained live pools when listen failed | Close app/workers/database resources; occupied-port startup exits nonzero with safe `PORT_OCCUPIED`. |
| Database outage could stall login; session-store failure was reported as invalid identity | Bound pool acquisition to 5000 ms, separate JWT validation from the required database predicate, and sanitize recognized connectivity errors as existing-contract 503 `DATABASE_UNAVAILABLE`. New real disconnected-DB unit checks; final production outage/recovery gate below. |
| Historical operator output risked replacing old M10 reports | Optional `DEMO_EVIDENCE_ROOT`; this candidate writes ignored operational reports. No historical evidence edits. |

No new dependency, feature, role, Copilot action, AI provider, public recommendation schema, prompt, database schema or migration. No inference retuning or speculative product refactoring.

## Fresh setup and database

`npm ci --no-audit --no-fund`, env setup with the exact installed Qwen tag, Prisma generation, lint/typecheck/unit/build, Compose validation, fresh pgvector PostgreSQL, migrations 1–7 and seed all completed successfully. Docker Desktop and Ollama initially were unavailable; the first env setup correctly refused to create a runnable configuration with a missing provider. Docker Desktop and the existing installed host Ollama were started; no model downloaded or substituted.

[DATABASE.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/DATABASE.json): **8/8 PASS**. Actual pgvector; exact seven completed migrations; repeat seed; repeat migrate deploy; restricted runtime DB privileges; real V1-style Request/AiRecommendation upgrade preserving confidence 0.625 and enabling V2 null; intentionally failed Prisma migration with no subsequent sentinel execution; fault isolation from the demo database. The auxiliary fixture database was created only after absence verification in the M16 cluster and removed after its connections closed. No developer/production reset or migration.

Schema changed: NO. Migration added: NO. Migration count: 7. Prisma schema/migration hashes and package lock are checked against the unchanged baseline.

## Startup, live AI and security

Real API/web Docker builds and startup, authenticated knowledge ingestion, actual 1024-dimensional request embeddings, bounded warmup and demo preflight passed. Normal readiness is core+AI READY. [RUNTIME.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/RUNTIME.json) records **17/17 completed checks**, including three live V2 cases, actual RBAC/ownership/session/stale/version/strict-output negatives and separate advisory review.

USER and STAFF are denied manager list/read/generation (six 403 responses). Unassigned STAFF and cross-owner USER receive 404 matching unknown resources. Revoked, expired JWT and expired persisted sessions receive 401. A stale mutation changes no Request/assignment/SLA/checklist/notification state. Authenticated cache policy is no-store; CSP/framing/MIME protections are present. Forged rawOutput/schema selection is rejected 400. Invalid critical env startup reports key names only. Protected business predicates are retained in final authentication regression after the database diagnostic fix.

| Live HTTP case | Result | Observation | V2 elapsed time |
|---|---|---|---|
| Complete IoT, 17 SIM at Amata | PASS | Real SOP-IOT source; HIGH/120-minute advisory; no business action | 18642 ms |
| IoT with missing location | PASS | Location null, real missing question/warning; no guessed location | 16511 ms |
| Duplicate billing charges | PASS | Real SOP-BILL source; MEDIUM/240-minute advisory; conservative missing-impact question | 17581 ms |

All strict public schemas, allowed source membership and real availability checks passed. Review records the manager's agreement separately and preserves original actions/procedure refs/reason. Generation and advisory review leave business Request/version/assignment/SLA/checklist unchanged. No raw prompt, hidden reasoning or unchecked model output is exposed in the recorded public results.

The canonical browser scenario adds one completed live V2 case. A prior browser attempt generated a valid V2 case and completed advisory review before a test-selector failure; that attempt is retained rather than silently counted as a completed end-to-end flow. Thus five successful V2 generations occurred across this bounded rehearsal: three HTTP, one interrupted browser case, one completed canonical browser case. Dependency recovery also performs failed AI jobs and explicit intake retries; those are not additional successful V2 quality/accuracy samples.

Prompt `grounded-recommendation.v2.10`, public schema `recommendation.v2`, Qwen/bge digests and dataset/parser/schema identities are listed in [the release inventory](M16_RELEASE_INVENTORY.md). Prompt SHA256 `71d7bbd664a232f31c7ef637601bbb812695e27a9a3acf7b6c76586cc34661de`; dataset SHA256 `e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290`. **Full M15 100+30 evaluation NOT RERUN:** generation prompt, schema, parser, provider/model and inference bounds are unchanged. This is release smoke, not new production-accuracy evidence.

## Canonical demo and UI

[BROWSER_CANONICAL.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/BROWSER_CANONICAL.json), [BROWSER_STATES.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/BROWSER_STATES.json): final complete browser gate **2/2 PASS**, Edge headless against production API/web, real PostgreSQL/Ollama.

Canonical request `ac563e69-1155-4adf-9221-c5f26c427827`: USER create/view → STAFF assigned work → MANAGER generate/inspect sourced V2 → explicit advisory acceptance with unchanged TRIAGED version/no assignment/SLA/checklist → independent human draft/send/approve → STAFF assignment/7200-second SLA/two human-authored checklist items → Copilot FIND_SOP → complete checklist/resolve → USER confirm CLOSED/feedback 5 → Analytics V2.

**AI suggestion → human review → explicit business decision: PASS.** No AI executes approval, assignment, priority, closure or checklist adoption. The manager's native confirmation explicitly distinguishes advisory acceptance from business execution.

| Width | Real surfaces scanned | Page-wide overflow | Axe serious/critical |
|---|---|---|---|
| 360 | USER request, STAFF queue/work, MANAGER V2/analytics | 0 | 0 / 0 |
| 768 | Same five | 0 | 0 / 0 |
| 1440 | Same five | 0 | 0 / 0 |
| 1920 | Same five | 0 | 0 / 0 |

20 actual scans; no uncaught page errors in the complete canonical test. Loading/initial-no-recommendation/missing/error/empty states observed. The error test explicitly aborts browser analytics transport, then restores the real API and retries; it is not evidence of an actual database outage. Custom 2001-01-01→2001-01-02 filters show actual empty Analytics UI/API data. Native confirmation, skip link/main focus and mobile drawer keyboard trap/Escape/focus return pass. Literal HTML is shown as text, with no injected img/onerror execution. Current product supports light theme; dark mode NOT APPLICABLE and no theme added. Vietnamese labels, sourced evidence and human review/manual approval copy reviewed; no UI redesign.

## Failure, recovery, logs and packaging

[RECOVERY.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/RECOVERY.json): **9/9 PASS** against the final production containers. API/web restart preserved Request/version/assignment/SLA/checklist/feedback. Only the owned API's Ollama origin was made unreachable: readiness 200/DEGRADED, coreReady=true, aiReady=false, owner reads and saving a NEW/MEDIUM request remained possible; intake and V2 failures published no unchecked output or protected business action. Restoring Ollama and explicitly retrying intake through the existing worker/state machine succeeded.

Stopping only M16 PostgreSQL produced readiness 503/NOT_READY, database/vector DOWN and process liveness 200. Valid-JWT protected read and login both returned bounded (asserted under 10000 ms), sanitized 503 DATABASE_UNAVAILABLE; neither granted authentication nor exposed SQL/Prisma/stack/credentials. Restarting PostgreSQL restored readiness and the same persisted session worked without restarting API or manual data repair. Actual production logs contained useful error categories and none of the four configured secrets, bearer JWTs or raw prompts.

[SECURITY_FINAL.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/SECURITY_FINAL.json): **13/13 PASS** after the final backend repair. The affected browser state/security smoke also passed **1/1** after this repair, without another successful V2 generation.

[PACKAGING.json](evidence/m16/2026-10-01T02-25-12-283Z-d00df092-2bd6-435d-8706-4aea46d0cd57/PACKAGING.json): **8/8 PASS**, including unchanged prompt/parser/public schema/dataset/migrations/dependencies/history, exact reviewed candidate source, actual installed model digests, completed runtime/database/browser/recovery evidence, retained container restrictions and isolated volumes/ports, required documentation, private configured-secret/runtime-artifact exclusion and `git diff --check`. Final lint also passed. Packaging measured 1256 nonignored source/evidence files and 12 M16 JSON files before the packaging and final-stack reports themselves were written; these counts describe that scan, not the final changed-file total.

## Exact commands and results

Commands below execute in the isolated candidate through the repository runner; exact child command/timestamp/exit/log entries are retained in SETUP.json. A passing historical milestone is not substituted for a current command.

| Command | Actual result |
|---|---|
| `npm ci --no-audit --no-fund` | PASS, unchanged lockfile |
| `npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M` | PASS after truthful initial provider-unavailable refusal |
| `npm run prisma:generate` | PASS |
| `npm run lint` | PASS, including final verification-code rerun |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 170/170 (7 config + 96 API + 2 web + 65 operational/evaluation units); earlier 168/168 before two outage regressions were added |
| `npm run build` | PASS |
| `docker compose -p mobiflow-m16-46d0cd57 config --quiet` | PASS |
| `docker compose -p mobiflow-m16-46d0cd57 up -d --wait postgres` | PASS |
| `npm run db:validate` / `npm run db:migrate` / `npm run demo:seed` | PASS, seven migrations |
| `node --env-file=.env scripts/verification/m16-database.mjs` | PASS, 8/8 |
| `docker compose -p mobiflow-m16-46d0cd57 build api web` / `up -d --wait api web` | PASS, final diagnostic fix rebuilt and deployed locally |
| `npm run knowledge:ingest` | PASS, real owning API/indexer |
| `node --env-file=.env scripts/verification/m16-index-history.mjs` | PASS, current real embeddings; canceled requests excluded |
| `npm run demo:warmup` / `npm run demo:preflight` | PASS |
| `node --env-file=.env scripts/verification/m16-runtime.mjs` | PASS, 17/17; three live cases |
| `node --env-file=.env node_modules/@playwright/test/cli.js test --config playwright.m16.config.mjs` | PASS, 2/2; 20 width/Axe scans |
| `node --env-file=.env scripts/verification/m16-runtime.mjs --security-only` | PASS, 13/13 after the final backend fix |
| `node --env-file=.env node_modules/@playwright/test/cli.js test --config playwright.m16.config.mjs --grep "M16 missing information"` | PASS, 1/1 after the final backend fix |
| `node --env-file=.env scripts/verification/m16-recovery.mjs` | PASS, 9/9 after the final backend fix |
| `node scripts/verification/m16-final-review.mjs "C:\Code\MobiFlow AI"` | PASS, 8/8 packaging checks |
| `docker compose -p mobiflow-m16-46d0cd57 stop` | PASS, owned project only; original stack healthy |
| `git diff --check` | PASS, including final documentation review |

Reproduction wrapper commands: `npm run verify:release:m16 -- --prepare`, `--runtime`, `--checks`, `--review`, `--shutdown`. Affected follow-up stages use `--prepare-resume`, `--security`, `--browser-states`, `--recovery` and avoid unnecessary new live cases.

## Retained failed attempts

Initial run `2026-10-01T02-23-41-863Z-cf1fd8a2-c67a-4b70-aadb-acd2b3f26c97`: install passed, env setup failed because Ollama was unavailable; no `.env` or database created. Main candidate: early lint findings corrected; repeat-seed timestamp defect fixed; expired-session fixture's createdAt/expiresAt relationship corrected without weakening the database check; repeated authentication honored actual Retry-After rather than disabling limits. Occupied-port timeout exposed the startup cleanup defect and was fixed. First browser attempt was stopped at an invalid exact label selector; another assertion named an incorrect existing error heading. Both tests passed after DOM-grounded selectors/current checklist buttons/error copy were used; failed traces/screenshots were archived privately before a rerun. Recovery first encountered a real transient socket closure during restart, then exposed masked session-store errors and an unbounded pool wait; these drove the narrow documented diagnostic repairs. A later indexing assertion counted an older Request version's retained embedding as current; it now checks current contextVersion without deleting historical rows, and the actual indexing/warmup/preflight passed. A passed recovery report's requestStatus field had overwritten its check status; that report is retained as RECOVERY.pre-metadata-fix.json and the same actual recovery was rerun after separating the metadata fields. Failed command codes/log pointers and sanitized recovery failure reports are retained. No failed attempt is labeled PASS or discarded to improve metrics.

## Documentation, Git, limits and gate

[Implementation plan](M16_RELEASE_HARDENING_DEMO_READINESS_IMPLEMENTATION_PLAN.md), [configuration reference](M16_CONFIGURATION_REFERENCE.md), [canonical runbook](M16_DEMO_RUNBOOK.md), [release inventory](M16_RELEASE_INVENTORY.md), [milestone gate](../verification/MILESTONE_16_VERIFICATION.md) and current demo entry point cover the authorized local candidate.

Working tree at completed implementation verification: **46 changed/new files (16 modified + 30 new, including 14 sanitized M16 JSON reports)**; nothing staged; HEAD/branch unchanged then. After final documentation/stack reports, a read-only scan of 1258 nonignored files and all 14 M16 JSON reports found none of the configured private secrets or raw prompt/JWT fields. Final `git diff --check` passed. The controlled stop is the final runner state STOPPED; it does not change measured PASS evidence into a failed runtime gate. The later closure record adds one documentation file and owns the final 47-file manifest/Git handoff.

Synthetic samples do not prove production accuracy, calibration, blinded human ratings or security penetration coverage. Existing M15 clipped prose/occasional foreign characters and qualitative limits remain visible in this smoke; no protected value/source/approval bypass was found. Local latency depends on host resources. Axe/width checks cover the five named surfaces, not the whole product. Internet-free dependency installation, TLS/external deployment, production migrations/data, backup/restore disaster recovery and M17 release are NOT RUN/outside scope.

Release blockers: **None found within the authorized local M16 gate.** Changes were uncommitted and reviewable at this implementation snapshot. The subsequent checkpoint closure authorizes one M16 commit/branch push only; no tag/merge/deploy/release. M17 NOT STARTED. Restarting the original developer stack to adopt M16 code and M17 release finalization are separate operator/review decisions; the original running stack was preserved.

**M16 gate: PASS — READY FOR HUMAN REVIEW. M17 NOT STARTED.**
