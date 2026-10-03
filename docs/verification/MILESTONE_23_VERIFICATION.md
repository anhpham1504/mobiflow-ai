# Milestone 23 verification

M23 only, 4 October 2026 Asia/Saigon. Direct user EXECUTE of the attached M23 checkpoint authorizes automatic reviewed commit/push and closure after all required gates PASS. Previous checkpoint `58aae141ee2a4e8d9af341fd88dce370106a8c16`; branch `feat/v1.3-saved-views-filters`. V1.3 IN DEVELOPMENT; M24 NOT STARTED. This record follows master-plan section34; [detailed verification](../v1.3/M23_SAVED_VIEWS_FILTERS_VERIFICATION.md) owns exact execution evidence.

## Scope implemented

Private per-account Saved Views with explicit create/apply/replace/delete, current-role authorization, canonical filters, maximum50, unavailable recovery, optimistic concurrency and URL replacement/back-forward semantics. No authority expansion or additional business mutation.

## Files/modules changed

Shared request-filter/saved-view contracts; API Request filter policy/query/controller, saved-view service/controller and Nest registration; Prisma schema/additive migration; shared RequestList/SavedViews UI and CSS; focused unit/real-PG/production-browser tests; isolated M23 harness/scripts; owning specs and current roadmap/verification records. Final exact INCLUDE list and Git blobs are in [M23_FINAL](../v1.3/evidence/M23_FINAL.json). No new dependencies.

## Database changes

Migration13 adds SavedRequestView with owner RESTRICT FK, normalized-name uniqueness, JSON schema payload/version, positive optimistic version, timestamps and owner index. Twelve old migrations unchanged. Fresh, M22 upgrade and successive V1.2 upgrade pass; preserved data and least-privilege runtime grants verified. Developer schema remains7 without mutation.

## API changes

Private GET/POST saved-request-views and GET/PUT/DELETE by UUID with generated OpenAPI, strict shared schemas, live identity and owner predicates. Shared canonical six-field query contract; assigneeId now explicitly MANAGER-only. Atomic count/create cap, versioned replacement/delete, minimal transactional human audit. Unavailable DTO excludes forbidden filter metadata.

## UI changes

Existing three-role list surfaces expose saved views, existing dates and manager assignee directory. Apply replaces filter domain and clears pagination/search/sort; explicit updates, confirmation, dirty indication and manual fallback. URL restores filters through history. Native dialogs, focus/error association, escaped names and responsive layouts.

## AI changes

None. AI/knowledge owners untouched; observed AI calls0. Live Ollama/M15 evaluation NOT RUN and outside scope.

## Security considerations

Current Request authorization remains authoritative; manager cannot read another account's view. Strict filters reject unknown/injected/authority keys. Every normal query revalidates filters independently. Reads validate stored schema/current role/references; no partial apply. Authenticated no-store, original guards and safe errors remain. Cap/name/version races and audit rollback use real PostgreSQL. Final focused secret/bundle/source checks and reviewed allowlist PASS; no penetration-test claim.

## Tests executed

| Command | Actual result |
|---|---|
| `npm run lint` | PASS, exit0 |
| `npm run typecheck` | PASS, exit0 |
| `npm test` | PASS, exit0;217 tests,0 failures/skips |
| `npm run build` | PASS, exit0; production Linux build |
| `npm run test:database:m23` | PASS, exit0;3 real migration paths |
| `npm run test:integration:m23` | PASS, exit0;9 cases, including concurrency and affected Request authorization/filter regressions |
| `npm run test:e2e:m23` | PASS, exit0;4 production Edge cases,0 skip/flaky,24 width/Axe scans |
| `npm run verify:security:m23` | PASS, exit0 |
| `node scripts/verification/m23-source-coverage.mjs` | PASS, exit0 |
| `node --env-file=.env scripts/verification/m23-final.mjs` | PASS, exit0 |

Actual command/platform/exit/source records and retained failed iterations are under [gates](../v1.3/evidence/gates). Source coverage reconciles final product with each owning gate; later UI focus repairs have new production build/typecheck/E2E evidence. No full historical replay.

## Manual verification

Executing agent reviewed source/diff, owning contracts, migration, test evidence and browser screenshots. Keyboard/focus and width360/768/1440/1920 checks are automated production-browser evidence, not independent human review. Independent external/human review: NOT RUN. Auto-closure authorization is not a human review result.

## Known limitations

Private preferences only,50/account; fixed existing order and UTC ranges. Search is current-page only and transient. No existing SLA/team/server-search/configurable-sort filter is invented. Local112-request/50-view performance fixture provides samples, not a production SLO. Normal developer DB intentionally remains at7 migrations.

## Deferred items

M24 NOT STARTED. No sharing, defaults, pinning, saved reports, AI filters or release/deployment. Live Ollama and historical full replay are outside scope.

## Release blockers

Remaining M23 technical blockers:0. Security/source/cleanup gates PASS. This milestone does not authorize a V1.3 release or deployment. Publication remains conditional on live Git synchronization.

## Gate

Technical milestone: **PASS**; all required gates passed, remaining blockers0. Checkpoint closure authorization: RECEIVED — explicit user execution prompt. Closure mode: AUTO; evaluate actual committed source and live refs under [M23 closure](../v1.3/M23_CHECKPOINT_CLOSURE.md). Stop after M23.
