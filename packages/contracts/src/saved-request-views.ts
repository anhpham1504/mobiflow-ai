import { z } from 'zod';
import { requestFilterSchema } from './request-filters.js';

export const SAVED_REQUEST_VIEW_SCHEMA_VERSION = 'saved-request-view.v1';
export const MAX_SAVED_REQUEST_VIEWS = 50;
export const savedViewNameSchema = z.string().transform(value => value.normalize('NFC').trim())
  .refine(value => Array.from(value).length >= 1 && Array.from(value).length <= 80 && Array.from(value).every(c => c.codePointAt(0)! >= 32 && c.codePointAt(0) !== 127), 'Invalid view name');
export const normalizeSavedViewName = (name: string) => savedViewNameSchema.parse(name).toLowerCase();
export const createSavedViewSchema = z.object({ name: savedViewNameSchema, filters: requestFilterSchema }).strict();
export const updateSavedViewSchema = createSavedViewSchema.extend({ expectedVersion: z.number().int().positive().max(2147483646) });
export const deleteSavedViewSchema = z.object({ expectedVersion: z.number().int().positive().max(2147483646) }).strict();
export const savedViewQuerySchema = z.object({}).strict();
const descriptor = { id: z.uuid(), name: savedViewNameSchema, version: z.number().int().positive() };
export const savedViewSchema = z.discriminatedUnion('availability', [
  z.object({ ...descriptor, availability: z.literal('AVAILABLE'), schemaVersion: z.literal(SAVED_REQUEST_VIEW_SCHEMA_VERSION),
    filters: requestFilterSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }).strict(),
  z.object({ ...descriptor, availability: z.literal('UNAVAILABLE'),
    reasonCode: z.enum(['UNSUPPORTED_VERSION', 'INVALID_FILTERS', 'ROLE_INCOMPATIBLE', 'REFERENCE_UNAVAILABLE']) }).strict(),
]);
export const savedViewResponseSchema = z.object({ data: savedViewSchema, requestId: z.uuid() }).strict();
export const savedViewListSchema = z.object({ data: z.array(savedViewSchema).max(MAX_SAVED_REQUEST_VIEWS), requestId: z.uuid() }).strict();
export const savedViewDeletedSchema = z.object({ data: z.object({ id: z.uuid(), deleted: z.literal(true) }).strict(), requestId: z.uuid() }).strict();
export type SavedRequestView = z.infer<typeof savedViewSchema>;
export type CreateSavedView = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedView = z.infer<typeof updateSavedViewSchema>;
