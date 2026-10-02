import { z } from 'zod';
import { text, pageSchema } from './workflow.js';

export const templateTypes = ['RESPONSE', 'CHECKLIST'] as const;
export const templateStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export const templateTypeSchema = z.enum(templateTypes);
export const templateStatusSchema = z.enum(templateStatuses);
const unicodeText = (min: number, max: number) => z.string().trim().refine(value => Array.from(value).length >= min && Array.from(value).length <= max, 'Invalid text length');
export const templateNameSchema = unicodeText(1, 120);
export const templateDescriptionSchema = unicodeText(1, 500);
export const responseTemplateContentSchema = z.object({ body: text(1, 4000) }).strict();
export const checklistTemplateItemSchema = z.object({ text: text(1, 500), required: z.boolean() }).strict();
export const checklistTemplateContentSchema = z.object({ items: z.array(checklistTemplateItemSchema).min(1).max(30) }).strict();
const metadata = { name: templateNameSchema, description: templateDescriptionSchema.optional() };
export const createTemplateSchema = z.discriminatedUnion('type', [
  z.object({ ...metadata, type: z.literal('RESPONSE'), content: responseTemplateContentSchema }).strict(),
  z.object({ ...metadata, type: z.literal('CHECKLIST'), content: checklistTemplateContentSchema }).strict(),
]);
export const createTemplateRevisionSchema = z.discriminatedUnion('type', [
  createTemplateSchema.options[0].extend({ expectedRevision: z.number().int().positive() }),
  createTemplateSchema.options[1].extend({ expectedRevision: z.number().int().positive() }),
]);
export const archiveTemplateSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();
const limit = z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int().min(1).max(50)).optional();
export const templateHistoryQuerySchema = z.object({ limit, cursor: z.string().max(500).optional() }).strict();
export const templateListQuerySchema = templateHistoryQuerySchema.extend({ type: templateTypeSchema.optional(), status: templateStatusSchema.optional(), q: unicodeText(0, 120).optional() });
export const templateSummarySchema = z.object({ id: z.uuid(), type: templateTypeSchema, name: templateNameSchema, description: templateDescriptionSchema.nullable(), status: templateStatusSchema, currentRevision: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), archivedAt: z.iso.datetime().nullable() }).strict();
const revisionMetadata = { id: z.uuid(), templateId: z.uuid(), revision: z.number().int().positive(), name: templateNameSchema, description: templateDescriptionSchema.nullable(), createdAt: z.iso.datetime() };
export const templateRevisionSchema = z.discriminatedUnion('type', [
  z.object({ ...revisionMetadata, type: z.literal('RESPONSE'), content: responseTemplateContentSchema }).strict(),
  z.object({ ...revisionMetadata, type: z.literal('CHECKLIST'), content: checklistTemplateContentSchema }).strict(),
]);
export const templateDetailSchema = templateSummarySchema.extend({ current: templateRevisionSchema });
export const templateListResponseSchema = z.object({ data: z.array(templateSummarySchema).max(50), page: pageSchema, requestId: z.uuid() }).strict();
export const templateDetailResponseSchema = z.object({ data: templateDetailSchema, requestId: z.uuid() }).strict();
export const templateHistoryResponseSchema = z.object({ data: z.array(templateRevisionSchema).max(50), page: pageSchema, requestId: z.uuid() }).strict();
export type TemplateType = z.infer<typeof templateTypeSchema>;
export type TemplateSummary = z.infer<typeof templateSummarySchema>;
export type TemplateDetail = z.infer<typeof templateDetailSchema>;
export type TemplateRevision = z.infer<typeof templateRevisionSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateTemplateRevisionInput = z.infer<typeof createTemplateRevisionSchema>;
export type ChecklistTemplateItem = z.infer<typeof checklistTemplateItemSchema>;
