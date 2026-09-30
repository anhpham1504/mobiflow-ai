# MobiFlow AI V1.2 — M13 Analytics V2 verification

Verified 2026-09-30. **M13 PASS — READY FOR HUMAN REVIEW.** Fresh real-PostgreSQL integration passed 13/13; the production-build browser gate passed 4/4 with responsive/Axe checks and final visual review. Changes remain uncommitted and reviewable. M14–M17 are NOT STARTED.

## Baseline and authority

- Previous release: `v1.1.0`, commit `2604590a0ff07bee8b994cc337d8f7e42da61e70`.
- M11/M12 checkpoint: `a03cebc581a05639ad2df3801fb565bed92800bf`; branch `feat/v1.2-operational-dashboard-sla-v2`; clean starting working tree, as recorded by the M13 preflight and [implementation plan](M13_ANALYTICS_V2_IMPLEMENTATION_PLAN.md).
- The explicit M13 execution request authorizes Analytics V2 only. M14–M17 remain unauthorized and NOT STARTED. Historical M0/M11/M12 execution limits are preserved as history, rather than interpreted as current authorization.
- Delivery policy: leave the working tree dirty and reviewable. No automatic commit, push, tag or main merge. The six existing migrations remain unchanged.

## Architecture and changed modules

The existing manager endpoint and page are extended. Nest `AnalyticsController` validates the strict shared query and delegates to `AnalyticsService`; controller guards and service-level active MANAGER revalidation remain in place. `analytics-query.ts` performs one bound PostgreSQL aggregate statement over current Request dimensions, immutable RequestResolution cycles, SlaInstance, Feedback, AiRecommendation and AiRun. Counts, distributions, means, decision rates, discrete latency percentiles and zero-filled daily trends are computed in SQL, without materializing raw request/AI records or applying the old 1,000/5,000-row limits in JavaScript.

`packages/contracts/src/analytics.ts` owns query and response Zod schemas. The web client validates the response and renders the existing Analytics page with V1.1 components and scoped analytics CSS. No new endpoint, role, request state, dependency or chart package is introduced. The original synthetic M9 evaluation snapshots remain a separate development-evidence section and are independent of operational filters.

| Area | Files/modules |
|---|---|
| API | `apps/api/src/analytics/analytics.controller.ts`, `analytics.service.ts`, new `analytics-query.ts` |
| Contracts | `packages/contracts/src/analytics.ts` |
| Web | `apps/web/src/components/analytics-dashboard.tsx`, analytics rules in `apps/web/src/app/globals.css` |
| Tests | New `apps/api/test/analytics-v2.test.mjs`, `analytics-v2.integration.test.mjs`, `helpers/analytics-v2-fixture.mjs`, `apps/web/e2e/analytics-v2.spec.mjs`, `playwright.m13.config.mjs` |
| Test tooling | `scripts/verification/m13-database.mjs`, `m13-seed.mjs`, `m13-integration.mjs`, `m13-browser.mjs`; package script registration |
| Documentation | README, implementation plan, PROJECT/API/DATABASE/SLA/UI/TEST_STRATEGY owning-spec amendments, this report and [Milestone 13 record](../verification/MILESTONE_13_VERIFICATION.md) |

Canonical M11/M12 dashboard/clock/state-machine implementations, protected AI decision writers, AI prompts, recommendation schemas and six Copilot business actions are unchanged. No M14 feature is implemented.

## API, filters and time semantics

GET `/api/v1/analytics`, OpenAPI operationId `getManagerAnalytics`, returns `{data,requestId}` with typed period, filters/filterOptions, operations, SLA, reopen, feedback, AI, Copilot, trends, separate evaluations and legacy overview fields. Cache-Control is `no-store`; the existing authenticated read limit remains 120/minute.

| Query | Contract |
|---|---|
| `preset` | `7d`, `30d`, `90d`; default `30d` |
| `from` / `to` | Paired ISO calendar dates; inclusive from, exclusive to; 1–365 daily buckets |
| `windowDays` | Deprecated compatibility alias, integer-string 1–365; cannot combine with preset/custom dates |
| `priority`, `status`, `category` | Existing controlled enum values |
| `teamId` | UUID matching the request's current normalized team; absent/unknown matching populations remain empty |

Unknown fields, duplicate/array-valued fields, malformed dates/enums/UUIDs, missing date pair, zero/reversed/overlong range and mixed modes return shared 400 `INVALID_INPUT`. USER/STAFF receive 403 and unauthenticated callers receive 401. No caller-provided role/owner/assignee scope override is accepted.

All calendar boundaries and grouping use `Asia/Ho_Chi_Minh`. PostgreSQL resolves presets at one statement timestamp, ending at tomorrow's local midnight; custom dates use the same explicit timezone. Response period carries date labels, exact UTC instants, day count, timezone, daily granularity and `asOf`. Future ranges are allowed and return activity only when matching persisted source events exist. Filters use the request's current dimensions for all event groups; the system does not reconstruct historical status/priority/team snapshots.

Legacy `windowDays` now uses these Vietnam calendar boundaries rather than a rolling 24-hour cutoff. Legacy overview snapshot fields are retained but omitted from the new operational page. Strict V1.1 Zod clients reject the additive response keys: deploy API/web together and reload the browser; retention of legacy fields is not a claim of old strict-client compatibility.

## Metric definitions and observed fixture values

The detailed definitions are frozen in [the implementation plan](M13_ANALYTICS_V2_IMPLEMENTATION_PLAN.md#metric-definitions). The following values come from the fresh completed integration evidence, including the isolated boundary check; they are synthetic source-data measurements, not real customer outcomes.

Custom fixture: `[2026-03-01,2026-03-04)` in Vietnam, represented as `[2026-02-28T17:00:00.000Z,2026-03-03T17:00:00.000Z)`.

| Group/metric | Exact population or denominator | Observed synthetic value |
|---|---|---|
| `requestVolume` / `createdCount` | Matching requests created in the period; equal aliases | 7 / 7 |
| `resolvedCount` | Distinct request IDs with valid immutable resolution events in the period, including later reopened requests | 6 |
| `closedCount` | Matching requests whose valid closedAt falls in the period, regardless of creation date | 3 |
| Status distribution | Current states of the creation cohort | NEW 1; CLOSED 2; RESOLVED 2; IN_PROGRESS 1; CANCELED 1; others 0 |
| Priority distribution | Current priorities of the creation cohort | LOW 3; MEDIUM 1; HIGH 2; URGENT 1 |
| Daily created / resolved | Creation counts / distinct resolved request IDs per Vietnam calendar day | Mar 1: 5/1; Mar 2: 1/4; Mar 3: 1/2 |
| Reopened count / rate | Distinct resolved-cohort requests whose same cycle reopened before min(to,asOf), divided by period distinct resolutions | 2 / 6; 33.333…% |
| SLA eligible / met / breached | Valid current RESOLVED/CLOSED completions in the resolution period, classified by canonical M12 expressions | 3 / 1 / 2 |
| SLA compliance | MET / eligible, with MET + BREACHED = eligible | 1/3; 33.333…% |
| Average SLA-effective resolution seconds | First-assignment budget consumed, excluding WAITING_USER and completed resolution holds, among eligible samples | 30,173.666666666668 seconds |
| Average wall-clock resolution seconds | Creation to current effective resolution among those valid completion samples | 145,800 seconds |
| Feedback count / mean / distribution | Immutable feedback submitted in the period; bins 1–5 | 2 / 4 / {1:0,2:0,3:1,4:0,5:1} |
| AI recommendations generated | Actual AiRecommendation rows created in the period, independent of review time | 4 |
| Accepted / modified / rejected | Explicit noninvalidated terminal records with reviewedById and reviewedAt in the period | 1 / 1 / 1 |
| Decision rates | Each outcome count / sum of the three reviewed outcome counts | Each 1/3; denominator 3 |
| AI runs / success / failure / latency p50 | Matching persisted runs created in the period; measured metadata only | 14 / 11 / 1 / 100 ms |
| Copilot total / success / failure / canceled / pending | Matching persisted COPILOT runs by creation time and stored status | 10 / 7 / 1 / 1 / 1 |
| Copilot unclassified | Null/unsupported legacy action, retained only in total | 1 |

Daily resolved counts sum to 7 while period distinct resolvedCount is 6 because a request may resolve on different days. Multiple cycles on the same day must count once for that day's request count. Reopening a cycle resolved before the selected period must not inflate the numerator for a fresh in-period resolution; the new transaction-scoped regression explicitly tests that case.

The six existing Copilot actions are unchanged: SUMMARIZE_REQUEST 2 runs; FIND_SOP 3; SUGGEST_NEXT_STEP 1; GENERATE_CHECKLIST 1; FIND_SIMILAR_REQUESTS 1; EXPLAIN_CLASSIFICATION 1. Their sum is 9; the unclassified run accounts for the remaining total. Manual triage/reviews do not fabricate AI recommendation records. Generated and reviewed populations can differ because they have separate event timestamps.

SLA averages and compliance exclude canceled stops, reopened active work, absent/malformed clocks and invalid completion timestamps. M12 deadline equality is met; historical breach remains sticky after a target increase. Current-completion SLA eligibility can be smaller than historical resolution activity. Empty populations return zero counts with null rates/averages, never an invented 100% compliance or missing feedback score. No composite AI score or measured-model-accuracy claim is introduced.

## Database isolation and measured performance

Schema changed: **NO**. Migration/index added: **NO**. Migration count: **6 → 6**. No persisted aggregate table, new vector store or production infrastructure configuration.

Both dedicated M13 runners require explicit `DEMO_MODE=true` and validated loopback PostgreSQL URLs. They acquire an advisory lock, create only the fixed `mobiflow_m13_test` synthetic target, refuse an already-existing target rather than overwrite it, and clean up the database they created. The M13 seed process adds this exact validated test target to its in-process seed allowlist; production seed/reset guards and running demo data are unchanged. Credentials remain in ignored local configuration and are not copied into evidence.

Fresh [database evidence](evidence/M13_DATABASE.json), recorded `2026-09-30T12:07:37.669Z`, contains 5,122 total synthetic request rows and 5,119 AI-run rows, including a 5,101-request bulk cohort. All 12 checks pass, with 13 tests including the parent. All bulk requests/resolutions/SLA samples/feedback/modified decisions/runs are counted, demonstrating removal of the earlier materialization caps.

- Aggregate query count: one statement; one separate manager-identity read. Existing auth/session queries are excluded from this instrumentation count, not claimed absent.
- Eleven real HTTP response samples: median **96.558 ms**, range **88.428–110.563 ms**. HTTP timings include normal endpoint processing.
- EXPLAIN ANALYZE/BUFFERS: planning **3.232 ms**, execution **94.967 ms**, shared-hit blocks **16,088**. Full local plan: `artifacts/m13/sql-plan.json`.
- These are local, single-client synthetic samples; no enterprise-scale, concurrency, load-test or performance-SLO claim is made. Current-dimension materialization and event-table scans remain scale risks. No index is justified solely by an invented target.

The added lifecycle check creates its team/requests/resolution/audit rows inside an interactive transaction, injects a deterministic asOf, deliberately rolls back, and asserts no temporary rows remain. Its fresh execution passed, covering exact from/to resolution boundaries, same-day cycles and older-cycle reopen exclusion without changing the shared fixture or performance cohort.

## Commands and actual final results

| Command | Actual result and scope |
|---|---|
| `npm run test:unit:m13` | PASS 8/8: four new M13 contract/query/service tests and four existing analytics units |
| `node --env-file=.env scripts/verification/m2-integration.mjs --m6-only --pattern 'M9 analytics'` | PASS 1/1 directly affected existing analytics case against real PostgreSQL; not a full historical M9/model gate |
| `npm run test:integration:m13` | Earlier completed run PASS 12 tests including the parent; superseded by the fresh runner below after lifecycle coverage was added |
| `node --env-file=.env scripts/verification/m13-integration.mjs` | Fresh PASS 13/13, including boundary/reopen transaction rollback; final 12-check DB evidence recorded 12:07:37.669Z |
| `npm run lint` | Fresh PASS after final browser-locator fixes, zero errors/warnings |
| `npm run typecheck` | PASS after the one-day chart fix |
| `npm test` | Fresh PASS 89/89: config 7, API 61, web 2, release tooling 19; zero skipped |
| `npm run build` | PASS API and Next production build after the one-day chart fix |
| `node --check apps/api/test/analytics-v2.integration.test.mjs` | PASS syntax check after addition; does not execute PostgreSQL tests |
| `npm run test:e2e:m13` | Fresh PASS 4/4 in 19.319 seconds, zero skipped/unexpected/flaky; final browser evidence recorded 12:10:45.027Z |
| `git diff --check` | PASS; only normal CRLF warnings, no whitespace errors |
| M11/M12 integration/browser regression | NOT RUN — canonical shared dashboard/SLA implementations and lifecycle writers unchanged |
| Other M0–M10 historical integration/browser/live-model regression | NOT RUN — intentionally outside M13 scope under the execution request |

`npm test` is the explicitly requested fast repository unit/release-tool gate; it does not run historical integration/browser/live-model suites. Test runners use real PostgreSQL and the production-built web app for their relevant boundaries, with no fixture substitutions for a missing database. The interrupted local runtime was restored, and the validated orphaned M13 synthetic target was inspected and cleaned before the fresh required gates. No extra historical gate was added.

## Failed attempts, repairs and review findings

1. Initial M13 fixture setup hit the existing seed-target guard because the new synthetic test DB was not allowlisted. The repair validates the exact loopback `mobiflow_m13_test` target, then adds it only within the M13 seed process. The production demo guard was not weakened.
2. An initial timezone-independence integration check exposed the installed Prisma pg adapter's normalization of timestamp values returned from a non-UTC session. Response boundaries/asOf now use explicit UTC ISO text formatting in SQL. Fresh integration verifies the same custom boundaries/trends under an America/New_York database session; no timezone test was removed.
3. The first browser attempt timed out waiting for exact `getByLabel('Khoảng thời gian')`; its error context reported the 180,000 ms timeout and the run was interrupted before a complete report. An intermediate completed browser attempt had three failed cases out of four. Repairs use named combobox-role locators, reopen the day-table disclosure after a query refresh remounts it closed, and scope alert assertions to the analytics page rather than Next's route announcer. No assertion was removed. Final browser execution passes all four cases; partial/intermediate failures are recorded here rather than labeled PASS.
4. Read-only review found that a one-day trend rendered single-point polylines with no visible segment. Visible point markers and a one-day browser assertion were added. Fresh browser execution verifies two series markers and the exact single-day table; screenshot `artifacts/m13/screenshots/single-day-1440.png` was generated.
5. Review requested stronger lifecycle coverage for exact resolution boundaries, same-day repeated cycles and older-cycle reopen attribution. The isolated rollback check passed in the fresh 13-test real PostgreSQL run.
6. An interruption left Docker/local runtime stopped and an orphaned isolated synthetic target. The verifier restored the existing Docker Desktop with a hidden launch, started the existing PostgreSQL service, checked the M13 target markers and zero active database sessions, and cleaned only the verified synthetic target before rerunning gates. No installer, production configuration or live demo reset was introduced.

No failed attempt is substituted with a fabricated success, skipped test or relaxed authorization/schema check. Historical M9 and M11/M12 verification/evaluation evidence is unchanged.

## UI, responsive, accessibility and manual review

Implemented page behavior: calendar/filter form with backend-authoritative queries; four operational KPIs; daily SVG/text/table trend; creation-cohort breakdown; SLA and reopen explanations; explicit manager decision rates; immutable feedback distribution; six-action Copilot counts; separate synthetic evaluation section. Loading uses the existing skeleton pattern without numeric placeholders. Empty periods use Vietnamese no-data copy. Errors and invalid responses use sanitized recoverable retry. Superseded requests are aborted and cannot overwrite current results. Null samples display unavailable copy rather than performance judgments.

Fresh [browser evidence](evidence/M13_BROWSER.json), recorded `2026-09-30T12:10:45.027Z`, confirms Microsoft Edge/Playwright against the production-built app and isolated real API/DB. All four cases passed in 19.319 seconds, with no skipped, unexpected or flaky cases.

| Required browser/manual check | Final result |
|---|---|
| Complete M13 E2E, fixture/API/UI metric agreement, presets/custom/filtering | PASS; 7/30/90-day created counts 6/10/11; custom cohort 7 created/6 resolved/1/3 compliance |
| Loading/empty/error/retry/invalid-response/superseded-request behavior | PASS |
| One-day trend visibility | PASS; two SVG point markers and exact single-day table verified |
| Keyboard skip-to-main and exact trend table disclosure | PASS |
| Responsive 360 / 768 / 1440 / 1920 | PASS at each width; no page-wide overflow |
| Axe zero serious/critical on required states | PASS; four recorded responsive scans each have zero total violations and zero serious/critical; loading/error/empty scans also pass |
| Final page/console/network error accounting | PASS; page/console errors 0, failed requests 0, external CSP blocks 0 |
| Final screenshot visual inspection | PASS; fresh 360px/768px/1440px/1920px and one-day screenshots manually reviewed; readable data/labels/controls, no clipping, visible one-day markers |

Code/spec review confirms consistent bound filters, distinct resolution populations, explicit noninvalidated reviewed decisions, SLA canonical reuse and the current-dimension limitation. No confirmed backend/RBAC blocker was found. Fresh executed browser checks and screenshot review supplement that static review. The application shell/design tokens/branding and protected business flows are preserved; targeted accessibility verification does not imply full WCAG certification. Final screenshots are under `artifacts/m13/screenshots`; the browser report and SQL plan remain local artifacts.

The one-day full-page screenshot captures the sticky shell partway down the page after focused controls scrolled the viewport; the chart markers and exact data table render correctly. This is a capture-state detail rather than clipping of the live page. Final cleanup confirmed `mobiflow_m13_test` absent and localhost 3000/3001 free after the gate.

## Security, limitations and deferred metrics

Fresh direct HTTP evidence: MANAGER 200; USER/STAFF 403; unauthenticated 401; invalid/duplicate/unknown filters 400 `INVALID_INPUT`; `no-store`; OpenAPI security/query/response references valid. Service unit negatives reject inactive/stale managers before SQL execution. Every input value is bound, identifier fragments are static, and responses expose aggregates/safe team metadata rather than request IDs/text, personal data, feedback comments, prompts, raw tool/model outputs, credentials or hidden reasoning. Read checks confirm no request-history/audit/notification writes from analytics. Protected mutations and their expected-version protocol remain unchanged.

Known limitations: current request dimensions rather than historical event-time dimensions; historical resolution activity versus current effective SLA completions; generated-versus-reviewed time populations; sparse/legacy metadata represented explicitly; dev evaluations independent of operational filters; paired API/web schema update; local synthetic performance sample only; snapshots refresh on query/retry rather than continuously.

Final audit: local M13 Markdown links resolve; the targeted secret-pattern scan has no hits. Historical evaluation/M11/M12 evidence, Prisma schema/migrations, lockfile and Docker Compose have no diffs. The audit did not broaden the test gate into unrelated historical suites.

Deferred: arbitrary historical backlog snapshots, staff productivity/ranking, arbitrary BI granularity, predictive/composite AI scores and wall-clock time-to-close. These are outside current reliable sources or M13 scope. No real customer data, additional role, AI action, model/prompt change, autonomous loop or infrastructure feature is introduced.

## Final gate and Git state

**M13: PASS — READY FOR HUMAN REVIEW.** Required targeted units, fresh PostgreSQL integration, M13 browser tests, static gates, responsive/Axe/console/network evidence and visual review are complete. No M13 release blocker remains. This implementation gate does not authorize a release tag, main merge or later milestone.

Branch remains `feat/v1.2-operational-dashboard-sla-v2`; dirty/reviewable delivery intended. Committed: **NO**. Pushed: **NO**. Tagged: **NO**. Main merged: **NO**. M14: **NOT STARTED**; further milestone execution requires separate user authorization after M13 review.

Final Git inventory: **30 changed files — 15 modified, 15 new**, using `git status --untracked-files=all`. Branch/HEAD remain unchanged at the checkpoint; no commit/push/tag/main merge was performed.
