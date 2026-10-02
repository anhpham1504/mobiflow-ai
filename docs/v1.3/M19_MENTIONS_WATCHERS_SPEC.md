# MOBIFLOW AI V1.3 — M19 MENTIONS + WATCHERS

Bạn là Senior Backend / Full-Stack / Database / Security / QA Engineer chịu trách nhiệm triển khai đầy đủ:

> **M19 — Mentions + Watchers**

M18 đã đóng checkpoint.

M19 là milestone tiếp theo được người dùng **explicitly authorized** bởi yêu cầu này.

Thực hiện implementation + targeted verification.

Sau khi M19 PASS:

```text
STOP FOR HUMAN REVIEW
```

Không commit.

Không push.

Không merge.

Không tag.

Không triển khai M20.

---

# 1. COMPRESSED BASELINE

Project:

```text
MobiFlow AI
```

Current released version:

```text
v1.2.0
```

V1.2 release SHA:

```text
31b445caf07dad606601a1e38e8ed39836d9f825
```

V1.3 status:

```text
IN DEVELOPMENT
```

Completed V1.3 checkpoint:

```text
M18 — Internal Notes
PASS — CHECKPOINT CLOSED
```

M18 checkpoint SHA:

```text
1f54dce3c8427976763b19ef33f181b4ef9a3337
```

M18 branch:

```text
feat/v1.3-internal-notes
```

M18 branch remote:

```text
PUSHED
local SHA == remote SHA
working tree CLEAN
```

M19:

```text
Mentions + Watchers
CURRENT TASK
```

M20–M24:

```text
NOT STARTED
```

---

# 2. V1.3 ROADMAP — DO NOT REDEFINE

Authoritative sequence:

```text
M18 — Internal Notes ✅
M19 — Mentions + Watchers       ← CURRENT
M20 — Response & Checklist Templates
M21 — Rule-based Routing
M22 — Reminder + SLA Escalation
M23 — Saved Views & Filters
M24 — Release Hardening & Closure
      ↓
    v1.3.0
```

V1.3 theme:

```text
Operational Collaboration & Workflow Productivity
```

M19 is NOT an AI milestone.

---

# 3. CORE ARCHITECTURE TO PRESERVE

Expected stack:

```text
npm monorepo
Next.js App Router
NestJS
Prisma
PostgreSQL + pgvector
shared Zod contracts
OpenAPI
Playwright
Docker Compose
Ollama optional
```

Roles:

```text
USER
STAFF
MANAGER
```

Core guarantees:

```text
Backend authorization authoritative

Roles not silently cumulative

STAFF access follows existing request scope

MANAGER access follows existing manager scope

USER remains requester-facing only

expectedVersion protects protected Request mutations

state machine remains authoritative

SLA remains M12 canonical

AI remains advisory

human business approval remains explicit
```

Do not weaken any of these.

---

# 4. M18 CONTRACT — FROZEN FOUNDATION

M18 provides:

```text
RequestInternalNote
```

Properties:

```text
private
plain text
append-only
request-scoped
STAFF/MANAGER only
```

M18 note API:

```text
GET  /api/v1/requests/:id/internal-notes
POST /api/v1/requests/:id/internal-notes
```

Accepted behavior:

```text
USER:
403 for internal-note role access

STAFF:
current assigned request scope

MANAGER:
existing A01 manager scope

foreign authorized-role resource:
indistinguishable 404
```

Internal-note body:

```text
1–4000 Unicode code points
```

Ordering:

```text
createdAt DESC
id DESC
```

Pagination:

```text
default 20
maximum 100
```

M18 lifecycle:

```text
RESOLVED:
read + create

CLOSED:
read-only

CANCELED:
read-only
```

Do NOT redesign M18.

---

# 5. M18 PRIVACY BOUNDARY — MUST REMAIN

Internal Notes must still NOT automatically enter:

```text
USER detail/history
USER dashboard
Analytics
RAG
Recommendation V2
Copilot
AI evaluation
public cache
customer conversation
```

M19 changes exactly one previously excluded area:

```text
notifications
```

but ONLY for authorized operational collaborators under M19's explicit rules.

Do not make note content generally visible to the notification subsystem.

---

# 6. M19 PRODUCT GOAL

M19 must provide two connected but separate capabilities:

```text
A. Mentions
B. Watchers
```

Mentions:

```text
Authorized operational users can explicitly mention
authorized internal collaborators when creating an Internal Note.
```

Watchers:

```text
Authorized operational users can subscribe to meaningful
future activity on a request they are currently allowed to access.
```

Both generate controlled internal notifications.

Neither grants request access.

---

# 7. ABSOLUTE SECURITY RULE

The central M19 invariant:

> **A mention or watcher subscription NEVER grants authorization.**

Formally:

```text
request authorization
      ↓
mention/watch eligibility
```

NEVER:

```text
mention/watch
      ↓
request authorization
```

No reverse relationship.

---

# 8. ACCESS LOSS RULE

If a user:

```text
was mentioned
or
is a watcher
```

and later loses request authorization:

they must NOT continue receiving usable internal request data.

This applies to:

```text
new notifications
notification list
notification detail
request navigation
Internal Notes
```

A stale watcher row or historical mention may remain for audit/history.

But it MUST NOT preserve access.

---

# 9. MENTION TARGET RULE

Mention target must be:

```text
active account
STAFF or MANAGER
currently authorized to access the request
```

at note-creation time.

Do NOT allow mention of arbitrary coworkers.

Do NOT create a global employee directory through M19.

---

# 10. EXISTING STAFF SCOPE CONSEQUENCE

Current STAFF authorization is:

```text
current assigned request only
```

Therefore:

if another STAFF user does not currently have access to the request:

```text
they are NOT a valid mention target
```

Do NOT widen STAFF scope just to make mentions more flexible.

A mention is not an invitation.

---

# 11. MANAGER TARGETS

MANAGER candidates must follow existing MANAGER request scope.

Do not implement:

```text
global manager bypass
super-admin mention
organization expansion
```

If current application has only A01 manager scope:

preserve it.

---

# 12. USER MUST NEVER PARTICIPATE

USER must NOT:

```text
see mention controls
be mention candidate
mention staff
watch request internally
see watcher state
see watcher notifications
see internal notification metadata
```

Existing requester notifications remain separate.

---

# 13. STRUCTURED MENTIONS — IMPORTANT

Do NOT make authorization depend on parsing arbitrary:

```text
@Display Name
```

from note body.

Mention identity must be structured.

Preferred request extension:

```json
{
  "body": "Đã kiểm tra gateway, nhờ anh Minh xác nhận cấu hình.",
  "mentionedUserIds": [
    "uuid..."
  ]
}
```

Exact naming may adapt to repository conventions.

The server trusts only validated user IDs.

---

# 14. BODY TEXT DOES NOT DEFINE MENTION IDENTITY

If note body contains:

```text
@Nguyen Van A
```

but that user was not explicitly selected in structured mention metadata:

it is plain text.

It must NOT generate a notification.

This prevents:

```text
ambiguous display-name matching
duplicate names
spoofed @mentions
authorization mistakes
```

---

# 15. MENTION UI

Preferred safe UI:

```text
Nhắc đến
[ searchable multi-select / combobox ]
```

Show authorized candidates only.

Selection may display:

```text
@Display Name
```

as chips/tokens.

Inline `@` autocomplete is optional.

Do not build a fragile free-text parser solely to simulate social-media mentions.

Structured identity is authoritative.

---

# 16. MENTION LIMIT

Bound mention fan-out.

Recommended:

```text
maximum 10 unique mentioned users per note
```

unless an existing project convention provides a smaller limit.

Server must:

```text
deduplicate IDs
validate all IDs
reject unauthorized IDs
```

Do not partially accept an invalid list.

---

# 17. SELF MENTION

Do not generate a notification to the author.

Preferred behavior:

```text
self may be rejected or removed deterministically
```

Choose one clear policy in implementation plan.

Recommended:

```text
reject self mention as invalid target
```

unless existing domain validation conventions favor silent normalization.

Document it.

---

# 18. MENTION ATOMICITY

Internal-note creation with mentions must be atomic.

Transaction:

```text
authorize actor
↓
lock/recheck request
↓
validate lifecycle
↓
validate all mention targets
↓
insert note
↓
insert mention records
↓
insert safe audit
↓
enqueue/create notifications
↓
COMMIT
```

Failure anywhere:

```text
ROLLBACK ALL
```

No orphan mention.

No note without requested mentions.

No notification without note.

---

# 19. M18 IMMUTABILITY MUST REMAIN

Once note is created:

```text
body immutable
mention set immutable
```

No:

```text
add mention later
remove mention later
edit mention
PATCH note
DELETE mention
```

Correction requires a new note.

---

# 20. MENTION PERSISTENCE

Preferred conceptual entity:

```text
RequestInternalNoteMention
```

Minimum:

```text
id or composite key
noteId
mentionedUserId
createdAt
```

Use repository conventions.

Unique constraint:

```text
(noteId, mentionedUserId)
```

No duplicate mention rows.

---

# 21. RELATIONS

Conceptually:

```text
RequestInternalNote
  1 → N RequestInternalNoteMention

User
  1 → N received mentions
```

Do not couple mention records directly to authorization.

They record historical collaboration only.

---

# 22. WATCHER CONCEPT

Preferred conceptual entity:

```text
RequestWatcher
```

A watcher means:

```text
the user asked to be notified about allowed future
internal/request operational activity
```

It does NOT mean:

```text
request ownership
assignment
authorization
workflow participant
```

---

# 23. WATCH ELIGIBILITY

Only:

```text
STAFF
MANAGER
```

who currently have request access may watch.

USER cannot watch.

---

# 24. WATCH IS MANUAL

Do NOT automatically watch someone because they are:

```text
assigned
manager
mentioned
note author
```

M19 watch subscription is explicit.

Mentioning someone also does NOT automatically watch them.

Keep semantics predictable.

---

# 25. WATCH / UNWATCH

Preferred idempotent API semantics:

```http
GET    /api/v1/requests/:id/watch
PUT    /api/v1/requests/:id/watch
DELETE /api/v1/requests/:id/watch
```

Adapt route names only if repository conventions strongly prefer another form.

GET:

```json
{
  "watching": true
}
```

PUT:

```text
start watching
```

DELETE:

```text
stop watching
```

PUT should be idempotent.

DELETE should also behave safely/idempotently according to repository convention.

---

# 26. WATCHER LIST

M19 does NOT require a public/internal list of all watchers.

Prefer NOT exposing:

```text
GET all watchers
watcher count
watcher identities
```

unless current UX genuinely requires it.

Primary UI only needs:

```text
my watch state
```

This reduces privacy and scope complexity.

---

# 27. WATCHER PERSISTENCE

Choose the simplest auditable representation after repository audit.

Preferred:

```text
RequestWatcher
requestId
userId
createdAt
```

unique:

```text
(requestId, userId)
```

Unwatch may delete the active subscription if immutable audit records:

```text
REQUEST_WATCH_STARTED
REQUEST_WATCH_STOPPED
```

already preserve history.

Alternative mutable status is acceptable only if it better matches existing architecture.

Document the choice.

---

# 28. WATCH ACCESS LOSS

If STAFF was watching then request is reassigned:

watcher row MAY remain.

But notification fan-out must filter them out because:

```text
current authorization no longer passes
```

Do not use stale subscription as access.

---

# 29. WATCH TERMINAL POLICY

Watch/unwatch is not a protected Request workflow mutation.

Preferred:

```text
authorized STAFF/MANAGER may inspect/change own watch state
for any request they can currently read
```

including terminal readable requests.

Do not change request state/version.

---

# 30. MENTION CANDIDATE API

A safe candidate endpoint will likely be useful.

Preferred concept:

```http
GET /api/v1/requests/:id/mention-candidates?q=<search>
```

Requirements:

```text
STAFF/MANAGER only
request scope first
active authorized collaborators only
bounded results
safe fields only
```

Return only:

```text
id
displayName
role if useful to distinguish users
```

Do NOT return:

```text
email unless current UI absolutely requires it
session metadata
account internals
phone
authorization details
```

---

# 31. CANDIDATE SEARCH

Bound query:

```text
q optional
limit <= 20
```

Search safely using repository conventions.

Stable ordering.

Do not create an unbounded user directory.

---

# 32. CANDIDATE AUTHORIZATION

Important:

candidate membership must be computed from:

```text
current request
+
current authorization rules
```

not merely:

```text
role IN (STAFF, MANAGER)
```

If user cannot currently access request:

they are not a candidate.

---

# 33. M18 CREATE CONTRACT EXTENSION

Extend note create additively.

Existing valid M18 request:

```json
{
  "body": "..."
}
```

must remain valid.

M19 optional extension:

```json
{
  "body": "...",
  "mentionedUserIds": []
}
```

No breaking change for M18 clients/tests.

---

# 34. NOTE RESPONSE

Authorized Internal Note responses may now include safe mention metadata.

Conceptually:

```json
{
  "id": "...",
  "requestId": "...",
  "body": "...",
  "createdAt": "...",
  "author": {
    "id": "...",
    "displayName": "..."
  },
  "mentions": [
    {
      "userId": "...",
      "displayName": "..."
    }
  ]
}
```

Do not expose email/session data.

---

# 35. NOTIFICATION INFRASTRUCTURE AUDIT

Before implementation, audit existing:

```text
Notification
notification service
outbox
polling
read/unread behavior
notification API
notification UI
idempotency
audit
```

Reuse existing architecture.

Do NOT build a second notification framework.

---

# 36. MENTION NOTIFICATION

Mention creates an internal notification for each valid target except author.

Notification semantics:

```text
"Bạn được nhắc đến trong một ghi chú nội bộ."
```

Do NOT include note body in notification payload.

Do NOT store rendered body excerpt just for notification.

---

# 37. WATCHER NOTIFICATION

Watchers receive notifications for a bounded allowlist of meaningful request activity.

Audit existing events first.

At minimum target events should include where naturally supported:

```text
INTERNAL_NOTE_CREATED
request status transition
assignment / reassignment
manager approval decision
resolution / reopen / close
```

If current architecture uses different canonical event names:

use those.

---

# 38. DO NOT WATCH EVERY EVENT

Do NOT notify watchers for:

```text
request read
dashboard load
analytics query
AI background retry
embedding job
Recommendation generation
health check
SLA clock tick every second/minute
audit inspection
```

Only meaningful persisted operational changes.

---

# 39. EXACT WATCH EVENT ALLOWLIST

The implementation plan MUST explicitly document:

```text
which existing persisted events trigger watcher notification
```

No vague:

```text
"all updates"
```

The allowlist must be deterministic and testable.

---

# 40. MENTION + WATCH DEDUPLICATION

A recipient may be:

```text
explicitly mentioned
AND
watching the request
```

for the same Internal Note event.

They must receive:

```text
ONE notification
```

not two.

Preferred precedence:

```text
MENTION > WATCH
```

because mention is more specific.

---

# 41. SELF-NOTIFICATION

Actor should not receive watcher notification for their own action.

Example:

```text
STAFF writes note
STAFF is watcher
```

Result:

```text
no self notification
```

---

# 42. RETRY / IDEMPOTENCY

Notification retry must not duplicate user-visible notifications.

Reuse existing outbox/idempotency infrastructure.

If existing system lacks a suitable dedup key:

design deterministic key based on:

```text
recipient
source event
request
reason
```

Do not rely only on application timing.

---

# 43. NOTIFICATION PAYLOAD PRIVACY

Persist only safe metadata needed for navigation/delivery.

Preferred conceptual payload:

```text
requestId
noteId if mention/note event
notification type
reason
source event ID
```

Do NOT store:

```text
note body
AI prompt
private request dump
raw audit JSON
```

---

# 44. DELIVERY-TIME AUTHORIZATION

Critical requirement:

> Current request authorization must be rechecked before exposing a request-linked internal notification.

A user losing access must not continue receiving request metadata simply because a notification row exists.

Apply to:

```text
notification list
notification detail
unread counts if relevant
navigation
```

---

# 45. STALE INTERNAL NOTIFICATIONS

If current authorization fails:

preferred safe behavior:

```text
hide internal request notification
```

or repository-equivalent safe redaction.

Do not expose:

```text
request title
note author
note body
internal activity
```

to the former collaborator.

Document chosen behavior.

---

# 46. UNREAD COUNT

If existing notification unread count is calculated server-side:

unauthorized stale internal notifications must not inflate a visible count if that itself leaks activity.

Recheck access before count where architecture allows.

Test it.

---

# 47. USER NOTIFICATION BOUNDARY

USER must never receive:

```text
internal note mention notification
watcher notification
watcher count
internal note activity
```

Existing customer-facing notifications remain unchanged.

---

# 48. NOTIFICATION CLICK

Authorized notification navigation may go to:

```text
request detail
```

and optionally internal-notes section.

But request page authorization remains authoritative.

Never bypass it via notification ID.

---

# 49. AUDIT EVENTS

Prefer safe immutable audit for:

```text
REQUEST_WATCH_STARTED
REQUEST_WATCH_STOPPED
```

and mention creation only if existing Internal Note audit can safely reference mention metadata.

Do NOT put note body in audit.

Do NOT create requester-visible Request history activity from internal collaboration events.

---

# 50. MENTION AUDIT

M18 already creates:

```text
INTERNAL_NOTE_CREATED
```

Keep its privacy design.

If mention metadata is added to audit:

only safe IDs/counts if actually necessary.

Preferred:

```text
do not widen generic audit unless required
```

Mention rows themselves are authoritative historical records.

---

# 51. DATABASE MIGRATION

Repository at M18 checkpoint:

```text
8 migrations
```

M19 will likely require migration:

```text
9
```

Recommended name:

```text
20261002020000_m19_mentions_watchers
```

Adapt timestamp only to repository convention.

Expected:

```text
8 → 9
```

---

# 52. MIGRATION 9 CONTENT

Likely entities:

```text
RequestInternalNoteMention
RequestWatcher
```

Potential notification schema change ONLY if existing Notification persistence genuinely requires it.

Do not create unnecessary tables.

---

# 53. MIGRATION RULE

Never modify:

```text
migrations 1–8
```

Migration 9 only.

No migration 10 during M19 unless a genuine design necessity is discovered and documented.

Prefer one coherent migration.

---

# 54. DATABASE CONSTRAINTS — MENTIONS

At minimum:

```text
FK noteId
FK mentionedUserId
createdAt
unique(noteId, mentionedUserId)
appropriate indexes
```

Use RESTRICT/ownership conventions consistent with existing schema.

---

# 55. DATABASE CONSTRAINTS — WATCHERS

At minimum:

```text
FK requestId
FK userId
unique(requestId, userId)
createdAt
```

If mutable subscription state is used:

document why.

Do not add role field to watcher row.

Role is current account state.

---

# 56. DB AUTHORIZATION MODEL

Do not infer authorization from mention/watcher table.

These tables are collaboration metadata only.

Every sensitive read/action still uses:

```text
AuthorizationPolicyService
```

or existing centralized owner.

---

# 57. DEVELOPER DB

Current developer stack still has:

```text
7 migrations
```

because M18 migration 8 was intentionally not applied.

M19 implementation MUST NOT silently migrate developer DB.

Use isolated verification targets.

---

# 58. MIGRATION TEST MATRIX

Test isolated:

```text
fresh:
1 → 9

M18 checkpoint DB:
1 → 8 then 9

V1.2-style DB:
1 → 7 then 8 then 9
```

Verify:

```text
existing V1.2 data preserved
M18 notes preserved
historical migration hashes unchanged
```

Do not deploy migration 8/9 to normal developer DB.

---

# 59. SEED

Do not add fake watcher/mention clutter to normal demo seed unless clearly useful.

Prefer integration fixtures.

Seed must remain idempotent.

---

# 60. API — MENTION CANDIDATES

Recommended:

```http
GET /api/v1/requests/:id/mention-candidates
```

Query:

```text
q?
limit?
```

Strict schema.

No arbitrary role/scope override.

---

# 61. API — INTERNAL NOTES

Existing:

```http
GET /api/v1/requests/:id/internal-notes
POST /api/v1/requests/:id/internal-notes
```

Extend POST additively for structured mentions.

GET may return mention metadata.

No PATCH/DELETE.

---

# 62. API — WATCH STATE

Recommended:

```http
GET    /api/v1/requests/:id/watch
PUT    /api/v1/requests/:id/watch
DELETE /api/v1/requests/:id/watch
```

Use actual route convention if current repository prefers another naming style.

Keep business logic centralized.

---

# 63. WATCH OPERATION VERSIONING

Watch/unwatch must NOT change:

```text
Request.version
Request.status
assignment
SLA
approval
resolution
checklist
```

No expectedVersion needed because watcher subscription is a separate child resource.

---

# 64. NOTE MENTION CREATION VERSIONING

Creating note + mentions remains a child-resource operation.

Do NOT increment Request.version.

Do not modify workflow state.

---

# 65. STRICT DTO VALIDATION

Mention note creation:

```text
body
mentionedUserIds?
```

Reject unknown:

```text
authorId
role
requestId override
createdAt
visibility
notificationRecipients
watchers
```

Server derives everything.

---

# 66. MENTION ID VALIDATION

Validate:

```text
valid UUID
unique
count <= configured limit
active user
allowed role
current request access
```

One invalid target:

```text
whole request fails
```

No partial fan-out.

---

# 67. SAFE ERROR CONTRACT

Do not leak whether an arbitrary inaccessible user/request exists.

Follow current:

```text
401
403
404
400
409
```

semantics.

Use safe domain errors.

No SQL/Prisma stack in client response.

---

# 68. UI — INTERNAL NOTE COMPOSER

Extend existing M18 composer.

Add:

```text
Nhắc đến
```

selector.

Keep:

```text
Ghi chú nội bộ
```

UI simple.

No social-network complexity.

---

# 69. MENTION SELECTOR

Requirements:

```text
searchable
keyboard accessible
bounded results
loading
empty
error
selected chips
remove before submit
```

Only authorized candidates returned from server.

---

# 70. MANUAL @ TEXT

If user manually types:

```text
@someone
```

without selecting a structured candidate:

do not silently treat it as a mention.

Optional helper text may explain:

```text
Chọn người dùng trong mục "Nhắc đến" để gửi thông báo.
```

Keep copy concise.

---

# 71. NOTE DISPLAY

Mentioned collaborators may be shown as safe chips:

```text
Đã nhắc:
Nguyễn A
Trần B
```

Do not turn note body into HTML.

Do not create raw anchor markup from body.

---

# 72. WATCH UI

On authorized STAFF/MANAGER request detail:

show a compact action:

```text
Theo dõi
```

When active:

```text
Đang theo dõi
```

Allow:

```text
Bỏ theo dõi
```

Do not show to USER.

---

# 73. WATCH UI STATE

Need:

```text
loading
watched
not watched
mutation pending
safe error/retry
```

Prevent duplicate toggle requests.

Do not make request page unusable if watcher API fails.

---

# 74. NOTIFICATION UI

Reuse existing notification center.

Add safe types/copy for:

```text
mention
watched request activity
```

No new separate inbox.

---

# 75. NOTIFICATION COPY

Examples:

Mention:

```text
Bạn được nhắc đến trong một ghi chú nội bộ.
```

Watcher:

```text
Yêu cầu bạn đang theo dõi có cập nhật mới.
```

Avoid note excerpts.

---

# 76. ACCESSIBLE UI

Mention combobox:

```text
visible label
keyboard selection
Escape
Arrow keys if custom listbox
proper aria semantics
```

Watch button:

```text
accessible name
visible state
focus
>= 44px target where current design expects
```

Notification:

```text
type not indicated by color alone
```

---

# 77. XSS

Existing Internal Note plain-text rendering remains mandatory.

Mention display names must also render as text.

Test malicious/synthetic display name where fixture allows:

```html
<img src=x onerror=alert(1)>
```

No execution.

---

# 78. MENTION USERNAME COLLISION

Test two users with identical or similar display names.

Structured IDs must keep identity correct.

Do not rely on display name uniqueness.

---

# 79. REQUEST REASSIGNMENT RACE

Critical scenario:

```text
STAFF A opens request
↓
request reassigned to STAFF B
↓
STAFF A tries to create note mentioning manager
```

Authorization must be checked transactionally.

Result:

```text
STAFF A denied
no note
no mention
no notification
```

---

# 80. MENTION TARGET ACCESS RACE

Scenario:

```text
candidate user valid when UI loads
↓
scope/account changes before submit
↓
note POST
```

Server must revalidate target at submit.

No stale-client trust.

---

# 81. WATCH LOSS-OF-ACCESS TEST

Scenario:

```text
STAFF A watches request
↓
request reassigned to STAFF B
↓
new internal note/workflow event
```

Expected:

```text
STAFF A receives no usable internal notification
```

Watcher row may remain historically.

---

# 82. MENTION LOSS-OF-ACCESS TEST

Scenario:

```text
STAFF A mentioned while authorized
↓
notification stored
↓
request reassigned before A reads notification
```

Notification list/read must not expose internal request metadata to A afterward.

Test explicitly.

---

# 83. DEDUP TEST

Scenario:

```text
MANAGER is watcher
AND
explicitly mentioned in a note
```

Expected:

```text
exactly one notification
reason = mention
```

No duplicates after retry.

---

# 84. RETRY TEST

Repeat notification/outbox handling for same source event.

Expected:

```text
one notification row/user-visible event
```

Use existing idempotency conventions.

---

# 85. WATCHER EVENT TESTS

For every allowed watcher event:

verify:

```text
watcher receives one
non-watcher receives zero
actor receives zero
unauthorized stale watcher receives zero
USER receives zero
```

---

# 86. EVENT ALLOWLIST DOCUMENTATION

M19 implementation plan must include a table:

```text
Event
Watcher notification?
Why?
```

Example categories:

```text
Internal note created      YES
Assignment changed         YES
Status changed             YES
Approval decision          YES
Resolved/Reopened/Closed   YES

Request read               NO
Analytics read             NO
AI generation              NO
Embedding/indexing         NO
Health checks              NO
```

Use actual events found in repository.

---

# 87. USER LEAKAGE

After M19 activity, USER endpoints must contain none of:

```text
mention IDs
watcher IDs
watcher count
internal notification
internal note body
internal note activity
```

Test:

```text
detail
history
dashboard
notifications
explanation
```

where applicable.

---

# 88. AI ISOLATION

Internal notes/mentions/watchers still must NOT enter:

```text
intake
RAG
request embeddings
Recommendation V2
Copilot
AI evaluation
```

No live AI model needed.

Use deterministic context-builder tests.

---

# 89. ANALYTICS

Do not add M19 metrics.

No:

```text
mentions count
watchers count
notification engagement
collaboration score
```

M13 analytics remains unchanged.

---

# 90. SLA

Do not touch SLA calculations.

Watcher notifications must not become SLA escalation.

M22 owns SLA escalation.

---

# 91. TEMPLATES / ROUTING

Do not implement:

```text
M20 templates
M21 routing
```

No placeholders in product code.

---

# 92. PERFORMANCE

Measure bounded local behavior.

Example fixture:

```text
50 notes
multiple mentions
10 watchers
```

Record:

```text
SQL statement behavior
fan-out query behavior
notification count
API latency samples
```

No enterprise claims.

---

# 93. N+1

Avoid:

```text
one user query per mention
one query per watcher
one notification existence check per recipient
```

Use batched queries.

Verify with instrumentation if current M18 harness supports it.

---

# 94. TRANSACTIONAL NOTIFICATIONS

Where existing architecture uses outbox:

notification enqueue should happen in the owning transaction.

Do not send/commit external effects before DB commit.

If polling notification records are used:

follow current model.

---

# 95. CACHE

Mention candidates, watcher state and internal notifications are authenticated/private.

Use:

```text
no-store
```

consistent with current application.

Do not put them into public service-worker cache.

---

# 96. LOGGING

Do not log:

```text
note body
notification payload body excerpts
raw candidate query result
JWT
cookies
```

Safe operational logs may use:

```text
requestId
noteId
recipient count
event type
```

---

# 97. DATABASE PRIVILEGES

M19 migration should preserve least privilege.

Conceptually:

Mention table:

```text
SELECT / INSERT
```

No product update/delete if immutable.

Watcher table:

```text
SELECT / INSERT / DELETE
```

if delete-based unwatch is chosen.

Follow existing runtime DB-role conventions.

---

# 98. OPENAPI

Document all new/changed endpoints.

Verify:

```text
unique operationId
bearer auth
strict query/body schemas
responses
errors
references
```

No broken `$ref`.

---

# 99. SHARED CONTRACTS

Create/reuse shared strict Zod contracts for:

```text
mention candidate
mention metadata
extended create Internal Note input
watch state
notification types if shared
```

Avoid duplicate frontend types.

---

# 100. IMPLEMENTATION PLAN

Before product edits create:

```text
docs/v1.3/M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md
```

It must define:

```text
baseline/checkpoint
architecture audit
data model
migration
mention identity
candidate authorization
watch semantics
event allowlist
notification dedup
delivery-time authorization
privacy
API
UI
tests
non-goals
acceptance
```

Then continue implementation.

Do NOT stop after writing plan.

---

# 101. UPDATE V1.3 STATUS

Update:

```text
docs/v1.3/README.md
```

During final result:

```text
M18 — PASS / CHECKPOINT CLOSED
M19 — PASS / READY FOR HUMAN REVIEW
M20 — NOT STARTED
...
M24 — NOT STARTED
```

Do not mark V1.3 released.

---

# 102. VERIFICATION DOCS

Create:

```text
docs/v1.3/M19_MENTIONS_WATCHERS_VERIFICATION.md
docs/verification/MILESTONE_19_VERIFICATION.md
```

Update owning specs as needed:

```text
PROJECT_SPEC
API_SPEC
AUTHORIZATION_SPEC
DATABASE_SPEC
NOTIFICATION spec if one exists
IMPLEMENTATION_PLAN status
```

Do not rewrite historical evidence.

---

# 103. UNIT TESTS

Target:

```text
mention input validation
mention max count
duplicate IDs
self mention policy
candidate filtering
watch idempotency
dedup recipient calculation
event allowlist
delivery authorization
safe notification payload
```

---

# 104. DATABASE INTEGRATION

Real PostgreSQL tests:

```text
migration 9
fresh 1→9
8→9
7→8→9

mention FK
mention unique constraint
watcher unique constraint
runtime privileges
data preservation
```

---

# 105. API INTEGRATION

Test:

```text
authorized STAFF candidate search
authorized MANAGER candidate search
USER denied

note without mentions
note with mention
multiple mentions
invalid mention target
foreign target
inactive target
duplicate target
self target

watch
watch again
unwatch
unwatch again
watch state
foreign request
USER denied
```

---

# 106. SECURITY TESTS

Mandatory:

```text
IDOR
stale assignment
loss of access after watch
loss of access after mention
notification filtering
no USER leakage
strict DTO
XSS
safe errors
no note-body notification leakage
```

---

# 107. E2E

Create targeted M19 browser suite.

Suggested flow:

```text
MANAGER login
→ open authorized request
→ enable watch
→ create Internal Note mentioning authorized STAFF
→ verify note + mention metadata

STAFF login
→ receives one mention notification
→ opens request
→ enables watch

MANAGER creates another note without mention
→ STAFF gets watcher notification

request scope changes
→ former STAFF does not receive/expose later internal notifications

USER login
→ no Internal Notes
→ no Watch control
→ no internal notifications
```

Use actual repository fixtures/scopes.

---

# 108. E2E DEDUP

Include:

```text
mentioned user already watching
```

Assert:

```text
one notification
```

not two.

---

# 109. RESPONSIVE

Check changed surfaces at:

```text
360
768
1440
1920
```

At minimum:

```text
STAFF request detail
MANAGER request detail
notification UI
```

Verify mention selector and watch button do not overflow.

---

# 110. ACCESSIBILITY

Run Axe on representative changed pages.

Target:

```text
0 serious
0 critical
```

Check:

```text
combobox/listbox semantics
keyboard interaction
focus
selected mention chips
watch toggle
notification item labels
```

Do not claim full WCAG certification.

---

# 111. BASELINE GATES

Required:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Then targeted M19 suites.

Use actual package scripts.

---

# 112. HISTORICAL TEST POLICY

Do NOT replay:

```text
M0–M18
```

full milestone suites.

M19 should run only:

```text
current baseline gates
M19 database
M19 integration
M19 security
M19 E2E
directly affected existing regression
```

---

# 113. TARGETED REGRESSION

If M19 changes:

AuthorizationPolicyService:

```text
run targeted authorization regression
```

Notification subsystem:

```text
run existing notification unit/integration regression
```

Internal Note service:

```text
run M18 targeted Internal Note regression
```

Do NOT replay full M18 browser/database suite unless necessary.

---

# 114. AI POLICY

Ollama availability is irrelevant to M19.

If:

```text
ECONNREFUSED
```

report truthfully.

Do not:

```text
start/download model
rerun M15
generate live AI output
```

No AI dependency for PASS.

---

# 115. DEVELOPER STACK

Do not migrate normal developer DB.

It may remain:

```text
7 migrations
```

during M19 development.

Use isolated DB targets for:

```text
1→9
7→8→9
8→9
```

Do not reset normal developer data.

---

# 116. NO NEW DEPENDENCY UNLESS NECESSARY

Prefer current UI primitives.

Do not add:

```text
new notification framework
WebSocket package
mention parser library
state management framework
```

without concrete necessity.

---

# 117. NO REAL-TIME

M19 remains polling/fetch based according to existing notification architecture.

Do NOT introduce:

```text
WebSocket
SSE
presence
typing indicators
live cursor
```

---

# 118. M19 NON-GOALS

Absolutely do NOT implement:

```text
templates
saved reply templates
checklist templates
rule routing
auto assignment
SLA escalation
reminders
saved views
AI mention suggestions
AI note summarization
email delivery
SMS
push notifications
reactions
threads
attachments
rich text
```

---

# 119. M20 BOUNDARY

M20:

```text
Response & Checklist Templates
```

must remain:

```text
NOT STARTED
```

No placeholder implementation.

---

# 120. GIT POLICY

At final M19 handoff:

```text
Committed: NO
Pushed: NO
Tagged: NO
Merged: NO
Deployment: NOT RUN
```

Leave working tree reviewable.

---

# 121. CREATE M19 BRANCH

Start from exact M18 checkpoint:

```text
1f54dce3c8427976763b19ef33f181b4ef9a3337
```

Verify branch remote first.

Then:

```powershell
git checkout feat/v1.3-internal-notes
git pull --ff-only
git rev-parse HEAD
git checkout -b feat/v1.3-mentions-watchers
```

Expected starting SHA:

```text
1f54dce3c8427976763b19ef33f181b4ef9a3337
```

---

# 122. GIT SAFETY

Never:

```text
git reset --hard
git clean -fd
git clean -xdf
force push
rewrite history
modify v1.2.0
```

---

# 123. M19 ACCEPTANCE — MENTIONS

PASS requires:

```text
[ ] structured mention identity
[ ] no free-text authorization
[ ] active STAFF/MANAGER only
[ ] target must already have request access
[ ] bounded mention count
[ ] duplicates prevented
[ ] atomic note+mentions
[ ] immutable mention set
[ ] one safe notification per target
[ ] note body absent from notification
```

---

# 124. M19 ACCEPTANCE — WATCHERS

```text
[ ] authorized STAFF/MANAGER can watch
[ ] USER cannot watch
[ ] watch does not grant access
[ ] watch/unwatch deterministic
[ ] no Request version mutation
[ ] meaningful event allowlist documented
[ ] self notifications suppressed
[ ] access-loss stops useful delivery
[ ] retries deduplicated
```

---

# 125. M19 ACCEPTANCE — PRIVACY

```text
[ ] USER sees no mention metadata
[ ] USER sees no watcher metadata
[ ] USER gets no internal notification
[ ] former collaborator gets no stale private data
[ ] no note body in notification storage
[ ] no note body in audit
[ ] no AI/RAG/Copilot context expansion
[ ] analytics unchanged
```

---

# 126. M19 ACCEPTANCE — DATABASE

```text
[ ] migration 9
[ ] migrations 1–8 unchanged
[ ] fresh 1→9 PASS
[ ] 8→9 PASS
[ ] 7→8→9 PASS
[ ] existing data preserved
[ ] M18 notes preserved
[ ] DB runtime grants least privilege
```

---

# 127. M19 ACCEPTANCE — UI

```text
[ ] mention candidate selector
[ ] selected mentions clear
[ ] watch control
[ ] notification copy safe
[ ] loading/empty/error
[ ] no duplicate-submit
[ ] responsive
[ ] keyboard
[ ] Axe zero serious/critical
```

---

# 128. M19 ACCEPTANCE — REGRESSION

```text
[ ] M18 notes remain append-only
[ ] M18 USER isolation preserved
[ ] request state machine unchanged
[ ] expectedVersion unchanged
[ ] SLA unchanged
[ ] analytics unchanged
[ ] Recommendation V2 unchanged
[ ] Copilot six actions unchanged
```

---

# 129. FINAL REPORT FORMAT

Return exactly:

```text
MOBIFLOW AI V1.3 — M19 MENTIONS + WATCHERS FINAL REPORT

BASELINE
Previous checkpoint:
Checkpoint SHA:
Starting branch:
M19 branch:
Working tree start:

V1.3 AUTHORITY
Master plan:
M18:
M19:
M20:
M21:
M22:
M23:
M24:

M19 ARCHITECTURE
Status:
Mention model:
Watcher model:
Notification integration:
Mention identity:
Watcher semantics:
Event allowlist:
Deduplication:
Access-loss behavior:

DATABASE
Schema changed:
Migration added:
Migration name:
Migration count before:
Migration count after:
Fresh 1→9:
V1.2 7→8→9:
M18 8→9:
Data preservation:
M18 note preservation:
Runtime privileges:

API
Mention candidates:
Internal Note create extension:
Watch state:
Watch:
Unwatch:
Notification changes:
OpenAPI:
Breaking changes:

AUTHORIZATION
USER mention:
USER watch:
STAFF mention:
STAFF watch:
MANAGER mention:
MANAGER watch:
Target authorization:
Foreign resource:
IDOR:

MENTION RULES
Structured identity:
Maximum mentions:
Duplicate IDs:
Self mention:
Invalid target:
Atomicity:
Immutability:

WATCHER RULES
Manual subscription:
Auto-watch:
Request version impact:
Terminal requests:
Loss of access:
Self notification:

NOTIFICATIONS
Mention notification:
Watcher notification:
Note body stored:
Dedup:
Retry/idempotency:
Delivery-time authorization:
Unread count protection:
Stale notification behavior:

PRIVACY / ISOLATION
USER leakage:
Internal note leakage:
History leakage:
Analytics leakage:
RAG leakage:
Recommendation leakage:
Copilot leakage:
Cache leakage:

UI
STAFF:
MANAGER:
USER:
Mention selector:
Watch control:
Notifications:
Loading:
Empty:
Error:
XSS:

RESPONSIVE
360:
768:
1440:
1920:

ACCESSIBILITY
Axe:
Keyboard:
Focus:
Combobox:
Watch control:

PERFORMANCE
Fixture:
SQL behavior:
N+1:
Notification fan-out:
API samples:

TESTS
Lint:
Typecheck:
Unit:
Build:
M19 database:
M19 integration:
M19 security:
M19 E2E:
M18 targeted regression:
Notification regression:
Authorization regression:

Historical M0–M18 replay:
NOT RUN — intentionally outside M19 scope.

AI RUNTIME
Ollama:
Impact on M19:

DOCUMENTATION
M19 implementation plan:
M19 verification:
Milestone record:
Specs updated:

KNOWN LIMITATIONS
-

GIT
Files changed:
Committed: NO
Pushed: NO
Tagged: NO
Merged: NO
Deployment: NOT RUN

NEXT
M20:
Status: NOT STARTED

FINAL GATE
M19:
V1.3:
```

---

# 130. EXPECTED SUCCESS STATE

```text
v1.2.0 ✅ RELEASED
        │
        └─ M18 checkpoint
           1f54dce...
                │
                └─ feat/v1.3-mentions-watchers
                       │
                       └─ M19 PASS
                          READY FOR HUMAN REVIEW
```

V1.3:

```text
M18 ✅ CHECKPOINT CLOSED
M19 ✅ READY FOR HUMAN REVIEW
M20 ⏳ NOT STARTED
M21 ⏳ NOT STARTED
M22 ⏳ NOT STARTED
M23 ⏳ NOT STARTED
M24 ⏳ NOT STARTED
```

Expected repository migrations:

```text
8 → 9
```

Developer stack:

```text
still 7
```

unless separately authorized later.

---

# 131. FINAL INSTRUCTION

Start exactly from M18 checkpoint:

```text
1f54dce3c8427976763b19ef33f181b4ef9a3337
```

Create:

```text
feat/v1.3-mentions-watchers
```

First audit the existing Notification/outbox/authorization architecture.

Then write:

```text
docs/v1.3/M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md
```

Then implement M19 completely.

Critical invariants:

```text
mention != authorization
watcher != authorization

mention target must already have access

loss of access disables future/private notification visibility

notification contains no Internal Note body

mention + watch same event = one notification

USER remains completely outside internal collaboration

AI/RAG/Analytics remain isolated
```

Do not migrate developer DB.

Do not replay M0–M18.

Do not start Ollama merely for M19.

Do not implement M20.

Do not commit/push/tag/merge.

Stop only at:

```text
M19 PASS
READY FOR HUMAN REVIEW
M20 NOT STARTED
```

or:

```text
M19 BLOCKED
```

with the exact unresolved blocker.