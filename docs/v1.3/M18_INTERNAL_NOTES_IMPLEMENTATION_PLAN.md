# M18 Internal Notes — Implementation Plan

Chronology: this plan was written before product edits under the initial implementation-only authority. Its uncommitted/human-review boundary below describes that phase. The later explicit [checkpoint closure authorization](M18_CHECKPOINT_CLOSURE.md) permits one reviewed branch-only commit/push, while preserving M19 NOT STARTED and all product/non-goal boundaries.

Written before product edits on 2 October 2026. Authority: [V1.3 master plan](V1_3_MASTER_PLAN.md) and the current user request. Scope: implement M18 fully, stop before M19 and leave all changes uncommitted for review.

## Baseline and Git

Starting branch `main`; clean working tree. HEAD, main, origin/main and peeled `v1.2.0` all equal `31b445caf07dad606601a1e38e8ed39836d9f825`. `git pull --ff-only` reported already up to date. Created `feat/v1.3-internal-notes`. Preserve every historical tag/commit and migrations 1–7.

## Architecture audit

- npm workspaces; Node 24.19.0/npm 11.17.0; NestJS controllers/services, Prisma PostgreSQL adapter, shared Zod schemas, Next App Router and deterministic Playwright/Edge harnesses.
- Request/User use UUID, timestamptz and RESTRICT FKs. Seven migrations exist. RequestMessage is a **customer-facing** conversation primitive linked to audit; it has no private visibility subtype. There is no equivalent internal-note entity. A separate persistent child entity is required.
- AuthorizationPolicyService owns current request scope: STAFF currentAssigneeId, USER createdById, MANAGER the single synthetic organization (A01). Guards enforce live session/active account, role, JSON/origin and existing 120 reads/60 writes per minute. RequestStateMachineService rechecks identity and locks request on protected mutations.
- RequestQueryService builds explicit detail/list DTOs. History selects request-linked AuditLog events and customer conversation payloads. Dashboard/analytics count workflow entities; they must not acquire a note count.
- Intake reads RequestMessage only. Recommendation history requires histories/messages. Request embedding reads request text/analysis/messages. Copilot and resolution summary include request-linked audits. Never add notes to these relations or inputs.
- RequestDetail serves role-specific pages with SessionGate, LoadingState, workflow-card styles, explicit loading/error and shared authenticated `api()` using fetch `cache: no-store`. No service worker/PWA cache exists.
- OpenAPI is generated from decorated controllers and shared Zod schemas at `/api/docs-json`; no static `contracts/openapi.yaml` exists. Test generated document and refs rather than create a second source.
- Existing message policy permits RESOLVED writes, denies CLOSED/CANCELED. Current assignee remains on terminal requests for historical read access.
- Existing seed is idempotent; test database harnesses validate a fixed loopback synthetic target and never overwrite an existing target. Demo reset discovers tables dynamically. No seed/reset product edits are needed.

## Data model and migration

Add RequestInternalNote: id UUID, requestId FK Request, authorId FK User, body varchar(4000), createdAt timestamptz default database time. Add inverse relations on Request/User. RESTRICT deletions, index `(requestId, createdAt, id)` for bounded deterministic list ordering. No mutable timestamp/version, attachments, AI or M19 columns.

Migration 8: `20261002010000_m18_internal_notes`. Add table, nonempty/length check, index and FKs only. Grant runtime mobiflow_app SELECT/INSERT and revoke UPDATE/DELETE/TRUNCATE to enforce append-only storage under the application principal. Owner-only synthetic fixture maintenance is not a product edit/delete capability. Do not alter migrations 1–7.

## Authorization and transaction boundaries

Add one centralized policy method requiring STAFF/MANAGER before returning the existing request predicate. USER receives 403 even for owned/unknown requests. Missing authentication is 401; authorized operational role with unknown/out-of-scope request gets the same 404 shape.

Service list/create rechecks active identity, role and live session under User/RefreshSession share locks. Lock parent Request (share for list, update for create) and apply the same scope before querying/inserting notes; locks serialize reassignment/closure against the authorization/lifecycle decision. Keep controller validation/delegation only. No role-dependent data access inside UI/controller. No Request update or version check/increment: only a note child row and its safe audit event are inserted atomically.

## API, validation and pagination

- GET `/api/v1/requests/:id/internal-notes`: STAFF/MANAGER, strict query `{limit?,cursor?}` only. Reuse existing keyset parser/page encoding; default 20, allowed 1–100, createdAt DESC then id DESC. Do not accept filters/owner/assignee/role. Scope before page; no count or global total.
- POST same path: strict `{body}`. Reuse existing `text(1,4000)` trim/length policy. Local validation of installed Zod 4.6.5 confirmed this counts Unicode code points (4,000 emoji pass; 4,001 fail), correcting the initial UTF-16 assumption. PostgreSQL varchar(4000) matches that bound; UI counter/validation counts code points and its native UTF-16 cap accommodates surrogate pairs. Blank/whitespace/oversized and unexpected fields return 400. JSON cap 64 KiB/415 media, origin, rate limits and safe errors remain in existing middleware/guards.
- Server derives author/ID/time. Response `{data:{id,requestId,body,createdAt,author:{id,displayName}},requestId}`; list uses existing page envelope. No email/password/session/auth metadata. Shared strict create, query, note, response/list schemas consumed by API/UI; generated OpenAPI operationIds and all applicable errors documented.

## Immutability, audit and terminal policy

No PATCH/DELETE/edit/soft-delete routes or UI. Corrections are appended notes.

Create `INTERNAL_NOTE_CREATED` audit event with resourceType=RequestInternalNote/resourceId=noteId, actor provenance, correlation ID and safeAfterJson `{noteId,requestId,authorId}`. **The audit's optional Request relation remains null**: this is a child-resource event, not a request workflow event. Its immutable note row carries the canonical request FK. This deliberate resource-only audit prevents even activity metadata entering requester history or request-audit AI contexts; the general manager-only audit can retain safe provenance. Never copy body into audit/reason/logs, status history, messages or notifications. Audit failure rolls back note insertion.

Read permitted notes on all readable states. Creation follows existing conversation-write policy: allowed through RESOLVED, denied CLOSED/CANCELED with 409 INVALID_STATE. Composer becomes read-only on CLOSED/CANCELED; existing notes remain visible within unchanged scope. Parent lock makes closure/reassignment races atomic.

## UI design

Add shared InternalNotes section to authorized STAFF/MANAGER request detail only. Match existing cards, spacing, buttons and skeleton. Heading “Ghi chú nội bộ”; helper “Chỉ nhân sự được phân quyền mới có thể xem các ghi chú này.” Show author display name, timestamp and plain escaped text. API/UI both newest first, load older pages on demand, normal fetch/refetch only.

Visible textarea label/associated helper and character limit; keyboard-accessible submit and load/retry; disabled submit while in flight and a synchronous duplicate-submit guard. Preserve draft on create failure, clear only after success. Distinct loading, empty, error/retry, posting/success, pagination failure and terminal read-only states. Keep workflow data usable when note loading fails. Wrap long tokens/newlines; no rich text, links/previews or @name behavior.

## Risks and verification

1. Privacy/IDOR: direct HTTP tests for USER 403, STAFF foreign/old assignment 404, MANAGER existing scope and inactive/revoked sessions. Test parent lock against reassign/close and post-lock identity changes.
2. Leakage: after a unique private canary, assert requester detail/list/history/dashboard/notifications/explanation unchanged and no note ID/author-activity/count; analytics unchanged. Exercise real deterministic intake/recommendation/Copilot builders with capture providers, confirming no body, note ID or note audit event. No live model generation.
3. Integrity: fresh 1–8 migration; separate v1.2 seven-migration target seeded before upgrade; preserve row snapshots and migration checksums; idempotent seed; runtime immutability/FKs/body check; rollback on audit failure; request/SLA/assignment/checklist/history/notifications unchanged.
4. Pagination/performance: tied timestamps, disjoint pages, bounded results, newest first, malformed cursors and unknown query fields; measure SQL statement count with 1 and 50 note fixtures/author batching and local API samples. No scale claims.
5. UI: actual STAFF create → MANAGER view/create → USER absence; Unicode/emoji/newlines/HTML script plain text and no execution/network image; empty/loading/list retry/create draft retention/double submit/load older/terminal states. Check both role surfaces at 360/768/1440/1920, keyboard/visible focus/touch targets and Axe zero serious/critical. Save screenshots and compact evidence.
6. Baseline gates: lint/typecheck/npm test/build. Only targeted existing authorization/request projection regression because the shared policy gets an additive method. No historical milestone integration/browser replay, no M15/live AI evaluation.

Docker was initially stopped; bring up existing PostgreSQL infrastructure for isolated tests without resetting/reseeding the developer database. Ollama is optional and no models will be started/downloaded for M18.

## Files and acceptance

Add shared notes contracts, Prisma table/migration, dedicated note controller/service, UI panel/styles, unit/integration/browser/security/migration harnesses and V1.3 documents. Add registrations/exports/scripts; amend PROJECT_SPEC A11 to distinguish child-resource insertion, and affected API/AUTHORIZATION/DATABASE specs plus current implementation status.

M18 PASS requires persistent immutable notes, preserving migration, strict bounded API, authoritative scope, no USER/AI/analytics/notification leakage, safe rendering, complete UI states, responsive/Axe and all required gates passing with actual evidence. Known limits are disclosed. M19–M24 remain NOT STARTED; V1.3 remains IN DEVELOPMENT. Stop for human review without commit/push/tag/merge.
