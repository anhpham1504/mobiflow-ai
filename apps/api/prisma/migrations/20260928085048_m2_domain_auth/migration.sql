-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'STAFF', 'MANAGER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'AI_ANALYZING', 'TRIAGED', 'PENDING_APPROVAL', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('NOT_STARTED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "RequestMessageKind" AS ENUM ('COMMENT', 'INFO_REQUEST', 'INFO_REPLY');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'STAFF', 'MANAGER', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AssignmentDecisionKind" AS ENUM ('AI_ACCEPT', 'AI_MODIFY', 'MANUAL', 'REASSIGN');

-- CreateEnum
CREATE TYPE "ChecklistProvenance" AS ENUM ('APPROVAL', 'STAFF');

-- CreateEnum
CREATE TYPE "AiPurpose" AS ENUM ('ANALYSIS', 'RECOMMENDATION', 'COPILOT', 'RESOLUTION_SUMMARY');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'MODIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('SUFFICIENT', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "ToolCallStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('SAFE', 'AT_RISK', 'BREACHED', 'PAUSED', 'MET');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCEEDED', 'DENIED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "replacedById" UUID,
    "revocationReason" VARCHAR(120),

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSkill" (
    "staffId" UUID NOT NULL,
    "skillId" UUID NOT NULL,

    CONSTRAINT "StaffSkill_pkey" PRIMARY KEY ("staffId","skillId")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" UUID NOT NULL,
    "publicCode" VARCHAR(32) NOT NULL,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "category" VARCHAR(40),
    "subcategory" VARCHAR(80),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "teamId" UUID,
    "currentAssigneeId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aiAnalysisStatus" "AiAnalysisStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "activeAnalysisRunId" UUID,
    "latestAnalysisId" UUID,
    "triageDraftJson" JSONB,
    "manualDraftRevision" INTEGER NOT NULL DEFAULT 0,
    "reviewKind" "ReviewKind",
    "pendingRecommendationId" UUID,
    "pendingDraftRevision" INTEGER,
    "currentResolutionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "canceledAt" TIMESTAMPTZ(6),
    "cancellationReason" VARCHAR(2000),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestMessage" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "kind" "RequestMessageKind" NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAttachment" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestStatusHistory" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" UUID,
    "requestVersion" INTEGER NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),
    "reason" VARCHAR(2000) NOT NULL,
    "recommendationId" UUID,
    "decisionKind" "AssignmentDecisionKind" NOT NULL,
    "finalDecisionJson" JSONB NOT NULL,
    "managerChangesJson" JSONB,
    "eventId" UUID NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestResolution" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "cycle" INTEGER NOT NULL,
    "resolvedById" UUID NOT NULL,
    "rootCause" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "resolvedAt" TIMESTAMPTZ(6) NOT NULL,
    "reopenedAt" TIMESTAMPTZ(6),
    "confirmedAt" TIMESTAMPTZ(6),
    "eventId" UUID NOT NULL,

    CONSTRAINT "RequestResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "createdById" UUID,
    "provenance" "ChecklistProvenance" NOT NULL,
    "sourceRunId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sourceRefsJson" JSONB NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "completedById" UUID,
    "waivedAt" TIMESTAMPTZ(6),
    "waivedById" UUID,
    "waiverReason" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" UUID NOT NULL,
    "requestId" UUID,
    "resolutionId" UUID,
    "purpose" "AiPurpose" NOT NULL,
    "action" VARCHAR(80),
    "initiatingActorId" UUID,
    "contextVersion" INTEGER NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(200),
    "modelIdentityJson" JSONB,
    "promptVersion" VARCHAR(80) NOT NULL,
    "schemaVersion" VARCHAR(80) NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMPTZ(6),
    "finishedAt" TIMESTAMPTZ(6),
    "latencyMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "inputSize" INTEGER,
    "outputSize" INTEGER,
    "errorCode" VARCHAR(120),
    "errorSummary" VARCHAR(1000),
    "safeResultJson" JSONB,
    "retrievalSnapshotJson" JSONB,
    "leaseUntil" TIMESTAMPTZ(6),
    "deadlineAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "aiRunId" UUID NOT NULL,
    "intent" VARCHAR(40) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "subcategory" VARCHAR(80) NOT NULL,
    "prioritySuggestion" "Priority" NOT NULL,
    "entitiesJson" JSONB NOT NULL,
    "missingFieldsJson" JSONB NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "reasonSummary" VARCHAR(1000) NOT NULL,
    "schemaVersion" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRecommendation" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "aiRunId" UUID NOT NULL,
    "suggestedPriority" "Priority" NOT NULL,
    "suggestedTeamId" UUID,
    "suggestedStaffId" UUID,
    "suggestedSlaMinutes" INTEGER,
    "procedureRefsJson" JSONB NOT NULL,
    "actionsJson" JSONB NOT NULL,
    "similarCaseAlertJson" JSONB NOT NULL,
    "evidenceStatus" "EvidenceStatus" NOT NULL,
    "reasonSummary" VARCHAR(1000) NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "managerChangesJson" JSONB,
    "finalDecisionJson" JSONB,
    "invalidatedAt" TIMESTAMPTZ(6),
    "invalidationReason" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolCall" (
    "id" UUID NOT NULL,
    "aiRunId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "toolName" VARCHAR(120) NOT NULL,
    "safeInputJson" JSONB NOT NULL,
    "safeOutputSummaryJson" JSONB NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "finishedAt" TIMESTAMPTZ(6) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" "ToolCallStatus" NOT NULL,
    "errorCode" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedById" UUID NOT NULL,
    "pageCount" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeGeneration" INTEGER,
    "indexManifestJson" JSONB,
    "indexedAt" TIMESTAMPTZ(6),
    "errorCode" VARCHAR(120),
    "errorSummary" VARCHAR(1000),
    "leaseUntil" TIMESTAMPTZ(6),
    "deadlineAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "pageNumber" INTEGER,
    "section" VARCHAR(255),
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "metadataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" UUID NOT NULL,
    "category" VARCHAR(40),
    "priority" "Priority" NOT NULL,
    "targetMinutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaInstance" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "targetSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "pausedAt" TIMESTAMPTZ(6),
    "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "resolvedHoldAt" TIMESTAMPTZ(6),
    "totalResolvedHoldSeconds" INTEGER NOT NULL DEFAULT 0,
    "stoppedAt" TIMESTAMPTZ(6),
    "stopReason" VARCHAR(120),
    "status" "SlaStatus" NOT NULL DEFAULT 'SAFE',
    "breachedAt" TIMESTAMPTZ(6),
    "assessedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SlaInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "requestId" UUID,
    "eventId" UUID NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "safeActorMetadataJson" JSONB NOT NULL,
    "slaInstanceId" UUID,
    "warningLevel" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(6),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "requestId" UUID,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" UUID,
    "initiatingActorId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "resourceType" VARCHAR(120) NOT NULL,
    "resourceId" VARCHAR(200) NOT NULL,
    "requestCorrelationId" UUID NOT NULL,
    "safeBeforeJson" JSONB,
    "safeAfterJson" JSONB,
    "reason" VARCHAR(2000),
    "outcome" "AuditOutcome" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_replacedById_key" ON "RefreshSession"("replacedById");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_revokedAt_idx" ON "RefreshSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshSession_familyId_idx" ON "RefreshSession"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "StaffSkill_skillId_staffId_idx" ON "StaffSkill"("skillId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_publicCode_key" ON "Request"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "Request_activeAnalysisRunId_key" ON "Request"("activeAnalysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_latestAnalysisId_key" ON "Request"("latestAnalysisId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_pendingRecommendationId_key" ON "Request"("pendingRecommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_currentResolutionId_key" ON "Request"("currentResolutionId");

-- CreateIndex
CREATE INDEX "Request_createdById_createdAt_id_idx" ON "Request"("createdById", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Request_currentAssigneeId_status_createdAt_id_idx" ON "Request"("currentAssigneeId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Request_status_createdAt_id_idx" ON "Request"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Request_category_priority_idx" ON "Request"("category", "priority");

-- CreateIndex
CREATE INDEX "Request_teamId_idx" ON "Request"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestMessage_eventId_key" ON "RequestMessage"("eventId");

-- CreateIndex
CREATE INDEX "RequestMessage_requestId_createdAt_id_idx" ON "RequestMessage"("requestId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RequestAttachment_storageKey_key" ON "RequestAttachment"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "RequestStatusHistory_eventId_key" ON "RequestStatusHistory"("eventId");

-- CreateIndex
CREATE INDEX "RequestStatusHistory_requestId_createdAt_idx" ON "RequestStatusHistory"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestStatusHistory_requestId_requestVersion_key" ON "RequestStatusHistory"("requestId", "requestVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_eventId_key" ON "Assignment"("eventId");

-- CreateIndex
CREATE INDEX "Assignment_staffId_assignedAt_idx" ON "Assignment"("staffId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestResolution_eventId_key" ON "RequestResolution"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestResolution_requestId_cycle_key" ON "RequestResolution"("requestId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_requestId_key" ON "Checklist"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_checklistId_ordinal_key" ON "ChecklistItem"("checklistId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_requestId_key" ON "Feedback"("requestId");

-- CreateIndex
CREATE INDEX "AiRun_requestId_createdAt_idx" ON "AiRun"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "AiRun_status_leaseUntil_idx" ON "AiRun"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnalysis_aiRunId_key" ON "AiAnalysis"("aiRunId");

-- CreateIndex
CREATE INDEX "AiAnalysis_requestId_createdAt_idx" ON "AiAnalysis"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiRecommendation_aiRunId_key" ON "AiRecommendation"("aiRunId");

-- CreateIndex
CREATE INDEX "AiRecommendation_status_createdAt_idx" ON "AiRecommendation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiRecommendation_requestId_createdAt_idx" ON "AiRecommendation"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiToolCall_aiRunId_ordinal_key" ON "AiToolCall"("aiRunId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_storageKey_key" ON "KnowledgeDocument"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_sha256_key" ON "KnowledgeDocument"("sha256");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_createdAt_idx" ON "KnowledgeDocument"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_sourceId_key" ON "KnowledgeChunk"("sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_generation_idx" ON "KnowledgeChunk"("documentId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_generation_chunkIndex_key" ON "KnowledgeChunk"("documentId", "generation", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SlaInstance_requestId_key" ON "SlaInstance"("requestId");

-- CreateIndex
CREATE INDEX "SlaInstance_status_dueAt_idx" ON "SlaInstance"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_id_idx" ON "Notification"("recipientId", "readAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientId_eventId_type_key" ON "Notification"("recipientId", "eventId", "type");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_createdAt_id_idx" ON "AuditLog"("requestId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_createdAt_idx" ON "AuditLog"("resourceType", "resourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSkill" ADD CONSTRAINT "StaffSkill_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSkill" ADD CONSTRAINT "StaffSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_currentAssigneeId_fkey" FOREIGN KEY ("currentAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_activeAnalysisRunId_fkey" FOREIGN KEY ("activeAnalysisRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_latestAnalysisId_fkey" FOREIGN KEY ("latestAnalysisId") REFERENCES "AiAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_pendingRecommendationId_fkey" FOREIGN KEY ("pendingRecommendationId") REFERENCES "AiRecommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_currentResolutionId_fkey" FOREIGN KEY ("currentResolutionId") REFERENCES "RequestResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AiRecommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResolution" ADD CONSTRAINT "RequestResolution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResolution" ADD CONSTRAINT "RequestResolution_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResolution" ADD CONSTRAINT "RequestResolution_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_waivedById_fkey" FOREIGN KEY ("waivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "RequestResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_initiatingActorId_fkey" FOREIGN KEY ("initiatingActorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolCall" ADD CONSTRAINT "AiToolCall_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaInstance" ADD CONSTRAINT "SlaInstance_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaInstance" ADD CONSTRAINT "SlaInstance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_slaInstanceId_fkey" FOREIGN KEY ("slaInstanceId") REFERENCES "SlaInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- M2 domain checks not expressible in the Prisma schema.
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check"
  CHECK ("email" = lower(btrim("email")) AND char_length("email") BETWEEN 3 AND 254);
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_lifetime_check"
  CHECK ("expiresAt" > "createdAt" AND ("consumedAt" IS NULL OR "consumedAt" >= "createdAt") AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt"));
ALTER TABLE "Request" ADD CONSTRAINT "Request_version_check" CHECK ("version" > 0 AND "manualDraftRevision" >= 0);
ALTER TABLE "Request" ADD CONSTRAINT "Request_category_pair_check" CHECK (
  ("category" IS NULL AND "subcategory" IS NULL) OR
  ("category" = 'NETWORK' AND "subcategory" IN ('IOT_CONNECTIVITY', 'MOBILE_NETWORK')) OR
  ("category" = 'IOT' AND "subcategory" = 'DEVICE_CONFIGURATION') OR
  ("category" = 'BILLING' AND "subcategory" = 'BILLING_DISCREPANCY') OR
  ("category" = 'ACCOUNT' AND "subcategory" = 'ACCESS_ISSUE') OR
  ("category" = 'SERVICE' AND "subcategory" = 'ACTIVATION') OR
  ("category" = 'OTHER' AND "subcategory" IN ('INTERNAL_SUPPORT', 'UNSPECIFIED'))
);
ALTER TABLE "Request" ADD CONSTRAINT "Request_review_shape_check" CHECK (
  ("reviewKind" IS NULL AND "pendingRecommendationId" IS NULL AND "pendingDraftRevision" IS NULL) OR
  ("reviewKind" = 'AI' AND "pendingRecommendationId" IS NOT NULL AND "pendingDraftRevision" IS NULL) OR
  ("reviewKind" = 'MANUAL' AND "pendingRecommendationId" IS NULL AND "pendingDraftRevision" IS NOT NULL)
);
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 4000);
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_size_hash_check" CHECK ("byteSize" > 0 AND "sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_version_check" CHECK ("requestVersion" > 0);
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_time_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "assignedAt");
ALTER TABLE "RequestResolution" ADD CONSTRAINT "RequestResolution_cycle_check" CHECK ("cycle" > 0);
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_version_check" CHECK ("version" > 0);
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_bounds_check" CHECK (
  "ordinal" BETWEEN 1 AND 30 AND char_length(btrim("text")) BETWEEN 1 AND 500 AND
  NOT ("completedAt" IS NOT NULL AND "waivedAt" IS NOT NULL) AND
  (("waivedAt" IS NULL AND "waiverReason" IS NULL) OR ("waivedAt" IS NOT NULL AND char_length(btrim("waiverReason")) > 0))
);
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_measurements_check" CHECK (
  "contextVersion" > 0 AND "retryCount" >= 0 AND
  ("latencyMs" IS NULL OR "latencyMs" >= 0) AND ("inputSize" IS NULL OR "inputSize" >= 0) AND ("outputSize" IS NULL OR "outputSize" >= 0)
);
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1);
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_taxonomy_check" CHECK (
  "intent" IN ('REPORT_INCIDENT', 'REQUEST_SERVICE', 'ASK_INFORMATION', 'UNKNOWN') AND (
    ("category" = 'NETWORK' AND "subcategory" IN ('IOT_CONNECTIVITY', 'MOBILE_NETWORK')) OR
    ("category" = 'IOT' AND "subcategory" = 'DEVICE_CONFIGURATION') OR
    ("category" = 'BILLING' AND "subcategory" = 'BILLING_DISCREPANCY') OR
    ("category" = 'ACCOUNT' AND "subcategory" = 'ACCESS_ISSUE') OR
    ("category" = 'SERVICE' AND "subcategory" = 'ACTIVATION') OR
    ("category" = 'OTHER' AND "subcategory" IN ('INTERNAL_SUPPORT', 'UNSPECIFIED'))
  )
);
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_confidence_sla_check" CHECK (
  "confidence" BETWEEN 0 AND 1 AND ("suggestedSlaMinutes" IS NULL OR "suggestedSlaMinutes" > 0)
);
ALTER TABLE "AiToolCall" ADD CONSTRAINT "AiToolCall_measurements_check" CHECK ("ordinal" > 0 AND "latencyMs" >= 0 AND "finishedAt" >= "startedAt");
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_bounds_check" CHECK (
  "byteSize" > 0 AND "sha256" ~ '^[0-9a-f]{64}$' AND "version" > 0 AND
  ("pageCount" IS NULL OR "pageCount" > 0) AND ("activeGeneration" IS NULL OR "activeGeneration" > 0)
);
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_bounds_check" CHECK (
  "generation" > 0 AND "chunkIndex" >= 0 AND char_length("content") > 0 AND
  "startOffset" >= 0 AND "endOffset" > "startOffset" AND ("pageNumber" IS NULL OR "pageNumber" > 0)
);
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_bounds_check" CHECK ("targetMinutes" BETWEEN 1 AND 10080 AND "version" > 0);
ALTER TABLE "SlaInstance" ADD CONSTRAINT "SlaInstance_clock_check" CHECK (
  "policyVersion" > 0 AND "targetSeconds" > 0 AND "dueAt" >= "startedAt" AND
  "totalPausedSeconds" >= 0 AND "totalResolvedHoldSeconds" >= 0 AND "version" > 0
);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_warning_shape_check" CHECK (
  ("slaInstanceId" IS NULL AND "warningLevel" IS NULL) OR ("slaInstanceId" IS NOT NULL AND "warningLevel" IS NOT NULL)
);

-- Transactional uniqueness used by later milestones, staged with the baseline schema.
CREATE UNIQUE INDEX "Assignment_one_active_per_request" ON "Assignment"("requestId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "AiRecommendation_one_pending_per_request" ON "AiRecommendation"("requestId") WHERE "status" = 'PENDING' AND "invalidatedAt" IS NULL;
CREATE UNIQUE INDEX "AiRun_one_active_request_purpose" ON "AiRun"("requestId", "purpose") WHERE "requestId" IS NOT NULL AND "status" IN ('QUEUED', 'RUNNING');
CREATE UNIQUE INDEX "AiRun_one_successful_resolution_summary" ON "AiRun"("resolutionId") WHERE "resolutionId" IS NOT NULL AND "purpose" = 'RESOLUTION_SUMMARY' AND "status" = 'SUCCEEDED';
CREATE UNIQUE INDEX "SlaPolicy_active_category_priority" ON "SlaPolicy"("category", "priority") WHERE "active" AND "category" IS NOT NULL;
CREATE UNIQUE INDEX "SlaPolicy_active_fallback_priority" ON "SlaPolicy"("priority") WHERE "active" AND "category" IS NULL;
CREATE UNIQUE INDEX "Notification_sla_warning_key" ON "Notification"("recipientId", "slaInstanceId", "warningLevel") WHERE "slaInstanceId" IS NOT NULL AND "warningLevel" IS NOT NULL;

-- The runtime principal receives data access only. AuditLog is append-only for the app.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mobiflow_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditLog" FROM mobiflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mobiflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE mobiflow_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mobiflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE mobiflow_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mobiflow_app;
