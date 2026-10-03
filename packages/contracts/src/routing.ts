import { z } from 'zod';
import { categories, priorities, taxonomy, pageSchema } from './workflow.js';
import { templateNameSchema, templateDescriptionSchema } from './templates.js';

export const routingFields = ['category', 'subcategory', 'priority'] as const;
export const routingOperators = ['EQ', 'IN'] as const;
export const routingStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export const routingSubcategories = Object.values(taxonomy).flat();
export const ROUTING_FIELD_DEFINITIONS = {
  category: { key: 'category', source: 'Request.category', type: 'enum', operators: routingOperators, normalization: 'exact; null never matches', options: categories },
  subcategory: { key: 'subcategory', source: 'Request.subcategory', type: 'enum', operators: routingOperators, normalization: 'exact; null never matches', options: routingSubcategories },
  priority: { key: 'priority', source: 'Request.priority', type: 'enum', operators: routingOperators, normalization: 'exact', options: priorities },
} as const;
const condition = <T extends string>(field: typeof routingFields[number], options: readonly T[]) => z.object({ field: z.literal(field), operator: z.enum(routingOperators), values: z.array(z.enum(options)).min(1).max(20) }).strict()
  .refine(value => value.operator !== 'EQ' || value.values.length === 1, { path: ['values'], message: 'EQ requires one value' });
export const routingConditionSchema = z.union([condition('category', categories), condition('subcategory', routingSubcategories), condition('priority', priorities)]);
export const routingConditionsSchema = z.array(routingConditionSchema).min(1).max(10);
export const routingTargetSchema = z.object({ type: z.literal('TEAM'), id: z.uuid() }).strict();
export const routingTargetViewSchema = routingTargetSchema.extend({ displayName: z.string().min(1).max(160), eligible: z.boolean() });
export const routingDefinitionSchema = z.object({ name: templateNameSchema, description: templateDescriptionSchema.optional(), priority: z.number().int().min(1).max(10000), target: routingTargetSchema, conditions: routingConditionsSchema }).strict();
export const createRoutingRuleSchema = routingDefinitionSchema;
export const routingCommandSchema = z.object({ expectedRevision: z.number().int().positive(), expectedRuleVersion: z.number().int().positive() }).strict();
export const createRoutingRevisionSchema = routingDefinitionSchema.extend(routingCommandSchema.shape);
const limit = z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int().min(1).max(50)).optional();
export const routingHistoryQuerySchema = z.object({ limit, cursor: z.string().max(500).optional() }).strict();
export const routingListQuerySchema = routingHistoryQuerySchema.extend({ status: z.enum(routingStatuses).optional(), q: z.string().trim().max(120).optional() });
export const routingEmptySchema = z.object({}).strict();
export const routingRevisionSchema = z.object({ id: z.uuid(), ruleId: z.uuid(), revision: z.number().int().positive(), name: templateNameSchema, description: templateDescriptionSchema.nullable(), priority: z.number().int().min(1).max(10000), target: routingTargetSchema, conditions: routingConditionsSchema, createdAt: z.iso.datetime() }).strict();
export const routingRuleSchema = z.object({ id: z.uuid(), status: z.enum(routingStatuses), currentRevision: z.number().int().positive(), version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), archivedAt: z.iso.datetime().nullable(), current: routingRevisionSchema }).strict();
export const routingListResponseSchema = z.object({ data: z.array(routingRuleSchema).max(50), page: pageSchema, requestId: z.uuid() }).strict();
export const routingDetailResponseSchema = z.object({ data: routingRuleSchema, requestId: z.uuid() }).strict();
export const routingHistoryResponseSchema = z.object({ data: z.array(routingRevisionSchema).max(50), page: pageSchema, requestId: z.uuid() }).strict();
export const routingTargetsResponseSchema = z.object({ data: z.array(routingTargetViewSchema).max(500), requestId: z.uuid() }).strict();
export const routingFactsSchema = z.object({ category: z.enum(categories).nullable(), subcategory: z.enum(routingSubcategories).nullable(), priority: z.enum(priorities) }).strict();
const revisionIdentity = z.object({ ruleId: z.uuid(), revisionId: z.uuid(), revision: z.number().int().positive(), ruleVersion: z.number().int().positive() }).strict();
const explanation = z.object({ field: z.enum(routingFields), operator: z.enum(routingOperators), expected: z.array(z.string()).min(1).max(20), actual: z.string().nullable(), matched: z.boolean() }).strict();
export const routingEvaluationSchema = z.object({
  status: z.enum(['MATCH', 'NO_MATCH', 'CONFLICT']), diagnostic: z.enum(['MATCHED', 'NO_ACTIVE_RULE_MATCHED', 'CONFLICTING_TARGETS', 'INVALID_TARGET']),
  requestVersion: z.number().int().positive(), facts: routingFactsSchema, evaluatedRevisions: z.array(revisionIdentity).max(500),
  ruleRevisions: z.array(revisionIdentity.extend({ name: templateNameSchema, priority: z.number().int().positive(), target: routingTargetViewSchema, explanation: z.array(explanation).max(10) })).max(500),
  suggestedTarget: routingTargetViewSchema.nullable(),
}).strict();
export const routingEvaluationResponseSchema = z.object({ data: routingEvaluationSchema, requestId: z.uuid() }).strict();
export type RoutingCondition = z.infer<typeof routingConditionSchema>;
export type RoutingFacts = z.infer<typeof routingFactsSchema>;
export type RoutingDefinition = z.infer<typeof routingDefinitionSchema>;
export type RoutingRule = z.infer<typeof routingRuleSchema>;
export type RoutingRevision = z.infer<typeof routingRevisionSchema>;
export type RoutingEvaluation = z.infer<typeof routingEvaluationSchema>;
export type RoutingTargetView = z.infer<typeof routingTargetViewSchema>;
export function normalizeRoutingConditions(conditions: RoutingCondition[]): RoutingCondition[] {
  return conditions.map(value => ({ ...value, values: [...new Set(value.values)].sort() } as RoutingCondition));
}
