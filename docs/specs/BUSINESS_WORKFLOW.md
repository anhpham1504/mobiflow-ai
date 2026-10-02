# Business Workflow

Authority: master-plan §§1–2, 6–10, M3–M8 and §28. Assumptions A01–A17 are recorded in [PROJECT_SPEC](PROJECT_SPEC.md). [REQUEST_STATE_MACHINE](REQUEST_STATE_MACHINE.md) is the exhaustive transition authority; [AUTHORIZATION_SPEC](AUTHORIZATION_SPEC.md) is the permission authority.

## Intake and triage

1. Authenticated active USER submits trimmed description (10–10,000 characters), optional title (1–160). Backend creates NEW with owner from session, MEDIUM priority, no assignment/SLA, public code, version 1 and creation audit. Request text is not editable afterward. Backend uses the first 100 description characters for a missing title.
2. M4 onward, creation schedules one persisted analysis job. Backend starts NEW → AI_ANALYZING, captures version/context and records AiRun. A valid analysis stores typed facts/suggestions and transitions to TRIAGED. Final operational category/priority/team/assignee remain unset/default until manager approval; listings can separately label suggested category.
3. Provider failure, timeout, invalid output or failed recovery returns AI_ANALYZING → NEW with `aiAnalysisStatus=FAILED`; the original request remains intact. Owning USER or MANAGER may retry. Manual triage is available to MANAGER in NEW; an active run must complete/fail or be canceled before manual triage can proceed.
4. M6 onward, TRIAGED can run the fixed recommendation pipeline. A successfully validated artifact and transition to PENDING_APPROVAL are committed together. Failure leaves TRIAGED with a failed run and retry/manual review available. No assignment, priority change or SLA is produced by AI.
5. Missing facts are visibly listed. Time stated as “8 giờ sáng” is stored as reported text unless an explicit date/time zone makes an instant unambiguous. Manager must explicitly acknowledge missing critical location/time facts at approval; staff obtains them later through the prescribed info-request path.

## Manual workflow independent of AI

M20 amendment (2026-10-02): MANAGER can select an ACTIVE CHECKLIST template in this existing local action editor, preview, explicitly apply with nonempty-draft replacement confirmation, and edit text/required/order/add/remove. Selection changes no persisted business resource. Only the existing triage-save, submit and protected approval sequence adopts final human actions. The source is an exact immutable starting revision, validated ACTIVE/current when saving the draft, retained historically if later revised/archived. STAFF cannot use checklist templates on active work. Response templates similarly prepare STAFF/MANAGER existing message or assigned STAFF information-request drafts; only explicit existing send performs the original versioned command. No new messaging workflow. Stale template metadata rejects atomically; human text remains available for explicit manual retry without that reference. Existing expectedVersion never changes from template selection. [M20 plan](../v1.3/M20_RESPONSE_CHECKLIST_TEMPLATES_IMPLEMENTATION_PLAN.md) and owning API/authorization/database amendments define the contracts.

MANAGER records a manual triage draft with category/subcategory, priority, eligible team/staff, policy-derived SLA, a bounded action checklist, reason and missing-fact acknowledgment. NEW moves to TRIAGED. In TRIAGED a new draft replaces the prior manual draft with before/after audit; prior AI artifacts remain immutable.

Manager explicitly submits the draft (TRIAGED → PENDING_APPROVAL, reviewKind=MANUAL). A separate accept command applies the reviewed draft using the same assignment, policy, concurrency, audit and notification checks as AI approval. Same-person preparation and approval is permitted in this three-role demo. There is no automatic approval or fabricated AI record. This path is the M3 gate while AI is disabled.

## Manager review and application

Pending review identifies its kind, request version, draft/recommendation ID and source revision. Manager sees original input, missing data, model-reported confidence, reason, retrieved sources and tool results separately from the proposed final decision.

| Decision | Preconditions | Atomic result |
|---|---|---|
| Accept AI | Current PENDING AI recommendation; request PENDING_APPROVAL; evidence SUFFICIENT; IDs/policy/sources still valid; eligible available STAFF; missing facts acknowledged | Recommendation ACCEPTED; final decision/assignment snapshot; approved category/priority/team/assignee; checklist; first SLA; ASSIGNED; notification; history; audit |
| Modify AI | Current pending review/version; manager supplies complete final fields plus reason; retained source refs must still be valid; insufficient evidence may be overridden only by explicitly human-authored actions | Recommendation MODIFIED even if only checklist changes; original suggestion retained; diff/final decision persisted; same assignment transaction |
| Accept manual | Current submitted manual draft and PENDING_APPROVAL; same eligibility/policy validation | Assignment and final manual decision; no AI acceptance metric; same domain transaction |
| Modify manual | Current submitted draft; replacement final decision plus reason | Same domain transaction with human provenance; no AI metric |
| Reject | Pending current review; nonempty reason | AI recommendation REJECTED where present; history/audit; request TRIAGED; no assignment/SLA; clear pending reference |

Accept rejects incomplete candidates, unavailable evidence or stale policy with actionable conflict/validation errors. Manager refreshes then modifies or rejects; backend does not silently replace staff or accept unavailable sources. Manual actions may be human-authored without SOPs but cannot pretend to be sourced AI procedures.

Approval transactions validate all inputs before commit. A modification may remove stale/unsupported original evidence and replace actions with a human-authored plan; it cannot retain invalid citations or pretend the original AI advice was sourced. At most one competing approval succeeds. Failure or stale version leaves all business rows unchanged. Duplicate browser submission cannot create two assignments or two SLA records.

## Staff work, messages and resolution

Only current assigned STAFF can start ASSIGNED → IN_PROGRESS. Staff and owner may post plain-text messages on nonterminal accessible requests; generic messages do not change state. MANAGER may add operational messages. No private internal-message subtype in V1: all posted conversation messages are visible to owner, current staff and manager. Keep internal peer evidence out of those messages.

Only assigned STAFF in IN_PROGRESS can request information, supplying a nonempty question. WAITING_USER pauses SLA and notifies the owner. Only owning USER can provide-info with a nonempty response; this appends a message and resumes IN_PROGRESS/SLA. A generic message while waiting does not resume the clock. There is no automatic expiry/cancellation for lack of a reply.

Checklist originates from the approved plan or an explicit staff save of a Copilot draft. It has up to 30 items (text 1–500 characters, required boolean). In IN_PROGRESS assigned staff may add/edit items, mark complete/incomplete, or waive a required item with a reason. Completion/waiver records actor and time. AI cannot save, tick or waive items. Resolution requires each required item completed or explicitly waived; an empty manual checklist is permitted with manager justification retained in the plan.

Assigned STAFF resolves only from IN_PROGRESS, entering rootCause, resolution and verification (each 10–4,000 characters). Persist these facts, freeze SLA, transition RESOLVED and notify owner atomically. Then schedule factual AI summary; its failure cannot undo resolution or block confirmation. Every resolve/reopen cycle retains its resolution event and summary provenance.

Owning USER confirms RESOLVED → CLOSED, or reopens RESOLVED → IN_PROGRESS with a reason (1–2,000 characters). Reopen preserves assignment, prior resolution facts and consumed SLA budget and notifies current staff/manager. No reopening CLOSED. After CLOSED the owner may submit exactly one rating 1–5 and optional comment up to 2,000 characters.

## Management changes and cancellation

MANAGER reassigns ASSIGNED, IN_PROGRESS or WAITING_USER work to an eligible available staff/team with a reason. End the old Assignment, create the new one, change current assignee, preserve status and SLA timing, revoke old staff access immediately, and notify the new staff. New staff takes over IN_PROGRESS/WAITING_USER as-is; the state is not reset to ASSIGNED.

MANAGER may change priority on ASSIGNED/IN_PROGRESS/WAITING_USER with a reason and valid SLA policy. It updates budget per SLA_SPEC without erasing a historical breach. Pre-assignment priority is changed through triage/approval only. AI never invokes these commands.

Cancellation actors/states are exhaustively listed in the state specification. It requires a reason, closes active assignment/SLA processing, invalidates pending work/review and preserves all history. Late AI output is discarded by the version/state guard. Cancellation is not deletion and creates no fabricated manager rejection for pending AI suggestions.

## In-app notifications

All notification insertion is transactional with its triggering domain event; unique `(recipientId,eventId,type)` prevents duplicate processing. No external publishing or email/SMS/Zalo integration.

| Event | Recipients |
|---|---|
| Approval required | Active MANAGER accounts |
| Assignment/reassignment | New current STAFF |
| User info required | Owning USER |
| User replied | Current STAFF |
| SLA AT_RISK / BREACHED | Current STAFF and active MANAGER accounts |
| Request resolved | Owning USER |
| Request reopened | Current STAFF and active MANAGER accounts |

Notification has type, request link, event/actor metadata, createdAt/readAt. It is visible only to its recipient. Links reauthorize on click; after reassignment the former staff sees a generic notification without cached request content and receives 404 on the old resource. Invalidated approval notifications remain historical but are labeled no longer actionable on opening.

## Failures, audit and acceptance

Every mutation rechecks active identity, access, state, version and invariants in a transaction. Audit records initiating human/internal actor, effective service actor if applicable, action, resource, safe before/after fields, reason and request ID. Failed authorization is logged safely without leaking target content. No audit write means no business commit.

Acceptance: demonstrate manual flow with Ollama unavailable; normal AI review without preapproval side effects; reject/resubmit; concurrent approval conflict; reassignment access loss; wait/reply pause; resolve/summary failure/confirm; reopen preserving clock; terminal feedback; cancellation during AI; all specified notification recipients. These tests are planned for M2–M8, not executed in M0.
