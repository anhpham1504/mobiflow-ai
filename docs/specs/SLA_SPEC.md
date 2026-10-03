# SLA Specification

Authority: master-plan §5.11, M3.7, M8.4–M8.5 and §27. Assumptions A05/A08/A15 in [PROJECT_SPEC](PROJECT_SPEC.md). All times use UTC instants; UI displays Asia/Ho_Chi_Minh. SLA uses continuous elapsed time, not a business-hours calendar.

## Policy selection and approval

Choose an active exact `(category,priority)` policy, else the active fallback `(null,priority)`. Exactly one active policy per key. Missing policy blocks approval with 422; never guess a target. Target is an integer 1–10,080 minutes; seed values below are synthetic demo choices, not enterprise commitments.

| Fallback priority | targetMinutes |
|---|---:|
| LOW | 480 |
| MEDIUM | 240 |
| HIGH | 120 |
| URGENT | 60 |

Manager-approved priority selects the policy. AI's suggestedSlaMinutes must exactly match the retrieved policy for its suggested category/priority, and is advisory. Per-request arbitrary SLA-minute overrides are not supported. Approval rechecks active policy and copies policy ID/version/target into the SlaInstance. Later policy edits do not retroactively affect requests.

## Clock lifecycle

One SlaInstance per assigned request. Start at the first successful APPROVE_AND_ASSIGN commit time, not creation/AI analysis/review time. `startedAt` is immutable. `targetSeconds=targetMinutes*60`; persist the snapshot. At start, dueAt=startedAt+targetSeconds.

- IN_PROGRESS and ASSIGNED consume time.
- WAITING_USER sets pausedAt. Resume adds `(resumeAt-pausedAt)` to totalPausedSeconds and clears pausedAt; no double-pause or double-resume.
- RESOLVED sets resolvedHoldAt and freezes the assessment at that instant. Confirmation wait consumes no budget. Reopen adds `(reopenAt-resolvedHoldAt)` to totalResolvedHoldSeconds and clears the hold, retaining the original budget and all previously consumed time.
- CLOSED finalizes without consuming confirmation time; preserve the resolution assessment.
- CANCELED sets stoppedAt and stopReason=CANCELED, closes any open pause/hold and retains historical breach evidence. No extra SLA enum is introduced; retain the last active assessment (not PAUSED). Exclude canceled instances from fulfillment denominators and future monitoring.
- Reassignment preserves every clock field. Priority change uses a newly selected policy snapshot and revised targetSeconds, preserving startedAt, exclusions and consumed time. Never clear breachedAt; record old/new policy and dueAt in audit.

## Exact calculation

Let `t` be now for running requests, pausedAt during WAITING_USER, resolvedHoldAt during RESOLVED/CLOSED, or stoppedAt for canceled work. Closed exclusion intervals must be accumulated once; an open interval is represented by the frozen t rather than also subtracted.

```text
elapsedSeconds = max(0, t - startedAt - totalPausedSeconds - totalResolvedHoldSeconds)
remainingSeconds = targetSeconds - elapsedSeconds
dueAt = startedAt + targetSeconds + totalPausedSeconds + totalResolvedHoldSeconds
```

Normalize each SLA clock instant to integer Unix seconds (floor milliseconds/1000) before subtracting or accumulating intervals; persist all SLA deadlines/clock boundaries at that same second precision. Other audit timestamps may retain milliseconds. This avoids accumulating inconsistent fractional rounding across pauses. While paused/on hold, dueAt is the frozen forecast and UI must display paused/awaiting confirmation instead of a ticking overdue countdown. On resume/reopen the exclusion is added and dueAt moves by the excluded duration. On close, preserve the resolution dueAt/elapsed snapshot; do not add a confirmation interval that will never resume.

Evaluate at every relevant mutation and in a bounded scheduler tick (initial interval 30 seconds). Deadline equality is on-time: elapsedSeconds <= targetSeconds; breach occurs strictly after. A delayed scheduler sets breachedAt to the logical first breach instant (`dueAt + 1 second`), not merely its polling time. Priority reduction that creates immediate overrun sets breachedAt at the priority-change time if there was no prior breach.

## Canonical status

| Status | Rule |
|---|---|
| SAFE | Running, no historical breach, remainingSeconds > targetSeconds * riskRatio. |
| AT_RISK | Running, no historical breach, 0 <= remainingSeconds <= targetSeconds * riskRatio. |
| BREACHED | Running/resolved/closed with breachedAt set or elapsedSeconds > targetSeconds. Historical breach remains sticky after priority changes. |
| PAUSED | WAITING_USER; retain breachedAt if it occurred before pause, displayed as an additional historical breach indicator. |
| MET | RESOLVED/CLOSED with elapsedSeconds <= targetSeconds and no historical breach. |

`riskRatio` default 0.20, configurable in (0,1). The status is deterministic; checklist/workload may appear in a narrative but never alter this V1 rule. AI may explain the persisted status; it cannot write it or label it a measured ML prediction.

Before entering WAITING_USER or RESOLVED, assess elapsed/breach at that timestamp so a late pause/resolve cannot erase a breach. Before cancellation, assess at the effective frozen/current time. Reopen from MET recalculates SAFE/AT_RISK/BREACHED using preserved elapsed budget, not a fresh target. If a previous breach exists, reopen remains BREACHED.

## Notifications, audit and failures

M22 supersedes the old monitor warning fan-out: M12 monitor still persists canonical clock assessments in its own locked transaction; protected lifecycle/priority changes retain their original state-machine transaction/audit. M22 never writes the clock. An operational observation, exactly one safe resource-only SYSTEM audit and its eligible Notification rows commit atomically in a separate transaction after Request then SlaInstance locks and canonical reassessment. Clock persistence need not precede the observation; the assessed M12 snapshot is authoritative. Warning delivery failure rolls back observation/audit/delivery without blocking manual workflow.

Preserve one warning per `(slaInstanceId,level,recipientId)` for the instance lifetime, including historical warning rows. Reassignment permits a newly assigned eligible recipient to receive the current warning once; a return to an already-delivered recipient does not resend. Paused, confirmation-held and terminal instances suppress operational delivery. Current role/assignment/scope revalidation also governs legacy SLA notifications.

## M22 operational observation contract (2026-10-03)

The sole dimension is RESOLUTION, keyed by the existing lifetime SlaInstance.id. Pause/resume/reopen/priority edits/reassignment and config changes do not create a cycle. `slaConsumedRatio` belongs to the canonical clock owner; M22 does not reconstruct elapsed/deadline math. Defaults: early consumed ratio0.5, risk/breach enabled,60s cadence,100 items/batch,10s monotonic budget checked between items. Config strictly bounds ratio(0,0.8), cadence30..3600s, batch1..200 and budget1000..30000ms; changing cadence/config creates no delivery identity. Tests inject instants; production obtains database time after locks.

| Highest current level | Stable threshold key | Notification / recipients |
|---|---|---|
| SAFE with consumed>=early ratio | EARLY_REMINDER_PRIMARY | SLA_REMINDER / current active authorized STAFF only |
| Canonical AT_RISK | CANONICAL_AT_RISK | SLA_AT_RISK / current STAFF and active scoped MANAGER |
| Canonical BREACHED, including sticky breach | CANONICAL_BREACH | SLA_BREACHED / same escalation recipients |

Only one level is considered per observation. A disabled highest level suppresses delivery instead of falling back to an obsolete lower level. A first scan already at risk/breach emits only that current event; observedAt is the actual observation and logical deadline/breach remain canonical. No overdue catch-up delivery/backdating. Dedup is `(requestId,slaInstanceId,dimension,eventType,thresholdKey)`; configIdentity is immutable evidence, not part of identity. Persist the canonical state/deadline/elapsed/remaining/target snapshot, safe IDs and audit event ID without customer/note/body/AI text. Existing lifetime Notification uniqueness supplements `(slaAlertId,recipientId)` for upgrade continuity.

One durable ascending UUID keyset cursor/version with compare-and-swap advances across successes, dedup and item failures; a failed item retries next sweep. Wrap to start on exhaustion; an exactly full last batch needs one empty tick. With N unchanged candidates and no time-budget exhaustion, coverage is ceil(N/batchSize)+1 ticks. Budget is checked between transactions (maxWait3s/transaction5s), not a hard wall-clock deadline. Managers are discovered once/batch with explicit100-manager bound (overflow safely fails the tick); current eligible identities are locked/rechecked per item in bulk. No per-recipient query. Failures have safe aggregate codes/status and do not alter core readiness. No public scheduler trigger/status endpoint. [Plan](../v1.3/M22_REMINDER_SLA_ESCALATION_IMPLEMENTATION_PLAN.md), [verification](../v1.3/M22_REMINDER_SLA_ESCALATION_VERIFICATION.md).

The DB time is authoritative; inject a test clock for unit tests. A missed poll is recoverable by recomputation, not accumulated drift. Invalid/negative duration/configuration blocks the operation and logs a safe error; it does not silently reset the clock. A DB failure rolls back the surrounding state action.

## Worked acceptance cases

- HIGH 120-minute assignment at 09:00, pause 09:30–10:00: due 11:30. Resolve 11:00 consumes 90 minutes and is MET.
- Reopen that request at 12:00 adds a 60-minute resolution hold: due 12:30, 30 minutes remain. Resolve by 12:30:00 is MET; at 12:30:01 it is BREACHED.
- HIGH running with 24 minutes remaining is AT_RISK at the 20% boundary. Zero remaining remains AT_RISK; one second over is BREACHED.
- Changing HIGH 120 to URGENT 60 after 75 active minutes immediately breaches; later increasing target cannot erase breachedAt.
- Cancel during a pause stops processing, preserves exclusions/history and is absent from MET/BREACHED rate denominators.

Dependencies: state machine, transactional assignment, policies, notifications and audit (M3 initial clock; M8 monitoring). Test boundaries, multiple waits/reopens, scheduler delay, sticky breach, reassignment, policy edits, cancel, retry/dedupe and concurrent state changes with real DB integration.

## M12 canonical read contract (2026-09-30)

`sla-clock.ts` supplies shared elapsed-budget math, ordered state rules and `SLA_RISK_RATIO=0.2`; `sla-sql.ts` compiles those rules for DB aggregates. Scalar views, dashboard SQL, scheduler and the existing analytics SLA counters use this same engine; reads do not mutate status, audit or notification data. Runtime reads/monitoring use DB time; tests inject UTC instants without sleeps. Persisted timestamps/exclusions still belong to state-machine transactions.

The additive DTO uses state/deadlineAt aliases alongside status/dueAt, and exposes completedAt=resolvedHoldAt, breachedBySeconds=max(0,-remainingSeconds), riskThresholdSeconds=targetSeconds*0.2, totalPausedSeconds. A sticky breach with a later increased target remains BREACHED even with zero current overrun. PAUSED visibly retains any historical breach. Closed/canceled clocks never age; cancellation is displayed as stopped and does not enter dashboard risk or analytics fulfillment denominators.

Repeated pause does not replace the original pausedAt; repeated resume/reopen does not accumulate exclusions again. Lifecycle mutations reject backwards boundary time; negative/noninteger exclusions, invalid target/date/risk configuration fail rather than reset. The existing state machine still rejects invalid state/actions and stale expectedVersion before any transactional side effect. UI formats durations/text/colors only and never applies the removed 30-minute risk rule. No AI override, new state, business-calendar policy or M13 feature is introduced.

## M13 completion analytics projection (2026-09-30)

M13 reuses these unchanged canonical SQL expressions. Eligible fulfillment samples are matching currently RESOLVED/CLOSED requests with current effective resolvedAt in the selected half-open Vietnam calendar period and a valid completed SlaInstance. Missing/malformed timestamps, negative exclusions, an assignment start before request creation, canceled stops and reopened active work are excluded. MET + BREACHED = eligible; compliance=MET/eligible, null if empty. Deadline equality and sticky historical breach retain M12 behavior. AverageResolutionSeconds is canonical SLA-effective elapsed, from first assignment less WAITING_USER and prior confirmation holds; separate averageWallClockResolutionSeconds includes creation/preassignment/waits. Activity resolvedCount uses immutable resolution history and therefore can exceed this current-completion population. No clock/lifecycle/status writer changes or M14 capability.
