# MobiFlow AI V1.2 — M11 + M12 verification

Verified 2026-09-30. Implementation gate: **M11 PASS; M12 PASS; READY FOR HUMAN REVIEW**. The subsequent [checkpoint closure review](M11_M12_CHECKPOINT_CLOSURE.md) records fresh checks and final file/evidence decisions before the authorized commit/push. M13 NOT STARTED; no V1.2 release tag or main merge is authorized.

## Baseline and authority

- Previous release `v1.1.0`, commit `2604590a0ff07bee8b994cc337d8f7e42da61e70`.
- Started clean on `feat/v1.1-mobifone-ui-refresh`; inspected status/branch/HEAD/tag/log/remotes, switched main, ran `git pull --ff-only` (already up to date), reconfirmed clean main=release, created `feat/v1.2-operational-dashboard-sla-v2`.
- At implementation handoff, HEAD and main remained at the release commit, with no commit/push/tag/main merge/reset/clean; the dirty branch was the review deliverable. Later closure authority permits one checkpoint commit and feature-branch push, while preserving main and v1.1.0.
- [Implementation plan](M11_M12_IMPLEMENTATION_PLAN.md) was saved before application edits. Current user authority extends the historical V1 plan only to M11/M12. All owning specifications were amended; original release evidence remains historical.

## Architecture and files

Backend: new `apps/api/src/dashboard/dashboard.controller.ts` and `dashboard.service.ts`, shared authorization SQL predicate, shared `requests/sla-clock.ts` budget/rules/view, new `sla-sql.ts`, request list/detail projections, DB-timed monitoring. Existing analytics receives only the SLA canonical-expression/canceled-exclusion compatibility correction; no analytics V2 UI or new metrics.

Contracts: additive SLA fields in `packages/contracts/src/workflow.ts`, new strict role-discriminated `dashboard.ts`, barrel export. Web: new dashboard metric component, independently abortable dashboard/list reads in `request-list.tsx`, canonical SLA presentation helper and existing shared SlaIndicator. Existing request detail consumes that shared indicator without redesign.

Tests: new API unit/integration, web presentation unit, four browser cases and Playwright config; package scripts register them. Existing integration runner adds the new gate. M2 runtime checker uses the verified frontend URL's Origin for local port overrides instead of leaking a runtime Origin override into isolated tests.

No Prisma schema/migration, dependency/lockfile, Docker production configuration, AI business logic, state-machine transition/version protocol, global CSS, design tokens/branding/sidebar/theme files changed. Generated M4/M5/M6 evidence changed because the user required fresh regressions; prior M4/M5 baseline evidence and M6 iterations were retained under `docs/verification/evidence/iterations`.

## M11 API and exact KPI definitions

GET `/api/v1/dashboard/user`, `/staff`, `/manager`, each restricted to its exact role, share one aggregate service. Response: `{data:{role,asOf,timeZone,day:{from,to},metrics},requestId}`; Cache-Control no-store. No query input is accepted. Shared Zod schemas drive web validation and OpenAPI.

| Role | KPI | Definition inside server-derived scope |
|---|---|---|
| USER | openRequests | Eight nonterminal states, including RESOLVED awaiting owner confirmation |
| USER | inProgress / waitingForUser / resolved / closed | IN_PROGRESS / WAITING_USER / RESOLVED / CLOSED |
| STAFF | assignedToMe | CurrentAssigneeId=actor, including readable terminal history |
| STAFF | active | ASSIGNED/IN_PROGRESS/WAITING_USER |
| STAFF | waitingForUser | WAITING_USER |
| MANAGER | open | Eight nonterminal states |
| MANAGER | pendingApproval | PENDING_APPROVAL |
| MANAGER | unassigned | PENDING_APPROVAL and no currentAssigneeId: only state allowing APPROVE_AND_ASSIGN |
| STAFF/MANAGER | resolvedToday | Current RESOLVED/CLOSED and current resolvedAt in the Vietnam day; reopened/yesterday/next-day excluded |
| all | slaAtRisk / slaBreached | Nonterminal canonical AT_RISK/BREACHED only; no canceled/closed or double-counted paused records |

Scope: USER createdById; STAFF currentAssigneeId; MANAGER all records in the existing single synthetic organization. Metrics overlap intentionally; do not sum them. Staff's assigned history count need not equal the open work queue count.

Day uses `Asia/Ho_Chi_Minh`, inclusive start/exclusive end converted to UTC. Injected 2026-09-30 16:59:59Z verifies `[2026-09-29T17:00:00Z,2026-09-30T17:00:00Z)` independently of host timezone. Counts do not depend on list filters, search, cursor or limit.

One bound SQL aggregate statement per snapshot, with a unique SLA join, COUNT FILTER and common canonical clock; role scope is applied in SQL. No materialized request set, Javascript production counting, per-row query, N+1, magic UI threshold or scheduler-lag reliance. Auth/session lookup is separate existing overhead, not included in the statement count.

Pagination invariant: 120 authorized requests, all three roles, limits 1/10/20/50 and cursor advancement; metrics unchanged. Mixed states/owners/assignees/pending/unassigned/terminal/day boundaries/SLA classifications reconcile against real PostgreSQL. Empty USER/STAFF scopes return zeros, and a single row is verified before bulk fixtures.

## M12 canonical clock and DTO

`sla-clock.ts` supplies SLA_RISK_RATIO=0.2, generic elapsed-budget math and ordered state rules; `sla-sql.ts` compiles them into SQL. Domain service owns persisted exclusions and snapshots. Reads are pure projections; no hidden status/audit/notification writes. State-machine transactions remain the sole request status writer with expectedVersion.

States remain SAFE, AT_RISK, BREACHED, PAUSED, MET. AT_RISK is remainingSeconds <=20% of policy snapshot target, inclusive zero. Strictly negative remaining breaches; delayed assessment's logical first breach instant is deadline+1 second. Historical breach stays sticky after a target increase. Policy/assignment changes do not reset consumed time.

DTO preserves all old fields, status and dueAt, adding state=status, deadlineAt=dueAt, breachedBySeconds=max(0,-remainingSeconds), completedAt=effective resolvedHoldAt, riskThresholdSeconds and totalPausedSeconds. A sticky historical breach can have zero current overrun. No extra columns or renamed enum. Deploy the API before the stricter new web client; old-field clients remain compatible.

| Lifecycle | Verified behavior |
|---|---|
| WAITING_USER | Freeze at pausedAt, retain historical breach; repeated pause preserves the first boundary |
| Resume | Accumulate one closed pause only; multiple cycles shift deadline by exact excluded seconds; repeated resume is safe |
| RESOLVED | Freeze at effective resolution, MET if on time and never breached; late resolution preserves BREACHED |
| CLOSED | Finalize at owner confirmation without charging confirmation wait; preserve resolution/deadline assessment |
| REOPEN | Exclude the hold, preserve original start and budget; repeated reopen does not double-count |
| CANCELED | Close any open exclusion, stop, retain nonpaused assessment/history; no later aging, warning or dashboard risk; excluded from existing analytics SLA denominator |

UTC instants, continuous clock, floor-second boundaries, no business-hours calendar. Runtime clock reads/monitoring use PostgreSQL time. Tests inject instants with no sleep for boundaries. Invalid target/date/risk/negative exclusion and backwards lifecycle boundary time are rejected, not reset. Seventeen SQL/scalar parity cases include risk/deadline +/-1 second, multi-wait/hold/reopen, close and cancellation.

UI mismatch removed: no 30-minute classifier in dashboard or detail. All roles use backend state for Vietnamese text and semantic tone; paused historical breach and stopped cancellation remain explicit. No fabricated progress percentage or client ticking clock. Dashboard/read snapshots refresh on load/filter/reset/retry, not continuously.

## Database and performance

Schema changed: NO. Migration added: NO. Count before/after: **6 → 6**. Old migration bytes unchanged. Clean dedicated `mobiflow_m2_test` / `mobiflow_m10_test` databases applied all six migrations, seeded twice, and verified idempotence and least-privilege append-only audit permissions. Only these existing verified synthetic test targets are reset; the live demo database is not reset.

[Implementation-run DB plan and timing evidence](evidence/iterations/M11_M12_DATABASE-6470518dc8dc.json): full integration had 225 synthetic request rows, one aggregate SQL statement, ten real manager HTTP responses in ms: 15.724, 14.273, 14.969, 15.753, 15.166, 15.486, 15.519, 15.758, 15.351, 14.580. Mean 15.258, median 15.419, range 14.273–15.758. EXPLAIN ANALYZE planning 0.339ms, execution 0.319ms. The [latest closure DB evidence](evidence/M11_M12_DATABASE.json) contains the fresh isolated M11/M12 run: 154 rows, mean 13.464ms, median 15.445ms, range 5.854–15.992ms; planning 0.270ms, execution 0.247ms. Different fixture counts reflect full versus selected integration runs. Both small local samples are evidence, not a performance budget, load test, scalability promise or new index justification.

## Implementation-run commands and actual results

The following table records the implementation phase, not a claim that every suite was rerun during closure. Fresh closure commands/results are in the [closure review](M11_M12_CHECKPOINT_CLOSURE.md#fresh-safety-gates).

Browser environment: `MOBIFLOW_WEB_BASE_URL=http://localhost:2500`, `PLAYWRIGHT_HTML_OPEN=never`; single worker, retries=0. Existing ignored local compose override supplies web2500/API2501; tracked defaults remain 3000/3001. Integration runtime URLs: VERIFY_API_URL=http://localhost:2501, VERIFY_WEB_URL=http://localhost:2500. Do not globally override WEB_ORIGIN for isolated integration fixtures.

| Command | Actual final result |
|---|---|
| `npm run lint` | PASS, zero errors/warnings |
| `npm run typecheck` | PASS, strict API/web/shared contracts |
| `npm test` | PASS 85/85: config7/API57/web2/release19; zero skipped |
| `npm run build` | PASS API and Next production build |
| `npm run test:integration:m10` | PASS six migrations, double seed/history/SLA/privilege checks, five release-core tests |
| `npm run test:integration:m11-m12` | PASS workflow3 + new DB/HTTP gate1 |
| `npm run test:integration` with verified runtime URL overrides | PASS 48 real DB tests, including live PDF/TXT/RAG/Ollama recommendation and new M11/M12; zero skipped |
| `npm run test:e2e:m3` | PASS 2/2 |
| `M4_E2E_MODE=offline; npm run test:e2e:m4` | PASS 1/1, actual host Ollama stopped, controlled failure persisted |
| `M4_E2E_MODE=online; npm run test:e2e:m4` | PASS 2/2, actual host Ollama restored, explicit recovery/reload |
| `npm run test:e2e:m5` | PASS 1/1 |
| `npm run test:e2e:m6` | PASS 1/1 |
| `npm run test:e2e:m7` | PASS 1/1 |
| `npm run test:e2e:m8` | PASS 1/1 |
| `npm run test:e2e:m9` | PASS 1/1 |
| `npm run test:e2e:m10` | PASS 3/3, including full axe zero violations on demonstrated analytics |
| `npm run test:e2e:ui-v1-1` isolated after login window expiry | PASS 8/8, 32.8s; [implementation evidence](evidence/iterations/V11_UI_REGRESSION-90f08d1a847f.json) |
| `npm run test:e2e:v1-2` on final rebuilt runtime | PASS 4/4, 27.2s, no skipped/flaky; [implementation evidence](evidence/iterations/M11_M12_BROWSER-1a11dd28724f.json) |
| `docker compose -f docker-compose.yml -f <existing-local-ports-override> build api web` | PASS; refreshed images |
| Same compose files `up -d --no-build --wait --wait-timeout 45` | PASS healthy API/web/PostgreSQL |
| `git diff --check` | PASS |

Attempt history retained: initial lint caught effect-state handling and was fixed without disabling the rule; initial DB aggregate exposed PostgreSQL integer inference for 0.2, fixed with a bound numeric cast and then parity-tested. Initial root runtime checks used wrong default port, then wrong Origin, then a global Origin override leaked into isolated fixtures; the checker now derives Origin from VERIFY_WEB_URL, and the complete command passes without weakening CSRF. Back-to-back UI V1.1 after M9/M10 reached the real manager login rate limit (three HTTP429 failures); the [bounded failure record and raw-log retention decision](M11_M12_CHECKPOINT_CLOSURE.md#rate-limit-attempt) preserve that failure without committing credential-bearing runtime stacks. Security settings are unchanged; the full isolated implementation rerun and fresh closure rerun both passed. No failure is replaced with fake evidence or a skipped test.

## UI, responsive, accessibility and manual review

Three role dashboards render the full backend metrics; list pagination/filtering and original V1.1 layout/styles/navigation remain intact. Request detail's shared indicator matches SLA DTO state. Loading shows no invented zeros; network/API error has recoverable retry. Existing empty list, disabled/action feedback and auth states remain covered by the unchanged suites.

Final new browser suite: all three dashboards and all three role request details at 360/768/1440/1920, **24 axe scans with zero critical/serious violations**, no page-wide overflow, visible primary touch targets >=44px, skip-to-main focus, named headings/regions and text SLA labels, drawer containment/Escape/focus restoration. Final application page/console/network errors=0; known external CSP block counters also 0. Screenshots in `artifacts/v1-2/screenshots`; manually inspected desktop manager dashboard and 360px USER dashboard, preserving hierarchy/wrapping and the original design system. This is targeted verification, not a full WCAG certification.

## AI/RAG and security

Intake/RAG/recommendation/human approval/six Copilot actions/degraded manual flow remain unchanged in product code and pass fresh integration/browser regressions. Live recommendation set: eight SUCCEEDED, schema/reference/candidate valid 8/8; priority and staff agreement **6/8**, retained as model disagreement, not a 100% accuracy claim. No full M9 benchmark reevaluation or M16 evaluation feature was started. Existing M9 historical evaluations remain unchanged.

Authentication still checks live active session/user; RBAC remains non-cumulative. Direct HTTP role matrix is 200 for matching role, 403 for wrong role, 401 absent identity. Spoofed role/owner/assignee/limit/cursor/asOf inputs return 400. Foreign owner/assignee records are excluded; their detail returns 404. Response schemas deny extra global fields. Parameter binding is used for scope, clock, ratio and JSON keys; identifiers are fixed allowlisted source. No raw SQL/user prompt/LLM internal content or secrets returned. Auth limiter, CORS/CSRF, expectedVersion, audit rollback, state authority, source ownership and AI protected-action constraints were neither disabled nor widened.

Final health: READY, coreReady=true, aiReady=true, pgvector UP, host Ollama models UP, RAG READY (9 documents/12 chunks); loopback containers healthy. No production deployment/configuration or destructive demo reset occurred.

## Known limitations and deferred work

- Local synthetic organization and small response-time sample; not scale/enterprise performance evidence.
- Metrics deliberately overlap; STAFF assignedToMe includes terminal readable history and may exceed its open queue.
- Dashboard/DTO snapshots are not a real-time ticking UI. Existing analytics' other caps/window semantics are unchanged; M13 is not started.
- Live AI semantic agreement is imperfect (6/8 priority/staff); M6 similarity negative no-match is 1/2. Source/schema validity is not generalized business or retrieval accuracy. Closure does not rerun a full live-AI evaluation.
- Automated axe plus keyboard/visual checks do not establish full WCAG compliance.
- The stricter new web schema needs the updated API deployed first. No externally incompatible enum/route/mutation change.
- Batch browser runs must respect real authentication windows; the observed rate-limit attempt is preserved.

## Final gate and handoff

M11 PASS: real aggregates, full-scope pagination invariant, role isolation, UI consumption, query/contract/performance evidence, unit/integration/browser gates.

M12 PASS: shared canonical rules and math, exact 20%/deadline boundaries, pause/MET/hold/close/reopen/cancel persistence and SQL parity, preserved version/audit/approval, shared UI projection, full regression.

Implementation combined **PASS — READY FOR HUMAN REVIEW**, with no required implementation check NOT RUN or skipped. The [closure review](M11_M12_CHECKPOINT_CLOSURE.md) records the subsequent pre-commit safety gate, visual review and evidence policy. Checkpoint Git SHA and post-push verification belong in the final closure chat report, avoiding a self-referential documentation commit. No M13/M14/M15/M16/M17 implementation, release tag or main merge. See [M11 section-34 record](../verification/MILESTONE_11_VERIFICATION.md) and [M12 section-34 record](../verification/MILESTONE_12_VERIFICATION.md).

## Exact review file inventory

Implementation handoff inventory: 60 files changed/new, including fresh evidence and retained history. This is the original snapshot, not the final staging manifest; the rate-limit raw report below is subsequently retained under ignored artifacts and excluded. [Closure inventory](M11_M12_CHECKPOINT_CLOSURE.md#file-classification-and-staging-manifest) classifies all original candidates and the final 63 included paths. `M` = modified tracked file; `??` = new untracked file. Ignored builds, browser screenshots/traces and synthetic runtime data are not included.

```text
 M README.md
 M apps/api/package.json
 M apps/api/src/analytics/analytics.service.ts
 M apps/api/src/app.ts
 M apps/api/src/authorization/authorization-policy.service.ts
 M apps/api/src/requests/request-query.service.ts
 M apps/api/src/requests/sla-clock.ts
 M apps/api/src/requests/sla-monitor.service.ts
 M apps/web/src/components/request-list.tsx
 M apps/web/src/components/ui/patterns.tsx
 M docs/IMPLEMENTATION_PLAN.md
 M docs/specs/API_SPEC.md
 M docs/specs/AUTHORIZATION_SPEC.md
 M docs/specs/DATABASE_SPEC.md
 M docs/specs/PROJECT_SPEC.md
 M docs/specs/SLA_SPEC.md
 M docs/verification/evidence/M4_BROWSER_OFFLINE.json
 M docs/verification/evidence/M5_CLEAN_DATABASE_LIVE.json
 M docs/verification/evidence/M6_CANDIDATE_EVAL.json
 M docs/verification/evidence/M6_RECOMMENDATION_EVAL.json
 M docs/verification/evidence/M6_RECOMMENDATION_PROGRESS.json
 M docs/verification/evidence/M6_SIMILAR_CASE_EVAL.json
 M package.json
 M packages/contracts/src/index.ts
 M packages/contracts/src/workflow.ts
 M scripts/verification/m2-integration.mjs
 M scripts/verification/m2-runtime.mjs
?? apps/api/src/dashboard/dashboard.controller.ts
?? apps/api/src/dashboard/dashboard.service.ts
?? apps/api/src/requests/sla-sql.ts
?? apps/api/test/dashboard-sla.integration.test.mjs
?? apps/api/test/dashboard-sla.test.mjs
?? apps/web/e2e/dashboard-sla-v1-2.spec.mjs
?? apps/web/src/components/dashboard-metrics.tsx
?? apps/web/src/lib/sla-presentation.ts
?? apps/web/test/sla-presentation.test.mjs
?? docs/v1.2/M11_M12_IMPLEMENTATION_PLAN.md
?? docs/v1.2/M11_M12_VERIFICATION.md
?? docs/v1.2/evidence/M11_M12_BROWSER.json
?? docs/v1.2/evidence/M11_M12_DATABASE.json
?? docs/v1.2/evidence/V11_UI_RATE_LIMIT_ATTEMPT.json
?? docs/v1.2/evidence/V11_UI_REGRESSION.json
?? docs/verification/MILESTONE_11_VERIFICATION.md
?? docs/verification/MILESTONE_12_VERIFICATION.md
?? docs/verification/evidence/iterations/M4_BROWSER_OFFLINE-v1-1-release.json
?? docs/verification/evidence/iterations/M5_CLEAN_DATABASE_LIVE-v1-1-release.json
?? docs/verification/evidence/iterations/M6_CANDIDATE_EVAL-a07d9a3cb363.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_EVAL-9865fa60993a.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-2a398766c5fe.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-3c3f1678873b.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-48eef04a51a9.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-5789574db191.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-6597c999356c.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-7a8ec419aa74.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-89472278a7ad.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-a5d8ccf2a325.json
?? docs/verification/evidence/iterations/M6_RECOMMENDATION_PROGRESS-f5969d5503ea.json
?? docs/verification/evidence/iterations/M6_SIMILAR_CASE_EVAL-8900db443566.json
?? packages/contracts/src/dashboard.ts
?? playwright.v1-2.config.mjs
```
