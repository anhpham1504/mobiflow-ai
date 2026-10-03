import { z } from 'zod';
import { categories, priorities, statuses } from './workflow.js';

export const requestFilterKeys = ['status', 'priority', 'category', 'assigneeId', 'from', 'to'] as const;
const instant = z.iso.datetime().transform(value => new Date(value).toISOString());
export const requestFilterSchema = z.object({
  status: z.enum(statuses).optional(), priority: z.enum(priorities).optional(),
  category: z.enum(categories).optional(), assigneeId: z.uuid().optional(),
  from: instant.optional(), to: instant.optional(),
}).strict().refine(value => !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to), 'Invalid date range');
export const requestListQuerySchema = requestFilterSchema.safeExtend({
  limit: z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  cursor: z.string().max(500).optional(),
});
export type RequestFilters = z.infer<typeof requestFilterSchema>;
export type FilterRole = 'USER' | 'STAFF' | 'MANAGER';
export function requestFiltersAllowed(filters: RequestFilters, role: FilterRole) {
  return role === 'MANAGER' || filters.assigneeId === undefined;
}
export function filterValues(input: RequestFilters): RequestFilters {
  return requestFilterSchema.parse(Object.fromEntries(requestFilterKeys.filter(key => input[key] !== undefined).map(key => [key, input[key]])));
}
// URL adapters copy only canonical fields. Other shell parameters never reach the API.
export function requestFiltersFromUrl(params: URLSearchParams): RequestFilters {
  const entries = requestFilterKeys.filter(key => params.has(key)).map(key => [key, params.getAll(key).length === 1 ? params.get(key) : params.getAll(key)]);
  return requestFilterSchema.parse(Object.fromEntries(entries));
}
export function replaceRequestFilters(params: URLSearchParams, filters: RequestFilters) {
  const next = new URLSearchParams(params);
  for (const key of [...requestFilterKeys, 'cursor', 'page', 'sort', 'search']) next.delete(key);
  for (const [key, value] of Object.entries(filterValues(filters))) next.set(key, value);
  return next;
}
export function sameRequestFilters(a: RequestFilters, b: RequestFilters) {
  return requestFilterKeys.every(key => a[key] === b[key]);
}
