# Hybrid AI auto-routing design

## Problem and goal

The accepted v1.4.0 path requires a Manager to perform every initial assignment. v1.4.1 should automatically assign an ordinary, grounded and unambiguous request while keeping AI advisory, workforce selection local and Manager control intact.

## Non-goals

No continuous re-routing, online presence, shift scheduling, capacity forecasting, learned ranking, new AI provider/vector store, broad UI redesign, automatic priority application, automatic checklist completion, resolution or closure.

## Architecture

`DeepSeek analysis -> PostgreSQL lexical RAG -> validated AiAnalysis -> deterministic routing facts -> AutoRoutingService -> RequestStateMachineService transaction -> Assignment/SLA/audit/notification`.

AI never emits or persists a staff ID. The existing analysis category/subcategory are the only model-derived routing inputs. Required skills and the default team code are deterministic application mappings. Active routing rules can select a Team; a same-priority Team conflict or invalid target requires Manager review.

## Inputs and gates

Auto-assignment requires all of the following:

- the exact analysis run succeeded and is still the Request's latest analysis;
- Request is still TRIAGED at the expected version;
- RAG evidence is `SUFFICIENT` with a validated citation;
- category/subcategory is supported and not `OTHER/UNSPECIFIED`;
- routing rules do not conflict or point to an invalid target;
- the selected Team is active;
- an active, available STAFF member has active membership in that Team and every required skill;
- a canonical SLA policy exists for the AI category and current applied Request priority;
- the assignment transaction can lock/revalidate current facts.

Missing operational fields such as location/time do not become model defaults. They remain visible to STAFF, who can use the existing information-request/WAITING_USER flow. Missing *routing* facts, weak grounding, ambiguity or missing eligibility always requires Manager review.

## Workload and deterministic selection

Workload is the count of current assignments in `ASSIGNED`, `IN_PROGRESS` and `WAITING_USER`. Hard eligibility is evaluated before ranking. Candidate order is lowest active workload, then lexical staff UUID. Existing score components remain explainability metadata; no random ordering or history/experience claim is used.

## State machine and persistence

No `AUTO_ROUTING` database status is introduced. A successful system operation moves `TRIAGED -> ASSIGNED` atomically and creates the same first SLA and `REQUEST_ASSIGNED` notification as manual assignment. The applied priority remains the Request's current domain priority; `prioritySuggestion` stays visibly advisory.

An unsafe decision leaves the Request in TRIAGED, records `AUTO_ROUTING_REVIEW_REQUIRED`, and notifies active Managers through the existing notification subsystem. The existing Manager plan/approval path then owns the human assignment. Re-running on ASSIGNED is a no-op/conflict and cannot replace a Manager override. There is no automatic later reassignment.

## Audit and explainability

Safe machine-readable metadata includes routing source, outcome, category/subcategory, AI priority suggestion versus applied priority, required skill codes, selected Team/STAFF IDs, bounded candidate count, selected workload, reasons and request version. It excludes prompts, request body, emails, personal details and full workload tables.

Manager UI may show the safe routing explanation. USER receives only generic workflow status; STAFF receives the normal assignment and optional auto-routing source label.

## Failure behavior

Expected domain outcomes produce Manager review rather than a failed request. Unexpected technical failure leaves the request unassigned/recoverable and records a sanitized review-required audit in a separate safe transaction where possible. AI or RAG failure follows the existing analysis failure path and never invokes routing with fabricated defaults.

## Security boundary

DeepSeek receives only the existing bounded request/RAG context. Team membership, skill mappings, candidate IDs, availability and workload never leave the backend database boundary. Existing request RBAC remains unchanged; USER cannot read routing internals.

## Known limitations

- `User.available` is administrative availability, not live presence.
- Workload balancing is deterministic count balancing, not advanced fairness or capacity optimization.
- Initial auto-assignment only; later availability changes require Manager reassignment.
- The legacy Assignment schema requires `assignedById`; v1.4.1 retains the authenticated analysis initiator as provenance while the canonical audit identifies SYSTEM as the decision actor and `AUTO_ROUTING` as the source.
