import { z } from 'zod';
import { pageSchema, text } from './workflow.js';

export const INTERNAL_NOTE_MAX_LENGTH = 4000;
export const MAX_NOTE_MENTIONS = 10;
export const mentionedUserIdsSchema = z.array(z.uuid()).max(100)
  .transform(ids => [...new Set(ids.map(id => id.toLowerCase()))])
  .pipe(z.array(z.uuid()).max(MAX_NOTE_MENTIONS));
export const createInternalNoteSchema = z.object({ body: text(1, INTERNAL_NOTE_MAX_LENGTH), mentionedUserIds: mentionedUserIdsSchema.optional() }).strict();
export const mentionSchema = z.object({ userId: z.uuid(), displayName: z.string().min(1).max(160) }).strict();
export const mentionCandidateSchema = z.object({ id: z.uuid(), displayName: z.string().min(1).max(160), role: z.enum(['STAFF', 'MANAGER']) }).strict();
export const mentionCandidateQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.string().regex(/^[0-9]+$/).refine(value => Number(value) >= 1 && Number(value) <= 20).optional(),
}).strict();
export const mentionCandidateListSchema = z.object({ data: z.array(mentionCandidateSchema).max(20), requestId: z.uuid() }).strict();
export const emptyCollaborationSchema = z.object({}).strict();
export const watchStateResponseSchema = z.object({ data: z.object({ watching: z.boolean() }).strict(), requestId: z.uuid() }).strict();
export type MentionCandidate = z.infer<typeof mentionCandidateSchema>;
// HTTP query values stay strings so the existing keyset parser remains the authority.
export const internalNoteQuerySchema = z.object({
  limit: z.string().regex(/^[0-9]+$/).refine(value => Number(value) >= 1 && Number(value) <= 100).optional(),
  cursor: z.string().max(500).optional(),
}).strict();
export const internalNoteSchema = z.object({
  id: z.uuid(), requestId: z.uuid(), body: text(1, INTERNAL_NOTE_MAX_LENGTH), createdAt: z.iso.datetime(),
  author: z.object({ id: z.uuid(), displayName: z.string().min(1).max(160) }).strict(),
  mentions: z.array(mentionSchema).max(MAX_NOTE_MENTIONS).optional(),
}).strict();
export const internalNoteResponseSchema = z.object({ data: internalNoteSchema, requestId: z.uuid() }).strict();
export const internalNoteListSchema = z.object({ data: z.array(internalNoteSchema), page: pageSchema, requestId: z.uuid() }).strict();
export type CreateInternalNoteInput = z.infer<typeof createInternalNoteSchema>;
export type InternalNote = z.infer<typeof internalNoteSchema>;
