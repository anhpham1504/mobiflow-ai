import {z} from 'zod';

export const autoRoutingReasons=[
  'GROUNDED_RAG','EXACT_SKILL_MATCH','TEAM_MATCH','AVAILABLE','LOWEST_WORKLOAD','STABLE_TIE_BREAK','SLA_POLICY_MATCH','DEFAULT_TEAM_MAPPING','ROUTING_RULE_MATCH',
  'WEAK_RAG_GROUNDING','MISSING_ROUTING_FACT','AMBIGUOUS_TEAM','ROUTING_RULE_CONFLICT','INVALID_ROUTING_TARGET','NO_ELIGIBLE_STAFF','MISSING_SLA_POLICY','ROUTING_TECHNICAL_FAILURE',
] as const;
export const autoRoutingReasonSchema=z.enum(autoRoutingReasons);
export const autoRoutingOutcomeSchema=z.enum(['AUTO_ASSIGNED','MANAGER_REVIEW_REQUIRED']);
export const autoRoutingViewSchema=z.object({
  source:z.literal('AUTO_ROUTING'),outcome:autoRoutingOutcomeSchema,
  category:z.string().nullable(),subcategory:z.string().nullable(),prioritySuggestion:z.string().nullable(),appliedPriority:z.string(),
  requiredSkills:z.array(z.string()).max(5),recommendedTeamCode:z.string().nullable(),teamId:z.uuid().nullable(),staffId:z.uuid().nullable(),
  candidateCount:z.number().int().nonnegative().max(10),selectedWorkload:z.number().int().nonnegative().nullable(),
  reasons:z.array(autoRoutingReasonSchema).min(1).max(12),requestVersion:z.number().int().positive(),evaluatedAt:z.iso.datetime(),
}).strict();
export type AutoRoutingReason=z.infer<typeof autoRoutingReasonSchema>;
export type AutoRoutingView=z.infer<typeof autoRoutingViewSchema>;
