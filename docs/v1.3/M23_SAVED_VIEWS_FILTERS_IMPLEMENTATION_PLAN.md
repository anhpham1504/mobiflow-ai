# M23 — Saved Views & Filters implementation plan

Frozen before product edits, 4 October 2026 (Asia/Saigon). Authority: the direct user EXECUTE request incorporating the attached M23 automatic-checkpoint document. Checkpoint closure authorization: RECEIVED — explicit user execution prompt. Complete implementation, real verification and technical self-review, then ordinary commit/push and live closure verification only when every mandatory gate passes. Independent external/human review: NOT RUN; no separate mandatory human review is imposed by this authority. Stop after M23; M24 NOT STARTED. No main merge, tag, deployment or live Ollama.

## Verified baseline

Previous checkpoint and starting HEAD: `58aae141ee2a4e8d9af341fd88dce370106a8c16`, `feat/v1.3-reminder-sla-escalation`, CLEAN. Fetch/live remote checks, sole-parent M18→M22 ancestry, all latest gate records and 98 M22 audited Git blobs match. Main/v1.2.0 remain `31b445caf07dad606601a1e38e8ed39836d9f825`. Twelve existing migrations. No previous M23 implementation or branch; created `feat/v1.3-saved-views-filters` at the exact M22 SHA. Original preflight is captured under ignored artifacts and will be retained as sanitized evidence. Three normal developer containers are already running; preserve their identities/start times/ports and read-only migration checksums. No migrate/reset/reseed/restart of that stack.

## Audit and canonical filter contract

`RequestQueryService.list` owns authorized query execution: requestScope AND canonical filters AND queue/approval route scope AND cursor. Existing backend fields are scalar status, priority, category, assigneeId, from/to (inclusive/exclusive UTC), with fixed createdAt DESC/id DESC. Existing UI exposes status/priority/category and a separate client-only current-page text search. It has component-local query state, no URL synchronization. There is no Request-list search, configurable sort, team, assignedToMe, SLA, alert, routing, template or collaboration filter. Analytics is a different owner and is excluded.

Extract the six actual backend filter definitions into shared strict Zod `request-filters.ts`; HTTP pagination derives from them, while saved JSON omits limit/cursor/unreadOnly. Canonical date validation compares parsed instants, normalizing valid UTC inputs to ISO strings. Preserve fixed ordering. All three roles have status/priority/category/from/to. `assigneeId` becomes explicitly MANAGER-only, matching the existing manager-only staff directory; the formerly permissive hidden transport field on USER/STAFF is narrowed, never broadened. Tests cover this intentional validation hardening. References must be currently active STAFF; missing/inactive/wrong-role IDs fail safely without metadata. Validate normal list requests independently. List/detail saved-view reads batch reference checks, never one owner/reference query per view.

| Field | Type / values | USER | STAFF | MANAGER |
|---|---|---|---|---|
| status | exact existing status enum, scalar | yes | yes | yes |
| priority | LOW/MEDIUM/HIGH/URGENT | yes | yes | yes |
| category | existing six-category enum | yes | yes | yes |
| from/to | UTC instants; inclusive from, exclusive to; from < to | yes | yes | yes |
| assigneeId | UUID, active STAFF in existing A01 directory | no | no | yes |

Expose existing dates and the manager directory selector alongside current filters, without a new query engine. Current-page search remains local/transient and is not saved; applying/resetting a view clears it. Canonical empty fields mean no restriction; sort always returns to the existing fixed order.

## Storage, API and concurrency

One additive migration13, `20261004010000_m23_saved_request_views`, adds SavedRequestView: UUID ID, ownerUserId FK RESTRICT, name, normalizedName, schemaVersion, filters JSONB, positive integer version default1, createdAt/updatedAt. Index owner/createdAt/id and unique(ownerUserId,normalizedName). No result IDs/rows/counts or authority state. Single constant `saved-request-view.v1` is server-owned. Name NFC+trim, 1–80 Unicode code points; deterministic lowercase normalized key retains Vietnamese accents. Name is plain text rendered escaped, never identity.

GET/POST `/saved-request-views`, GET/PUT/DELETE `/:id`; strict empty queries and strict bodies. Create {name,filters}; PUT full replacement {name,filters,expectedVersion}; DELETE {expectedVersion}. Every operation has live identity/session and owner predicates, no manager override; foreign/unknown404. Existing WorkflowGuard origin/media/payload/rate controls and authenticated no-store remain. Generated OpenAPI uses shared schemas. No new dependency.

Lock the current owner's User row before preference writes and identity/session recheck; count+insert share one transaction, maximum50. This serializes only that owner, including concurrent creates with different names. Atomic version compare-and-write/delete yields409 for stale state with no overwrite/audit. Unique-name race yields safe409. Request.version and all business rows are unchanged. Minimal resource-only SAVED_VIEW_CREATED/UPDATED/DELETED audit records contain IDs/version only, no filters, names, customer data or Request FK. No notifications/AI context integration.

Read validates schemaVersion, full payload, current role and current references. A bad view becomes an UNAVAILABLE descriptor {id,safe name,version,reasonCode}, with no filters or forbidden metadata; valid peers still load. Owner can version-delete or fully replace unavailable rows without parsing the old JSON. No partial filter application. Runtime grants allow preference SELECT/INSERT/DELETE and only mutable-column UPDATE, no ownership transfer/TRUNCATE/DDL; existing User retention remains RESTRICT.

## UI and URL behavior

Shared SavedViews control on existing RequestList surfaces for all supported roles. Save uses the actual applied filter state; explicit create/edit dialogs and delete confirmation with accessible labels, errors, focus and keyboard handling. View list loading/empty/failure never disables manual Request work. Apply re-fetches owned detail then replaces all six managed filter keys, resets cursor/page/sort/current-page search, and preserves unrelated URL navigation params. Absent fields clear old values; empty view clears every managed field. URL is authoritative for applied filter state and back/forward restoration; selected view identity is only UI state, never sent as query authority. Dirty indicator compares applied filters with selected definition; exploration never autosaves. No defaults on login, sharing, pinning, reorder or favorites.

## Verification plan and execution environment

Baseline `npm run lint`, `npm run typecheck`, `npm test`, production `npm run build`; targeted M23 unit, PostgreSQL migration/API/security/production Edge E2E. Reuse isolated M22 harness patterns in M23-owned scripts, with distinct project/volume/DB and loopback ports55423/33023/33500/33501. Linux Node24.19.0 preserves native argon2 authentication despite the previously documented Windows Application Control restriction. No normal-stack change, security guard disablement or model invocation. Evidence captures exact commands, exits, timings, source hashes and failed iterations; raw tokens/logs/screenshots/traces stay ignored.

DB matrix: fresh1→13, M22 12→13, V1.2 7→8→9→10→11→12→13, verifying old data/checksums plus FK/unique/version/privilege constraints. API cases: owner CRUD; three-role IDOR; strict/unknown/role-disallowed filters; current role/reference changes; malformed stored view isolation/recovery; 49+two distinct concurrent creates leaves50; concurrent normalized-name creates/renames; update/update and update/delete; unrelated owner progresses while another owner's lock is held; no business side effects; auth/media/origin/rate/no-store and generated OpenAPI. Use controlled locks/clocks, no long waits to bypass limits.

Production browser: three-role save/apply/edit/delete and scoped actual results; sentinel priority/date/page-search removal, empty view, cursor reset/fixed sort, unrelated URL keys, back/forward, dirty/no autosave, unavailable/error/empty/loading/manual fallback, literal XSS, stale conflict. Responsive360/768/1440/1920 and targeted Axe0 serious/critical, keyboard/dialog focus and application console/network checks. Performance:50 views/account and a synthetic Request dataset; measure SQL counts and timing samples, no enterprise claim. Current baseline and targeted canonical filter/authorization regressions; M12/M18–M22 owners preserved or tested if affected. No full historical replay.

## Review and closure

Update affected owning specs, root/V1.3 indexes, section34 milestone record, detailed verification and AUTO closure record. Review all product/migration/contract/test/docs/evidence changes from M22, run affected gates after fixes, scan configured secrets and production bundle, verify exact source coverage, cleanup owned resources and preserve developer stack/main/tags/history. Stage only audited M23 paths. Commit `feat(v1.3): complete M23 saved views & filters`, ordinary push to existing origin, verify local=live remote SHA and CLEAN tree. Record actual final SHA in handoff, never a prospective self-SHA in its own commit. Any unresolved mandatory gate or remote divergence blocks closure. M24 remains NOT STARTED.

## Execution amendments

Implemented the frozen semantics without a new dependency. Retained the initial isolated-env/lint/browser failures as evidence; corrected runner env setup, ambiguous browser locators and native-modal focus timing, compressed desktop date controls and a subsequent navigation/focus race. Focus restoration now waits for the expected URL selection and enabled control; the filter grid preserves readable input width. After the focus fix, production build/typecheck/E2E passed again. Baseline217 units,3 migration paths,9 real API cases and4 production E2E cases passed;24 role/surface/width scans have0 serious/critical violations or overflow. Cap49+two creates observed2 PostgreSQL waiters, one success, final50, and independent-owner progress. Detailed commands, measurements, source scope and final security/cleanup outcomes belong to [verification](M23_SAVED_VIEWS_FILTERS_VERIFICATION.md); publication is evaluated by [AUTO closure](M23_CHECKPOINT_CLOSURE.md), never assumed in this plan.
