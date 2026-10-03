# Authorization Specification

Authority: master-plan §§2.1, 2.3, 9, M2 and M8. This owns RBAC, ownership and identity rules. Assumptions A01/A09/A10 in [PROJECT_SPEC](PROJECT_SPEC.md). No frontend control or model output grants permission.

## Business roles

| Role | Scope |
|---|---|
| USER | Requests with createdById equal to authenticated user ID. |
| STAFF | Requests with currentAssigneeId equal to authenticated staff ID, including read-only terminal history. |
| MANAGER | All requests within the single V1 synthetic organization. |

All accounts must be active. Roles are not cumulative: MANAGER does not impersonate USER to close a request or STAFF to resolve. No fourth role, self-registration, account deletion or role-changing endpoint. `/users` supports the caller profile and bounded manager staff-directory projection only.

## Capability matrix

| Capability | USER | STAFF | MANAGER |
|---|---|---|---|
| Template list/detail (M20) | No | ACTIVE current RESPONSE only, including direct IDs | Both types, ACTIVE and historical ARCHIVED within A01 |
| Create/revise/archive/template history (M20) | No | No | Yes; expectedRevision and live session/account required |
| Response template source in existing messages/request-info (M20) | No provenance input/library | Current assigned request; existing action/state/version predicates | Existing message scope; no staff-only request-info authority |
| Checklist template source in manager manual draft (M20) | No | No | NEW/TRIAGED draft only; separate existing submit/approval required |
| Create request | Yes, own identity only | No | No |
| Read request/list/timeline/messages | Own, requester projection | Current assigned only | All V1 |
| Post plain message | Own nonterminal | Assigned nonterminal | Nonterminal V1 |
| Internal notes read / append (M18) | No, including owned requests; no content/count/activity | Current assigned only; append through RESOLVED, CLOSED/CANCELED read-only | Existing A01 organization scope; same lifecycle policy |
| Mention candidates / note mentions (M19) | No | Current assigned request; active authorized operational targets excluding self | A01 request scope; same target policy |
| Own watch state/start/stop (M19) | No | Current assigned readable request, including terminal | A01 readable requests, including terminal; no other-watcher list/count |
| Trigger intake/retry | Own NEW only | No | Any NEW |
| Manual triage/submit/recommendation generation | No | No | NEW/TRIAGED as state rules allow |
| Read pending approval/staff workload/AI tool trace | No | No | Yes |
| Accept/modify/reject approval | No | No | PENDING_APPROVAL only |
| Assign/reassign/change priority | No | No | Through approved commands only |
| Start work/request information/resolve | No | Current assigned, eligible states | No |
| Provide-info/confirm/reopen | Owning USER, eligible states | No | No |
| Checklist edit/tick/waive/save draft | No | Current assigned IN_PROGRESS | Only as part of initial approval plan |
| Copilot actions | No | Current assigned ASSIGNED/IN_PROGRESS/WAITING_USER/RESOLVED | No (uses manager review tools) |
| Retry failed resolution summary | No | Current assigned RESOLVED/CLOSED, latest effective resolution | RESOLVED/CLOSED, latest effective resolution |
| Knowledge upload/reindex/disable | No | No | Yes |
| Knowledge content/source fetch | No internal SOP access | READY documents, under source rules | READY documents and own organization metadata; disabled historical content for audit only |
| Similar-request detail | No peer records | Only currently assigned records | All V1 authorized results |
| Operational SLA | Own simplified progress | Assigned | All V1 |
| Audit/analytics/evaluation reports | No | Request-safe timeline only | Yes |
| Notifications/read-state | Own legacy business notifications; no M19/M22 internal types | Own recipient; internal types also require current assignment | Own recipient; internal types also require current A01 scope |
| Feedback | Own CLOSED, once | No | No |
| Cancel | Own four preassignment states | No | Seven states in state matrix |

Every state-qualified permission also requires a matching current version and payload invariants. See [REQUEST_STATE_MACHINE](REQUEST_STATE_MACHINE.md) for exact state sets.

## Enforcement and response projections

M23 amendment (2026-10-04): USER/STAFF/MANAGER CRUD only ownerUserId=current live actor, with ownership predicates on every operation, foreign/unknown404 and no manager override. Reads lock/recheck User and RefreshSession; writes first acquire that owner's User lock, then recheck identity/session. Saved filters never alter RequestScope; normal Request APIs independently validate current role/reference/type and AND filters after scope. [REQUEST_FILTER_SPEC](REQUEST_FILTER_SPEC.md) includes the manager-only assignee restriction. Stored role is neither persisted nor trusted. Unavailable views omit filter metadata after role/reference changes; complete replacement and guarded deletion remain possible. Private preferences never enter requester Request history, analytics or AI context. Resource-only audits use the real human role, safe IDs/version and no Request FK. No Request/version/status/assignment/SLA/notification mutation.

M22 amendment (2026-10-03): operational reminder delivery uses the current active assigned STAFF; escalation also includes active authorized MANAGER accounts through the existing A01 organization scope. USER, obsolete STAFF, inactive accounts and watchers without current access receive no delivery. The SYSTEM audit actor has no login role. Lock Request then SLA and re-read lifecycle/assignment; lock candidate User IDs in stable order then recheck `internalCollaborators` before bulk delivery. A historical delivery/watch/mention confers no access. The shared internal notification set includes M19 mention/watch and SLA_REMINDER/SLA_AT_RISK/SLA_BREACHED (including old rows): list/unreadOnly filters current role/scope before pagination; read/unread locks the parent and uses the same predicate. Reassignment removes old STAFF access immediately, unknown/stale/foreign IDs return404, USER has no internal payload/count/history. Resource-only alert audit has null request FK and no private body; no AI/analytics/requester-context inclusion or public alert/trigger surface. Human protected commands retain live guards and expectedVersion. [SLA_SPEC](SLA_SPEC.md) owns reconciliation/dedup/lifecycle.

M21 amendment (2026-10-02): only MANAGER can list/read/manage rules, read immutable history/targets or evaluate request routing. USER and STAFF receive403 on every routing surface, including guessed rule/revision/request IDs. Management uses existing single-organization A01 authority; evaluation combines the Request ID with `requestScope(actor)` before facts are projected, then checks read authorization. No invented tenant boundary, enlarged STAFF scope or role inherited from membership/watch/mention. Live account/role/session is rechecked under the existing identity lock in every service transaction. Missing/out-of-scope Request404; no fact, target, role, owner or scope override in evaluation input.

Eligible Team references reuse assignment eligibility: active team/member, active available STAFF. Create/revise/activate lock a qualifying membership during validation; evaluation rechecks in one batch. A later change cannot bypass final human command eligibility/version checks. Rule access grants no business mutation. Resource-only rule audits contain safe IDs/revision/version/priority, omit AuditLog.requestId and do not appear in requester history. Routing facts/results/history are absent from USER/STAFF request projections, notifications, analytics and every AI context. All rule/evaluation responses are no-store. Apply affects only local manager form fields; actual assignment remains behind the unchanged protected state-machine command.

Central auth guard validates credential and live session/account; RBAC guard rejects wrong role. Domain policies combine resource identity, relationship, state and version within transactions. Use these same policies for lists, details, messages, files, export-like reports, source previews, Copilot, tool output and background-result delivery. Never load all records then filter in the browser.

- USER response: original description/title, own messages, status timeline, public progress, missing-info prompts, approved priority, simplified SLA, staff-provided resolution facts and factual summary. Hide internal SOP text, peer request identifiers/counts, candidate directory/workloads, raw tool traces and internal review artifacts.
- STAFF response: assigned request, facts, approved plan, checklist, allowed SOP evidence, safe timeline, SLA and messages. Similar-case results must be reretrieved or filtered to current assignment scope; never expose organization-wide intake counts/IDs cached for manager review. Do not forward the free-text manager recommendation reason, which may mention broader evidence; use a new assigned-context explanation or factual fields only. Manager approval explicitly publishes the reviewed action plan to the assignee, while candidate/peer evidence stays restricted. No candidate staff workloads or global metrics.
- MANAGER response: full permitted business review/audit projection, still without password hashes, session credentials, secrets, raw prompts or hidden reasoning.
- Recheck access when fetching a source, opening a notification, polling a run or completing an AI call; cached authorization from job creation is insufficient. Source links use backend IDs, never raw filesystem paths.
- Unauthorized authentication returns 401; wrong-role endpoint 403; resource outside an otherwise permitted reader's scope returns 404 with the same shape as an unknown ID. Do not leak existence through error details or total counts.

## Internal AI/system capabilities

SYSTEM can execute only registered transitions/jobs and scheduled SLA calculations. AI is telemetry provenance, never a credential. Human-triggered Copilot carries authenticated STAFF scope. Intake/recommendation jobs are bound to one request with manager-review purpose and may read organization-wide candidates/similarity through explicit tool policies; they cannot mutate protected business fields. This is a backend service capability, not role impersonation. Its full output is manager-only; narrow projections prevent privilege amplification.

No client-supplied role, owner, actorType, tenant, arbitrary context IDs or model-provided permissions are trusted. No role/team filter passed by a model can enlarge server-derived scope. Tool registry denies unknown or purpose-incompatible tools before execution.

## Authentication and sessions (M2 target)

Email is trimmed and lowercased, unique, up to 254 characters. Password input is 8–128 characters; do not trim it. Hash with Argon2id; initial parameters 64 MiB memory, 3 iterations, parallelism 1, with unique salts and verified library support. These are configuration defaults subject to M2 host checks, not a benchmark claim.

Access credential: signed short-lived JWT (15 minutes) with subject, session ID, issuer/audience and expiry; role in a token is not the sole authority. Validate active User and non-revoked RefreshSession on protected requests so logout/deactivation is effective before token expiry. Access token returned in JSON and held only in browser memory, never localStorage.

Refresh credential: high-entropy opaque token (at least 256 random bits), store only a keyed hash using REFRESH_TOKEN_SECRET. Session expires after seven days absolute, with rotation on every successful refresh; no extension beyond original expiry. Preserve rotated-token hash until family expiry to detect replay and revoke that session family. Atomic consume-and-rotate means concurrent refreshes cannot both succeed; frontend serializes refresh to prevent accidental replay. Logout revokes the session family, clears cookie and returns success even if already revoked. Invalid/expired/replayed refresh returns 401 and clears the cookie.

Refresh cookie: HttpOnly, SameSite=Lax, Path=/api/v1/auth, no Domain, Secure under HTTPS. Secure=false is allowed only in the explicit local HTTP demo configuration. Login, refresh and logout require an exact configured Origin and `X-CSRF-Protection: 1`; absent/unapproved Origin or header is 403. Restrict credentialed CORS to exact local frontend origin; no wildcard. Bearer-protected mutations require JSON and allowed browser Origin when present. Access/refresh secrets stay API-only and distinct.

Login generic 401 does not disclose inactive/unknown account versus incorrect password. Rate limits and payload limits are in [API_SPEC](API_SPEC.md). Auth success/failure/revocation events are audited with safe actor/session IDs, never token/password contents. Failed login audit must not invent an authenticated actor.

## Acceptance

M19 amendment (2026-10-02): structured mention and manual watch never grant access. Candidates first require current route Request scope and active identity/session; return only active STAFF/MANAGER already permitted under current A01/current-assignee rules, excluding caller, with safe id/displayName/role fields and a 20-row cap. No global directory, email, availability, other-watcher count or override. At note submit, lock live actor/session, scoped parent, and candidate users; revalidate every selected UUID. Invalid/inactive/USER/foreign/self targets produce the same generic 400 INVALID_MENTION_TARGET with no writes. Reassignment while waiting for the parent lock rejects stale STAFF operations with 404.

Own watch mutations serialize on the same scoped parent; no Request business/version write. Historical watch rows confer no access after reassignment/deactivation/role change. Fan-out uses batched current eligible recipients, excludes actor and USER, and validates resulting assignment after workflow writes. Internal notification list/unreadOnly predicates include current recipient role/active account and current Request scope before pagination; read/unread mutations additionally lock the scoped parent. Foreign/stale IDs produce the same 404 as unknown IDs without changing readAt. There is no separate notification detail/count endpoint. Private DTOs and child-resource audits never enter requester history, AI/RAG/recommendation/Copilot, analytics or public caches. M19 supersedes only M18's no-note-notification rule for safe internal notifications; note bodies remain excluded from Notification and all public contexts. [M19 plan](../v1.3/M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md).

M18 amendment (2026-10-02): separate GET/POST `/requests/:id/internal-notes`, role guard STAFF/MANAGER, shared existing request predicate, scoped parent lock and live identity/session recheck. USER always 403; operational roles receive indistinguishable 404 for foreign/unknown resources; no role/team/owner override or count. Notes are private child records: no requester DTO/history, note notifications, analytics or AI context. INTERNAL_NOTE_CREATED audit is child-resource-only (optional request FK null, safe request/note/author IDs in metadata), never copied into public Request timeline. Runtime notes allow only SELECT/INSERT, no edit/delete. Current-assignment loss or terminal closure is rechecked after parent lock. No existing business permission is enlarged.

M14 amendment: recommendation generate/read/review remains MANAGER only within existing A01 organization scope, including historical `aiRunId` reads scoped to the route request. USER/STAFF cannot access manager evidence or decisions; no role/action is added. Generation/read check active identity and unconsumed/unrevoked/unexpired session; review locks and rechecks identity inside the transaction. V2 queue binds its initiating SID as backend-only metadata, checked before request embedding, each tool/model attempt and under publication locks. Refresh rotation consuming that SID cancels unfinished work; fresh explicit generation uses the new SID. Strip metadata before strict public evidence/model/API input. Historical V1 snapshots without metadata remain compatible. V2 artifact review never grants assignment permission or executes its next step. STAFF continues to read only approved work via existing projections. Forged role/version/schema/source/context fields cannot widen scope. Exact missing fields are acknowledged for V2 accept/modify; stale/replayed/out-of-request reviews fail without writes.

M11 amendment: `/dashboard/user`, `/dashboard/staff`, `/dashboard/manager` are non-cumulative, role-guarded reads. USER counts owned records only; STAFF counts current assignments only, including readable terminal history; MANAGER retains A01 single-organization scope. The shared authorization policy emits both Prisma and bound SQL predicates. No query parameter may select role, owner, assignee or broaden scope; unknown fields return 400, wrong-role route 403, missing identity 401. Responses contain aggregate numbers for that role only, no request IDs, hidden totals, approval/directory/team workload fields for USER/STAFF. Authenticated read limits and no-store caching apply.

M2 tests three-role login, inactive users, expiry, revoke/rotation/replay, wrong role, owner A versus B, unassigned staff and pagination totals. M3/M7 tests transactional authorization and reassignment races. M5/M8 tests source access, tool-purpose restrictions, scope-filtered AI context and access revocation during model calls. M10 verifies direct URLs/API calls, CORS/CSRF, no frontend secrets and no trust in forged actor/role fields.
