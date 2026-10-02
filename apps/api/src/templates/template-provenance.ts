import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import type { TemplateType } from '@mobiflow/contracts';
import { ApiError } from '../http.js';

export async function validateTemplateSource(tx: Prisma.TransactionClient, actor: AuthenticatedActor, revisionId: string, type: TemplateType) {
  if (actor.role === 'USER' || (type === 'CHECKLIST' && actor.role !== 'MANAGER')) throw new ApiError(403, 'FORBIDDEN', 'This role cannot use this template.');
  // This lock serializes selection adoption with manager archive/revise; content remains human-owned.
  const [source] = await tx.$queryRaw<{ templateId: string; revisionId: string; revision: number; type: TemplateType; status: string; currentRevision: number }[]>(Prisma.sql`
    SELECT t.id AS "templateId", r.id AS "revisionId", r.revision, t.type, t.status, t."currentRevision"
    FROM "OperationalTemplateRevision" r JOIN "OperationalTemplate" t ON t.id=r."templateId"
    WHERE r.id=${revisionId}::uuid FOR SHARE OF t`);
  if (!source || source.type !== type) throw new ApiError(422, 'INVALID_TEMPLATE_SOURCE', 'Choose an available template of the correct type.');
  if (source.status !== 'ACTIVE' || source.revision !== source.currentRevision) throw new ApiError(409, 'TEMPLATE_UNAVAILABLE', 'The template changed or was archived. Keep your draft and retry manually.');
  return source;
}

export async function recordTemplateUsage(tx: Prisma.TransactionClient, actor: AuthenticatedActor, revisionId: string, requestId: string, resourceType: string, resourceId: string, correlationId: string, createdAt: Date, draftRevision?: number) {
  const source = await tx.operationalTemplateRevision.findUniqueOrThrow({ where: { id: revisionId }, select: { templateId: true, revision: true } });
  await tx.auditLog.create({ data: { actorType: actor.role, actorId: actor.id, action: 'TEMPLATE_USED', resourceType, resourceId, requestCorrelationId: correlationId,
    safeAfterJson: { templateId: source.templateId, templateRevisionId: revisionId, revision: source.revision, requestId, ...(draftRevision ? { draftRevision } : {}) }, outcome: 'SUCCEEDED', createdAt } });
}
