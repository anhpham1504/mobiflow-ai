# Auto-routing authority discovery

Date: 2026-10-29
Baseline: `c33a6dd5fd362787a3b427ad0d3e33bf3260bac5` / tree `a2ad6c27be2e0417865632e3aa42aa747d38c22c`
Candidate branch: `feat/v1.4.1-hybrid-auto-routing`

## Discovery checkpoint

- Current flow: USER creation queues `ANALYSIS`; `AnalysisWorker` executes DeepSeek plus RAG; `RequestStateMachineService.finishAnalysis` validates/persists the analysis and moves `AI_ANALYZING -> TRIAGED`; a MANAGER can request a separate recommendation and apply a protected manual/approval flow; `RequestStateMachineService.transition` alone creates Assignment/SLA/checklist/history/audit/notification records.
- Authority map: there is one canonical mutation owner, `RequestStateMachineService`. No competing assignment or state writer was found. The M21 `RoutingService` is read-only and only recommends a Team.
- Schema reuse: Request, AiRun, AiAnalysis, Assignment, SlaInstance, AuditLog, Notification, Team, TeamMember, Skill, StaffSkill and existing JSON decision snapshots are sufficient. No new status or column is required.
- Available routing facts: persisted validated `AiAnalysis.category`, `subcategory`, `prioritySuggestion`, missing fields and the analysis run's RAG evidence status/citations. Required skill and default team are deterministic taxonomy projections from the validated category/subcategory, not LLM-selected identifiers.
- Staff eligibility source: shared `eligibleStaffPredicate()` plus `ai/tools/staff.candidates()`; both enforce active TeamMember, active Team, active STAFF account, `available=true`, and complete required-skill membership.
- Availability rule: persisted `User.available=true`; there is no online/presence/shift model. `ONLINE_PRESENCE_NOT_IMPLEMENTED`.
- Workload definition: active requests where `currentAssigneeId=staffId` and status is `ASSIGNED`, `IN_PROGRESS` or `WAITING_USER`. The existing aggregate/subquery excludes RESOLVED/CLOSED/CANCELED.
- State transition plan: after a successful grounded analysis, a system-only state-machine operation locks the Request, revalidates the exact run/version/facts, evaluates routing rules and eligibility, then atomically writes `TRIAGED -> ASSIGNED`, Assignment, first SLA, status history, safe audit and existing assignment notification. Unsafe cases remain `TRIAGED`, receive a machine-readable review audit and existing manager notification, and remain editable through the existing manual plan flow.
- Migration required: **NO**. Auto-routing provenance is stored in the existing Assignment decision JSON and canonical SYSTEM audit metadata. The legacy required `assignedById` records the authenticated analysis initiator only as provenance; it is not presented as the decision actor. Canonical decision attribution is `AuditLog.actorType=SYSTEM`, `action=REQUEST_AUTO_ASSIGNED`, `routingSource=AUTO_ROUTING`.
- Likely files: routing evaluator/service, a focused AutoRoutingService, RequestStateMachineService, AnalysisWorker, request query/contracts, small request-detail/analysis copy, unit/integration tests, and v1.4.1 docs/evidence.
- Tests: deterministic routing unit tests; real PostgreSQL assignment/review/concurrency/RBAC/SLA/audit tests; existing full unit/integration/build suites; role journeys and responsive/accessibility checks.
- Principal risks: stale analysis/run, weak RAG, routing-rule conflict, no active Team/SLA policy/staff, concurrent routing, legacy Assignment attribution shape, UI exposing workforce details, and accidental v1.4.0 mutation. Each fails closed to Manager review or conflict; workforce facts remain backend-only.

## Authority map

| Feature | Canonical owner | Transaction / authorization boundary | Existing proof |
|---|---|---|---|
| Request state transitions | `apps/api/src/requests/request-state-machine.service.ts` | Row lock, expected version, domain transaction | `transition-rules.ts`, workflow tests |
| Initial assignment and reassignment | `RequestStateMachineService` | Same Request transaction; eligibility recheck | `APPROVE_AND_ASSIGN`, `REASSIGN` branches |
| Approval and applied priority | `RequestStateMachineService` | MANAGER command, current review identity/version | recommendation/workflow integration tests |
| Team routing rules | `apps/api/src/routing/routing.service.ts` and `routing-evaluator.ts` | MANAGER-only public management; read-only repeatable evaluation | M21 routing tests |
| Team/staff eligibility | `eligibleStaffPredicate()` | Database facts, active team membership and STAFF role | workflow/recommendation integration tests |
| Skills and workload | `apps/api/src/ai/tools/staff.ts` | Local PostgreSQL only; bounded deterministic ranking | recommendation tests |
| Availability | `User.available` | Rechecked at assignment | workflow/recommendation tests |
| SLA | `RequestStateMachineService` plus `sla-clock.ts` | First assignment transaction; canonical clock | SLA unit/integration tests |
| Audit and notifications | `RequestStateMachineService` | Atomic with protected mutation | workflow tests |
| AI analysis persistence | `RequestStateMachineService.finishAnalysis` | Validated schema, run/version/source checks | analysis/RAG tests |
| RAG retrieval and provenance | `KnowledgeRetriever`, `rag-output.ts` | Retrieved source membership and live-generation validation | knowledge/RAG tests |
| Recommendation | `RecommendationService` | Advisory artifact; no direct business mutation in V2 | recommendation-v2 tests |
| Checklist | `RequestStateMachineService` | Assigned STAFF/version/state checks | workflow/Copilot tests |

## Flow map

`RequestsController/create -> RequestStateMachineService.create -> AiRun(ANALYSIS) -> AnalysisWorker -> KnowledgeRetriever + executeAnalysis -> RequestStateMachineService.finishAnalysis -> TRIAGED`.

The v1.4.1 insertion point is immediately after successful `finishAnalysis`: `AnalysisWorker -> RequestStateMachineService.autoRouteAnalysis -> AutoRoutingService.evaluate (read-only within the state-machine transaction) -> ASSIGNED or Manager-review audit`.

Frontend transport remains the existing request detail/list APIs and normal STAFF work queue. No workforce profile, workload table, private ID list or staff email is sent to DeepSeek or exposed to USER.

## Authority conclusion

`V1_4_1_AUTO_ROUTING_BLOCKED_AUTHORITY_AMBIGUITY` does not apply. The new owner authorization changes the ordinary initial-assignment policy, but it does not create a second mutation owner: all protected writes remain in `RequestStateMachineService`.
