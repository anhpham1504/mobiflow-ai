# M19 Mentions + Watchers Verification

Date: 2026-10-02. Authority: [explicit M19 request](M19_MENTIONS_WATCHERS_SPEC.md), [master plan](V1_3_MASTER_PLAN.md), [implementation plan](M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md). **M19 PASS — READY FOR HUMAN REVIEW**, on `feat/v1.3-mentions-watchers`, uncommitted/unpushed. M20–M24 NOT STARTED; V1.3 IN DEVELOPMENT.

## Baseline and boundary

Started clean on `feat/v1.3-internal-notes`, exact published checkpoint `1f54dce3c8427976763b19ef33f181b4ef9a3337`; `git pull --ff-only` returned already up to date. Created `feat/v1.3-mentions-watchers` from that SHA. Released `v1.2.0` remains `31b445caf07dad606601a1e38e8ed39836d9f825`. Wrote architecture/implementation plan before product edits. No commit/push/tag/merge/deployment, normal-stack restart/rebuild, developer migration/reset/reseed, Ollama/model start or M20 work.

## Files and modules changed

| Area | Owning implementation |
|---|---|
| Persistence | Prisma schema, migration9 `20261002020000_m19_mentions_watchers`; two composite-key child tables and partial internal Notification key |
| Backend | Collaboration controller/service, extracted collaboration identity/parent/user locks, notification union/fan-out; InternalNote service extension; central eligible-recipient/delivery predicates; one transactional state-machine hook; notification list/read scoping |
| Contracts | Optional strict structured IDs, max10 unique/raw100 bound, safe candidates/mention views and own watch boolean |
| UI | MentionSelector, RequestWatch, InternalNotes integration, request-key remount, safe notification labels and scoped CSS |
| Tests | Eight new units; actual PostgreSQL/API integration and deterministic actual context builders; five production-browser cases/config/runner; guarded migration/security/capture helpers; root/API scripts |
| Existing test fixtures | M18 mock includes empty mention/watcher results; M15 service fixture includes an empty RequestWatcher table. Existing assertions are retained, no test disabling or substitute database PASS |
| Docs | PROJECT_SPEC/API_SPEC/AUTHORIZATION_SPEC/DATABASE_SPEC amendments; current roadmap/index/implementation authority; M19 source request, plan, this evidence record and section34 milestone record |
| Evidence | Compact sanitized JSON under docs/v1.3/evidence, including retained prior iterations; raw logs/screenshots/traces and test storage remain ignored under artifacts/m19 |

## Architecture and contracts verified

Mention is immutable `RequestInternalNoteMention(noteId,mentionedUserId)`; UUID identity survives identical names. Optional body-only DTO remains valid; literal @ text creates no mention. Active STAFF current assignee and MANAGER existing A01 scope are eligible, excluding actor. Max10 unique targets; duplicates/case normalize; self/USER/inactive/foreign/unknown targets reject uniformly400. Invalid target rejects the complete note/mention/audit/notification transaction. No Request status/version/updatedAt/business mutation.

Own watch is manual, idempotent `RequestWatcher(requestId,userId)`; no auto-watch or other-watcher directory/count. GET/PUT/DELETE strict empty input and scoped live identity; terminal readable requests permitted. Parent lock serializes subscribe/unsubscribe and cap100 stored rows/request. Repeated same state writes no audit. Stale rows remain and count toward cap, but never grant access. Actual cap409 leaves business/audit/subscription state unchanged.

Internal fan-out reuses existing Notification rows and owning persisted AuditLog event inside the existing transaction; no outbox/second queue/provider. Allowlist: INTERNAL_NOTE_CREATED, SUBMIT_FOR_APPROVAL, APPROVE_AND_ASSIGN, REJECT_APPROVAL, REASSIGN, START_WORK, REQUEST_USER_INFO, USER_PROVIDE_INFO, RESOLVE, USER_REOPEN, USER_CONFIRM, CANCEL. All other events, AI/advisory/RAG/embedding, SLA/background ticks, reads and watch changes are excluded. Union by recipient, mention precedence, self suppression, current eligibility and one batched insert. Partial unique(recipientId,eventId) across MENTION/WATCH plus conflict-safe insertion protects retry. Legacy/SLA notifications retain their existing behavior and keys.

Notification rows/audits contain safe IDs/action/reason only, never note body/excerpt. Current recipient active/role and Request scope filter internal rows before pagination/unreadOnly. Read/unread additionally locks parent scope; stale/foreign/unknown notification ID404 and readAt unchanged. No separate unread-count/detail endpoint exists. Legacy recipient-owned assignment notices can remain after reassignment; opening their Request still uses existing scoped authorization. Watcher never grants access.

No requester note/mention/watch UI/content/type/count/activity, history, analytics, log body or AI context. Actual deterministic intake, embedding/RAG, Recommendation V2 and Copilot builder inputs were captured and checked for note/body/IDs/child-audit keys. Provider fixtures exercise real builders, not live-model quality. Authenticated responses and frontend fetches remain no-store.

## Database evidence

[M19_DATABASE.json](evidence/M19_DATABASE.json): fresh1→9, V1.2 7→8→9 and M18 8→9 PASS. Upgrade snapshots preserve27 preexisting tables/153 rows including a synthetic M18 note. Eight historical migration bytes/checksums remain unchanged; repeated synthetic seed is idempotent. Runtime Note/Mention SELECT+INSERT only, no UPDATE/DELETE/TRUNCATE; Watcher SELECT+INSERT+DELETE, no UPDATE/TRUNCATE. Real FK/composite/partial uniqueness and privilege errors tested. New migration does not modify old rows.

Guarded runner requires explicit demo mode, exact fixed loopback `mobiflow_m19_test`, separate established owner/runtime roles, rejects existing target, holds advisory ownership lock and cleans only its created DB. Developer DB read-only count is7; no migrate/reset/reseed. Normal Compose stack untouched. Tests use actual PostgreSQL/runtime grants, not SQLite or fixtures claiming DB semantics.

## Commands and actual results

Commands below were captured using `node --env-file=.env scripts/verification/m19-capture.mjs NAME COMMAND...`; sanitized JSON summaries are in [gates](evidence/gates/M19_DATABASE.json), raw output is local-only. No configured secret values are included.

| Actual command | Result |
|---|---|
| npm run lint | PASS; no warnings; initial development run found structuredClone no-undef in integration helper, fixed using JSON copy |
| npm run typecheck | PASS, strict API/Web |
| npm test | PASS184: config7 + API110 + Web2 + release/evaluation deterministic units65; no failures/skips |
| `$env:NODE_ENV='production'; $env:NEXT_PUBLIC_API_BASE_URL='http://localhost:33101/api/v1'; npm run build` | PASS, API and standalone production Next; process-only overrides, no .env/normal-stack edit |
| npm run test:database:m19 | PASS, three real fresh/upgrade paths |
| npm run test:integration:m19 | PASS15/15,0 skipped; rerun after adding inactive/role/session and cap100 assertions |
| node --test apps/api/test/mentions-watchers.test.mjs apps/api/test/internal-notes.test.mjs apps/api/test/authorization.test.mjs | PASS16/16,0 skipped; eight M19 + six M18 + two central authorization |
| npm run test:e2e:m19 | PASS5/5,0 skipped/flaky/unexpected; real account rate limit honored with15-second Retry-After |
| npm run verify:security:m19 | PASS, actual API/browser/DB evidence, source/credential/bundle review;22 JS bundle files,0 findings |
| git diff --check | PASS |
| node --env-file=.env scripts/verification/m19-final-sanity.mjs | PASS,0 staged, preserved HEAD/release/history, developer7, owned test DB/ports removed |
| git ls-remote origin refs/heads/main refs/heads/feat/v1.3-internal-notes refs/heads/feat/v1.3-mentions-watchers 'refs/tags/v1.2.0^{}' | PASS read-only: main/peeled v1.2.0 remain31b445ca; M18 branch remains1f54dce3; no remote M19 branch |

Historical M0–M18 replay: **NOT RUN — intentionally outside M19 scope.** Required baseline npm test includes fast existing units; no old migration/integration/browser/live-evaluation gate was replayed. Targeted existing notification ownership/read/unread and authorization regressions reuse the same API assertions inside M19 integration, including legacy assignment notification behavior; they do not claim a full historic suite execution.

## API, isolation and performance evidence

[M19_API.json](evidence/M19_API.json) records15 PASS checks: candidate role/scope/identity/strict DTO; M18 body/4000-Unicode/append-only/version invariants; atomic target validation/max10; idempotent manual/terminal watches; dedup/replay/cross-type key; scope-loss/unread/read filtering; inactive/role-changed/revoked-session behavior; queued reassignment race; injected Notification/audit rollback; all allowlisted persisted workflow actions and exclusions; USER/history/analytics/log isolation; legacy notification regression; actual context builders; measured SQL/fan-out/latency; generated OpenAPI operation-ID/reference validity. No new static OpenAPI owner, dependency, login role or arbitrary tool.

Performance fixture:50 notes with multiple mentions (2 per bulk note),10 watcher rows. Note list SQL statements remain12 for1 versus50 notes; fan-out22 for1 versus10 watchers; one measured event produces exactly10 notifications. SQL counts include transaction/auth/session operations and nested Prisma batched relation queries. No per-note/per-recipient growth in these comparisons. Actual final API latency samples:24.3054,23.5298,22.9440ms; local synthetic samples are not an enterprise SLO. Bulk data insertion prepares cardinality, while measured calls and notifications use real services/PostgreSQL.

## Browser, accessibility and manual review

[M19_BROWSER.json](evidence/M19_BROWSER.json): PASS5/5, run `e95f8108-e733-472b-aa6a-3f89cc735b44`,59.653s,0 skipped/flaky/unexpected; prior failed iterations retained. Actual production Next + API + PostgreSQL on isolated loopback33100/33101. Browser cases cover mention/watch union and body-free labels, literal @watch-only and self suppression, read/navigation, USER private API absence, selector/watch loading/error/retry/empty/keyboard, selected-chip removal/Escape, invalid-target draft/selection retention, duplicate submit, reassignment denial and terminal watch/M18 read-only notes.

Responsive case passed STAFF/MANAGER notes/selector/watch and notification pages at360/768/1440/1920. All16 Axe scans had0 serious/critical and0 other violations; no XSS image/script execution or dialogs/page errors, literal malicious long display-name/note text stays escaped, no horizontal overflow,44px private controls and visible keyboard focus. Manually inspected1440 manager and final360 STAFF screenshots; long literal body/name/chips wrap within private card, mention/watch follow existing layout. This is targeted accessibility evidence, not WCAG certification.

[M19_SECURITY.json](evidence/M19_SECURITY.json): focused source review, actual negative API/race/rollback/role/session evidence, eight frozen migration hashes, preserved AI/knowledge/analytics/dashboard/SLA/demo/config/lock owners, changed-file configured-credential/high-confidence-token scan and22 JS frontend bundle files PASS,0 findings. Read-only developer count7 confirmed. Read-only Ollama tags probe unavailable (connection/timeout); no generation/start/download/change performed, no M19 impact.

## Failure history and repairs

- Initial lint: unsupported global structuredClone in test helper; changed to JSON copy. Subsequent lint PASS.
- Initial baseline units:16 failures because existing M15 mock did not expose new read-only watcher delegate; added empty table, retained all assertions. Subsequent184 baseline units and16 targeted units PASS.
- Initial build: .env NODE_ENV=development caused Next prerender/useContext failure. Process-only production override fixed it; no framework/version/config workaround. Production build PASS, including rebuild after focus fix.
- First browser:3 PASS/2 FAIL. Found watch button lost keyboard focus during disabled pending state; restored focus on completion without stealing focus from another control. Corrected stale-link test to distinguish internal notifications from unchanged legacy assignment notice. Next run confirmed these cases PASS.
- Second browser:4 PASS/1 FAIL. Terminal case hit the real5/account/minute login limit. Harness now honors only an actual429 Retry-After with one bounded<=60-second wait/retry; no limit disabling/reset or synthetic success. Final run waited15 seconds and passed5/5.
- Execution tools temporarily failed before process creation with Windows Access is denied/os error5, including PowerShell, cmd and Node REPL. After recovery, final browser/lint/security execution succeeded. No failed process start was treated as a test PASS.

## Known limitations

Ollama generation/model verification is NOT RUN; service read-only probe unavailable, M19 has no live-AI dependency and did not start it. No email/WebSocket/SSE/outbox/auto-watch, mention edit/delete, watcher counts, global directory, templates/routing/reminders/saved views, new role/dependency or deployment. Cap100 counts stale historical subscriptions; only own current authorized subscriptions can be removed through API. Notification privacy is checked when fetching/marking; an already fetched row can become stale before the next refresh, and detail access still denies it. Targeted source/security review is not penetration testing or production certification. Developer native generated build targets isolated33101 for browser verification; Docker stack/config remains unchanged, and a normal native build can restore the configured public API origin.

## Gate and Git

M19: **PASS — READY FOR HUMAN REVIEW.** V1.3 IN DEVELOPMENT. Working branch feat/v1.3-mentions-watchers; HEAD remains M18 checkpoint. No stage/commit/push/tag/merge/deployment. M20 Response & Checklist Templates and M21–M24 NOT STARTED. [Final Git/cleanup evidence](evidence/M19_FINAL.json) records the changed-file inventory snapshot, unchanged historical evidence/release/HEAD, zero staged files, developer7 and cleanup of owned test DB/ports. [Milestone section34 record](../verification/MILESTONE_19_VERIFICATION.md) records the same gate. Stop here; later checkpoint publication or M20 requires separate authorization.
