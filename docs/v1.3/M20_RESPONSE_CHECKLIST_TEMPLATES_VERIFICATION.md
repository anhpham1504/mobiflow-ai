# M20 — Response & Checklist Templates verification

Date: 2 October 2026. Authority: explicit M20 user request, following closed M19 checkpoint `35e4b1c41165fa04348871dee31bd20c28386b47`. Starting branch `feat/v1.3-mentions-watchers` and remote tip matched that SHA; starting tree was clean. Work is on `feat/v1.3-response-checklist-templates` without commit, push, tag, merge or deployment. V1.2 remains `v1.2.0` / `31b445caf07dad606601a1e38e8ed39836d9f825`; M21–M24 remain NOT STARTED.

Current gate: **M20 PASS — READY FOR HUMAN REVIEW**. Required baseline/product/targeted/source/security/cleanup gates passed with actual evidence. Work remains uncommitted; M21 NOT STARTED.

## Architecture and implemented scope

The [implementation plan](M20_RESPONSE_CHECKLIST_TEMPLATES_IMPLEMENTATION_PLAN.md) was written before product edits, after auditing RequestMessage, MANAGER's local `FinalDecision.actions` draft, `RequestStateMachineService`, authorization, expectedVersion, audit/history and protected checklist activation. Source integration is confined to existing message/request-info commands and manual triage drafts. Selecting/previewing/applying performs GETs and local copying. Response sending is an explicit existing human command. Checklist activation still requires separate versioned save, submit and APPROVE_AND_ASSIGN; template management never assigns or creates active work.

Implemented three normalized template models: `OperationalTemplate`, immutable `OperationalTemplateRevision`, ordered immutable `OperationalTemplateChecklistItemRevision`. Types RESPONSE/CHECKLIST; statuses ACTIVE/ARCHIVED. Revision1 at create; N+1 on revise under a locked expectedRevision. Archive is one-way and preserves all history; there is no delete/unarchive API. Metadata snapshots retain the original name/description. Immutable itemCount plus deferred integrity checks prevent additions to an already committed historical checklist revision as well as update/delete.

Shared strict contracts reuse current Unicode code-point bounds: response1–4,000; checklist1–30 items, item text1–500 and required boolean; names1–120, optional description1–500. The installed canonical Zod validator was measured accepting4,000 emoji and rejecting4,001; UTF-16 length is not the business bound. No dependency, macro engine, rich text, AI generation, routing, reminders, analytics or notification subsystem was added.

## Database verification

Migration10: `20261002030000_m20_response_checklist_templates`. Migrations1–9 and release/historical evidence remain unchanged. The existing Request draft, RequestMessage and Checklist receive nullable immutable-revision references; no old rows are replaced.

| Isolated path | Actual result |
|---|---|
| Fresh1→10 | PASS;10 migrations,32 tables snapshotted,157 established fixture rows |
| M19 9→10 | PASS;29 old tables/157 rows preserved |
| M18 8→9→10 | PASS;29 old tables/157 rows present before10 and preserved |
| V1.2 7→8→9→10 | PASS;29 old tables/157 rows present before10 and preserved |

Upgrade fixtures include real synthetic M18 note/M19 mention/watch/notification rows and prior domain/AI evidence. The comparisons account only for the three new nullable defaults. Real PostgreSQL tests establish unique(templateId,revision), RESTRICT FKs, deferred current pointer/metadata/type/item-order/shape checks, immutable snapshots including historical append rejection, one-way archive and valid archived provenance.

The runtime role has SELECT/INSERT on the three tables; only six metadata/lifecycle columns on OperationalTemplate are updateable. It has no table-wide UPDATE, no revision/item UPDATE, DELETE, TRUNCATE or DDL privilege; actual CREATE/ALTER/DROP attempts are denied. The migration owner is also blocked by the snapshot DML triggers. Owner DDL is outside this immutability claim. Contiguity verifies both count and maximum revision against the pointer; the malformed {1,3,4}/current3 fixture is rejected on all four paths. The [database evidence](evidence/M20_DATABASE.json) records these actual results. Tests use guarded synthetic `mobiflow_m20_test` only: demo mode, established separate owner/runtime accounts, advisory lock, refusal of an existing target and cleanup only of a database created by this harness. Read-only developer metadata before/after remains7 migrations; no developer migration/reset/reseed.

## API, authorization and human provenance

Six generated OpenAPI routes: GET/POST `/api/v1/templates`, GET `/:id`, GET/POST `/:id/revisions`, POST `/:id/archive`. Existing Access/Roles/Workflow guards, live identity/session checks, media/origin/payload/rate rules, safe errors and authenticated no-store remain in effect. List uses SQL scope/type/status/name-description filters, createdAt/id keyset pagination and summary-only projection (default20, max50). Revision history is nested, manager-only and bounded; no standalone revision backdoor.

USER is denied every template route and template provenance adoption. STAFF can only list/read current ACTIVE RESPONSE templates and use them in already authorized response forms; STAFF cannot manage, read archive/history or use CHECKLIST templates. MANAGER manages both types within the existing A01 scope and uses CHECKLIST only in the authorized human draft workflow. Unknown/out-of-scope detail is404; prohibited roles/filters are403. Request ownership/current assignment remain separate backend predicates.

Management create/revise/archive transactions write safe resource-only audits. Stale expectedRevision/concurrent revise/archive/repeated archive are atomic409s, without partial revision/audit. Existing business commands accept an optional sourceTemplateRevisionId and first enforce Request expectedVersion. Live type/current revision/ACTIVE/role validation takes a shared template lock in that same transaction. Archived/noncurrent references return409 TEMPLATE_UNAVAILABLE with no business/history/audit/notification/version write; ordinary manual commands remain usable.

RequestMessage stores final submitted human text with exact revision provenance. The manual draft stores edited ordered/required human actions and its source separately; protected approval copies that source to the final Checklist. Revising/archiving after successful draft save does not invalidate the historical starting point used by submit/approval. Existing message DTOs/history explicitly omit source fields; draft/checklist sources are projected only to MANAGER. Resource-only TEMPLATE_USED audits have no AuditLog.requestId and contain IDs/revision only, never bodies. USER sees allowed final communication/status only. No library/provenance content is fed to RAG/recommendation/Copilot/embeddings or analytics.

The [API evidence](evidence/M20_API.json) records12/12 real HTTP/PostgreSQL cases, including authorization/IDOR, strict validation, safe media/origin/payload errors, management concurrency/history, human-edited message/checklist, stale triage and approval rollback, archive/revision race/manual fallback, unchanged request-info SLA/notification behavior, M18/M19 scoped regression, OpenAPI, safe audits/logs and zero provider work.

## Browser, responsive and accessibility verification

Production Next + real isolated Nest/PostgreSQL, Microsoft Edge/Playwright:4/4 cases passed,0 unexpected/skipped/flaky. Manager creates both types, revises, reads immutable history, cancels/confirms archive; STAFF previews/confirms/replaces/edits/explicitly sends and handles an archive-after-fetch race; MANAGER edits checklist order/required flags, separately saves/submits/approves, and a stale Request version blocks the command; USER receives final content without controls/library requests/provenance.

Loading/503/empty/retry are explicit transport fixtures; successful business actions always use the actual API. They preserve manual work and hide synthetic raw internal errors. A delayed real detail read proves the draft is temporarily disabled during application, then re-enabled and editable. Nonempty replacement and archive confirmations receive focus; cancel returns focus after the trigger is enabled. Native select/Tab and semantic labels/forms are verified. Literal HTML/script strings in name/description/body/item remain text; no script variable/image/network execution. The browser reports0 page errors. No real customer data is used.

Three changed surfaces (STAFF response composer, MANAGER management and checklist draft) passed12 Axe/overflow scans at360/768/1440/1920, with0 violations and no page overflow. One additional manager create/history Axe scan passed. Manually inspected final360 screenshots for all three and1440 management: controls stay within cards, long literal text wraps and checklist controls remain reachable. Raw screenshots/traces/fixture tokens are ignored/local; [compact browser evidence](evidence/M20_BROWSER.json) contains safe assertions only. This is targeted accessibility verification, not a WCAG certification.

## Performance and unaffected owners

Actual fixture:50 templates,2 revisions each,30-item checklists. SQL list:8 total including authentication/transaction,1 template query,29.5433ms. Current detail:10 total,3 template queries,35.4789ms. History:10 total,3 template queries,29.6718ms. Additional list samples19.3005/18.0946/15.6020ms. Query count stays constant as returned rows/history items grow; no per-row fetch or JS full-library filtering. These modest loopback samples do not establish an enterprise throughput/SLO.

Protected owners remain unchanged by diff: internal-note/mention/watch services and contracts, existing collaboration notification allowlist/dedup, transition rules, canonical SLA clock/monitor, AI/knowledge/RAG/recommendation/Copilot, analytics/dashboard, demo/reset/config, dependency lockfile and migrations1–9. Targeted HTTP regression confirms private append-only notes, USER isolation, structured mentions, own watching and current delivery. Template reads/management produce no watcher or legacy business notification. Generic MESSAGE remains outside the M19 watcher allowlist; REQUEST_USER_INFO still pauses/resumes SLA and produces its existing final-action notifications.

## Actual commands and results

Gates are captured with `node --env-file=.env scripts/verification/m20-capture.mjs <M20_GATE> <command>`. The wrapper sanitizes configured secrets, stores raw logs under ignored artifacts and preserves previous compact evidence in iterations.

| Exact command | Actual result |
|---|---|
| `npm run lint` | PASS;0 warnings |
| `npm run typecheck` | PASS after final UI repairs |
| `npm test` | PASS190 (config7/API116/web2/current release/evaluation units65),0 failures/skips |
| `npm run build` with process `NODE_ENV=production`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:33201/api/v1` | PASS; production route includes `/manager/templates` |
| `npm run test:database:m20` | PASS four real fresh/upgrade paths and privilege/constraint/history checks |
| `npm run test:integration:m20` | PASS12/12; actual429 Retry-After57s honored once, guards unchanged |
| `node --test apps/api/test/templates.test.mjs apps/api/test/workflow.test.mjs apps/api/test/authorization.test.mjs apps/api/test/internal-notes.test.mjs apps/api/test/mentions-watchers.test.mjs` | PASS25/25 |
| `npm run test:e2e:m20` | PASS4/4;12 responsive scans and additional manager Axe scan |
| `npm run verify:security:m20` | PASS focused RBAC/IDOR/validation/race/rollback/XSS/projection/source review;0 credential findings,23 production JS bundle files |
| `git diff --check` | PASS |
| `node --env-file=.env scripts/verification/m20-final-sanity.mjs` | PASS; HEAD/release/history preserved,0 staged, developer7, owned test DB removed,33020/33200/33201 released, normal containers unchanged during verification |

Historical M0–M19 replay: **NOT RUN — intentionally outside M20 scope.** The required current unit baseline includes existing deterministic units; no full historical DB/integration/browser/evaluation gate was replayed. Live AI/M15 evaluation: NOT RUN / not required. Ollama read-only `/api/tags` probe: UNAVAILABLE; no model start/download/inference, no M20 dependency.

## Retained failures and repairs

- Initial unit assumption used UTF-16 bounds; measured canonical Zod behavior established Unicode code points, then corrected the test/UI limits. The existing server validator was not weakened.
- Initial React lint failure came from synchronous effect-to-loader state writes. Read effects now use abortable fetch promises and apply results asynchronously; final lint passed.
- Initial integration attempts expected a generic MESSAGE watch notification and exceeded the real manager write rate. Corrected the test to preserve the actual M19 allowlist and own-watch PUT route, and honored bounded Retry-After without disabling production guards. Final12/12 passed.
- The first build inherited NODE_ENV=test from the local env-file. A process-only production override fixed the real production build; `.env` and app behavior were unchanged.
- First browser attempt used exact label-text queries whose wrapping label contents included control values/options; changed tests to exact computed accessible role/name queries. The next run exposed real focus-return and pending-application overwrite defects. Focus now returns after rendering, and the owning draft is disabled during apply revalidation. The final4/4 run verifies both fixes, including delayed read and exact final human checklist.
- Final source review strengthened the deferred SQL sequence check from count-only to count-plus-maximum, preventing a future revision from masking a missing revision. All four PostgreSQL paths reject the new gap fixture and actual runtime CREATE/ALTER/DROP attempts; valid application flows are rerun against the final migration.

Failed logs and sanitized prior metadata remain in [gate iterations](evidence/gates/iterations) and [browser iterations](evidence/iterations); no failed attempt was relabeled PASS. Successful repeated checks reflect the subsequent source repairs.

## Documentation, limitations and boundary

Updated owning PROJECT_SPEC/API_SPEC/AUTHORIZATION_SPEC/DATABASE_SPEC/BUSINESS_WORKFLOW/UI_SPEC, IMPLEMENTATION_PLAN and current V1.3 README/master-plan authority. Historical milestone/release/checkpoint evidence remains untouched. See [section34 milestone record](../verification/MILESTONE_20_VERIFICATION.md), [security evidence](evidence/M20_SECURITY.json) and [final inventory](evidence/M20_FINAL.json).

Library scope is the existing single synthetic A01 organization. Fixed plain text only; no dynamic placeholders, attachments, sharing, rich text, AI authoring/suggestions, restore/unarchive or library analytics. STAFF checklist-template adoption is intentionally unavailable because its existing editor mutates active work. A request-version conflict still requires explicit reload/review. An unavailable source requires explicit manual retry with retained draft; there is no automatic retry. Production normal stack remains at migration7 and was not rebuilt/restarted or upgraded for M20. Deployment and V1.3 release readiness were not exercised.

## Gate

**M20 PASS — READY FOR HUMAN REVIEW.** No remaining M20 blocker. Required baseline and targeted gates passed against the final implementation/migration. Final Git/history/developer/owned-resource cleanup checks passed. Stop uncommitted for human review. M21–M24 NOT STARTED; V1.3 IN DEVELOPMENT. No commit/push/tag/merge/deployment.
