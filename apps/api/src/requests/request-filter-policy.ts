import { requestFiltersAllowed, type RequestFilters, type FilterRole } from '@mobiflow/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';

export async function availableAssignees(db: Pick<Prisma.TransactionClient, 'user'>, filters: RequestFilters[]) {
  const ids = [...new Set(filters.flatMap(filter => filter.assigneeId ? [filter.assigneeId] : []))];
  if (!ids.length) return new Set<string>();
  const rows = await db.user.findMany({ where: { id: { in: ids }, active: true, role: 'STAFF' }, select: { id: true } });
  return new Set(rows.map(row => row.id));
}
export async function assertRequestFilters(db: Pick<Prisma.TransactionClient, 'user'>, filters: RequestFilters, role: FilterRole) {
  if (!requestFiltersAllowed(filters, role)) throw new ApiError(403, 'FILTER_NOT_ALLOWED', 'This role cannot use the selected filter.');
  if (filters.assigneeId && !(await availableAssignees(db, [filters])).has(filters.assigneeId)) {
    throw new ApiError(422, 'FILTER_REFERENCE_UNAVAILABLE', 'The selected filter is unavailable.');
  }
}
