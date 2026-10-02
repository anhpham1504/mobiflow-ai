# M18 Internal Notes Verification

Implementation authority: initial explicit 2 October 2026 user request, [V1.3 master plan](V1_3_MASTER_PLAN.md) and [implementation plan](M18_INTERNAL_NOTES_IMPLEMENTATION_PLAN.md). **M18 implementation PASS — READY FOR HUMAN REVIEW at the implementation handoff. V1.3 IN DEVELOPMENT; M19–M24 NOT STARTED.** The subsequent [checkpoint closure authorization](M18_CHECKPOINT_CLOSURE.md) permits one reviewed commit/push on the M18 branch only; this accepted test record remains the implementation snapshot.

## Baseline and review boundary

Started on clean `main`, equal to origin/main, at released `v1.2.0` / `31b445caf07dad606601a1e38e8ed39836d9f825`. `git pull --ff-only` returned already up to date; created `feat/v1.3-internal-notes`. At the implementation handoff HEAD and release references were at that baseline. The roadmap and implementation plan were written before product edits. Prior release tags, migrations 1–7, historical milestone evidence and AI/workflow/SLA owners are preserved.

The implementation handoff left M18 uncommitted for human review. The later closure request separately authorizes checkpoint publication; passing M18 never authorizes M19 or a V1.3 release.

## Files and modules changed

| Area | Files / purpose |
|---|---|
| Persistence | [Prisma schema](../../apps/api/prisma/schema.prisma); new [migration 8](../../apps/api/prisma/migrations/20261002010000_m18_internal_notes/migration.sql). Request/User inverse relations and private child table only. |
| Backend | [InternalNoteService](../../apps/api/src/requests/internal-note.service.ts), [controller](../../apps/api/src/requests/internal-note.controller.ts), [application registration](../../apps/api/src/app.ts), additive [central authorization method](../../apps/api/src/authorization/authorization-policy.service.ts). |
| Contracts | [internal-notes.ts](../../packages/contracts/src/internal-notes.ts), [exports](../../packages/contracts/src/index.ts). Strict create/query/note/list/envelope schemas and shared body bound. |
| Frontend | [InternalNotes](../../apps/web/src/components/internal-notes.tsx), authorized mount in [RequestDetail](../../apps/web/src/components/request-detail.tsx), scoped [CSS](../../apps/web/src/app/globals.css). |
| API tests | [six unit tests](../../apps/api/test/internal-notes.test.mjs), [real integration tests](../../apps/api/test/internal-notes.integration.test.mjs), [synthetic harness](../../apps/api/test/helpers/internal-notes-fixture.mjs), [API package script](../../apps/api/package.json). |
| Browser tests | [M18 Playwright config](../../playwright.m18.config.mjs), [four browser tests](../../apps/web/e2e/internal-notes.spec.mjs), [production browser runner](../../scripts/verification/m18-browser.mjs). |
| Verification | [guarded database helper](../../scripts/verification/m18-database.mjs), [fresh/upgrade gate](../../scripts/verification/m18-migrations.mjs), [integration runner](../../scripts/verification/m18-integration.mjs), [command capture](../../scripts/verification/m18-capture.mjs), [security review gate](../../scripts/verification/m18-security.mjs), [root commands](../../package.json). |
| Documentation | V1.3 master plan, README, implementation plan, this record and [milestone §34 record](../verification/MILESTONE_18_VERIFICATION.md); relevant amendments in PROJECT_SPEC, API_SPEC, AUTHORIZATION_SPEC, DATABASE_SPEC and IMPLEMENTATION_PLAN. |
| Evidence | Compact safe JSON in [evidence](evidence/M18_API.json), including retained M18 failed iterations. Closure excludes raw console logs while preserving them locally; JSON log/artifactDirectory fields and screenshot links are local-only historical pointers. Screenshots/traces, synthetic test storage and temporary historical migration views remain ignored under artifacts/m18. |

No dependency/lockfile, model, protected workflow, SLA, AI, notification, analytics, request projection, demo seed/reset or historical test implementation changes.

## Architecture, audit and lifecycle

RequestInternalNote is a persistent append-only child: UUID id/requestId/authorId, plain body varchar(4000), createdAt timestamptz(6), RESTRICT FKs and `(requestId,createdAt,id)` index. There are no mutable timestamps, visibility overrides, version, soft-delete, attachments or M19 fields. Runtime mobiflow_app has SELECT/INSERT only; actual UPDATE/DELETE/TRUNCATE attempts fail with PostgreSQL 42501.

List/create use the existing centralized request predicate. USER is rejected before a note query; STAFF must be the current assignee; MANAGER retains the documented single synthetic organization A01. Inside the transaction, active role and unconsumed/unrevoked/unexpired session are rechecked under User/RefreshSession share locks. The scoped parent Request is locked before accessing notes: share for list, update for create. A real blocked create/reassignment race returned 404 after reassignment and inserted no note.

Creation inserts only the note and INTERNAL_NOTE_CREATED audit atomically. Audit resourceType=RequestInternalNote/resourceId=noteId; optional AuditLog.requestId is deliberately null. Safe metadata is `{noteId,requestId,authorId}` plus existing actor/time/correlation/outcome fields, never body. This child-resource event stays outside requester Request history and request-audit AI context. Injected audit failure returned sanitized 500 and rolled back the note.

Request status/version/updatedAt/priority/assignment/SLA/checklist/resolution/approval, messages, status history and notifications do not change. A previously loaded expectedVersion remains usable for the next existing business command. PROJECT_SPEC A11 explicitly distinguishes this newly authorized child insertion from every unchanged protected Request mutation.

Read access includes authorized terminal history. Creation follows existing conversation policy: allowed through RESOLVED, CLOSED/CANCELED return 409 INVALID_STATE. Both terminal UI surfaces remove the composer and retain readable notes. Sequential close/cancel and reassignment checks passed; the concurrency probe specifically exercises reassignment, not every possible lifecycle interleaving.

## Database verification

[Database evidence](evidence/M18_DATABASE.json): fresh isolated PostgreSQL applied all eight migrations and seeded successfully. A separate target used the actual v1.2.0 schema and migrations 1–7 from Git, seeded before applying migration 8. All **26 existing tables / 152 rows** survived unchanged in deterministic JSON snapshots; historical migration records/checksums were unchanged. Repeating seed preserved row counts and produced zero fabricated demo notes. Runtime privileges, missing Request/User FKs and nonempty body constraints were tested with real SQL.

All harnesses require DEMO_MODE=true, distinct established owner/runtime principals, the same loopback server and exact `mobiflow_m18_test`; they take an advisory lock, refuse an existing target, and drop only the target they created. No developer DB migration/reset/reseed occurred. Final read-only check found developer DB still at **seven** migrations and the isolated target removed. This verifies the upgrade without deploying M18 into the running V1.2 stack.

## API and contracts

- GET `/api/v1/requests/:id/internal-notes`: strict limit/cursor only; existing opaque keyset, default 20, maximum 100. Newest first by createdAt DESC/id DESC; no count. Tied timestamps, eight disjoint pages of seven over 50 rows, stable ordering and invalid cursor/query negatives passed.
- POST same path: strict `{body}`, server-owned author/id/time, 201 safe note envelope. Body trims surrounding whitespace and is bounded at 1–4,000 Unicode code points using installed Zod 4.6.5, matching PostgreSQL. Both 4,000 Vietnamese characters and 4,000 emoji pass; 4,001 fail. Unexpected identity/role/request/time/visibility/version fields fail.
- Safe author exposes id/displayName only; no email, role, session or credentials. Both routes inherit authenticated no-store, origin/media/payload handling and existing read/write limits. Missing auth 401, USER 403, foreign/absent resources same 404, malformed input 400, terminal write 409, oversized JSON 413, wrong media 415 and safe internal failures are covered.
- Generated OpenAPI operationIds listRequestInternalNotes/createRequestInternalNote, bearer security, strict schemas, parameters, error statuses and all local references passed. No static duplicate OpenAPI source or breaking existing endpoint change.
- No PATCH/DELETE/PUT, read-by-note-ID, attachment, mention, watcher, count or notification endpoint.

## Security, privacy and AI isolation

[API evidence](evidence/M18_API.json) contains 10 passing subchecks plus the passing parent (11 tests, zero skipped). Direct actual HTTP covers USER read/create denial on owned and guessed resources, STAFF foreign/unassigned/old assignment denial, MANAGER A01, inactive/revoked identity, strict inputs, UUID/query/cursor/media/origin/size, safe errors, immutable writes and atomic audit.

After inserting unique synthetic private canaries, requester detail/list/history/dashboard/notifications/explanation contained no body, note IDs, counts, entity or INTERNAL_NOTE_CREATED activity. Request/workflow snapshots remained identical; analytics business values remained identical after excluding only their three explicit clock-dependent asOf metadata fields. Logs and audit metadata contained no private body.

Real intake, knowledge ingestion/retrieval/request embedding, Recommendation V2 and Copilot SUMMARIZE_REQUEST context builders ran against PostgreSQL with deterministic capture providers. The exercised jobs succeeded; captured inputs contained no note canary, note/audit ID or note activity/entity. Captured prompts stay in process memory and are not written to evidence. This verifies context isolation, not model accuracy or a historical/live evaluation. AI owner code is unchanged.

[Focused security evidence](evidence/M18_SECURITY.json) combines those actual HTTP/DB checks and browser XSS outcomes with review of bound SQL/current scope/live identity, strict DTOs, safe audit, plain React text, no-store and unchanged owning subsystems. Changed-file configured-secret/high-confidence credential scan had no findings. No penetration-testing claim.

## UI, responsive and accessibility

[Browser evidence](evidence/M18_BROWSER.json), run `8f5c15b4-1acb-4de5-abf4-0709f94b7329`: **4/4 passed**, zero skipped/unexpected/flaky, actual production Next build + API + PostgreSQL, Microsoft Edge. No application page exceptions in the observed collaboration/rendering paths.

STAFF created Vietnamese/emoji/newline content; MANAGER read it and appended another note; safe author and timestamp displayed. USER had no section, content or internal-notes API request, and its observed JSON payloads contained no note canary/activity. Loading, empty, safe list error/retry, failed-create draft retention, success clearing, in-flight disabling, synchronous duplicate-submit protection (one request), Unicode bound, load-older 20→25, terminal read-only and foreign STAFF detail all passed. UI transport delay/503 fixtures are explicitly scoped and restored; business writes use the actual API.

Literal img/script payloads rendered as plain text; no note img/script/iframe DOM, flag execution, image request or dialog occurred. Long unbroken tokens wrapped. STAFF and MANAGER each passed 360/768/1440/1920 widths: no document horizontal overflow, textarea/timestamps within viewport and all note buttons at least 44×44 CSS pixels. Visible textarea label/associated helper/count/error, named note region, loading/error/status semantics, Tab/Shift+Tab, visible ≥2px focus and keyboard submission passed.

Axe representative whole STAFF/MANAGER detail pages: **0 serious / 0 critical**, zero other recorded violations. This is targeted accessibility verification, not full WCAG certification. Actual screenshot inspection confirmed the section follows existing cards, author/time and composer layout; full-page screenshots include the existing sticky chrome at the capture scroll position.

Local screenshot artifacts: [STAFF 1440](../../artifacts/m18/browser-runs/8f5c15b4-1acb-4de5-abf4-0709f94b7329/staff-1440.png), [MANAGER 768](../../artifacts/m18/browser-runs/8f5c15b4-1acb-4de5-abf4-0709f94b7329/manager-768.png), [USER absence](../../artifacts/m18/browser-runs/8f5c15b4-1acb-4de5-abf4-0709f94b7329/user-no-internal-notes.png). The same run retains all eight width/role screenshots, exact JSON, failure-free test results and safe runtime artifacts locally.

## Measured local performance

Synthetic fixture: **50 notes / two authors**. Authenticated list used **10 SQL statements with one note and 10 with 50 notes**; this includes auth/session and scoped transaction work. One note-list SQL plus batched author retrieval; no per-note N+1. The 50-note response was **13,001 bytes**. Ten default-page end-to-end localhost samples (milliseconds): **11.28, 13.58, 15.34, 11.09, 16.17, 14.79, 11.34, 12.55, 11.31, 11.58**. These modest local observations are not load tests or enterprise/SLO claims.

## Actual commands and results

Measured 2 October 2026. [Sanitized gate summaries](evidence/gates/M18_UNIT.json) retain exact commands, start/finish time, exit code and older JSON iterations. Raw logs were reviewed at closure and retained locally, excluded from the checkpoint; gate.log pointers are not portable committed log files. Each npm/node gate below was captured with `node --env-file=.env scripts/verification/m18-capture.mjs M18_<NAME> <command>`; build alone used `$env:NODE_ENV='production'` before that wrapper, preserving the user's .env. Closure did not replay these gates.

| Exact gate command | Actual result |
|---|---|
| `git status`; `git branch --show-current`; `git log --oneline -8`; `git tag`; `git remote -v`; `git pull --ff-only`; `git checkout -b feat/v1.3-internal-notes` | PASS baseline; clean/main/release SHA verified, pull already up to date, branch created. |
| `docker desktop start`; `docker compose ps --all` | Existing PostgreSQL infrastructure restored; normal V1.2 services healthy. No Docker image rebuild/deploy. |
| `npm run lint` | PASS, zero warnings. |
| `npm run typecheck` | PASS contracts/config/API/web and Next route types. |
| `npm test` | PASS **176/176**, zero skipped: config 7, API 102 (six new M18), web 2, deterministic root verification/evaluation units 65. Required baseline includes these existing unit files; it is not historical milestone replay. |
| `npm run build` with NODE_ENV=production | PASS foundation, Prisma generation, API and standalone production Next. |
| `npm run test:database:m18` | PASS real fresh eight migrations + seeded v1.2 seven→eight upgrade, row/checksum preservation, idempotent seed/privileges. |
| `npm run test:integration:m18` | PASS **11/11**, zero skipped, real PostgreSQL/HTTP/privacy/security/context builders/API restart. |
| `npm run test:e2e:m18` | PASS **4/4**, zero skipped/retries; responsive, Axe, keyboard and XSS included. |
| `npm run verify:security:m18` | PASS focused static/credential review + actual dynamic evidence, seven migration freeze and unchanged existing owners. |
| `node --test apps/api/test/authorization.test.mjs` | PASS **2/2** existing central ownership/indistinguishable 404 regression. |
| `node --env-file=.env artifacts/m18/final-runtime-check.mjs` | Read-only developer DB seven/vector 0.8.6, isolated target cleaned; current V1.2 core HTTP 200; optional Ollama unavailable. Local operator helper remains ignored. |
| `git diff --check`; final source/document/link/configured-secret/Git review | PASS — [final review](evidence/M18_FINAL_REVIEW.json): allowed M18 files, local links, all §34 headings, passing gate exit codes and unchanged release refs; no release operation. |

**Historical M0–M17 replay: NOT RUN — intentionally outside M18 scope.** No full old integration/browser suite, M15 evaluation, live model generation, model start/download or dependency upgrade. Request projection/audit/SLA/AI owners are unchanged; their M18 privacy/context boundaries were tested specifically rather than replaying their milestones.

## Failed iterations and corrections

Failures were retained and fixed; no tests, assertions, authorization or Axe gates were disabled:

1. Initial unit assertion assumed UTF-16. Local installed Zod behavior showed code-point counting; contract/docs/UI/count/emoji boundaries corrected to 4,000 Unicode code points.
2. Initial integration compared analytics asOf clock metadata and its draft reporter could appear successful before the parent exit. Compare only business metrics, retain the failed iteration as FAIL, and let the runner promote evidence only after actual node --test exit 0/all checks. A later lock-wait probe used a cached PostgreSQL stats snapshot; fixed with pg_stat_clear_snapshot and guaranteed rollback. Only that runner's dedicated test lock was released; developer DB untouched.
3. First upgrade harness compared checkout CRLF with Git LF bytes. Normalize line endings solely for verifying historical content, and apply the actual historical Git SQL; original migrations were not edited.
4. Lint rejected a test global and synchronous effect state work. Use a plain JSON clone for JSON metrics and promise callbacks/event-driven loading; no suppression.
5. Build inherited NODE_ENV=development from the existing .env and failed prerendering. Explicit production environment passed; no config/source/dependency workaround or .env rewrite.
6. First browser run exposed CSS specificity overriding 44px and an ambiguous Next route-announcer alert locator. Fix only note button specificity and scope the error locator. Next run encountered a second legitimate note after STAFF keyboard creation; target the unchanged literal fixture exactly for MANAGER. Final four tests all passed, with all XSS/Axe assertions retained.

## Runtime and known limitations

[Runtime evidence](evidence/M18_RUNTIME.json): Ollama `/api/version` returned ECONNREFUSED. Existing stack core remains healthy (web/API 200, coreReady=true), truthfully AI/RAG degraded. M18 works without Ollama; no models were started/downloaded and no live accuracy claim is made.

M18 is verified on synthetic local PostgreSQL + Microsoft Edge and a production build. No multi-tenant organization subsystem is introduced beyond existing A01, enterprise load test, penetration test, full WCAG certification, production deployment, backup/restore rehearsal or live AI evaluation. Notes have normal fetch/refetch and deliberately no edit/delete, attachments, real-time collaboration, mentions/watchers or notifications. Migration 8 has **not** been applied to the running developer V1.2 stack. Local screenshot/trace artifacts are ignored and are not portable committed evidence.

## Gate and next milestone

**M18 implementation PASS — READY FOR HUMAN REVIEW at handoff.** No implementation blocker remains within M18. The subsequent [closure record](M18_CHECKPOINT_CLOSURE.md) covers the separately authorized single branch-only checkpoint commit/push and final publication checks, without replaying accepted tests. V1.3 remains IN DEVELOPMENT. **M19 — Mentions + Watchers: NOT STARTED**; M20–M24 likewise NOT STARTED. No main merge, tag, deployment or developer DB migration is authorized.
