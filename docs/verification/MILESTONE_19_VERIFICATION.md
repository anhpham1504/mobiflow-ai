# Milestone 19 Verification

Date: 2026-10-02. Authority: explicit [M19 request](../v1.3/M19_MENTIONS_WATCHERS_SPEC.md), [master plan](../v1.3/V1_3_MASTER_PLAN.md), [frozen plan](../v1.3/M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md). **M19 PASS — READY FOR HUMAN REVIEW.** Detailed actual evidence/failures: [M19 verification](../v1.3/M19_MENTIONS_WATCHERS_VERIFICATION.md). Work remains uncommitted/unpushed; V1.3 IN DEVELOPMENT; M20–M24 NOT STARTED.

## Scope implemented

M19 structured immutable Internal Note mentions, scoped candidate selection, own manual idempotent watch, persisted event allowlist, batched body-free notification union with mention precedence/self suppression/DB retry key and delivery-time role/account/Request authorization. Existing USER isolation and actual AI/RAG/recommendation/Copilot/analytics/history exclusion remain. No M20 or release action.

## Files/modules changed

Prisma schema/new migration9; strict shared contracts; collaboration access/notifications/controller/service; InternalNote extension; central policy; one state-machine transactional hook; scoped notification query/read. Mention/watch components, existing private note/detail/notification integration/CSS. M19 real DB/API/browser/security/capture/final-sanity scripts/tests/config; necessary empty tables in existing service mocks; owning specifications/current roadmap and safe evidence. [Final inventory snapshot](../v1.3/evidence/M19_FINAL.json).

## Database changes

RequestInternalNoteMention(noteId,mentionedUserId) and RequestWatcher(requestId,userId) composite keys/FKs/indexes. Partial unique internal Notification(recipientId,eventId). Migration `20261002020000_m19_mentions_watchers`; count8→9, old8 immutable. Fresh1→9, V1.2 7→8→9, M18 8→9 PASS; upgrades preserve27 old tables/153 rows including M18 note. Real least-privilege/FK/uniqueness checks PASS. Developer DB remains7, no migration/reset/reseed.

## API changes

GET requests/:id/mention-candidates, GET/PUT/DELETE requests/:id/watch; optional mentionedUserIds on existing note POST and safe mentions response. Existing notifications list/read hide stale internal types before pagination/unread filtering, with scoped parent lock on mutations. Strict safe DTO/OpenAPI; no Request version/status/business mutation, other-watcher count/directory or legacy breaking change.

## UI changes

Accessible labeled combobox/chips, keyboard/Escape/removal, explicit own watch pressed state, safe internal notification labels/navigation, loading/empty/retry/invalid-target draft retention. USER has no controls/private API activity. Notes and names remain escaped text. Terminal notes read-only with own watch available. Watch pending-state keyboard focus repair completed and verified by second browser iteration.

## AI changes

No product AI/provider/model/action changes. Actual deterministic intake/RAG/embedding/Recommendation V2/Copilot context builders exclude private body/mention/watch/audit identities. No live evaluation/generation/Ollama start/model action; no quality claim.

## Security considerations

Operational role guard + central existing Request predicate; transactionally lock/recheck actor/session/parent/targets; generic invalid-target400/foreign404; least-privilege immutable mentions; atomic audit/notification rollback; cap100 and batched fan-out; persisted cross-type dedup; current-scope delivery before paging/unread/read-state; no USER/history/AI/analytics/log/body/cache leakage. Focused source/security/changed-file credential and22-file JS bundle scan PASS,0 findings; old8 migration hashes and protected owners unchanged.

## Tests executed

| Command | Result |
|---|---|
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm test | PASS184,0 failures/skips |
| npm run build with process NODE_ENV=production and NEXT_PUBLIC_API_BASE_URL=http://localhost:33101/api/v1 | PASS |
| npm run test:database:m19 | PASS three fresh/upgrade paths |
| npm run test:integration:m19 | PASS15/15,0 skipped |
| node --test apps/api/test/mentions-watchers.test.mjs apps/api/test/internal-notes.test.mjs apps/api/test/authorization.test.mjs | PASS16/16 |
| npm run test:e2e:m19 | PASS5/5,0 skipped/flaky/unexpected; real Retry-After honored15s |
| npm run verify:security:m19 | PASS,0 findings,22 JS bundle files |
| git diff --check | PASS |
| node --env-file=.env scripts/verification/m19-final-sanity.mjs | PASS, unchanged baseline/release/history,0 staged, developer7, owned DB/ports cleaned |

Historical M0–M18 replay: **NOT RUN — intentionally outside M19 scope.** Targeted M18 note/authorization and legacy notification assertions PASS inside the owning baseline/M19 tests. No full historical integration/browser/live-model replay. Failures and repairs are retained in detailed verification and JSON iterations.

## Manual verification

Reviewed owning authorization/storage/notification architecture and transactional hook/source projection. Actual race/rollback/read-unread/role/session/cap scenarios passed. Production browser completed16 responsive/Axe scans across STAFF/MANAGER private notes and notifications at360/768/1440/1920:0 violations, no overflow/XSS/dialog/page errors,44px controls/visible focus. Inspected1440 manager and final360 STAFF screenshots for long literal text/name/chip layout. SQL12→12 for1→50 notes and22→22 for1→10 watchers; samples24.3054/23.5298/22.9440ms, exactly10 recipients for measured event.

## Known limitations

A temporary Windows process creation failure was resolved before successful final browser/security execution; earlier failed test/build/browser iterations remain recorded. Local synthetic SQL/latency/cardinality/security checks are not enterprise SLO/WCAG or production certification. Stale watch rows retained/counted toward100 cap. No separate notification count/detail endpoint, email/realtime/outbox or AI generation. Ollama read-only tags probe unavailable; no M19 gate dependency. Native generated Web build uses isolated33101; normal Docker stack/.env untouched.

## Deferred items

M20 Response & Checklist Templates; M21 routing; M22 reminders/escalation; M23 saved views; M24 release closure. Commit/push/tag/merge/deployment and developer migration/reset/reseed remain outside authorization. Historical evidence/tags unchanged.

## Release blockers

No remaining M19 blocker. V1.3 release remains gated on separately authorized M20–M24 and release closure. No production deployment/readiness claim.

## Gate

**M19 PASS — READY FOR HUMAN REVIEW.** V1.3 IN DEVELOPMENT. M20 NOT STARTED. Stop with work uncommitted/unpushed; no tag/merge/deployment or developer DB migration. Required baseline and targeted gates passed with actual evidence; historical full replay NOT RUN.
