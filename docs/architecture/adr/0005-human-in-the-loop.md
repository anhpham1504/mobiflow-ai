# ADR 0005: Mandatory human control of business decisions

Status: Accepted for V1 at M0 (2026-09-28).

## Context

AI recommendations can be wrong, stale or incomplete. Master-plan §2, M3/M6/M7/M8 and §37 makes manager approval and owner confirmation mandatory while requiring a manual workflow when AI is absent.

## Decision

Only MANAGER accepts/modifies/rejects a pending AI or manual review. Apply team/staff/priority/policy/checklist through a single versioned domain transaction with assignment, SLA, history, notification and audit. Store original recommendation separately from final decision/diff. Manual triage submits a real manual draft and requires an explicit approval action, without a fabricated AI recommendation. Reject returns to TRIAGED.

Only current assigned STAFF performs work/resolve; only owning USER confirms CLOSED or reopens RESOLVED. No model confidence threshold or failure fallback can auto-approve, force URGENT, assign or close. Same manager may prepare and approve a manual draft because V1 contains no dual-manager separation workflow.

## Alternatives and consequences

Automatic high-confidence assignment risks unauthorized changes and violates the contract. Client-side-only controls are bypassable. Human control adds a review step but provides traceable accountability and measured acceptance/modification/rejection. Concurrency, stale sources and changing eligibility must block outdated approval atomically.

## Verification and scope

M3 proves AI-independent manual approval/lifecycle; M6 proves no preapproval side effects; M7 proves stale/double approval prevention and original/diff preservation; M8 owner confirmation/reopen; M10 bypass tests. See [BUSINESS_WORKFLOW](../../specs/BUSINESS_WORKFLOW.md) and [REQUEST_STATE_MACHINE](../../specs/REQUEST_STATE_MACHINE.md).
