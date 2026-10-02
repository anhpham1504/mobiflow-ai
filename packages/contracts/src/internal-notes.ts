import { z } from 'zod';
import { pageSchema, text } from './workflow.js';

export const INTERNAL_NOTE_MAX_LENGTH = 4000;
export const createInternalNoteSchema = z.object({ body: text(1, INTERNAL_NOTE_MAX_LENGTH) }).strict();
// HTTP query values stay strings so the existing keyset parser remains the authority.
export const internalNoteQuerySchema = z.object({
  limit: z.string().regex(/^[0-9]+$/).refine(value => Number(value) >= 1 && Number(value) <= 100).optional(),
  cursor: z.string().max(500).optional(),
}).strict();
export const internalNoteSchema = z.object({
  id: z.uuid(), requestId: z.uuid(), body: text(1, INTERNAL_NOTE_MAX_LENGTH), createdAt: z.iso.datetime(),
  author: z.object({ id: z.uuid(), displayName: z.string().min(1).max(160) }).strict(),
}).strict();
export const internalNoteResponseSchema = z.object({ data: internalNoteSchema, requestId: z.uuid() }).strict();
export const internalNoteListSchema = z.object({ data: z.array(internalNoteSchema), page: pageSchema, requestId: z.uuid() }).strict();
export type CreateInternalNoteInput = z.infer<typeof createInternalNoteSchema>;
export type InternalNote = z.infer<typeof internalNoteSchema>;
