# M24 release hardening verification

Executed 4 October 2026 Asia/Saigon. The user confirmed execution of the attached M24 automatic checkpoint, including Phase B Git release. Previous checkpoint M23 `4735afafe7cda4dbf98bdd387cc2fd49db22f764`; starting branch `feat/v1.3-saved-views-filters`, CLEAN. Hardening branch `feat/v1.3-release-hardening`. [Preflight](evidence/M24_PREFLIGHT.json) verifies six closed, published M18–M23 checkpoints and main/v1.2.0 at `31b445caf07dad606601a1e38e8ed39836d9f825`. No new dependency, migration, API, UI feature or business rule.

## Actual change and architecture review

The seven existing M22 SLA_ALERT settings were parsed and tested by config but absent from normal Compose and `.env.example`. Both now expose the existing defaults, including enable/cadence/batch/budget. [Configuration reference](M24_CONFIGURATION_REFERENCE.md) documents them. The actual production container ran with enabled=true, interval30, batch2 and all remaining defaults; packaging audit compares all seven resolved values. Application, contracts, Prisma schema, all13 migrations, lockfile and Dockerfile remain identical to M23. The only package.json change adds four M24 verification commands.

Controllers still validate/delegate; request-state-machine owns protected business mutations. Template preview/apply and routing evaluate/prefill do not assign, activate checklist or send messages. Internal notes/watch/preferences do not increment Request version or mutate business history. M12 owns SLA math; M22 observes and delivers durable events without changing priority/assignment/status. Current identity and Request scope filter internal notices; legacy non-internal notification retention remains its accepted contract. Private views never widen Request scope. Original AI suggestions and explicit human decisions remain separate.

## Commands and measured results

Every command below has an exit0 PASS record under [gates](evidence/gates); previous failures remain under `gates/iterations` and `evidence/iterations`. Commands were wrapped by `m24-capture.mjs` to record timestamps, environment, source hashes and ignored raw-log paths. Linux commands ran in the owned Node24.19.0 verification container using locked npm dependencies; browser/Compose/security ran on Windows Node24.19.0/npm11.17.0.

| Command | Actual result |
|---|---|
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 217 current tests: config7/API143/web2/helper65; no failures/skips |
| `env NODE_ENV=production NEXT_PUBLIC_API_BASE_URL=http://localhost:33601/api/v1 node scripts/verification/m24-capture.mjs M24_BUILD npm run build` | PASS; API and optimized Next production build |
| `node scripts/verification/m24-release.mjs build` | PASS; original Dockerfile API/Web targets, actual Compose config |
| `npm run test:database:m24` | PASS; fresh13 and actual V1.2 schema7→8→9→10→11→12→13, then current app login/dashboard/read on both |
| `npm run test:integration:m24` | PASS, 5 integrated real PostgreSQL/HTTP tests |
| `node scripts/verification/m24-release.mjs database` | PASS; isolated production13 migrations and seed |
| `node scripts/verification/m24-release.mjs start` | PASS; actual production API/Web healthy |
| `node scripts/verification/m24-smoke.mjs` | PASS; real three-role login/dashboard, manual triage/submit/approve, collaboration/templates/routing/views, analytics and privacy |
| `npm run test:e2e:m24` | PASS, 4 Edge tests, no skip/retry/flaky; 28 responsive/Axe scans |
| `node scripts/verification/m24-recovery.mjs` | PASS; actual API/Web restart, DB outage/restart and persistent scheduler dedup |
| `node scripts/verification/m24-release.mjs database` with API stopped | PASS; repeat seed preserves all15 inspected table populations including V1.3 rows |
| `node scripts/verification/m24-identity.mjs` | PASS; 61 V1.2 owner files, 7 matching M15 identity hashes, 6 Copilot actions |
| `npm run verify:security:m24` | PASS; RBAC/privacy evidence, all13 immutable migrations, actual hardened containers, configured-secret scan and25 production JS bundles |
| `node scripts/verification/m24-source-coverage.mjs` | PASS;179 files match14 gate captures; see [coverage record](evidence/M24_SOURCE_COVERAGE.json) |
| `node --env-file=.env scripts/verification/m24-final.mjs` | PASS;84 reviewed entries,256 historical files frozen, owned cleanup and five free ports; see [final record](evidence/M24_FINAL.json) |

Full Linux invocations use `node scripts/verification/m24-linux.mjs run ...`; production runtime orchestration uses `docker compose --env-file artifacts/m24/release.env -p mobiflow-m24-release -f docker-compose.yml -f scripts/verification/docker-compose.m24-release.yml ...`. Private env values are excluded. These are historical rehearsal commands, not instructions to reset a later release to M23.

## Database and seed

[Database report](evidence/M24_DATABASE.json): actual v1.2.0 schema/migrations materialized, synthetic rows inserted, each successive migration compared against pre-upgrade rows and migration checksums. Rows across26→36 existing tables were retained, including users, requests, messages, SLA, history/audit, AI/RAG and notifications, then notes/mentions/watch/templates/routing/alerts. The12→13 path is included in the V1.2 sequence. M23→M24 introduces no migration; current app starts on unchanged13 schema. Runtime CRUD constraints and owner-column/DDL/TRUNCATE denial pass. Earlier detailed model-grant evidence remains applicable because all schema/migration/owner bytes are unchanged.

Repeat production seed preserved14 Requests,2 messages,3 notes,1 mention,2 watchers,4 templates/4 revisions,1 rule/1 revision,1 view,7 alerts,35 notifications,185 audit rows,60 status-history rows and11 SLA rows. These include synthetic production/browser mutations; they are not empty-table idempotence assertions. The command capture contains the measured report. API was stopped to exclude concurrent scheduler writes during comparison.

## Integrated behavior, privacy and concurrency

[API report](evidence/M24_API.json) covers: local template draft→explicit save/submit/approval, historical checklist provenance after archive; routing NO_MATCH/MATCH/CONFLICT with no workflow write; mention+watch one-event/one-recipient dedup; saved filters scoped to current assignee; explicit response send and stale409; USER internal endpoint denial and public detail/history/dashboard/notification privacy; foreign request/view404 and STAFF manager-command denial; changed-assignee internal/SLA notice filtering; strict unknown fields, foreign Origin403, media415, body413, rate429 respecting Retry-After and revoked session401.

Real-PG cap/name/version races and rollback are reused from [M23](evidence/M23_API.json), with complete unchanged owner/source verification. No new concurrency algorithm is introduced. Deep M18–M23 suites are not replayed unconditionally.

Scheduler M24 integration: five synthetic alert candidates, batch2, three measured ticks21.07/14.82/13.14ms; policy ratio edit produced0 new events; handoff reconciled current recipients without business mutation. [Recovery](evidence/M24_RECOVERY.json) restarts actual production API/Web, waits at least5 persisted scans across7 active rows with batch2, and proves the five fixtures still have5 events/10 unique recipients, no duplicate or protected-row changes. Temporary DB stop returns ready503/coreReady=false, live200, safe protected-read503; after start, authenticated core reads recover. Optional provider remains truthfully degraded.

Performance evidence is local synthetic, not an SLO. Accepted unchanged M23 performance fixture has112 Requests/50 views: five list samples6.57–10.78ms,9 SQL each/one preference select; apply5.27–12.11ms,10 SQL/20 rows. Those are historical measurements, not newly measured M24 SQL counts. M24 scheduler durations above are new measurements.

## Browser and visual review

[Browser report](evidence/M24_BROWSER.json): Windows Microsoft Edge (Chromium), actual production Docker API/Web and PostgreSQL,4 tests. Seven surfaces ×360/768/1440/1920 =28 scans: notes/mentions/watch request detail, staff saved filters, SLA notifications, template management, routing management, manager routing/checklist, manager filters. Every scan has0 serious/critical and no horizontal overflow. Keyboard watch, overwrite confirmation/cancel focus, routing-prefill focus, saved-view dialog focus/Escape, and template archive confirmation/cancel focus pass. USER sees final customer-facing conversation and is denied manager UI. No app page/console/HTTP errors in responsive traversal.16 external Kaspersky script CSP messages were recognized by the exact existing URL/message signature; app CSP was not weakened. Existing deep loading/empty/error/XSS cases are reused with unchanged UI owners. No Firefox/WebKit or full WCAG certification claim.

Agent inspected saved mobile request-detail and desktop routing screenshots; layout and clipping were reviewed. All28 screenshots/traces remain ignored in the report's artifact directory. Independent external/human review NOT RUN.

## AI identity and runtime

[Identity report](evidence/M24_AI_IDENTITY.json) compares prompt/parser/schema, datasets/evaluators, context builders, projections, tool dispatch/permissions and six actions. All61 owner files match V1.2 after EOL normalization; M15 app hashes use historical CRLF and evaluation scripts LF. Shared config delta is only seven SLA_ALERT declarations; authorization Request/AI scope methods are identical. Shared workflow additions are M20 transport provenance fields; AI context owners use their own explicit projections and never serialize those fields/library rows. Actual deterministic capture exercises intake1, structured2 and embedding2 calls with private canaries absent; protected rows unchanged.

Accepted M15 prompt `grounded-recommendation.v2.10`, schema `recommendation.v2`, dataset `m15.recommendation.synthetic.v2` hash `e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290`. Historical100 cases+30 consistency runs are retained; not a new quality evaluation. Historical model/embedding tags/digests/dimension are in the inventory. Production rehearsal deliberately uses unreachable Ollama and unconfigured model labels: `DEGRADED`, `coreReady=true`, `aiReady=false`, RAG disabled. Existing [M16 runbook](../v1.2/M16_DEMO_RUNBOOK.md) permits optional-provider core operation. No live inference, download, model replacement or AI READY claim.

## Failures and corrections retained

- Docker engine was initially unavailable. The installed Docker Desktop was started hidden; its restart policy auto-resumed normal developer PostgreSQL. Normal API/Web stayed stopped. All preservation comparisons use the captured post-engine-start IDs/start times/running states/ports; no normal-stack compose/rebuild/migrate/reset/reseed was run.
- A stale guessed Docker executable path, first runner sync before git installation, one npm-ci ECONNRESET and a missing copied public `.env.example` were setup failures. Correct installed path, isolated runner prerequisites, locked install retry and explicit public-file copy resolved them; no dependency upgrade or gate waiver.
- First release DB seed failed before generated API/Prisma compilation existed. Subsequent actual deploy/seed and populated idempotence passed. Transient seed image emitted an OpenSSL autodetection warning; commands succeeded. Production images/runtime gates passed independently.
- First integrated run3/5 passed: two assertions incorrectly expected all legacy notifications to disappear after reassignment. Owning policy retains non-internal legacy notices; assertions now specifically require current-scope filtering for internal/SLA notices. Product code unchanged; next run5/5.
- First browser run3/4 passed: test used an invented SLA label. Actual accepted label is “SLA sắp đến hạn, cần được chú ý.” Corrected selector; final4/4, same product. Rerun fixture setup handles already-watching state and unique template names.
- Identity harness had one syntax error, then mismatched historical line-ending hashes. Exact V1.2 source comparison was already identical; historical per-file EOL representation was verified and preserved. A dependent security attempt failed while identity output was absent; final identity/security both passed. Failed records remain immutable.

## Source, cleanup and closure

[Source coverage](evidence/M24_SOURCE_COVERAGE.json) binds every current required gate to the same179 product/config/migration files and normalized Git blobs. Verification-only edits are audited in [final inventory](evidence/M24_FINAL.json); docs-only release preparation must not change tested product. Source gates refuse mismatches. Cleanup removes only the owned verification/release containers, volumes and synthetic DBs, verifies all five ports released and normal developer identities/seven migration checksums preserved. Images/dependency caches and ignored local evidence may remain; they are not running services or committed secrets.

Technical self-review, exact source coverage and final cleanup audit PASS; remaining technical blockers0. [AUTO closure](M24_CHECKPOINT_CLOSURE.md) evaluates actual refs, not a prospective SHA. Required checks may not be waived. Known limits: local synthetic evidence; optional AI degraded; no penetration test, full WCAG certification, full disaster recovery, production deploy or V1.4. Independent human review and unrelated historical replay NOT RUN. Publication status is established only by Phase B live refs.
