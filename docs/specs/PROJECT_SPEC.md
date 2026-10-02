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
| A11 | Every mutation of versioned Request business data requires expectedVersion and increments version; existing message/checklist/workflow commands retain that contract. Stale analysis/recommendation cannot overwrite newer decisions. Idempotent processing uses persisted run/event identifiers. M18's separately authorized append-only child notes insert no Request data and do not require/increment its version. | §6, M3.3, M7 tests; DATABASE_SPEC; V1.3 M18 amendment |
| A12 | Candidate ranking uses skill (60/85) and workload (25/85) only; no history score until supported by measured data. All required skills, active team membership and availability are hard filters. | §26, M6.3, optional scope §45; TOOL_CALLING_SPEC |
| A13 | A recommendation with no verified SOP sources may enter review as INSUFFICIENT_EVIDENCE with no procedural actions. AI accept is disabled; manager may modify with a human-authored plan/reason or reject and triage manually. | §4, M4.6, M5/M6, §24; AI_BEHAVIOR_SPEC |
| A14 | Request text is immutable after creation; information arrives as messages. If title omitted, backend derives a bounded excerpt; AI never overwrites explicit titles. Reanalysis is permitted only in NEW; recommendation regeneration only in TRIAGED. | §8.2, M4.7, §6; API_SPEC |
| A15 | SLA targets are policy-controlled, not freely editable per request. Manager priority changes recalculate the target from active policy without resetting elapsed time. MANAGER reassigns only open assigned work, with an audit reason. | §2.1, M7.1 “if editable”, §27; SLA_SPEC |
| A16 | Feedback is one immutable rating 1–5 plus optional comment per CLOSED request by its owner. STAFF may edit/complete checklist items only while IN_PROGRESS; resolve requires all required items completed or explicitly waived with reason. | M8; BUSINESS_WORKFLOW |
| A17 | Persistent AiRun/knowledge work is polled by a bounded API worker with recovery leases; no Redis or external queue is required in V1. Provider outages do not break manual workflow. | local target, optional dependencies; ARCHITECTURE |

## Remaining implementation validations

M1 must verify compatible package/runtime/container versions, actual Ollama connectivity and installed model names. M4 must verify Vietnamese model behavior. M5 must probe embedding dimension and validate retrieval before selecting/indexing a model. M9 must measure quality/latency/benchmark; no numeric quality success is claimed here. These are explicit later gates, not unresolved business rules or M0 blockers.

## Acceptance

### Authorized V1.3 roadmap and M18 amendment (2026-10-02)

The initial user request establishes [V1_3_MASTER_PLAN](../v1.3/V1_3_MASTER_PLAN.md) as authority for M18–M24: Internal Notes → Mentions + Watchers → Response & Checklist Templates → Rule-based Routing → Reminder + SLA Escalation → Saved Views & Filters → Release Hardening & Closure. Theme: Operational Collaboration & Workflow Productivity. **Only M18 is authorized now**. After accepted M18 verification, the subsequent [checkpoint closure authorization](../v1.3/M18_CHECKPOINT_CLOSURE.md) permits one reviewed commit and push of feat/v1.3-internal-notes only. Stop before M19; no main merge, tag, deployment or developer DB migration. V1.2 remains released as `v1.2.0` / `31b445caf07dad606601a1e38e8ed39836d9f825`; preserve historical tags and evidence.

M18 adds private append-only plain-text RequestInternalNote children for authorized STAFF/MANAGER within current scope. USER receives neither notes, counts nor activity metadata. Notes and their resource-only safe audits never enter requester history, AI/RAG/recommendation/Copilot, analytics or notifications. Reads include terminal history; creation follows existing message policy (through RESOLVED, CLOSED/CANCELED read-only). No Request status/version/updatedAt/assignment/SLA/approval/resolution/checklist mutation. A11 is explicitly narrowed for this child insertion; no existing versioned command is bypassed. [M18 plan](../v1.3/M18_INTERNAL_NOTES_IMPLEMENTATION_PLAN.md) owns implementation decisions and [verification](../v1.3/M18_INTERNAL_NOTES_VERIFICATION.md) records measured results. Mentions/watchers and M19–M24 features remain NOT STARTED; V1.3 is IN DEVELOPMENT.

### Authorized V1.2 amendment — M14 Recommendation V2 (2026-09-30)

The subsequent [user-supplied M14 specification](../v1.2/M14_RECOMMENDATION_V2_SPEC.md) adds structured grounded advisory recommendations, real evidence excerpts, missing questions/impact, one existing workflow next step and a short sourced checklist. It supersedes A13 only for recommendation.v2: ACCEPTED is agreement, including an explicitly acknowledged insufficient artifact, and never executes a business plan. V1 publication/review and its A13 approval guards remain versioned historical behavior. V2 generation and all three reviews leave Request status/version, assignment, SLA, checklist and business notifications unchanged; manager uses the existing explicit manual draft/submit/approval flow to apply a plan. Current MANAGER access remains, STAFF sees approved business results. No confidence/probability/composite score, new role/action, provider/model change or autonomous operation. The [frozen plan](../v1.2/M14_RECOMMENDATION_V2_IMPLEMENTATION_PLAN.md) documents bounds and the one nullable legacy-confidence migration. The [V1.2 index](../v1.2/README.md) records authorization chronology; prior milestone evidence is not rewritten. M14 work remains uncommitted for review; M15–M17 NOT STARTED.

### Authorized V1.2 amendment — M11/M12 only (2026-09-30)

The M11/M12 request authorized full-scope role-isolated aggregate dashboards and normalization/exposure/testing of the existing deterministic SLA engine. No new role, state, AI capability, infrastructure, or visual design was introduced. Preserve all V1 invariants. At that checkpoint M13 analytics V2 and later milestones were unauthorized. KPI definitions and overlap, half-open Vietnam day boundaries, additive API fields and acceptance evidence are in [the implementation plan](../v1.2/M11_M12_IMPLEMENTATION_PLAN.md) and [verification](../v1.2/M11_M12_VERIFICATION.md). No V1.2 release tag or main merge is authorized.

Existing analytics' SLA counters use the same canonical SQL clock and exclude canceled instances as a compatibility correction to A05, not an analytics V2 implementation. Other analytics behavior is unchanged.

### Authorized V1.2 amendment — M13 Analytics V2 (2026-09-30)

The subsequent explicit M13 request authorizes operational analytics over time on the existing manager analytics page and endpoint: calendar presets/custom range, current approved priority/status/team/category filters, request/resolution/closure trends and distributions, canonical completion SLA, reopen cohort, immutable feedback, explicit manager decisions and persisted six-action Copilot usage. Metrics and denominator/time definitions are owned by [M13 plan](../v1.2/M13_ANALYTICS_V2_IMPLEMENTATION_PLAN.md); implementation must use real PostgreSQL aggregates, null for empty averages/rates and separate synthetic development evaluations. No new schema, AI capability/action, classifier, role, infrastructure or synthetic quality score. M14–M17 are not authorized. Leave changes reviewable without commit/push/tag/merge. Historical M9 and M11/M12 evidence remains unchanged; [M13 verification](../v1.2/M13_ANALYTICS_V2_VERIFICATION.md) records current results.

M0 passes only with all required documents and no unresolved cross-document business/security conflict. M1 is ready to be authorized once that gate passes. Competition readiness requires every M1–M10 gate, including actual runtime, security, AI, RAG, browser and demo evidence; see [IMPLEMENTATION_PLAN](../IMPLEMENTATION_PLAN.md) and [TEST_STRATEGY](TEST_STRATEGY.md).
