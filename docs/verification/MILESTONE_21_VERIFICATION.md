# Milestone 21 Verification

## Scope implemented

M21 Rule-based Routing only, explicitly authorized from closed M20 `b75d15acc2dbbb16d00ce47db8ed891af210a48d`, clean starting tree, branch `feat/v1.3-rule-based-routing`. Manager-only deterministic rules/current immutable revisions, read-only evaluation from canonical facts and explicit local Team prefill. Existing human APPROVE_AND_ASSIGN/REASSIGN/expectedVersion remain authoritative. [Pre-edit plan](../v1.3/M21_RULE_BASED_ROUTING_IMPLEMENTATION_PLAN.md) and [detailed verification](../v1.3/M21_RULE_BASED_ROUTING_VERIFICATION.md) own decisions/evidence. M22–M24 NOT STARTED; V1.3 IN DEVELOPMENT.

## Files/modules changed

Shared routing contracts; additive Prisma routing models/migration11; RoutingFactsBuilder/evaluator/service/controllers, manager-only policy method and app registration. Manager rule page/navigation/typed editor/history/archive; local assignment field components and narrow request-detail integration. New unit/real PostgreSQL/API/browser/security/capture/final-sanity harnesses and npm scripts. Updated PROJECT/API/DATABASE/AUTHORIZATION/BUSINESS_WORKFLOW/UI/IMPLEMENTATION_PLAN/V1.3 master/index. Entire backend requests/templates/AI/knowledge/analytics/dashboard owners and historical migrations/evidence remain unchanged. No dependency/lockfile change. Exact inventory is recorded by the final gate.

## Database changes

RoutingRuleStatus, RoutingRule and immutable RoutingRuleRevision only; typed bounded JSONB conditions, Team/creator FKs, priority bounds, unique contiguous revisions and deferred current pointer. INACTIVE revision1/version1; edits append and bump version; lifecycle increments version, archive terminal. Column-scoped parent UPDATE plus SELECT/INSERT; no revision UPDATE/DELETE or routing DELETE/TRUNCATE/DDL. Migration `20261002040000_m21_rule_based_routing`, repository10→11. Four real isolated paths PASS: fresh1→11,10→11,9→10→11,7→8→9→10→11. The M20 upgrade preserves32 old tables/160 seeded rows; all original values compared. Developer DB metadata remains7, read-only; no migrate/reset/reseed.

## API changes

GET/POST routing-rules; GET targets/detail; GET/POST revisions; POST activate/deactivate/archive; POST requests/:id/routing/evaluate.8 paths/10 generated OpenAPI operations. Shared strict body/query/response contracts, safe errors, no-store, SQL search/filter/keyset paging default20/max50. Live MANAGER/account/session/A01 scope; current target validation via existing Team/STAFF predicate. Rule mutations require expectedRevision and expectedRuleVersion under row lock and atomic safe audit. Evaluation RepeatableRead loads canonical category/subcategory/priority only; maximum500 active rules, overflow503. Response gives requestVersion, evaluated/winning immutable identities, explanations and nullable Team recommendation. No legacy command/API change.

## UI changes

Manager rule management, typed EQ/IN/AND enum controls, numeric priority, eligible Team, revisions/status/history/permanent archive dialog. Existing manager draft/reassignment card shows MATCH/NO_MATCH/CONFLICT and loading/error/retry. Explicit Apply rechecks Request/rule/target snapshots, fills Team locally, clears/focuses staff; human may override. No protected command from evaluation or Apply. Reads bounded15seconds. Native labels/keyboard/dialog focus, result status/alerts and escaped literal content. Production browser4/4 PASS;12 responsive/Axe scans across three surfaces at360/768/1440/1920 have0 violations/overflow.

## AI changes

None. AI/provider/RAG/recommendation/Copilot/embedding/analytics owners unchanged; no AI/private context in facts. Captured provider calls=0. Ollama probe/start/download/generation and live AI evaluation NOT RUN. No live model quality claim.

## Security considerations

USER/STAFF denied every routing surface. Request evaluation reuses existing scope, scoped absent404; A01 has no second tenant, so the constrained-scope test is explicitly labeled. Live identity/session checks, target revalidation, strict unknown/path/expression/fact override negatives, physical immutable/privilege constraints, safe row locks/version races, atomic audit-failure rollback and no-store pass. Rule audit omits Request FK/content and never enters public history. No business writes or notifications from rule management/evaluation/prefill. User projections and M18 privacy remain unchanged. Focused source/credential/24 JS bundle review PASS,0 findings; not penetration testing or certification.

## Tests executed

| Command | Actual result |
|---|---|
| `npm run lint` | PASS,0 warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS198/198,0 skipped;8 new routing units |
| `npm run build` with process NEXT_PUBLIC_API_BASE_URL=http://localhost:33301/api/v1 | PASS production build |
| `npm run test:database:m21` | PASS four isolated migration/preservation/privilege paths |
| `npm run test:integration:m21` | PASS11/11,0 skipped; real concurrency/atomicity/scoping/commands |
| `npm run test:e2e:m21` | PASS4/4,0 unexpected/skipped/flaky |
| `npm run verify:security:m21` | PASS,0 findings,24 JS bundles |
| `git diff --check` | PASS |
| `node --env-file=.env scripts/verification/m21-final-sanity.mjs` | PASS; HEAD/remote/release/history preserved,0 staged, developer7, test DB/ports cleaned and original loopback containers unchanged |

Detailed verification retains exact capture commands/local logs, failed lint fixtures, initial9/10 API, initial1/4 browser and branch-precondition security failure with repairs. No failing test was hidden/skipped. Targeted workflow/auth/M18/M19/M20 regression is included in the current baseline units and M21 real HTTP/browser suites. Historical M0–M20 replay: **NOT RUN — intentionally outside M21 scope.**

## Manual verification

Audited actual owners before coding and final diff afterward. Real HTTP snapshots prove no evaluation write; human override/approval and reassignment remain explicit, stale409 is atomic, M19 emits one watcher fan-out, M20 edited checklist/provenance stays intact and SLA row is preserved. Inspected final360 manual-draft and1440 reassignment screenshots; controls/content reflow and malicious labels render literally. Earlier360 manager editor screenshot also reviewed. Keyboard focus/status/error/retry/USER exclusion and12 zero-violation Axe scans passed. Physical PostgreSQL row reorder and repeat/permuted input preserve complete evaluation data.

Measured50-rule fixture (33 active /17 inactive,10 conditions each): rule-load2 SQL, total evaluation9 SQL, list7 SQL, no N+1. Samples12.04/17.79/13.21/11.88/11.89ms. Transaction/identity statements included; no enterprise SLO claim.

## Known limitations

Existing single A01 organization; fixed canonical enum fields and flat AND. Category/subcategory may be null before approval. Team only, no skill/staff target or optional fallback. No persisted routing-acceptance provenance because existing protected commands have no source channel. Maximum500 active rules/targets fails closed; manual workflow remains. Local synthetic verification, no full WCAG/penetration/load certification, live AI or production deployment. Developer runtime remains at migration7 and does not serve M21. Raw logs/traces/screenshots/tokens remain ignored/local.

## Deferred items

M22 reminders/SLA escalation, M23 saved views and M24 release hardening/closure require separate authority. No later milestone started. Commit/push/merge/tag/deploy or developer DB mutation is outside this request.

## Release blockers

No unresolved M21 blocker. Required product/baseline/DB/API/security/browser and final Git/history/isolated-resource cleanup checks passed. [Final inventory](../v1.3/evidence/M21_FINAL.json) lists63 changed/new files including sanitized evidence and retained iterations. HEAD remains M20,0 staged; original container starts and developer7 are unchanged, test database removed and33021/33300/33301 released. V1.3 release additionally requires separately authorized later milestones and closure; no production readiness claim.

## Gate

**M21 PASS — READY FOR HUMAN REVIEW**, uncommitted on `feat/v1.3-rule-based-routing`. No commit/push/merge/tag/deploy. M22–M24 NOT STARTED; V1.3 IN DEVELOPMENT.
