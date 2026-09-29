import {z} from 'zod';
import {categories,priorities,statuses} from './workflow.js';
import {sourceIdSchema,sourceSchema} from './knowledge.js';
import {analysisSchema,aiRunStatusSchema} from './analysis.js';

export const recommendationVersion='recommendation.v1';
export const skillCodes=['IOT','NETWORK','BILLING','ACCOUNT','CUSTOMER_SUPPORT'] as const;
const unique=<T extends z.ZodType>(schema:T,min:number,max:number)=>z.array(schema).min(min).max(max).refine(v=>new Set(v).size===v.length,'Duplicate values');
export const candidateSchema=z.object({staffId:z.uuid(),displayName:z.string().max(160),teamId:z.uuid(),skillCodes:unique(z.enum(skillCodes),1,5),activeWorkload:z.number().int().nonnegative(),score:z.number().min(0).max(1),scoreComponents:z.object({skillMatch:z.number().min(0).max(1),workloadScore:z.number().min(0).max(1)}).strict()}).strict();
export const similarCaseSchema=z.object({requestId:z.uuid(),publicCode:z.string().max(32),title:z.string().max(160),status:z.enum(statuses),category:z.enum(categories).nullable(),location:z.string().max(200).nullable(),createdAt:z.iso.datetime(),contextVersion:z.number().int().positive(),score:z.number().min(0).max(1),scoreComponents:z.object({cosineSimilarity:z.number().min(-1).max(1),vector:z.number().min(0).max(1),category:z.number().min(0).max(1),location:z.number().min(0).max(1),recency:z.number().min(0).max(1)}).strict()}).strict();
export const policySchema=z.object({id:z.uuid(),version:z.number().int().positive(),category:z.enum(categories).nullable(),priority:z.enum(priorities),targetMinutes:z.number().int().min(1).max(10080)}).strict();
export const toolSchemas={
  searchKnowledge:{input:z.object({query:z.string().min(1).max(2000),topK:z.number().int().min(1).max(5).default(5)}).strict(),output:z.object({sources:z.array(sourceSchema.strict()).max(5),indexModel:z.string().max(200),indexGeneration:z.string().max(80)}).strict(),timeout:30000,max:5},
  findSimilarRequests:{input:z.object({requestId:z.uuid(),timeWindow:z.number().int().min(1).max(10080).default(30),limit:z.number().int().min(1).max(5).default(5)}).strict(),output:z.object({cases:z.array(similarCaseSchema).max(5),windowMinutes:z.number().int().min(1).max(10080),returnedCount:z.number().int().min(0).max(5),truncated:z.boolean()}).strict(),timeout:30000,max:5},
  getSlaPolicy:{input:z.object({category:z.enum(categories),priority:z.enum(priorities)}).strict(),output:z.object({policy:policySchema.nullable()}).strict(),timeout:5000,max:1},
  getCandidateStaff:{input:z.object({team:z.uuid(),skills:unique(z.enum(skillCodes),1,5)}).strict(),output:z.object({candidates:z.array(candidateSchema).max(10),scoringVersion:z.literal('staff.v1')}).strict(),timeout:5000,max:10},
  getStaffWorkload:{input:z.object({staffIds:unique(z.uuid(),1,10)}).strict(),output:z.object({workloads:z.array(z.object({staffId:z.uuid(),activeCount:z.number().int().nonnegative()}).strict()).max(10),asOf:z.iso.datetime()}).strict(),timeout:5000,max:10},
  getRequestHistory:{input:z.object({requestId:z.uuid()}).strict(),output:z.object({events:z.array(z.object({id:z.uuid(),type:z.string().max(120),actorType:z.enum(['USER','STAFF','MANAGER','SYSTEM','AI']),timestamp:z.iso.datetime(),payload:z.union([z.object({fromStatus:z.enum(statuses).nullable(),toStatus:z.enum(statuses),requestVersion:z.number().int().positive()}).strict(),z.object({body:z.string().min(1).max(4000),kind:z.enum(['COMMENT','INFO_REQUEST','INFO_REPLY'])}).strict()])}).strict()).max(50),truncated:z.boolean()}).strict(),timeout:5000,max:50},
} as const;
export type ToolName=keyof typeof toolSchemas;
export type ToolOutput<N extends ToolName>=z.infer<(typeof toolSchemas)[N]['output']>;
export type Candidate=z.infer<typeof candidateSchema>;
export type SimilarCase=z.infer<typeof similarCaseSchema>;
export const recommendationSchema=z.object({
  suggestedPriority:z.enum(priorities),suggestedTeamId:z.uuid().nullable(),suggestedStaffId:z.uuid().nullable(),suggestedSlaMinutes:z.number().int().min(1).max(10080).nullable(),
  procedureSources:z.array(z.object({sourceId:sourceIdSchema}).strict()).max(5),
  actions:z.array(z.object({text:z.string().trim().min(1).max(500),sourceIds:unique(sourceIdSchema,1,5)}).strict()).max(30),
  similarCaseAlert:z.object({detected:z.boolean(),count:z.number().int().min(0).max(5)}).strict(),
  confidence:z.number().min(0).max(1),reasonSummary:z.string().trim().min(1).max(1000),evidenceStatus:z.enum(['SUFFICIENT','INSUFFICIENT_EVIDENCE']),
}).strict();
export type Recommendation=z.infer<typeof recommendationSchema>;
export const recommendationEvidenceSchema=z.object({
  analysisId:z.uuid(),analysis:analysisSchema,requestVersion:z.number().int().positive(),retrievedAt:z.iso.datetime(),
  sources:z.array(sourceSchema).max(5),similar:toolSchemas.findSimilarRequests.output,
  candidates:toolSchemas.getCandidateStaff.output,workload:toolSchemas.getStaffWorkload.output,
  policy:policySchema.nullable(),history:toolSchemas.getRequestHistory.output,
  embeddingIdentity:z.object({provider:z.string(),model:z.string(),digest:z.string(),dimension:z.number().int(),revision:z.string(),key:z.string()}).strict(),
}).strict();
export type RecommendationEvidence=z.infer<typeof recommendationEvidenceSchema>;
export const recommendationJobSchema=z.object({aiRunId:z.uuid(),requestId:z.uuid(),purpose:z.literal('RECOMMENDATION'),status:aiRunStatusSchema,errorCode:z.string().nullable(),createdAt:z.iso.datetime(),finishedAt:z.iso.datetime().nullable(),contextVersion:z.number().int(),recommendationId:z.uuid().nullable(),recommendation:recommendationSchema.nullable(),evidence:recommendationEvidenceSchema.nullable(),stale:z.boolean(),staleReasons:z.array(z.string()),model:z.string().nullable(),latencyMs:z.number().nullable(),toolCalls:z.array(z.object({toolName:z.string(),ordinal:z.number(),latencyMs:z.number(),status:z.string(),errorCode:z.string().nullable(),summary:z.unknown()}))});
export const recommendationResponseSchema=z.object({data:recommendationJobSchema.nullable(),requestId:z.uuid()});
