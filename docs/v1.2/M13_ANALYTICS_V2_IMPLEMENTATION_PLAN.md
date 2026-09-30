# M13 Analytics V2 Implementation Plan

Authorized 2026-09-30 by the M13 execution request. Scope ends at M13; M14–M17 are not authorized. No commit, push, tag or main merge.

## Baseline and current architecture

Preflight: clean `feat/v1.2-operational-dashboard-sla-v2`, HEAD `a03cebc581a05639ad2df3801fb565bed92800bf`; previous release `v1.1.0` at `2604590a0ff07bee8b994cc337d8f7e42da61e70`. M11/M12 evidence records PASS. Six migrations; no schema change planned.

Nest AnalyticsController guards MANAGER, AnalyticsService rechecks active manager identity. The existing GET `/api/v1/analytics?windowDays=30` returns `{data:{overview,ai,evaluations},requestId}` via shared Zod contracts. It mixes current open/risk snapshots with rolling activity, materializes up to 1,000 resolutions and 5,000 runs/reviews, and has no day trends or feedback/Copilot breakdown. Next AnalyticsDashboard uses the session API client, skeleton/error patterns and V1.1 CSS. M9 evaluation files are development evidence, not operating accuracy.

## Audited source fields

| Source | Available reliable fields | Use |
|---|---|---|
| Request | createdAt, closedAt, approved priority/category/teamId, current status | Creation cohort and current breakdown; immutable closure activity |
| RequestResolution | requestId, cycle, resolvedAt, reopenedAt, confirmedAt | Historical resolution activity and reopened resolution cohort; survives clearing Request.resolvedAt |
| RequestStatusHistory / audit | versioned edges linked to immutable events | Lifecycle cross-checks; do not double-count joined events |
| Assignment | assignedAt/endedAt/team/staff, explicit decisionKind | Establishes SLA origin; current team filter is Request.teamId, not historical assignment team |
| SlaInstance | startedAt, resolvedHoldAt, stoppedAt, exclusions, target, breachedAt | Existing M12 `slaStateSql` and `slaElapsedSql`; no new classifier |
| Feedback | one immutable 1–5 rating per closed request, createdAt | Submitted feedback count, mean and distribution; no inferred missing scores |
| AiRecommendation | createdAt, terminal status, reviewedById/reviewedAt, invalidatedAt | Actual generation and actual reviewed decisions; manual drafts are excluded |
| AiRun | purpose, action, createdAt/status, latency/retry/version metadata | Operational runs and six persisted Copilot actions; no prompts/results returned |
| Team / taxonomy | real normalized Team and approved category enum | Supported server filters and safe team select metadata |

## Canonical query and time semantics

Extend the existing endpoint. Query is a strict shared schema: optional `preset=7d|30d|90d` (default 30d), or paired `from`/`to` ISO calendar dates, optional priority/status/category/teamId. Legacy `windowDays` integer-string 1–365 remains an exclusive compatibility alias; it cannot combine with preset/custom dates. Unknown fields, duplicate/array fields, malformed dates/enums/UUIDs, missing pair, from>=to and >365 days return shared 400 INVALID_INPUT. Custom daily ranges support 1–365 days. The old analytics-only VALIDATION_ERROR code is normalized to the repository's shared validation helper.

SQL uses one statement_timestamp, the existing `Asia/Ho_Chi_Minh` policy, inclusive from and exclusive to. Presets cover N complete calendar labels through today, ending at tomorrow's local midnight. Date-only values are converted to UTC instants by PostgreSQL with explicit timezone; never use the host timezone. Response period echoes date labels, exact UTC boundaries, day count, timezone, daily granularity and asOf. Future custom periods are allowed and truthfully empty. All event timestamps are filtered in SQL, including exact midnight boundaries. Filters apply to the request's **current approved** dimensions for every group; historical dimensions at event time are not stored consistently and are not inferred.

## Metric definitions

| Metric | Population / formula |
|---|---|
| requestVolume / createdCount | Matching requests created in [from,to); equal aliases |
| resolvedCount | Distinct matching request IDs with a valid RequestResolution.resolvedAt in the period, including later reopened requests; multiple cycles count once over the period |
| closedCount | Matching requests with valid closedAt in the period; creation may precede period |
| status/priorityDistribution | Current status/priority of the creation cohort, not a reconstructed historical backlog |
| daily created/resolved | Creations and distinct resolved request IDs per Vietnam calendar day; one request resolved on different days appears on both days, so daily resolved sum can exceed period distinct resolvedCount |
| reopenedRequestCount / reopenRate | Distinct requests with a resolution in the period whose same resolution cycle reopened at/after resolution and before min(to,asOf), divided by resolvedCount; null if denominator zero. Reopening an older cycle is not attributed to a newer resolved cohort |
| slaEligibleCount | Matching currently RESOLVED/CLOSED requests with an effective resolvedAt in the period, a valid completed SLA clock and canonical M12 MET/BREACHED assessment. CANCELED/stopReason CANCELED, reopened active work, missing/malformed clocks excluded |
| slaMetCount / slaBreachedCount | Eligible canonical states; their sum is eligible. No active-risk snapshot card |
| slaComplianceRate | met / eligible; null when no eligible completions |
| averageResolutionSeconds | Mean canonical SLA-effective elapsed seconds among eligible completions, from first assignment, excluding WAITING_USER and completed resolution holds. Deadline equality is met; sticky breach stays breached |
| averageWallClockResolutionSeconds | Separate mean creation-to-current-resolution among those valid completions, includes preassignment/pauses/holds; explicit name prevents mixing clocks |
| feedbackCount / averageFeedbackScore / distribution | Feedback submitted in the period on matching requests; average null if count zero; bins 1–5 |
| recommendationsGenerated | Actual AiRecommendation rows created in period, independent of review time |
| accepted/modified/rejected | Actual noninvalidated terminal AiRecommendation rows with reviewer and reviewedAt in period (even if generated earlier); denominator=sum of these, each rate=count/denominator or null |
| AI runs | Matching persisted AiRuns created in period; SQL success/failure/repair, averages and discrete p50/p95 metadata aggregates; queue time and latency are different measures |
| Copilot | Matching AiRun purpose=COPILOT created in period, counts by the unchanged six-action enum, SUCCEEDED/FAILED/CANCELED/pending. Null/unsupported legacy action is explicitly unclassified, never a new action |

Zero counts describe activity only; zero denominators produce null rates/averages. Evaluations remain clearly labeled synthetic/dev, with original metadata and limitations, outside operational filters. Keep legacy overview snapshot fields for compatibility (current open/highUrgent, creation-cohort canonical SLA state counts, current effective-resolution wall-clock average); the UI consumes only new event/completion groups. Legacy windowDays now follows the same Vietnam whole-calendar period, not the old rolling 24-hour cutoff; this amendment is explicit. Remove snapshot KPIs from the page.

## Query strategy, RBAC and performance risks

One bound Prisma SQL aggregate statement with clock/period/matched request CTEs, event-time predicates, conditional counts, grouped distributions and generate_series for zero-filled days. No findMany cap, N+1 or one-call-per-point. SQL returns aggregates and safe team options only. Active MANAGER revalidation and existing auth/session reads remain separate and measured. Use existing authenticated read limiting and no-store. USER/STAFF direct HTTP 403, no identity overrides. No SQL string interpolation or PII/request/feedback text/prompts/AI output projection.

Existing indexes suit the local dataset; date predicates on resolution/review/run/feedback can require scans. Measure on isolated synthetic PostgreSQL (including >5,000 rows to detect old truncation), HTTP samples, aggregate query count and EXPLAIN ANALYZE/BUFFERS. Add no index/migration without measured necessity. Local timings are not enterprise scale evidence.

## UI plan

Preserve shell, colors, typography and components. Calendar preset/custom form and priority/status/team/category filters apply one server query; abort superseded requests and prevent stale results. Four top KPIs: created, resolved, SLA compliance and effective resolution duration. Daily trend SVG plus exact accessible data table/text summary, creation-cohort breakdown, completion SLA explanation, explicit AI decisions, feedback and six Copilot action counts. Keep synthetic evaluation evidence in a distinct section. Use skeletons without numeric placeholders, Vietnamese empty copy, sanitized errors with retry, null-aware labels, keyboard focus and responsive 360/768/1440/1920 layouts. No chart dependency.

## Test plan

Targeted contracts/query/service tests: strict filters, 0/1/365-day range, leap dates, parameter binding, inactive/wrong-role service negatives, empty/null handling and daily aggregation. Dedicated real PostgreSQL M13 fixture verifies single/multiple days, half-open timezone boundaries, all implemented metrics, cancellation and paused/hold/sticky/deadline M12 parity, reopen cycles, distinct counts, feedback, explicit decisions, old/new generated/review times, all Copilot actions/unclassified, filter intersection, zero-filled trends, >5,000 uncapped rows, direct HTTP RBAC, OpenAPI and response leakage. Isolate/recreate only named loopback synthetic M13 databases; leave running demo data untouched.

M13 browser command starts test API and web against isolated synthetic data, verifies API/fixture agreement, all presets/custom range, filters, empty/loading/error/retry, superseded requests, keyboard, responsive and Axe serious/critical zero. Run existing analytics unit and M9 analytics integration only. Run npm lint/typecheck/test/build as requested; npm test contains fast historical units but does not run historical integration/browser/model evaluations. M11/M12 regression only if their shared implementation changes (none planned). Record exact actual commands/results; unavailable is NOT RUN.

## Deferred metrics and risks

Historical status/priority/team snapshots at arbitrary day, staff productivity/ranking, arbitrary BI granularity, prediction/AI scores and wall-clock time-to-close are deferred. Immutable resolution activity, completion-SLA effectiveness, feedback, explicit decision rates and Copilot counts are supported now; no essential source or migration is missing. Counts measure synthetic local activity, not real customer performance or universal AI correctness. Strict V1.1 Zod clients reject added response keys, so API/web are a paired update with a browser reload after both are deployed. Legacy fields remain for reading consumers; that does not claim old strict-client compatibility. No dependency or deployment configuration change.
