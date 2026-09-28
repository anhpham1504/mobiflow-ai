# Request State Machine

Authority: master-plan §§2.2, 4.5, 6 and M3/M4/M6/M7/M8. Assumptions A02–A05 and A11 in [PROJECT_SPEC](PROJECT_SPEC.md). This table is exhaustive: any unlisted state/action/actor combination is denied.

## Canonical states

| State | Meaning |
|---|---|
| NEW | Saved; not yet successfully triaged, including recoverable failed analysis. |
| AI_ANALYZING | One active bounded intake run owns a versioned request snapshot. |
| TRIAGED | Valid AI analysis or explicit manual triage exists; no pending approval yet. |
| PENDING_APPROVAL | Exactly one current AI recommendation or submitted manual draft awaits manager action. |
| ASSIGNED | Human-approved decision, current assignment and first SLA exist. |
| IN_PROGRESS | Current assigned staff is working. |
| WAITING_USER | Staff asked for information; owning user response required; SLA paused. |
| RESOLVED | Staff resolution facts persisted; owner confirmation outstanding; SLA frozen. |
| CLOSED | Owner confirmed; terminal, feedback allowed. |
| CANCELED | Authorized cancellation; terminal and preserved for audit. |

`AI` and `SYSTEM` below are not additional business roles. Public callers cannot claim either. Service transitions require an internal capability scoped to a persisted job/action, request and expected version.

## Transition matrix

| From | Action | To | Actor | Required guard and effects |
|---|---|---|---|---|
| NEW | START_AI_ANALYSIS | AI_ANALYZING | SYSTEM | Active request and unique analysis run; capture version; aiAnalysisStatus=RUNNING. Human triggers only authorize scheduling. |
| AI_ANALYZING | COMPLETE_AI_ANALYSIS | TRIAGED | SYSTEM | Matching active run/version; validated typed analysis; persist AiAnalysis and successful AiRun; aiAnalysisStatus=SUCCEEDED. |
| AI_ANALYZING | FAIL_AI_ANALYSIS | NEW | SYSTEM | Matching active run and freshly locked current version; failed run/error code; aiAnalysisStatus=FAILED; preserve original text and later messages. |
| NEW | MANUAL_TRIAGE | TRIAGED | MANAGER | Valid complete manual draft, reason and version; no fabricated AI artifact. |
| TRIAGED | SUBMIT_FOR_APPROVAL | PENDING_APPROVAL | SYSTEM/MANAGER | SYSTEM requires a new validated PENDING AI recommendation; MANAGER requires current manual draft. Store reviewKind and pending reference; notify managers. |
| PENDING_APPROVAL | APPROVE_AND_ASSIGN | ASSIGNED | MANAGER | Accept/modify current review; validate eligible staff/team, policy, sources/missing-data acknowledgment; commit final decision, assignment, checklist, SLA and notification. |
| PENDING_APPROVAL | REJECT_APPROVAL | TRIAGED | MANAGER | Reason required; AI recommendation REJECTED if present; clear pending reference; no assignment/SLA. |
| ASSIGNED | START_WORK | IN_PROGRESS | assigned STAFF | currentAssigneeId=actor.id; retain same assignment and SLA. |
| IN_PROGRESS | REQUEST_USER_INFO | WAITING_USER | assigned STAFF | Nonempty question, append message, pause SLA, notify owner. |
| WAITING_USER | USER_PROVIDE_INFO | IN_PROGRESS | owning USER | createdById=actor.id; nonempty reply, append message, resume SLA, notify staff. |
| IN_PROGRESS | RESOLVE | RESOLVED | assigned STAFF | Valid rootCause/resolution/verification; required checklist complete or waived; freeze SLA and persist resolution event; notify owner; schedule summary after commit. |
| RESOLVED | USER_CONFIRM | CLOSED | owning USER | Explicit confirmation; closedAt=now; finalize SLA and current assignment interval; no AI dependency. |
| RESOLVED | USER_REOPEN | IN_PROGRESS | owning USER | Reason required; retain assignee and resolution history; clear current resolvedAt; resume same SLA excluding confirmation wait; notify staff/managers. |
| NEW | CANCEL | CANCELED | owning USER/MANAGER | Nonempty reason; cancellation effects below. |
| AI_ANALYZING | CANCEL | CANCELED | owning USER/MANAGER | Same; invalidate active run and abort best effort; late output cannot commit. |
| TRIAGED | CANCEL | CANCELED | owning USER/MANAGER | Same; invalidate recommendation generation if in flight. |
| PENDING_APPROVAL | CANCEL | CANCELED | owning USER/MANAGER | Same; clear review pointer and invalidate pending artifact without fabricating a human rejection. |
| ASSIGNED | CANCEL | CANCELED | MANAGER | Same; stop SLA and end active assignment. |
| IN_PROGRESS | CANCEL | CANCELED | MANAGER | Same; preserve work and messages. |
| WAITING_USER | CANCEL | CANCELED | MANAGER | Same; close open pause at cancellation and stop SLA. |

## Atomic transition protocol

`RequestStateMachineService.transition(requestId, action, actorContext, expectedVersion, payload)` is the sole status writer. A creation transaction establishes NEW; every later transition follows this service. There is no generic public `PATCH status` endpoint.

1. Authenticate the initiating actor or validate internal job capability; load current identity/role/activity and the request within a transaction.
2. Apply ownership predicate and state/action guard. Hidden/out-of-scope resource returns 404; forbidden route role returns 403. Authorized invalid state or stale version returns 409.
3. Validate payload and references. Use conditional version update or row lock plus version predicate to serialize competing mutations.
4. Update status, `version=version+1`, `updatedAt` and action timestamps. Preserve historical timestamps in append-only events; never overwrite past resolution cycles.
5. Persist related records, a RequestStatusHistory row, critical AuditLog and required Notification rows in the same transaction. A failed write rolls everything back.
6. Commit, then dispatch persisted follow-up jobs. Provider calls never hold a database transaction open.

Cancellation sets canceledAt/reason, invalidates pending references/runs, ends the active assignment interval, freezes SLA with stopReason=CANCELED and suppresses future SLA warnings. An active/queued intake becomes AiRun CANCELED; clear activeAnalysisRunId and set aiAnalysisStatus=FAILED with safe cancellation metadata if intake had not finished. Keep currentAssigneeId for terminal-history access; it confers no terminal write permission. Pending AiRecommendation may retain status PENDING with `invalidatedAt`/reason; actionable reviews require the current pointer, no invalidation, and PENDING_APPROVAL. Acceptance metrics exclude invalidated/unreviewed records.

Terminal states have no outgoing state edges. Generic messages cannot bypass transitions. CLOSED allows feedback and reader-specific notification acknowledgments; an authorized failed-summary retry is an artifact-only exception, not a business mutation. CANCELED allows reads only. System summary completion on RESOLVED/CLOSED stores an artifact only, never changes request status/version or human facts.

## Non-transition commands

These reauthorize and audit but do not produce a status-history edge: TRIAGED manual-draft edit, generic message append, IN_PROGRESS checklist edits, manager reassignment/priority edits in ASSIGNED/IN_PROGRESS/WAITING_USER, closed feedback, AI artifact generation, notification read. Request-domain edits increment request version; notification read and artifact-only telemetry do not. Manual submit and AI recommendation publication do transition through the table above.

Reanalysis only starts from NEW. To retry a failed recommendation, remain TRIAGED and run recommendation synthesis again; never regress an assigned request to AI_ANALYZING. START_AI_ANALYSIS stores activeAnalysisRunId and the post-transition request version as the run's contextVersion. Successful output must match that snapshot. If a message changes version, discard the old output as STALE_CONTEXT. Failure cleanup locks the latest request and may execute FAIL_AI_ANALYSIS using its current version only when state is still AI_ANALYZING and activeAnalysisRunId still matches; this preserves the new message and safely restores NEW instead of leaving a stuck run. Clear the active pointer on completion/failure. If another state/run won, store telemetry only and do not transition.

USER_REOPEN clears currentResolutionId/resolvedAt and cancels QUEUED/RUNNING summary jobs for that prior resolution, preserving their history. Prior successful summaries remain historical. This frees the per-request active summary slot and prevents an old result from attaching to a later resolution cycle. Confirming CLOSED retains currentResolutionId, so a matching post-commit summary can still finish without changing state.

## Recovery and concurrency

- Worker crash: durable run lease/deadline expires; a recovery command fails a matching active intake through FAIL_AI_ANALYSIS using the locked current version as above. Recommendation jobs fail without leaving TRIAGED. No automatic unbounded rescheduling.
- Concurrent cancel/completion: only one conditional version update commits. Canceled request cannot be resurrected by model output.
- Double approval: only one pending reference/version can be consumed; second returns 409 with no duplicate side effects.
- Reassign versus staff action: old staff is checked inside the committing transaction and loses access if reassignment wins.
- Source disable/reindex versus approval: approval verifies current source generation/availability under consistent locks; unavailable evidence blocks accept.
- Repeated internal event delivery: uniqueness of run completion/history event key makes a replay a no-op or conflict, never a second transition.

## Acceptance and dependencies

M3 implements/test every edge using manual facts; M4 implements AI completion/failure; M6 recommendation publication; M7 human review; M8 full Copilot/summary. Unit coverage enumerates all states/actions/roles and denies the complement. Real-DB tests prove rollback, concurrent approval, cancellation races, reopen, timestamp integrity, assignment access changes and SLA effects. See [TEST_STRATEGY](TEST_STRATEGY.md).
