# Project Specification

Status: frozen V1 contract at M0, 2026-09-28. Authority: master-plan sections 1–3, 11 and 29–46; the [M0 execution request](../reference/M0_EXECUTION_PROMPT.txt) limits this delivery to M0. All behavior below is specified for future implementation, not claimed to run today.

## Product and success criteria

MobiFlow AI converts a Vietnamese natural-language service request into structured intake, sourced knowledge, controlled recommendations, a manager decision, staff work, resolution and measured outcomes. It must prove understanding, extraction, real RAG, business-tool recommendations and human-approved execution. The competition target is before 10 October 2026; timing never waives gates.

Actors are exactly `USER` (requester), `STAFF` (assigned worker), `MANAGER` (operations manager). `SYSTEM` and `AI` are internal/audit actor types with no accounts or login privileges. V1 is one synthetic organization on a Windows 11 laptop with Docker Desktop and host Ollama, capable of runtime operation without Internet once images, packages, models and documents are prepared.

## Scope

Included: authentication/session revocation, RBAC/ownership, request lifecycle and conversations, manual triage, AI intake, PDF/TXT knowledge ingestion, pgvector retrieval, similar cases, deterministic staff ranking, manager accept/modify/reject, assignment history, checklist, six constrained Copilot actions, SLA pause/resume/risk, factual AI resolution summary, owner confirmation/reopen, closed-request feedback, in-app notifications, audits, measured analytics/evaluation, reproducible synthetic demo and competition documentation.

Technology: npm workspaces; `apps/web` Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, React Hook Form, Zod, TanStack Query, Lucide and necessary Recharts charts; `apps/api` NestJS, Prisma, REST/OpenAPI; one PostgreSQL + pgvector; Ollama LLM and embedding provider adapters. No dependencies are installed in M0.

Optional items remain outside the required V1 delivery: request attachments, DOCX ingestion, extra filters/charts, dark-mode polish, historical-experience ranking and a Dockerized Ollama profile. Add them only after their owning required gate passes and without endangering the core flow. RequestAttachment remains a reserved domain entity; no upload route/UI is promised for request attachments. PDF/TXT knowledge uploads are mandatory.

## Non-goals (complete frozen list)

Native mobile app; voice AI; realtime speech recognition; computer vision; custom model training; fine-tuning; multi-agent swarm; autonomous open-ended agent loop; drag-and-drop workflow builder; full CRM; billing product; SMS; Zalo; external email automation; multi-tenant SaaS; real customer data; production cloud deployment; SSO; LDAP; Kubernetes; Elasticsearch; separate vector database; event streaming platform; blockchain; complex predictive ML; public marketplace; more business roles than USER/STAFF/MANAGER. Handling a billing-discrepancy request is in scope; implementing billing/payment operations is not.

## Global invariants

- The backend owns permissions, canonical data, state transitions and clocks. UI hiding and model instructions are never authorization.
- AI artifacts are suggestions until an authorized human decision. Actual request priority starts `MEDIUM`; no suggested priority, including `URGENT`, changes it before manager approval.
- Only owning USER closes or reopens a resolved request. No automatic closure, including timeout-based closure.
- No hard deletion of requests/users or role-management UI/API in V1.
- Every critical mutation is atomic with its audit. Human and AI provenance remain distinguishable.
- Missing facts stay null; no fabricated sources, identifiers, confidence, events, tool results or benchmark numbers.
- Defaults below are engineering/demo decisions, not company policy, measured outcomes or requirements inferred from a real organization.

## Assumption and clarification register

These choices resolve unspecified implementation details without adding product capabilities. References identify the master-plan authority and the owning specification. Change through an explicit documented amendment, not scattered implementation guesses.

| ID | Ambiguity and frozen interpretation | Basis / owner |
|---|---|---|
| A01 | Manager scope is the single V1 synthetic organization; all its requests. Team membership limits staff eligibility, not manager scope. No tenant machinery. | §2.1, §2.4; AUTHORIZATION_SPEC |
| A02 | USER can cancel own NEW/AI_ANALYZING/TRIAGED/PENDING_APPROVAL. MANAGER can also cancel ASSIGNED/IN_PROGRESS/WAITING_USER. RESOLVED is handled by confirm/reopen; CLOSED/CANCELED are terminal. Cancellation needs a reason. | §2.2, §6; REQUEST_STATE_MACHINE |
| A03 | Manual flow is NEW → TRIAGED → PENDING_APPROVAL → ASSIGNED. Manager explicitly submits a manual draft and explicitly approves it; no fake AiRun/recommendation. Same manager may prepare and approve: no second-manager role/workflow is specified. | M3.4, M3 gate, mandatory HITL; BUSINESS_WORKFLOW |
| A04 | Reject returns PENDING_APPROVAL → TRIAGED, preserving the original suggestion and rejection. A new draft or new run is required for resubmission. | M7.4; REQUEST_STATE_MACHINE |
| A05 | SLA starts on first assignment, pauses in WAITING_USER, freezes during RESOLVED confirmation wait, and resumes remaining original budget on reopen. Reassignment/priority edits never reset it. Canceled work is excluded from met/breached denominators. | M3.7, §27; SLA_SPEC |
| A06 | Canonical demo outage is NETWORK/IOT_CONNECTIVITY; IOT category covers device configuration issues rather than connectivity outages. OTHER/UNSPECIFIED handles ambiguity; preserve both mandated categories. | §4.4 example, M4.4, M10.5; AI_BEHAVIOR_SPEC |
| A07 | Missing location/time is flagged and may reach review; manager must acknowledge missing critical facts, then staff asks USER through WAITING_USER. No invented details or confidence threshold that auto-approves. | M4.6, M8; BUSINESS_WORKFLOW |
| A08 | Operational bounds (payload sizes, timeouts, attempts, rate limits, chunk sizes and synthetic SLA targets) are explicit initial configurable defaults, not performance claims. | §9, §27, §31; API/AI/RAG/SLA specs |
| A09 | Access token stays in memory; rotating refresh credential uses HttpOnly cookie and persisted hash. Demo HTTP allows Secure=false only on localhost. No self-registration or role administration. | §7.1, §9, M2; AUTHORIZATION_SPEC |
| A10 | Ready synthetic SOPs are readable by MANAGER and STAFF; USER sees a progress projection without internal documents or peer cases. STAFF similarity/history is restricted to currently assigned requests. Internal intake service has bounded organization-wide read context; its output is manager-only until filtered for a reader. | §2.1, M8 tests; AUTHORIZATION_SPEC / TOOL_CALLING_SPEC |
| A11 | Every request mutation requires expectedVersion and increments version. Stale analysis/recommendation cannot overwrite newer decisions. Idempotent processing uses persisted run/event identifiers. | §6, M3.3, M7 tests; DATABASE_SPEC |
| A12 | Candidate ranking uses skill (60/85) and workload (25/85) only; no history score until supported by measured data. All required skills, active team membership and availability are hard filters. | §26, M6.3, optional scope §45; TOOL_CALLING_SPEC |
| A13 | A recommendation with no verified SOP sources may enter review as INSUFFICIENT_EVIDENCE with no procedural actions. AI accept is disabled; manager may modify with a human-authored plan/reason or reject and triage manually. | §4, M4.6, M5/M6, §24; AI_BEHAVIOR_SPEC |
| A14 | Request text is immutable after creation; information arrives as messages. If title omitted, backend derives a bounded excerpt; AI never overwrites explicit titles. Reanalysis is permitted only in NEW; recommendation regeneration only in TRIAGED. | §8.2, M4.7, §6; API_SPEC |
| A15 | SLA targets are policy-controlled, not freely editable per request. Manager priority changes recalculate the target from active policy without resetting elapsed time. MANAGER reassigns only open assigned work, with an audit reason. | §2.1, M7.1 “if editable”, §27; SLA_SPEC |
| A16 | Feedback is one immutable rating 1–5 plus optional comment per CLOSED request by its owner. STAFF may edit/complete checklist items only while IN_PROGRESS; resolve requires all required items completed or explicitly waived with reason. | M8; BUSINESS_WORKFLOW |
| A17 | Persistent AiRun/knowledge work is polled by a bounded API worker with recovery leases; no Redis or external queue is required in V1. Provider outages do not break manual workflow. | local target, optional dependencies; ARCHITECTURE |

## Remaining implementation validations

M1 must verify compatible package/runtime/container versions, actual Ollama connectivity and installed model names. M4 must verify Vietnamese model behavior. M5 must probe embedding dimension and validate retrieval before selecting/indexing a model. M9 must measure quality/latency/benchmark; no numeric quality success is claimed here. These are explicit later gates, not unresolved business rules or M0 blockers.

## Acceptance

### Authorized V1.2 amendment — M11/M12 only (2026-09-30)

The current request authorizes full-scope role-isolated aggregate dashboards and normalization/exposure/testing of the existing deterministic SLA engine. No new role, state, AI capability, infrastructure, or visual design is introduced. Preserve all V1 invariants. M13 analytics V2 and later milestones remain unauthorized. KPI definitions and overlap, half-open Vietnam day boundaries, additive API fields and acceptance evidence are in [the implementation plan](../v1.2/M11_M12_IMPLEMENTATION_PLAN.md) and [verification](../v1.2/M11_M12_VERIFICATION.md). No V1.2 release tag or main merge is authorized.

Existing analytics' SLA counters use the same canonical SQL clock and exclude canceled instances as a compatibility correction to A05, not an analytics V2 implementation. Other analytics behavior is unchanged.

M0 passes only with all required documents and no unresolved cross-document business/security conflict. M1 is ready to be authorized once that gate passes. Competition readiness requires every M1–M10 gate, including actual runtime, security, AI, RAG, browser and demo evidence; see [IMPLEMENTATION_PLAN](../IMPLEMENTATION_PLAN.md) and [TEST_STRATEGY](TEST_STRATEGY.md).
