import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MAX_SAVED_REQUEST_VIEWS, SAVED_REQUEST_VIEW_SCHEMA_VERSION, normalizeSavedViewName, requestFilterSchema, requestFiltersAllowed, savedViewNameSchema,
  type CreateSavedView, type UpdateSavedView, type SavedRequestView } from '@mobiflow/contracts';
import { Prisma, type SavedRequestView as StoredView } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { ApiError } from '../http.js';
import { lockCollaborationIdentity } from '../requests/collaboration-access.js';
import { assertRequestFilters, availableAssignees } from '../requests/request-filter-policy.js';

@Injectable()
export class SavedViewService {
  constructor(private readonly prisma: PrismaService) {}

  private async identity(tx: Prisma.TransactionClient, actor: AuthenticatedActor, write: boolean) {
    // Take the exclusive owner lock before the shared live-identity check: no lock-upgrade race.
    if (write) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actor.id}::uuid FOR UPDATE`);
    await lockCollaborationIdentity(tx, actor);
  }
  private async owned(tx: Prisma.TransactionClient, id: string, actor: AuthenticatedActor) {
    const row = await tx.savedRequestView.findFirst({ where: { id, ownerUserId: actor.id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'The resource was not found.');
    return row;
  }
  private async project(tx: Prisma.TransactionClient, rows: StoredView[], actor: AuthenticatedActor): Promise<SavedRequestView[]> {
    const parsed = rows.map(row => requestFilterSchema.safeParse(row.filters));
    const references = await availableAssignees(tx, parsed.flatMap(p => p.success && requestFiltersAllowed(p.data, actor.role) ? [p.data] : []));
    return rows.map((row, index) => {
      const parsedName = savedViewNameSchema.safeParse(row.name), descriptor = { id: row.id, name: parsedName.success ? parsedName.data : 'Chế độ xem không khả dụng', version: row.version };
      const result = parsed[index]!;
      const reasonCode = row.schemaVersion !== SAVED_REQUEST_VIEW_SCHEMA_VERSION ? 'UNSUPPORTED_VERSION'
        : !result.success ? 'INVALID_FILTERS' : !requestFiltersAllowed(result.data, actor.role) ? 'ROLE_INCOMPATIBLE'
          : result.data.assigneeId && !references.has(result.data.assigneeId) ? 'REFERENCE_UNAVAILABLE' : null;
      if (reasonCode) return { ...descriptor, availability: 'UNAVAILABLE', reasonCode };
      if (!result.success) throw new Error('Unreachable validated filter');
      return { ...descriptor, availability: 'AVAILABLE', schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, filters: result.data, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
    });
  }
  async list(actor: AuthenticatedActor) {
    return this.prisma.$transaction(async tx => {
      await this.identity(tx, actor, false);
      const rows = await tx.savedRequestView.findMany({ where: { ownerUserId: actor.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SAVED_REQUEST_VIEWS });
      return this.project(tx, rows, actor);
    });
  }
  async detail(id: string, actor: AuthenticatedActor) {
    return this.prisma.$transaction(async tx => {
      await this.identity(tx, actor, false);
      return (await this.project(tx, [await this.owned(tx, id, actor)], actor))[0]!;
    });
  }
  private async audit(tx: Prisma.TransactionClient, actor: AuthenticatedActor, id: string, version: number, action: string, correlation: string) {
    await tx.auditLog.create({ data: { id: randomUUID(), actorType: actor.role, actorId: actor.id, action, resourceType: 'SavedRequestView', resourceId: id,
      requestCorrelationId: correlation, outcome: 'SUCCEEDED', safeAfterJson: { viewId: id, version } } });
  }
  private async write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.prisma.$transaction(operation, { maxWait: 5000, timeout: 10000 }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'SAVED_VIEW_NAME_CONFLICT', 'A view with this name already exists.');
      throw error;
    }
  }
  async create(actor: AuthenticatedActor, input: CreateSavedView, correlation: string) {
    return this.write(async tx => {
      await this.identity(tx, actor, true);
      await assertRequestFilters(tx, input.filters, actor.role);
      if (await tx.savedRequestView.count({ where: { ownerUserId: actor.id } }) >= MAX_SAVED_REQUEST_VIEWS) throw new ApiError(409, 'SAVED_VIEW_LIMIT', 'The saved view limit has been reached.');
      const row = await tx.savedRequestView.create({ data: { id: randomUUID(), ownerUserId: actor.id, name: input.name, normalizedName: normalizeSavedViewName(input.name),
        filters: input.filters, schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION } });
      await this.audit(tx, actor, row.id, row.version, 'SAVED_VIEW_CREATED', correlation);
      return (await this.project(tx, [row], actor))[0]!;
    });
  }
  async update(id: string, actor: AuthenticatedActor, input: UpdateSavedView, correlation: string) {
    return this.write(async tx => {
      await this.identity(tx, actor, true);
      await this.owned(tx, id, actor);
      await assertRequestFilters(tx, input.filters, actor.role);
      const changed = await tx.savedRequestView.updateMany({ where: { id, ownerUserId: actor.id, version: input.expectedVersion },
        data: { name: input.name, normalizedName: normalizeSavedViewName(input.name), filters: input.filters, schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, 'STALE_SAVED_VIEW', 'The view has changed. Reload it before retrying.');
      const row = await this.owned(tx, id, actor);
      await this.audit(tx, actor, id, row.version, 'SAVED_VIEW_UPDATED', correlation);
      return (await this.project(tx, [row], actor))[0]!;
    });
  }
  async delete(id: string, actor: AuthenticatedActor, expectedVersion: number, correlation: string) {
    return this.write(async tx => {
      await this.identity(tx, actor, true);
      await this.owned(tx, id, actor);
      const changed = await tx.savedRequestView.deleteMany({ where: { id, ownerUserId: actor.id, version: expectedVersion } });
      if (!changed.count) throw new ApiError(409, 'STALE_SAVED_VIEW', 'The view has changed. Reload it before retrying.');
      await this.audit(tx, actor, id, expectedVersion, 'SAVED_VIEW_DELETED', correlation);
      return { id, deleted: true as const };
    });
  }
}
