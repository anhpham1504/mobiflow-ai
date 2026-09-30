# Database Specification

Authority: master-plan §5, M2–M9; supporting choices implement the frozen contracts without changing product scope. This is a logical schema, not an applied Prisma migration. PostgreSQL with pgvector in one instance; Prisma for supported types and a parameterized vector repository as required.

## Conventions and invariants

UUID primary keys; timestamptz UTC instants; integer seconds/minutes for deterministic clock math; generated human publicCode unique (format `MF-YYYY-NNNNNN`, sequence allocated atomically, no count+1); text lengths enforced by schemas and suitable DB constraints. `createdAt` defaults to database time; mutable rows carry updatedAt/version where specified. Server controls IDs/actor/timestamps; foreign keys default RESTRICT rather than deleting audit/history through cascades. No business hard-delete routes. Synthetic reset is a separate explicit demo-only command in M10.

Enums are centralized in shared contracts: Role USER/STAFF/MANAGER; RequestStatus exactly the ten states in REQUEST_STATE_MACHINE; Priority LOW/MEDIUM/HIGH/URGENT; RecommendationStatus PENDING/ACCEPTED/MODIFIED/REJECTED; KnowledgeStatus UPLOADED/PROCESSING/READY/FAILED/DISABLED; SlaStatus SAFE/AT_RISK/BREACHED/PAUSED/MET. AuditActorType additionally supports AI/SYSTEM without granting login roles. Category/subcategory pairs follow AI_BEHAVIOR_SPEC.

## Identity and routing entities

| Entity | Fields and relationships | Constraints / query indexes |
|---|---|---|
| User | id, normalized email, passwordHash, displayName, role, active, available (staff), createdAt, updatedAt | Unique email; role enum; index role/active. Never expose hash. Availability defaults true for seeded staff; no scheduling subsystem. |
| RefreshSession | id, userId FK, familyId, tokenHash, createdAt, expiresAt, consumedAt?, revokedAt?, replacedById?, revocationReason? | Unique tokenHash; indexes userId/revokedAt and familyId; no raw credentials; retain consumed hashes until family expiry for replay detection. |
| Team | id, code, name, active | Unique code; four synthetic teams. |
| TeamMember | id, teamId FK, userId FK, active | Unique (teamId,userId); application validates STAFF role for assignable membership. |
| Skill | id, code, name | Unique code; five seeded skills. |
| StaffSkill | staffId FK User, skillId FK Skill | Composite PK; index skillId/staffId; service enforces STAFF. |

## Request and workflow entities

| Entity | Required fields / semantics | Constraints / query indexes |
|---|---|---|
| Request | id, publicCode, createdById FK, title, description, status, category?, subcategory?, priority=MEDIUM, teamId?, currentAssigneeId?, version=1, aiAnalysisStatus (NOT_STARTED/RUNNING/SUCCEEDED/FAILED), activeAnalysisRunId?, latestAnalysisId?, triageDraftJson?, manualDraftRevision, reviewKind? (AI/MANUAL), pendingRecommendationId?, pendingDraftRevision?, currentResolutionId?, createdAt, updatedAt, resolvedAt?, closedAt?, canceledAt?, cancellationReason? | Positive version; unique publicCode. Index (createdById,createdAt,id), (currentAssigneeId,status,createdAt,id), (status,createdAt,id), category/priority, teamId. Category/subcategory both null before approval or a valid pair after it. |
| RequestMessage | id, requestId FK, authorId FK, kind (COMMENT/INFO_REQUEST/INFO_REPLY), body, eventId FK AuditLog, createdAt | Body 1–4000; index (requestId,createdAt,id). No hidden internal-message subtype. |
| RequestAttachment | id, requestId FK, uploadedById FK, originalFileName, storageKey, mimeType, byteSize, sha256, createdAt | Reserved optional schema only; no active V1 upload route. Future use must inherit ownership/size/path rules; storageKey unique. |
| RequestStatusHistory | id, requestId FK, fromStatus?, toStatus, action, actorType, actorId?, requestVersion, eventId FK AuditLog, createdAt | Unique (requestId,requestVersion) for state transitions; creation history null→NEW allowed; index requestId/createdAt. Never update/delete history. |
| Assignment | id, requestId FK, staffId FK, teamId FK, assignedById FK, assignedAt, endedAt?, reason, recommendationId?, decisionKind (AI_ACCEPT/AI_MODIFY/MANUAL/REASSIGN), finalDecisionJson, managerChangesJson?, eventId FK | Partial unique requestId WHERE endedAt IS NULL; index staffId/assignedAt. Decision snapshot includes category/priority, policy ID/version/target, plan, source generation IDs, missing-fact acknowledgment and human rationale. |
| RequestResolution | id, requestId FK, cycle, resolvedById FK, rootCause, resolution, verification, resolvedAt, reopenedAt?, confirmedAt?, eventId FK | Unique (requestId,cycle); immutable staff facts; latest effective resolution referenced by Request. Supporting entity prevents overwriting multiple resolution cycles. |
| Checklist | id, requestId FK, createdById?, provenance (APPROVAL/STAFF), sourceRunId?, version, createdAt, updatedAt | One per request. Explicit human save required for Copilot drafts. |
| ChecklistItem | id, checklistId FK, ordinal, text, required, sourceRefsJson, completedAt?, completedById?, waivedAt?, waivedById?, waiverReason?, createdAt, updatedAt | Unique (checklistId,ordinal); <=30 items via transaction check; completion and waiver mutually exclusive; both clear on an explicit uncheck/unwaive with audit. |
| Feedback | id, requestId FK, userId FK, rating, comment?, createdAt | Unique requestId; rating 1–5 DB CHECK; owner and CLOSED enforced by service transaction. |

Request ownership never changes. category/subcategory/priority/team/staff in Request are approved operational values; triage/analysis suggestions reside in separate artifacts/draft JSON. Queue/filter APIs may explicitly return suggestedCategory as a distinct field before approval. Current assignee remains for terminal-history access; active Assignment interval ends on CLOSED/CANCELED or reassignment. RESOLVED retains the interval so reopen does not create a fake assignment.

## AI, vectors and knowledge

| Entity | Fields / semantics | Constraints / indexes |
|---|---|---|
| AiRun | id, requestId?, resolutionId?, purpose (ANALYSIS/RECOMMENDATION/COPILOT/RESOLUTION_SUMMARY), action?, initiatingActorId?, contextVersion, provider, model, modelIdentityJson, promptVersion, schemaVersion, status (QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELED), startedAt?, finishedAt?, latencyMs?, retryCount, inputSize?, outputSize?, errorCode?, errorSummary?, safeResultJson?, retrievalSnapshotJson?, leaseUntil?, deadlineAt?, createdAt | Partial unique (requestId,purpose) for QUEUED/RUNNING; resolution-summary uniqueness includes resolutionId to prevent duplicate successful summary for a cycle; index requestId/createdAt and status/leaseUntil. Context/output strict schema and bounded. |
| AiAnalysis | id, requestId FK, aiRunId FK unique, intent, category, subcategory, prioritySuggestion, entitiesJson, missingFieldsJson, confidence, reasonSummary, schemaVersion, createdAt | Confidence [0,1]; enum/pair checks; requestId/createdAt index. Immutable successful analysis. |
| AiRecommendation | id, requestId FK, aiRunId FK unique, suggestedPriority, suggestedTeamId?, suggestedStaffId?, suggestedSlaMinutes?, procedureRefsJson, actionsJson, similarCaseAlertJson, evidenceStatus, reasonSummary, confidence, status, reviewedById?, reviewedAt?, managerChangesJson?, finalDecisionJson?, invalidatedAt?, invalidationReason?, createdAt | Index status/createdAt and requestId/createdAt; partial unique requestId WHERE status=PENDING AND invalidatedAt IS NULL; all suggestion fields immutable after publication, review fields append-once. |
| AiToolCall | id, aiRunId FK, ordinal, toolName, safeInputJson, safeOutputSummaryJson, startedAt, finishedAt, latencyMs, status, errorCode?, createdAt | Unique (aiRunId,ordinal); allowlisted names validated before execution; max safe JSON size. |
| KnowledgeDocument | id, title, originalFileName, storageKey, mimeType, byteSize, sha256, status, uploadedById FK, pageCount?, version, activeGeneration?, indexManifestJson, indexedAt?, errorCode?, errorSummary?, leaseUntil?, deadlineAt?, createdAt, updatedAt | Unique sha256/storageKey; index status/createdAt. Immutable generation manifests hold model/dimension/parser/chunker metadata; current pointer promoted atomically. |
| KnowledgeChunk | id, sourceId, documentId FK, generation, chunkIndex, content, contentHash, pageNumber?, section?, startOffset, endOffset, modelIdentity, dimension, embedding vector(D), metadataJson, createdAt | Unique sourceId and (documentId,generation,chunkIndex); nonempty content; pageNumber>=1 or null; index documentId/generation; cosine vector index after actual D validated. Immutable chunk identity. |
| RequestEmbedding | id, requestId FK, contextVersion, modelIdentity, dimension, embedding vector(D), createdAt | Unique (requestId,modelIdentity,contextVersion); compatible latest vector only in similarity queries; cosine index. Supporting entity for M6 real similarity, never fake seed vectors. |

M6 storage refinement: RequestEmbedding also records `inputVersion`, `inputHash` and sanitized `identityJson` (including explicit truncation). Uniqueness includes inputVersion so an explicit embedding-input revision can coexist as immutable history; retrieval selects only its current revision. D=1024 was locally probed. A btree request/version index and HNSW cosine index are provisioned; the small-corpus query remains exact and scope-filtered before ranking. No approximate-index performance claim is made.

AiRun safeResultJson stores typed Copilot/summary outputs where no dedicated business entity is needed. Do not store hidden reasoning, full unsanitized prompts or raw invalid outputs. Optional null model metadata is permitted only before job execution/health discovery; a claimed successful run must record actual provider/model identity. `latencyMs` is measured monotonic elapsed time, never synthesized from a target.

## SLA, notification and audit

| Entity | Fields / semantics | Constraints / indexes |
|---|---|---|
| SlaPolicy | id, category?, priority, targetMinutes, active, version, createdAt, updatedAt | CHECK target 1–10080; separate partial unique active indexes for non-null (category,priority) and null-category priority fallback. |
| SlaInstance | id, requestId FK, policyId FK, policyVersion, targetSeconds, startedAt, dueAt, pausedAt?, totalPausedSeconds=0, resolvedHoldAt?, totalResolvedHoldSeconds=0, stoppedAt?, stopReason?, status, breachedAt?, assessedAt, version | Unique requestId; nonnegative exclusions and positive target; index status/dueAt for open processing; CLOCK equations in SLA_SPEC. |
| Notification | id, recipientId FK, requestId?, eventId FK, type, safeActorMetadataJson, createdAt, readAt? | Unique (recipientId,eventId,type); index (recipientId,readAt,createdAt,id); no confidential cached request excerpt. SLA warnings additionally unique (recipientId,slaInstanceId,warningLevel) when warning fields non-null. |
| AuditLog | id (domain event ID), requestId?, actorType, actorId?, initiatingActorId?, action, resourceType, resourceId, requestCorrelationId, safeBeforeJson?, safeAfterJson?, reason?, outcome, createdAt | Append-only; indexes requestId/createdAt/id and resourceType/resourceId/createdAt; system actor allowed without user ID; no passwords/tokens/raw prompts. |

Status history, messages, assignments and resolutions reference the same eventId for their action; timeline uses AuditLog events plus allowed joined payloads, avoiding double-counting one action. RequestCorrelationId is the HTTP/job correlation ID, distinct from the request entity ID. Audit can contain safe business facts but API projection still filters internal content.

## Transaction and integrity boundaries

- Request creation + initial history + audit + queued analysis when enabled are atomic. Manual triage cancels any QUEUED intake before acquiring its transition; RUNNING intake has AI_ANALYZING and cannot be manually overwritten.
- Approval: lock request/current review and chosen staff/team/policy/evidence generation in stable order, check versions/permissions, consume review, update request, end/create assignment as applicable, create one SLA/checklist, history, audit and notifications. External provider calls occur outside this transaction.
- ReviewKind=AI requires pendingRecommendationId and no manual pending revision; MANUAL requires pendingDraftRevision and no recommendation pointer. Only PENDING_APPROVAL holds an actionable pending reference. Enforce shape constraints plus service FK ownership checks.
- Request currentAssignee/team must agree with current Assignment for open assigned states. USER createdById and STAFF assignment roles verified against live User rows; scalar foreign keys alone cannot enforce role semantics.
- Resolve persists RequestResolution and event, freezes SLA and schedules the summary atomically. Summary retry creates a new failed/successful attempt under the same resolution provenance, never overwrites human facts. Use a unique successful summary per resolution (partial index) and at most one active run. Reopen clears currentResolutionId, cancels obsolete active summary jobs and retains prior resolution rows/artifacts.
- Intake completion validates activeAnalysisRunId and post-start contextVersion. Stale/failing run cleanup locks the current request, verifies the same active pointer/state and uses the latest version to restore NEW without discarding later messages. Completion/failure/cancel clears the pointer; stale jobs with a different current state/run are telemetry-only.
- Cancellation invalidates pending recommendation before leaving review so partial unique constraints do not block later valid work. Stale jobs cannot publish after cancellation or reassignment.
- SLA tick locks/rechecks request state and clock version, computes status, inserts deduplicated warning and audit in one transaction. Priority/reassignment/checklist/message commands use expected request version.
- Auth refresh consumes prior credential and inserts replacement in one transaction. Replay revokes all family records atomically.

## Migration, data access and rollback policy

M1 enables pgvector/infrastructure; M2 implements baseline business schema and constraints. Vector(D) storage/index migration is M5 after a real dimension probe; RequestEmbedding is populated/queried in M6. M2 may stage vector-related tables without an embedding column; do not invent D to satisfy a schema. Every later change has a forward migration; no `db push` replacing migration history for release verification.

App DB principal has required CRUD on business tables but no general DDL; migrations use separate credentials. Append-only audit permissions deny update/delete in normal runtime. Vector SQL binds every value and uses allowlisted identifiers; no interpolation of query text. Paginate lists and bounded joins to avoid unbounded scans/N+1. Migration failure stops the gate; retain data and fix forward, never blindly reset a non-demo database. M10 demo reset verifies explicit demo flag/target and synthetic markers before destructive operations; backup/recovery of local demo data is documented there, not claimed tested now.

## Acceptance

M13 amendment: no schema/index/migration or persisted aggregate table. Six migrations remain unchanged. One bound aggregate statement reads current Request dimensions, immutable RequestResolution cycles, M12 SLA expressions, Feedback, explicit AiRecommendation decisions and persisted AiRun/Copilot action metadata. Daily buckets use explicit Vietnam timezone and zero-filled generate_series. UTC response instants are formatted as UTC ISO text in SQL to prevent the installed Prisma pg adapter's non-UTC session offset normalization from changing transmitted instants. No raw business record materialization or old 1,000/5,000-row truncation. Isolated M13 tests use a fixed allowlisted loopback synthetic DB, reject an existing target instead of overwriting it, and clean up only the DB they created; the M13 seed adds that single target to the allowlist within its test process after exact validation. Production demo seed/reset policies are unchanged. Definitions and measured plans/timings: [M13 plan](../v1.2/M13_ANALYTICS_V2_IMPLEMENTATION_PLAN.md), [verification](../v1.2/M13_ANALYTICS_V2_VERIFICATION.md).

M11/M12 amendment: no persisted field, enum, index or migration changes. Six existing migrations remain immutable. Dashboard counts use one parameterized, role-scoped conditional aggregate over Request and the unique SlaInstance join, evaluated at one DB snapshot instant. state/deadlineAt/completedAt/breachedBySeconds/riskThresholdSeconds/totalPausedSeconds are DTO projections of the existing clock, not new columns. Existing analytics SLA counts also reuse this canonical expression with canceled instances excluded. Query plan and timings are measured locally in [M11/M12 verification](../v1.2/M11_M12_VERIFICATION.md); no scale/SLO claim or index is invented.

M2 empty-DB migration/seed, constraints, role/session boundaries; M3 lifecycle/clock/concurrency; M5 real vector search and incompatible-model rejection; M7 all-or-nothing approval; M8 resolution history, summary provenance, notification dedupe; M9 real aggregate reconciliation. Test unique active assignment/review/run, FK cross-request misuse, negative timestamps/counts, rollback on audit failure, auth replay, canceled jobs and source-generation races using real PostgreSQL.
