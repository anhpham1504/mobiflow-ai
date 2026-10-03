# M23 — Saved Views & Filters verification

Execution date: 4 October 2026, Asia/Saigon (evidence timestamps use UTC). Checkpoint closure authorization: **RECEIVED — explicit user execution prompt** incorporating the attached M23 checkpoint. Independent external/human review: **NOT RUN**; that authority does not require a separate human approval. M24 NOT STARTED; V1.3 IN DEVELOPMENT. No main merge, tag, deployment or live Ollama.

## Baseline and source identity

Previous M22 checkpoint and starting HEAD: `58aae141ee2a4e8d9af341fd88dce370106a8c16`, branch `feat/v1.3-reminder-sla-escalation`, CLEAN. Local, tracking and live remote M22 refs matched. The M18→M22 sole-parent chain, latest historical gates and 98 reviewed M22 blobs were verified. The new `feat/v1.3-saved-views-filters` branch started at that exact SHA. See [preflight](evidence/M23_PREFLIGHT.json) and the [pre-edit plan](M23_SAVED_VIEWS_FILTERS_IMPLEMENTATION_PLAN.md). Main/v1.2.0 remain `31b445caf07dad606601a1e38e8ed39836d9f825`.

Every command gate in `evidence/gates/M23_*.json` records actual command, exit, timestamps, platform/Node, source fingerprint and per-file product hashes. [Source coverage](evidence/M23_SOURCE_COVERAGE.json) must compare final product bytes with relevant tested scopes before closure: database owns Prisma; API/unit own backend/contracts; typecheck/build/browser/lint cover all product files. The final UI focus and grid fixes postdate the API/unit execution but changes no API/contract/unit owner; a new production build, typecheck and E2E cover those changes. Subsequent verification utilities and documentation are separately covered by lint and the final reviewed Git inventory, not described as product test reruns. Git LF normalization is reconciled by `git hash-object --path` in that inventory.

## Implemented semantics and owners

`packages/contracts/src/request-filters.ts` is the single canonical owner of status, priority, category, assigneeId and inclusive/exclusive UTC from/to. The normal Request list independently validates the same schema and retains `requestScope AND filters AND route scope AND cursor`, with existing createdAt DESC/id DESC ordering. Dates normalize to ISO; validation compares instants. All roles can use the five non-assignee fields. Only MANAGER may use active-STAFF assigneeId, matching the existing directory; the previously permissive hidden USER/STAFF query field is intentionally narrowed. There is no new SLA/team/search/sort query engine.

`saved-request-view.v1` is the only schema version. Each account owns at most 50 preferences. Names use NFC+trim, 1–80 Unicode code points, plain text; normalized lowercase names retain accents and are unique per owner. Saved payloads exclude cursor/page/limit/search/sort, scope, IDs/results/counts and credentials. Reads use live session/role/ref validation. Corrupt, unsupported, role-incompatible or inactive-reference items return minimal owner-only unavailable descriptors, with no filters; valid peers still work. Owners can delete or replace unavailable items.

GET/POST `/api/v1/saved-request-views` and GET/PUT/DELETE `/:id` use strict shared bodies/queries, generated OpenAPI, existing origin/media/payload/rate/auth guards and authenticated no-store. Every operation checks ownership, including MANAGER. Create locks the owner's User row before live identity checking and counts/inserts in one transaction. Updates/deletes compare expectedVersion atomically; stale updates return409 without mutation. If concurrent deletion wins, a later operation returns404 because the resource is missing. Minimal human audit contains only view ID/version and is in the same transaction. No Request version, state, assignment, SLA, notification, private collaboration or AI data is written.

Existing RequestList surfaces now include saved-view selection, explicit apply/save/update/delete, confirmation, dirty indication and manual fallback. Apply re-fetches the owned definition, replaces all six filter keys, clears cursor/page/sort/current-page search and preserves unrelated navigation params. Empty views reset all filters. URL back/forward restores actual filters; selecting or exploring does not autosave. Native dialogs provide keyboard focus and associated errors; names remain escaped text. No auto-default, sharing, favorites or pinning.

## Actual command gates

The capture wrapper is `node scripts/verification/m23-capture.mjs <gate> <command...>`. Linux execution uses `node scripts/verification/m23-linux.mjs run ...`; host commands use Node24.19.0/npm11.17.0. Exact command records are linked below. All test data is synthetic.

| Gate / actual command | Environment | Actual result |
|---|---|---|
| `npm run lint` | Windows host | PASS, exit0 |
| `npm run typecheck` | Windows host, generated Prisma | PASS, exit0 |
| `npm test` | Isolated Linux Node24.19.0 | PASS, exit0; 217 tests: config7 + API143 + web2 + release helpers65; no failure/skip |
| `npm run build` | Isolated Linux; process NODE_ENV=production and NEXT_PUBLIC_API_BASE_URL=http://localhost:33501/api/v1 | PASS, exit0; production API and Next16.3.6 build, 23 routes |
| `npm run test:database:m23` | Real isolated PostgreSQL/pgvector | PASS, exit0; 3 migration paths |
| `npm run test:integration:m23` | Real Nest/auth/PostgreSQL in isolated Linux | PASS, exit0; 9 tests, no skip |
| `npm run test:e2e:m23` | Windows Edge/Playwright against production Linux Next/API/PG | PASS, exit0; 4 tests, no skip/flaky; run `fb517ec7-0896-4a7b-a2ea-a3ec374ff8c8` |
| `npm run verify:security:m23` | Host source/evidence/credential scan plus production static bundle | PASS, exit0;91 changed files and32 JS outputs scanned,0 findings |
| `node scripts/verification/m23-source-coverage.mjs` | Host per-file evidence reconciliation | PASS, exit0 |
| `node --env-file=.env scripts/verification/m23-final.mjs` | Host Git/history/cleanup/developer read-only checks | PASS, exit0 |

[Lint](evidence/gates/M23_LINT.json), [typecheck](evidence/gates/M23_TYPECHECK.json), [unit](evidence/gates/M23_UNIT.json), [build](evidence/gates/M23_BUILD.json), [database](evidence/gates/M23_DATABASE.json), [integration](evidence/gates/M23_API.json), [E2E](evidence/gates/M23_E2E.json), [security](evidence/gates/M23_SECURITY.json), [final](evidence/gates/M23_FINAL.json).

## Database and concurrency

Exactly one additive migration, `20261004010000_m23_saved_request_views`, adds SavedRequestView and its User relation. Actual count12→13; all 12 historical migrations remain unchanged. Owner FK is RESTRICT; normalized-name uniqueness, JSON object/name/version constraints and owner ordering index are verified. Runtime can SELECT/INSERT/DELETE and update mutable columns only; owner/id/createdAt changes and DDL/TRUNCATE are denied.

[Database evidence](evidence/M23_DATABASE.json) records fresh1→13, M22 12→13 preserving36 tables/164 rows, and V1.2 7→8→9→10→11→12→13. Successive preserved snapshots contain26/152,27/153,29/157,32/159,34/161,36/164 tables/rows. Existing notes/watchers/mentions/templates/routing/alerts survive. The normal developer DB remains at7 migrations.

[API evidence](evidence/M23_API.json) covers CRUD/audit/business-row invariance; USER/STAFF/MANAGER IDOR404; strict schemas and real auth/transport guards/OpenAPI; scoped canonical query regressions; live role/reference changes and corrupt-view recovery; cap concurrency; normalized-name and version races; audit-failure rollback; performance; rate/revocation. At49 views, two differently named concurrent creates both reached the PostgreSQL lock (2 waiters observed), exactly one succeeded, final count50; another owner progressed independently. Duplicate create/rename, edit/edit and edit/delete races preserve uniqueness/version semantics. A failed audit rolls back the preference. The rate test admits120 reads, returns429/Retry-After60 on the next, advances a fake clock and verifies revoked401; no guard is disabled.

## Production browser, accessibility and fallback

[Browser evidence](evidence/M23_BROWSER.json) records4 real production cases in25.814 seconds. It covers all three roles, actual scoped results, CRUD, stale other-tab409, literal XSS name, dirty/no-autosave, same-view reapply, empty replacement, sentinel priority/date/search/page/cursor/sort removal, unrelated URL preservation, browser back/forward and fixed ordering. Delayed503/empty200 transport fixtures verify saved-view loading/error/empty fallback while normal Request filtering uses the real API; unavailable-item deletion uses real persisted data.

There are24 targeted scans: three roles × list/dialog ×360/768/1440/1920. All have0 serious/critical Axe violations and no horizontal overflow. Native modal entry, keyboard navigation, cancellation and post-mutation focus restoration are verified. Screenshots were inspected by the executing agent; this is technical self-review, not independent human review or full WCAG certification. Application page errors0, console errors0 and failed network0. Only the exact pre-existing Kaspersky external injection blocked by CSP is counted separately; expected navigation cancellation is excluded. Raw screenshots/traces/logs stay ignored.

## Performance and preserved owners

Local fixture:50 views for one account,100 additional synthetic Requests,112 total. Five saved-list samples:10.783,8.094,7.779,7.473,6.566ms;9 SQL statements including identity/session/transaction and only1 preference SELECT. Normal apply query samples:12.111,7.709,5.270,5.481,5.365ms;10 SQL statements,20 result rows. There is no owner-per-view query/N+1. These are local measurements, not an enterprise SLO.

Baseline tests include the existing authorization, transition, SLA, notes/watchers/templates/routing/alert owner regressions. Targeted real Request filtering validates scope for USER/STAFF/MANAGER. M12 SLA, M18 notes, M19 collaboration, M20 templates, M21 routing, M22 alerts, auth, state machine, AI/knowledge, analytics/dashboard, package lock and normal Compose are preserved. No AI calls occurred. Live Ollama and full historical M0–M22 replay: NOT RUN, outside M23 scope.

## Security, repairs and cleanup

Final security/source/cleanup gates PASS. Security scanned91 changed files and32 retained production JavaScript outputs (including prior build chunks), with0 findings. Coverage verifies174 product files against7 relevant command gates; final audit verifies94 reviewed paths before its two nonrecursive final evidence files. [Security](evidence/M23_SECURITY.json) covers source predicates, strict schema/current role/reference checks, transaction/version/cap/audit, no business or AI writes, XSS, runtime grants, historical migration freeze and configured credential/token/private-key scan of changed files and production JavaScript. This is focused technical self-review, not a penetration test.

Earlier failed command records remain in `evidence/gates/iterations` and detailed report iterations. The first isolated DB attempt lacked the runner's `.env`; the generated synthetic env was copied into that owned runtime and DB paths rerun successfully. Early lint errors were fixed. Browser failures exposed ambiguous test locators and actual focus loss: role-based locators replaced ambiguous labels; modal opening waits for React rendering; selector focus restoration waits for the expected selected-view URL state and enabled controls. A later desktop screenshot review also corrected compressed date inputs with a wrapping grid. The next E2E exposed a remaining navigation/focus race, retained as FAIL; the final URL-aware effect fix passed the latest4-case production run. Production build/typecheck/E2E were rerun after the fix. Windows Application Control blocks native argon2 as previously documented, so authentic backend tests use isolated Linux without changing auth or host security settings.

Only M23 owns the verification PostgreSQL/runner, two volumes, synthetic test DB and ports55423/33023/33500/33501. Final cleanup verifies their removal/release and original developer container identities/start times/ports plus seven migration checksums. No normal-stack restart/build/migrate/reset/reseed occurred. Ignored private env/runtime manifests, tokens/cookies, logs, screenshots/traces and generated outputs are excluded from staging. [Final audit](evidence/M23_FINAL.json) supplies per-path INCLUDE/blob inventory and cleanup results.

## Limitations and gate

Saved views are private preferences only, maximum50, fixed existing ordering and fixed UTC dates. Current-page text search is transient. No existing Request SLA/team/server-search/configurable-sort contract exists to save. No sharing/defaults/pinning/AI filters, analytics reports or M24 work. Local synthetic evidence does not establish production readiness. Independent human review and deployment: NOT RUN. No mandatory test may be waived.

Technical gate: **PASS**; all required gates passed, remaining blockers0. Closure mode: AUTO; [closure record](M23_CHECKPOINT_CLOSURE.md) evaluates committed source and live Git refs after ordinary commit/push. No prospective self-SHA or publication assertion is stored here.
