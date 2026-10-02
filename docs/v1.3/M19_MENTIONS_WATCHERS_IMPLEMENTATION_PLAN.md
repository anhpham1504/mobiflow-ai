# M19 — Mentions + Watchers Implementation Plan

Date: 2026-10-02. Explicit [current user request](M19_MENTIONS_WATCHERS_SPEC.md) authorizes complete M19 implementation and targeted verification, then **STOP FOR HUMAN REVIEW**. No commit/push/merge/tag/deployment or M20. Starting clean branch `feat/v1.3-internal-notes`, checkpoint `1f54dce3c8427976763b19ef33f181b4ef9a3337`; work branch `feat/v1.3-mentions-watchers`. Released V1.2 remains `31b445caf07dad606601a1e38e8ed39836d9f825`. V1.3 IN DEVELOPMENT. The architecture decisions below were written before product edits; this authority link is an administrative addition at verification closure.

## Architecture audit

Existing Notification is an in-app persisted row inserted in the owning PostgreSQL transaction. Notification.eventId references AuditLog; existing unique(recipientId,eventId,type), readAt and keyset list/read APIs serve the existing notification center. There is no external delivery/outbox worker to extend. Keep fetch/manual refresh and this storage; add no framework, worker, email, WebSocket or SSE.

AuthorizationPolicyService owns existing role/ownership predicates: USER owner, STAFF currentAssigneeId, MANAGER all requests in A01's one synthetic organization. Add centralized eligible operational-user predicates, never authorization through collaboration relations. Existing InternalNoteService locks live actor/session and scoped parent before child insertion; preserve this lock discipline and body/lifecycle/version rules. Notification reads currently check recipient only; M19 must additionally filter internal types by current role/account/request access, including unreadOnly and read mutations.

## Persistence and migration

One forward migration `20261002020000_m19_mentions_watchers` (8 → 9); migrations 1–8 immutable. RequestInternalNoteMention(noteId,mentionedUserId composite primary key,createdAt), RESTRICT foreign keys, mentionedUserId index, SELECT/INSERT only. RequestWatcher(requestId,userId composite primary key,createdAt), RESTRICT foreign keys, userId index, SELECT/INSERT/DELETE only. Unwatch deletes active subscription; immutable resource-only REQUEST_WATCH_STARTED/STOPPED audit records preserve changes. Their Request FK stays null, so no internal collaboration enters public history.

Existing Notification storage needs no new columns. Add a partial unique(recipientId,eventId) covering only INTERNAL_NOTE_MENTION and REQUEST_WATCH_ACTIVITY, preventing duplicates across these two reasons without changing old notification uniqueness. Safe metadata contains reason, sourceAction and optional noteId; existing requestId/eventId columns provide navigation/provenance. No body/excerpt/title, author name, request dump or raw audit JSON.

## Mentions and candidates

Optional mentionedUserIds preserves valid M18 `{body}` input. Strict UUID array, at most 100 supplied IDs to bound input work, deduplicated to maximum **10 unique** IDs. Reject self mention and any invalid/inactive/USER/out-of-scope target with the same 400 INVALID_MENTION_TARGET; no partial acceptance or existence disclosure. No parsing of body text: literal @name has no identity/effect. Target IDs are rechecked under the actor/session/scoped-parent transaction and batched ordered user share locks at submission. Body and mention set remain immutable; correction requires a new note.

GET `/requests/:id/mention-candidates` authorizes operational actor/request first. Strict q (trimmed, max80 Unicode code points), limit default20/max20, stable displayName/id order. Only active STAFF currently assigned or MANAGER in existing A01 scope, excluding actor. Response only id/displayName/role. Neither candidates nor mentioned names expose account credentials/email. Internal note responses add safe mentions(userId,displayName), render as text.

## Watch semantics

GET/PUT/DELETE `/requests/:id/watch` expose only the actor's own watching boolean, strict empty body/query, operational role/request authorization. PUT/DELETE idempotent under parent lock; audit only actual state changes, no Request version/updatedAt/workflow/SLA writes and no expectedVersion. Terminal readable requests permit watch/unwatch. Never auto-watch assignment/manager/mention/author. Stale rows may remain; fan-out and delivery do not grant access. Engineering bound: maximum100 subscription rows/request, checked under parent lock; fan-out <=100 watchers +10 mentions and batched queries, no silent truncation. No watcher list/count/identity API.

## Exact persisted watcher event allowlist

| Existing event/action | Watcher notification? | Reason |
|---|---|---|
| INTERNAL_NOTE_CREATED | YES | New private note, no excerpt |
| SUBMIT_FOR_APPROVAL | YES (human command only) | Explicit workflow transition |
| APPROVE_AND_ASSIGN, REJECT_APPROVAL | YES (business workflow only) | Human approval and assignment/return to triage |
| REASSIGN | YES | Assignment change; filter using resulting current assignment |
| START_WORK, REQUEST_USER_INFO, USER_PROVIDE_INFO | YES | Meaningful persisted status transitions |
| RESOLVE, USER_REOPEN, USER_CONFIRM, CANCEL | YES | Resolution/reopen/close/cancel |
| MANUAL_TRIAGE, PRIORITY, MESSAGE, CHECKLIST_ADD/EDIT, FEEDBACK | NO | Outside bounded M19 allowlist |
| AI analysis/recommendation/review/generation/retry, embeddings, SLA ticks/warnings, reads/dashboard/analytics/health, watch/unwatch | NO | No collaboration fan-out from background/reads or M20–M22 scope |

State-machine changes only add transactional fan-out after its existing successful writes, using resulting Request ownership. No transition/expectedVersion/clock math changes. Advisory V2 review's early return remains untouched: agreement never becomes a workflow event. Existing requester/assignment/approval/SLA notification behavior stays separate and unchanged.

## Transaction, dedup and delivery

Note transaction: live actor/session → scoped parent lock/lifecycle → all target validation/locks → note → mentions → existing body-free audit → one batched internal notification insert → commit. Any failure rolls back all. Notification recipients union eligible manual watchers and validated targets, excluding actor; MENTION wins over WATCH. Source event is the immutable audit UUID; replay reads the same mention/watch inputs and uses database conflict protection, never timing. No external effects before commit.

Internal notification list applies a current backend relational predicate BEFORE pagination, unread filtering and projection; USER is unconditionally excluded from internal types. Current identity/session is rechecked transactionally. Read/unread mutation locks/rechecks the current scoped parent for internal rows and returns indistinguishable404 if stale/foreign. Existing API has no notification detail or unread-count endpoint; do not invent either. Filtered unreadOnly listing is tested. Request navigation uses the existing role detail route, with backend authorization again; no notification bypass. Authenticated endpoints remain no-store.

## UI

Reuse M18 note composer, detail card and notification center. Add labeled searchable candidate selector with keyboard selection/Escape, selected chips/removal, loading/empty/error/retry, stale search cancellation and structured IDs. Add independent own-watch toggle with aria-pressed, busy/duplicate-submit protection and safe retry; watch failures do not block request work. Safe mention/watch notification Vietnamese copy without raw enum/excerpts. USER mounts neither selector nor watch. Preserve literal React text rendering for body/displayName and response validation via shared contracts.

## Verification and acceptance

Required actual npm lint/typecheck/test/build; strict contract/domain tests, real isolated PostgreSQL fresh1→9/seed idempotency, V1.2 seven→eight→nine row preservation, M18 eight→nine note preservation/FKs/uniques/grants; HTTP actor/target/terminal/idempotency/stale/read/rollback/races/dedup/replay/all allowlisted events; deterministic USER/history/AI-context/analytics/cache/log isolation. Measure 50 notes/multiple mentions/10 watchers, batched SQL counts and local API latency samples. Targeted production-browser collaboration/dedup/scope-loss/USER/loading/error/XSS, widths360/768/1440/1920 for STAFF/MANAGER/notifications, representative Axe0serious/critical and keyboard/focus. Run affected M18 note, authorization and existing notification regression only; no historical milestone suite replay or live AI.

Use dedicated guarded loopback `mobiflow_m19_test`, reject any existing target, advisory-lock ownership and cleanup only the DB created by this harness. No normal developer migration/reset/reseed/stack restart; developer DB stays seven migrations. No new dependency. Preserve historical evidence; save truthful sanitized JSON with failures retained, screenshots/traces/raw logs local ignored. Update owning specs, V1.3 status and M19 verification plus section34 record with actual commands/results. PASS requires all gates and zero remaining blockers; missing/unavailable service is NOT RUN/blocked, never PASS.

## Non-goals and stop

No AI functionality/context expansion, analytics metrics, role/scope change, templates/routing/SLA escalation/reminders/saved views, attachments/rich text/edit/delete/threads/reactions, external or real-time delivery. M20–M24 NOT STARTED. End M19 uncommitted and unpushed, ready for human review.
