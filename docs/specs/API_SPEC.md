# API Specification

Authority: master-plan §7 and M1–M9. This is the M0 transport contract; routes are not implemented yet. NestJS serves REST under `/api/v1`, with OpenAPI generated in M2 from implemented shared contracts. Public routes never expose arbitrary state updates, tool execution or model endpoints.

## Common transport and validation

JSON UTF-8 except multipart knowledge upload. Strict unknown-field rejection; UUID IDs; ISO-8601 UTC timestamps; string trim except passwords; no coercion of booleans/numbers/enums. General JSON body cap 64 KiB. Plain text only for request/message/reason/checklist fields; escape on display. Return `X-Request-ID`, generated server-side or accept a sanitized UUID supplied for correlation; never use correlation ID as authorization.

Success shape `{data,requestId}`. Lists `{data:[],page:{nextCursor:null|string,hasMore:boolean},requestId}`; limit integer 1–100 default 20, opaque base64url cursor of validated `(createdAt,id)` pair; order createdAt DESC, id DESC unless history, which returns chronological order for the selected page. Scope/filter before pagination. Invalid cursor/filter yields 400; no hidden global totals. Date filters use inclusive from/exclusive to UTC with from<to. Filter status/priority/category/assigneeId by controlled values; assignee filter cannot enlarge actor scope.

Error shape `{error:{code,message,details?:[{field,code}]},requestId}`. HTTP 400 malformed/schema invalid; 401 absent/expired/revoked identity; 403 wrong role/CSRF; 404 unknown or out-of-scope resource; 409 STALE_VERSION/INVALID_STATE/ALREADY_REVIEWED/DUPLICATE; 413 size; 415 media; 422 valid schema but invalid business references/invariants (e.g. missing policy/incomplete checklist); 429 RATE_LIMITED with Retry-After; 503 dependency unavailable for an immediate synchronous operation. Background AI failure appears as failed job with safe error on polling, not a fake successful analysis. No stack traces, SQL details, local paths or raw model errors.

All request mutations after creation carry `expectedVersion:positive integer`, including message/checklist/AI commands, feedback and manager decisions. Success returns current Request DTO with incremented version for domain mutations. Read-only AI artifact generation checks expectedVersion but does not increment it unless publishing a state transition. A stale check happens again on job publication. Missing expectedVersion is 400. All commands require authentication unless explicitly public below.

## Shared DTOs

- RequestCreate: `{description:string[10..10000],title?:string[1..160]}`. No owner/role/status/priority allowed.
- RequestView: id/publicCode/title/description/status/version/approved category?/subcategory?/priority/currentAssignee projection?/createdAt/updatedAt/terminal times/aiAnalysisStatus/missingFields/progress/SLA. Internal fields added only according to AUTHORIZATION_SPEC; `suggestedCategory` is distinct from approved `category`.
- VersionCommand: `{expectedVersion}`; ReasonCommand adds `{reason:string[1..2000]}`; MessageCommand adds `{body:string[1..4000]}`.
- FinalDecision: `{category,subcategory,priority,teamId,staffId,actions:[{text:string[1..500],required:boolean,sourceIds:string[]<=5,provenance:AI|HUMAN}]<=30,acknowledgedMissingFields:string[]<=6,reason:string[1..2000]}`. Compatible taxonomy, eligible team/staff and policy required. AI actions must cite current evidence; unsourced human actions need HUMAN provenance/reason. No arbitrary SLA minutes/status field. Empty checklist requires explicit reason.
- ReviewCommand: `{expectedVersion,reviewKind:AI|MANUAL,recommendationId?:UUID,manualDraftRevision?:int}`; exactly the matching identity supplied. Accept adds acknowledgedMissingFields; Modify adds finalDecision; Reject adds reason.
- Source: sourceId/documentId/chunkId/generation/title/pageNumber?/section?/excerpt/score, resolved by backend.
- Job: `{aiRunId,status,purpose,requestId?,errorCode?,createdAt,finishedAt?}`; no prompts/secrets. Polling uses current permissions; source IDs are never filesystem paths.

## Endpoint inventory

### M20 operational templates (2026-10-02)

M20 adds these strict shared-contract routes and generated OpenAPI operations. All require live authentication, no-store, existing origin/JSON64KiB/read120-write60 per minute guards and safe errors. USER403 everywhere; STAFF list/detail only ACTIVE RESPONSE (prohibited filters/history/management403, guessed archived/checklist/detail IDs404); MANAGER both types/history/management in A01. No delete/unarchive or request-scope override.

| Method / relative path | Input | Result |
|---|---|---|
| GET /templates | type?,status?,q? trimmed name/description query<=120,limit1–50 default20,cursor? | Summary list, PostgreSQL filter/keyset createdAt DESC/id DESC, no full content |
| GET /templates/:id | UUID | Current revision/content and safe metadata, preview only |
| POST /templates | strict discriminated type,name1–120 Unicode points,description?1–500,content RESPONSE{body1–4000} or CHECKLIST{items:[{text1–500,required:boolean}]1–30} | 201 revision1, safe audit, no business action |
| GET /templates/:id/revisions | MANAGER; limit/cursor only | Immutable paginated snapshots, including archived history |
| POST /templates/:id/revisions | same strict create shape plus expectedRevision positive | 201 new N+1 snapshot, same type; stale/archived409 STALE_TEMPLATE_REVISION |
| POST /templates/:id/archive | MANAGER; expectedRevision positive only | 200 one-way archive, historical references preserved; repeat/stale409 |

New content reuses actual shared Unicode code-point message/checklist bounds. Unknown/server-owned fields are rejected400. Existing message and STAFF request-info inputs add optional sourceTemplateRevisionId UUID; USER cannot supply it403. USER provide-info retains its original strict message shape without provenance. Manager triage input adds the same optional CHECKLIST source reference outside FinalDecision. Current Request ownership/state/expectedVersion and final human submitted text/actions remain authoritative. Wrong/missing type/revision references422 INVALID_TEMPLATE_SOURCE; archived/non-current409 TEMPLATE_UNAVAILABLE and no writes. Client retains draft and offers explicit unreferenced manual retry, without auto retry or Request version refresh. Draft provenance validated at save remains historical through later submit/approval even after archive/revision. MANAGER RequestView adds manualDraftSourceTemplateRevisionId and checklist.sourceTemplateRevisionId; USER/STAFF message/history and USER request projections expose neither. See [M20 plan](../v1.3/M20_RESPONSE_CHECKLIST_TEMPLATES_IMPLEMENTATION_PLAN.md).

Paths in tables are relative to `/api/v1`. Role/state abbreviations refer to exact rules in [AUTHORIZATION_SPEC](AUTHORIZATION_SPEC.md) and [REQUEST_STATE_MACHINE](REQUEST_STATE_MACHINE.md).

### Auth, user directory and health

| Method and path | Actor / input | Result |
|---|---|---|
| POST /auth/login | Public; `{email,password}` plus trusted Origin and CSRF header | 200 `{accessToken,expiresIn:900,user}` + rotating HttpOnly refresh cookie; generic 401 failure |
| POST /auth/refresh | Refresh cookie + Origin/CSRF header | 200 new access token/user + rotated cookie; replay/expiry 401, revoke family |
| POST /auth/logout | Refresh cookie/session, Origin/CSRF header | 204, revoke/clear cookie idempotently; no response body |
| GET /auth/me | Any active authenticated role | 200 own id/displayName/email/role |
| GET /users/me | Any active authenticated role | 200 same safe profile projection; no edit/role-management route |
| GET /users/staff | MANAGER; teamId?, skills?, limit/cursor | 200 bounded eligible directory with current skills/availability/workload; used for human modification |
| GET /health/live | Public | 200 API liveness only, no secrets/config |
| GET /health/ready | Public local deployment | 200 when API+DATABASE+VECTOR_EXTENSION ready, else 503; component statuses API/DATABASE/OLLAMA_SERVER/OLLAMA_LLM_MODEL/OLLAMA_EMBEDDING_MODEL/VECTOR_EXTENSION and aiReady boolean. Ollama failure alone means degraded AI, not process failure. No paths/model credentials. |

Auth credential transport/lifetimes are fully specified in AUTHORIZATION_SPEC. Minimal public health is intentional; detailed operational configuration is never exposed.

### Requests, conversations and staff work

| Method and path | Actor / input / state | Success and effects |
|---|---|---|
| POST /requests | USER; RequestCreate | 201 RequestView NEW; creation history/audit; queued intake once enabled |
| GET /requests/mine | USER; pagination/status/priority/category/date filters | 200 own scoped list |
| GET /requests/:id | Own USER/current STAFF/MANAGER | 200 projected detail; unrelated resource 404 |
| GET /requests/:id/history | Same read scope; pagination | 200 safe chronological domain events |
| POST /requests/:id/messages | Scoped readers; MessageCommand; nonterminal | 201 message + request version; no state change |
| POST /requests/:id/provide-info | Owning USER; MessageCommand; WAITING_USER | 200 RequestView IN_PROGRESS + reply/SLA resume |
| POST /requests/:id/confirm | Owning USER; VersionCommand; RESOLVED | 200 CLOSED |
| POST /requests/:id/reopen | Owning USER; ReasonCommand; RESOLVED | 200 IN_PROGRESS; preserved SLA/assignment |
| POST /requests/:id/cancel | Owner/MANAGER by cancel matrix; ReasonCommand | 200 CANCELED; invalidate pending work |
| POST /requests/:id/feedback | Owning USER; `{expectedVersion,rating:int[1..5],comment?:string<=2000}`; CLOSED | 201 Feedback + request version; second submission 409 |
| GET /staff/work-queue | STAFF; scoped pagination/status/priority/category | 200 current assigned open work (ASSIGNED/IN_PROGRESS/WAITING_USER/RESOLVED); terminal history via authorized detail |
| POST /requests/:id/start | Assigned STAFF; VersionCommand; ASSIGNED | 200 IN_PROGRESS |
| POST /requests/:id/request-info | Assigned STAFF; MessageCommand; IN_PROGRESS | 200 WAITING_USER + question/SLA pause |
| POST /requests/:id/checklist | Assigned STAFF; `{expectedVersion,sourceRunId?,items:[{text,required,sourceIds}]<=30}`; IN_PROGRESS | 200 saved/appended checklist; overall 30-item cap; explicit staff adoption of AI draft with provenance |
| PATCH /requests/:id/checklist/:itemId | Assigned STAFF; `{expectedVersion,text?,required?,operation?:COMPLETE\|UNCOMPLETE\|WAIVE\|UNWAIVE,reason?}`; IN_PROGRESS | 200 checklist + request version; waiver needs reason; item must belong to request |
| POST /requests/:id/resolve | Assigned STAFF; `{expectedVersion,rootCause,resolution,verification}` each 10–4000; IN_PROGRESS | 200 RESOLVED + immutable resolution event, frozen SLA and queued summary |

Checklist creation is upsert of the one request checklist; supplied new items append, not silently replace approved/completed items. Text edits preserve before/after audit and source provenance; changing sourced text marks that edit human-authored. Completion/waiver changes timestamps as defined in DATABASE_SPEC. Generic message endpoints are never implicit state commands.

### Manager review and commands

| Method and path | Actor / input | Result |
|---|---|---|
| GET /manager/requests | MANAGER; bounded list filters | 200 all V1 matching requests |
| POST /manager/requests/:id/triage | MANAGER; `{expectedVersion,finalDecision}`; NEW or TRIAGED | 200 TRIAGED/manual draft revision; cancels queued intake; active AI_ANALYZING returns 409 |
| POST /manager/requests/:id/submit-approval | MANAGER; `{expectedVersion,manualDraftRevision}`; TRIAGED | 200 PENDING_APPROVAL MANUAL; notify managers |
| POST /manager/requests/:id/ai/recommend | MANAGER; VersionCommand; TRIAGED | 202 Job; fixed pipeline; background SYSTEM publication creates PENDING_APPROVAL |
| GET /manager/requests/:id/ai/recommendation | MANAGER; implemented M6 read projection | 200 latest recommendation job or null, validated evidence, sanitized tool traces and live stale flags; no approval action |
| GET /manager/approvals | MANAGER; pagination | 200 current actionable pending reviews only |
| GET /manager/approvals/:requestId | MANAGER | 200 review kind/reference/version, original AI/draft, evidence and decision form defaults |
| POST /manager/approvals/:requestId/accept | MANAGER; ReviewCommand + acknowledgedMissingFields | 200 ASSIGNED; atomic decision/assignment/checklist/SLA/notifications/audit |
| POST /manager/approvals/:requestId/modify | MANAGER; ReviewCommand + finalDecision | 200 ASSIGNED with immutable original and recorded changes |
| POST /manager/approvals/:requestId/reject | MANAGER; ReviewCommand + reason | 200 TRIAGED; preserve rejected artifact, clear current review |
| POST /manager/requests/:id/reassign | MANAGER; `{expectedVersion,teamId,staffId,reason}` | 200 RequestView; same state, new assignment, no clock reset |
| POST /manager/requests/:id/priority | MANAGER; `{expectedVersion,priority,reason}` | 200 RequestView; same state, policy recalculation; ASSIGNED/IN_PROGRESS/WAITING_USER only |
| GET /manager/audit | MANAGER; requestId?, actorType?, action?, dates, pagination | 200 safe audit events |

State/eligibility/source/policy changed since review returns 409/422 with stable code and refresh guidance. No endpoint treats “accept” as an unchecked shortcut. Manual reviews do not generate fake AiRecommendation rows or AI acceptance statistics.

### AI results and resolution retry

| Method and path | Actor / input | Result |
|---|---|---|
| POST /requests/:id/ai/analyze | Own USER/MANAGER; VersionCommand; NEW and no active run | 202 Job; idempotent scheduling by persisted request/purpose key |
| POST /requests/:id/ai/retry | Own USER/MANAGER; VersionCommand; NEW with failed intake | 202 new Job, preserving old failed telemetry |
| POST /requests/:id/ai/copilot/action | Assigned STAFF; `{expectedVersion,action}` six-action enum; allowed Copilot states | 202 Job; no arbitrary prompt/context/tool fields |
| GET /requests/:id/ai/explanation | Own USER/current STAFF/MANAGER | 200 role-projected facts/reason/sources; USER only progress/missing facts and approved resolution, not manager evidence |
| GET /ai/runs/:id | Current permitted reader by purpose: owner/MANAGER intake status, assigned STAFF initiator for Copilot, MANAGER recommendations, scoped readers for safe resolution summary | 200 Job and safe typed result by projection; SYSTEM-scheduled intake is pollable by owner; staff cannot read manager review traces |
| POST /requests/:id/ai/resolution-summary/retry | Current assigned STAFF or MANAGER; `{expectedVersion,resolutionId}`; RESOLVED/CLOSED | 202 Job only for latest effective resolution with failed summary; state/facts unchanged |

Automatic intake/recommendation/summary uses the same internal services and current permissions. Requests are committed before model execution; 202 means accepted for work, not AI success. Existing active same-purpose run returns its job instead of launching another when version still matches; stale version returns 409. Browser polls with bounded backoff (2→5 seconds), stops on terminal status/navigation; server checks access every poll.

### Knowledge, notifications and analytics

| Method and path | Actor / input | Result |
|---|---|---|
| POST /knowledge/documents | MANAGER; multipart title 1–200 + one PDF/TXT file <=10 MiB | 202 document ID/status UPLOADED; strict upload rules; 409 duplicate hash |
| GET /knowledge/documents | MANAGER all statuses; STAFF READY only; pagination | 200 authorized metadata |
| GET /knowledge/documents/:id | MANAGER metadata; STAFF only READY | 200 metadata/status/generation and safe error on failed indexing |
| GET /knowledge/documents/:id/content | MANAGER including historical audit; STAFF READY only | 200 controlled binary PDF or text download, authorized storage key; no client path |
| GET /knowledge/sources/:sourceId | MANAGER or STAFF permitted current READY source; MANAGER may request historical=true for audit | 200 Source; historical result flagged unavailableForLiveUse; stale STAFF source 404 |
| POST /knowledge/documents/:id/reindex | MANAGER; `{expectedVersion}` | 202 PROCESSING; rejects active job conflict; explicit reactivation if DISABLED |
| POST /knowledge/documents/:id/disable | MANAGER; `{expectedVersion,reason}` | 200 DISABLED; invalidate live source use |
| GET /notifications | Any authenticated role; own recipient only, unreadOnly?, pagination | 200 own safe notification records |
| PATCH /notifications/:id/read | Recipient; `{read:boolean}` | 200 readAt updated/null, idempotent; no request version needed |
| GET /analytics | MANAGER; strict calendar range/current priority/status/category/teamId filters | 200 typed PostgreSQL operations/SLA/reopen/feedback/AI/Copilot/trends and separate synthetic evaluations; combines the original planned overview/AI/SLA subresources |

## Abuse controls, audit and contracts

### M13 Analytics V2 amendment (2026-09-30)

GET `/analytics` operationId `getManagerAnalytics`; active MANAGER only, no-store, existing 120/minute authenticated read guard; no body/pagination/scope override. Query is `preset=7d|30d|90d` (default 30d) **or** `from`/`to` ISO calendar dates (both required, from inclusive/to exclusive, 1–365 days). Optional controlled `priority`, `status`, `category`, UUID `teamId` use current approved Request fields, including for older event activity. Dates resolve in PostgreSQL using Asia/Ho_Chi_Minh and one statement timestamp; preset ends tomorrow at local midnight. Response period echoes exact UTC boundaries, date labels/day count/timezone/asOf and daily granularity. Future empty ranges are valid. Unknown/duplicate fields, unsupported preset/range, malformed date/enum/UUID or mixed range modes return shared 400 INVALID_INPUT; missing auth 401, USER/STAFF 403, read limit 429, unexpected dependency failures sanitized 500.

`packages/contracts/src/analytics.ts` owns strict input/output Zod; response OpenAPI is generated from this schema. Data includes period/filters/filterOptions (safe normalized teams), operations/sla/reopen/feedback/ai/copilot/trends/evaluations and legacy overview fields. Exact event/completion populations and rate denominators are [defined here](../v1.2/M13_ANALYTICS_V2_IMPLEMENTATION_PLAN.md). No request IDs/text, personal data, feedback comments, prompts, tool results or raw AI output. Empty denominators/averages are null. Legacy `windowDays` string 1–365 remains mutually exclusive with the new range inputs and now follows Vietnam calendar boundaries. Legacy overview retains snapshot semantics for compatibility fields but is absent from the new page. Strict V1.1 Zod clients reject additive keys: this is a paired API/web update with a browser reload after both are deployed, not a claim of old-client compatibility.

### M11/M12 additive amendment (2026-09-30)

GET `/dashboard/user` (USER), `/dashboard/staff` (STAFF), `/dashboard/manager` (MANAGER) return `{data:{role,asOf,timeZone:'Asia/Ho_Chi_Minh',day:{from,to},metrics},requestId}`. No query parameters, body or pagination apply; unknown queries 400, unauthenticated 401, wrong role 403, read limit 429. All metrics are nonnegative integer PostgreSQL counts over the full authorized scope. OpenAPI operationIds are `getUserDashboard`, `getStaffDashboard`, `getManagerDashboard`; schemas are generated from `packages/contracts/src/dashboard.ts`. See [exact metric definitions](../v1.2/M11_M12_IMPLEMENTATION_PLAN.md). Day is inclusive `from`/exclusive `to`; current effective RESOLVED/CLOSED timestamps count, not reopened historical cycles.

Request SLA DTO preserves `status`, `dueAt`, and all previous fields, and adds `state` (=status), `deadlineAt` (=dueAt), nonnegative `breachedBySeconds`, nullable `completedAt` (effective resolution instant), `riskThresholdSeconds`, and `totalPausedSeconds`. `remainingSeconds` remains signed; breachedBySeconds is a current overrun, not duration since historical breachedAt. Strict newer clients require the additive fields; old clients can continue reading the old fields. Deploy API before the new web client. No mutation contract, role, route or enum is renamed. API consumers must use state, not derive classifications from remaining time.

Initial per-process local-demo token buckets: login 5 attempts/minute per normalized account+IP and 20/minute per IP; refresh 30/minute per session+IP; all AI triggers 5/minute per actor plus one active request/purpose and global LLM concurrency 1; uploads/reindex 5/minute per manager plus index concurrency 1; reads 120/minute per actor; other writes 60/minute per actor. Proxy trust is explicitly configured, not any client-supplied forwarding header. Bounds are tunable config, recorded in API startup; no distributed rate limiter dependency in V1. All critical writes and denied sensitive actions use safe audit/log metadata.

M2 shared contracts/OpenAPI must specify every DTO, enum, status, security scheme and error. Future generated clients use these contracts; UI cannot expand permissions. No externally consumed compatibility exists at baseline; once implemented, preserve `/api/v1` contract or document amendments. Tests cover every important endpoint with unauthenticated/wrong-role/wrong-owner, malformed input, stale version, successful mutation and relevant rollback cases.

## M14 Recommendation V2 amendment (2026-09-30)

Extend existing MANAGER routes: POST `/manager/requests/:id/ai/recommend` with strict `{expectedVersion}` queues V2 (202, server-selected version); GET `/manager/requests/:id/ai/recommendation` returns latest or optional strict `?aiRunId=UUID` historical run scoped to this request (200, data=null if no latest, 404 missing requested run). Both no-store; operationIds queueManagerRecommendation/getManagerRecommendation. Job shared schema now includes schemaVersion and V1/V2 payload/evidence union, reviewStatus/reviewerId/reviewedAt, validated finalDecision and safe managerChanges, original model metadata and live stale reasons. Unsupported/invalid stored output gives sanitized safe failure, never provider text. Old V1 snapshots and confidence remain readable; API/web update together because strict clients need new metadata.

Existing `/manager/approvals/:id/accept|modify|reject` retain strict expectedVersion/reviewKind/recommendationId and current RequestView response. OperationIds acceptManagerRecommendation/modifyManagerRecommendation/rejectManagerRecommendation. Server dispatches by persisted artifact version: V1/manual execute existing business workflow, V2 record artifact agreement/modification/rejection only. V2 accept/modify require exact missing-field acknowledgments, modifications use validated FinalDecision/current eligibility/policy/source provenance. Refetch job for reviewer/time/human plan. Errors 400 malformed/unknown input, 401 stale identity/session, 403 wrong role, 404 unknown/out-of-scope, 409 stale/version/replay/evidence, 422 decision/ack validation, 429 budget and sanitized500. No client-selectable legacy generation version, new action endpoint or expanded STAFF access.

## M18 Internal Notes amendment (2026-10-02)

This section records the M18 contract. M19 below adds optional structured mentions/body-free operational notifications while retaining body-only requests and all M18 privacy/lifecycle/version rules.

| Method and path (relative to /api/v1) | OperationId / contract | Scope and effects |
|---|---|---|
| GET /requests/:id/internal-notes | listRequestInternalNotes; strict limit/cursor query only; default 20/max 100; existing opaque (createdAt,id) cursor; `{data:InternalNote[],page,requestId}` | STAFF current assignment or MANAGER existing A01 scope; newest first (createdAt DESC/id DESC), including terminal history. No count. |
| POST /requests/:id/internal-notes | createRequestInternalNote; strict `{body}`; `{data:InternalNote,requestId}`; 201 | Same scope, allowed through RESOLVED; CLOSED/CANCELED 409 INVALID_STATE. Append child + body-free resource-only audit. No Request write/version change, notifications or AI input. |

InternalNote is strict `{id,requestId,body,createdAt,author:{id,displayName}}`; no email/session/password/role. Shared `createInternalNoteSchema`, `internalNoteQuerySchema`, `internalNoteResponseSchema`, `internalNoteListSchema` own validation. Body trims surrounding whitespace, rejects blanks, bounds at 4,000 Unicode code points under installed Zod 4.6.5; HTML/@name/Markdown syntax stays plain text. Server derives IDs/author/time. This newly authorized child insert is an explicit exception to the blanket Request-mutation expectedVersion wording above; all existing versioned commands are unchanged.

Authentication required; 401 invalid identity/session, USER 403 even on owned/unknown request, STAFF/MANAGER unknown/out-of-scope 404 same safe shape. Strict input/query/UUID/cursor 400; write origin 403, size 413 (64 KiB JSON), media 415, existing 120 reads/60 writes per minute with 429/Retry-After, sanitized database 503/internal 500. Both no-store through existing authenticated middleware/client; no public or service-worker cache. No read-by-note-ID, PATCH, DELETE or note-count API. Generated `/api/docs-json` documents schemas/params/security/statuses; no second static OpenAPI source is introduced. Request detail/list/history/explanation/dashboard/analytics/notifications keep their current projections and never include internal-note content or activity.

## M19 Mentions + Watchers amendment (2026-10-02)

All paths remain relative to `/api/v1`. STAFF/MANAGER only, current Request scope and active live identity/session; USER 403, foreign/unknown Request 404, strict query/body/UUID 400, existing authentication/origin/rate/no-store/error rules apply.

| Method and path | OperationId / input | Response / effects |
|---|---|---|
| GET /requests/:id/mention-candidates | listRequestMentionCandidates; strict optional q<=80 code points and limit string1..20, default20 | 200 `{data:[{id,displayName,role}],requestId}`; active already-authorized STAFF/MANAGER, excludes self, deterministic displayName/id order; no directory/email/watcher fields |
| POST /requests/:id/internal-notes | createRequestInternalNote; strict `{body,mentionedUserIds?:UUID[]}` | Existing201 envelope; optional IDs normalize lowercase/dedup, max10 unique (raw cap100), self invalid. Any invalid target400 INVALID_MENTION_TARGET; all-or-nothing note/mentions/audit/notifications. Body-only still valid; literal @ text does nothing |
| GET /requests/:id/watch | getRequestWatchState; strict empty query | 200 `{data:{watching:boolean},requestId}`; own state only, including terminal |
| PUT /requests/:id/watch | watchRequest; strict empty query/body (body optional) | Same200; idempotent manual own start; 409 WATCH_LIMIT at100 stored subscriptions/request |
| DELETE /requests/:id/watch | unwatchRequest; strict empty query/body (body optional) | Same200; idempotent own stop |

InternalNote response adds optional `mentions:[{userId,displayName}]` (max10), rendered as plain text; server currently returns an empty array for old/body-only notes. Author/mention/candidate names respect the existing160-character user field. No new Request DTO, directory or other-watcher projection. Child note/watch commands need no expectedVersion and write no Request fields. CLOSED/CANCELED notes stay read-only; candidates/watch remain allowed on readable terminal requests. No note edit/delete route or mutable mention API.

### Persisted internal notification events

| Source action | Meaning |
|---|---|
| INTERNAL_NOTE_CREATED | A private note was successfully persisted; explicit mention recipients and eligible watchers |
| SUBMIT_FOR_APPROVAL | Human draft submitted for approval |
| APPROVE_AND_ASSIGN | Human approval and assignment persisted |
| REJECT_APPROVAL | Human approval rejection persisted |
| REASSIGN | Human reassignment persisted; resulting assignment determines eligibility |
| START_WORK | Staff started work |
| REQUEST_USER_INFO | Staff requested requester information |
| USER_PROVIDE_INFO | Requester supplied the requested information |
| RESOLVE | Staff persisted a resolution |
| USER_REOPEN | Owner reopened a resolved request |
| USER_CONFIRM | Owner confirmed and closed a resolved request |
| CANCEL | Authorized human canceled the request |

Excluded: reads/polling/health, AI generation/advisory review, provider/RAG/embedding actions, SLA/background ticks, manual triage/priority/message/checklist/feedback changes and watch/unwatch changes. No arbitrary event publishes internal fan-out. Notification type is INTERNAL_NOTE_MENTION for mention or REQUEST_WATCH_ACTIVITY for watch. Use the owning persisted AuditLog event ID; union by recipient, mention precedence, suppress actor, insert in the owning transaction. Partial unique(recipientId,eventId) for these internal types plus conflict-safe insertion prevents duplicate retry/cross-type delivery; legacy/SLA keys are retained.

Notification safe metadata contains only reason/sourceAction/noteId where applicable; no note body/excerpt/display-name copy. Existing GET `/notifications` and PATCH `/notifications/:id/read` retain safe DTO/transport; current active recipient role and Request scope filter internal types before pagination/unreadOnly. Read/unread mutations lock/recheck parent scope. Stale rows yield no metadata/count/read-state change; stale/foreign IDs404. There is no separate detail/unread-count endpoint, so filtered unreadOnly data is the applicable unread surface. Browser navigation uses the existing scoped Request detail; it can be denied if access changes after listing. USER never sees internal types/activity. All private endpoints and frontend fetches remain no-store; no public cache/export/AI/analytics inclusion.
