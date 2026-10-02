import { z } from 'zod';
export * from './workflow.js';
export * from './analysis.js';
export * from './knowledge.js';
export * from './recommendation.js';
export * from './analytics.js';
export * from './dashboard.js';

export const componentSchema = z.object({
  status: z.enum(['UP', 'DOWN', 'NOT_CONFIGURED']),
  code: z.enum(['OK', 'UNAVAILABLE', 'MODEL_NOT_INSTALLED', 'CAPABILITY_MISMATCH', 'NOT_CONFIGURED', 'EXTENSION_MISSING', 'INVALID_RESPONSE']),
}).strict();

export const readinessSchema = z.object({
  status: z.enum(['READY', 'DEGRADED', 'NOT_READY']),
  coreReady: z.boolean(), aiReady: z.boolean(), checkedAt: z.iso.datetime(),
  rag:z.object({enabled:z.boolean(),status:z.enum(['READY','NOT_READY','DISABLED']),embedding:z.string(),knowledge:z.string(),errorCode:z.string().nullable(),documents:z.number(),chunks:z.number(),checkedAt:z.iso.datetime().nullable()}).optional(),
  components: z.object({
    API: componentSchema, DATABASE: componentSchema, VECTOR_EXTENSION: componentSchema,
    OLLAMA_SERVER: componentSchema, OLLAMA_LLM_MODEL: componentSchema, OLLAMA_EMBEDDING_MODEL: componentSchema,
  }).strict(),
}).strict();
export const readinessResponseSchema = z.object({ data: readinessSchema, requestId: z.string().uuid() }).strict();
export type ComponentHealth = z.infer<typeof componentSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
export * from './internal-notes.js';
