# V1.2 M11 + M12 implementation plan

Implementation-phase authorization, 2026-09-30: M11/M12 only, with no commit/push/tag/merge at that phase. The subsequent checkpoint-closure request authorizes review, fresh safety gates, one checkpoint commit and feature-branch push. No tag/main merge or M13–M17 work is authorized. See [closure review](M11_M12_CHECKPOINT_CLOSURE.md) for the final file/evidence decisions.

## Baseline and audit

- Clean start on `feat/v1.1-mobifone-ui-refresh`; `main` fast-forward pull was already up to date. HEAD, main and dereferenced `v1.1.0` are `2604590a0ff07bee8b994cc337d8f7e42da61e70`.
- Work branch: `feat/v1.2-operational-dashboard-sla-v2` from main/release.
- npm workspaces / Next App Router / Nest / shared Zod contracts / Prisma / one PostgreSQL+pgvector. Six immutable migrations. No new dependency planned.
- `RequestList` derives dashboard cards from a list limited to 20 rows. List filtering/pagination must remain independent of dashboard scope.
- `sla-clock.ts` already owns continuous second-normalized math, 20% risk, sticky breach, multiple pauses, resolution hold, close/reopen/cancel. State-machine transactions use DB time and expectedVersion, append history/audit/notifications. Keep that lifecycle and human approval unchanged.
- UI `SlaIndicator` and dashboard currently derive risk at 30 minutes. Replace this mismatch with canonical backend state. No visual redesign.
- Storage already has startedAt/dueAt/targetSeconds, pausedAt/totalPausedSeconds, resolvedHoldAt/totalResolvedHoldSeconds, stoppedAt/stopReason, status/breachedAt/assessedAt/version. Request has resolvedAt and currentAssigneeId. Additional DTO values can be derived: no migration or enum rename necessary.
- RBAC: USER createdById; STAFF currentAssigneeId (including terminal read-only history); MANAGER all requests in the one synthetic organization. Roles are not cumulative. Preserve 401/403/404 semantics.
- Unassigned work can be assigned only via PENDING_APPROVAL → APPROVE_AND_ASSIGN; NEW/TRIAGED cannot be assigned directly. Counts must not invent an assignment bypass.

## M11 proposed contract and semantics

Three explicit guarded routes, one aggregate service: GET `/api/v1/dashboard/user`, `/staff`, `/manager`. No query input, no caller role/owner/scope override. Existing authenticated read limiter applies. Shared discriminated dashboard response includes role, asOf, timeZone and day window plus only the role's metrics; no IDs, rows, directory or global counts for USER/STAFF.

| Role | Metric | Definition within authorized scope |
|---|---|---|
| USER | openRequests | All eight nonterminal states, including RESOLVED awaiting confirmation |
| USER | inProgress / waitingForUser / resolved / closed | IN_PROGRESS / WAITING_USER / RESOLVED / CLOSED respectively |
| STAFF | assignedToMe | All currently assigned records, including terminal readable history |
| STAFF | active | ASSIGNED, IN_PROGRESS, WAITING_USER |
| STAFF | waitingForUser | WAITING_USER |
| MANAGER | open | All eight nonterminal states |
| MANAGER | pendingApproval | PENDING_APPROVAL |
| MANAGER | unassigned | PENDING_APPROVAL and currentAssigneeId IS NULL |
| STAFF/MANAGER | resolvedToday | Current RESOLVED/CLOSED with resolvedAt inside today's half-open Asia/Ho_Chi_Minh day; reopened records excluded |
| all | slaAtRisk / slaBreached | Nonterminal records whose freshly computed canonical SLA state is AT_RISK / BREACHED; CLOSED/CANCELED excluded, PAUSED not double-counted |

One bound SQL conditional aggregation statement: DB statement time, authorized WHERE before join, unique requestId SLA join, common canonical clock expression/rules, COUNT FILTER. No list fetch/Javascript counting, N+1, scheduler-lag dependency or ad hoc index. SELECT only; no domain mutation. Independently fetch dashboard and list in the UI with explicit loading/error/retry/abort handling, preserving existing grid/components/styles.

## M12 canonical implementation

- Keep SAFE, AT_RISK, BREACHED, PAUSED, MET; aliases `state`/`deadlineAt` are additive alongside existing `status`/`dueAt` for compatibility.
- Central constants, elapsed-budget formula and ordered classification rules shared by scalar and SQL evaluation. Risk boundary <=20% of selected policy target; zero remaining is AT_RISK; strictly negative is BREACHED. Historical breachedAt stays sticky.
- DTO adds state/deadlineAt/breachedBySeconds/completedAt/riskThresholdSeconds/totalPausedSeconds. completedAt is the effective resolution instant, not owner confirmation. A historically breached request with increased target has breach flag but nonnegative breachedBySeconds=0; do not claim a current overrun.
- WAITING_USER freezes at pausedAt. Resume accumulates each closed pause once. Defensive repeated pause/resume cannot overwrite an open pause or accumulate twice. Reject invalid/negative clock configuration or backwards lifecycle timestamps.
- RESOLVED freezes at resolvedHoldAt. CLOSED preserves that assessment/deadline. Reopen excludes the hold and resumes the original budget. CANCELED closes exclusions, stops, retains last nonpaused assessment and historical breach, never ages after stopping; excluded from fulfillment denominator and dashboard risk.
- Read DTOs and scheduler use DB clock in runtime, with explicit injected times for tests. No client ticking/classification, AI inference, hidden mutation, state writer or expectedVersion change.

## Tests and verification plan

1. Unit: empty/single/mixed role metrics, predicate/contract/query shape, exact risk/deadline +/-1 second, invalid clocks, multiple pause/hold cycles, repeated operations, freeze/finalize/reopen/cancel/sticky breach; scalar/SQL parity tested against PostgreSQL.
2. Dedicated loopback synthetic DB: six migrations, double seed, actual HTTP aggregates and role denials/401, 120 authorized rows plus foreign owner/assignee rows, limits 1/10/20/50 and cursors invariant, timezone today/yesterday boundaries, DB query count and measured response samples/EXPLAIN. Domain workflow integration proves version/rollback/history/audit preserved.
3. Fresh lint, typecheck, all unit, build, M10 integration and complete existing real DB integration. Run M3, M4 offline/online, M5–M10 and V1.1 UI E2E on rebuilt runtime. Record live Ollama variance honestly; do not weaken gates.
4. M11/M12 browser tests: real dashboard DTO/card agreement, filtering/pagination invariance, role-specific KPI fields, all roles' detail SLA agreement, loading/error/retry, 360/768/1440/1920 overflow and axe serious/critical=0, keyboard drawer/skip focus, text labels and touch targets.
5. OpenAPI: all three operationIds, security/statuses, generated shared DTO schemas/enums/refs. Security diff: no scope override, data leakage, SQL interpolation, secrets or AI scope changes.
6. Update owning specs, implementation plan and section-34 milestone documents; final combined `M11_M12_VERIFICATION.md` with exact actual results/performance/limitations. End READY FOR HUMAN REVIEW only when both gates pass; M13 NOT STARTED.

## Risks and acceptance

Audit follow-up during implementation: existing analytics SLA counts used scheduler-persisted states and included canceled instances despite A05. M12 replaces only those existing counters with canonical SQL and the canceled exclusion, retaining the response and other analytics fields; M13 remains NOT STARTED. The M2 runtime checker now derives browser Origin from its verified web URL, so the existing local 2500/2501 compose override can be checked without changing auth policy or leaking that Origin into isolated integration fixtures.

SQL/scalar divergence is the primary risk: shared math/rules plus boundary parity integration must pass. One snapshot per query avoids internal time skew. Day semantics are explicit, not host-timezone-dependent. Counts overlap intentionally and must not be summed into a total. Existing canceled breach history and paused breach indicator must remain truthful. No production data, broad reset, schema migration, tag or main merge is authorized. The later closure authority permits only the checkpoint commit/feature-branch push described above. A failing required test stops the final gate, not the implementation effort.
