import { z } from 'zod';
import { categories, priorities, taxonomy } from './workflow.js';
import {groundingSchema} from './knowledge.js';

export const analysisSchemaVersion = 'analysis.v1';
export const missingFieldNames = ['customer','location','affectedCount','startedAt','impact','description'] as const;
const nullableText = (max:number) => z.string().trim().min(1).max(max).nullable();
export const analysisSchema = z.object({
  intent:z.enum(['REPORT_INCIDENT','REQUEST_SERVICE','ASK_INFORMATION','UNKNOWN']),
  category:z.enum(categories), subcategory:z.enum(['IOT_CONNECTIVITY','MOBILE_NETWORK','DEVICE_CONFIGURATION','BILLING_DISCREPANCY','ACCESS_ISSUE','ACTIVATION','INTERNAL_SUPPORT','UNSPECIFIED']),
  prioritySuggestion:z.enum(priorities),
  entities:z.object({customer:nullableText(200),location:nullableText(200),affectedCount:z.number().int().min(1).max(1000000).nullable(),startedAt:nullableText(100)}).strict(),
  missingFields:z.array(z.enum(missingFieldNames)).max(6),
  confidence:z.number().min(0).max(1),reasonSummary:z.string().trim().min(1).max(1000),
}).strict().superRefine((a,ctx)=>{
  if(!(taxonomy[a.category] as readonly string[]).includes(a.subcategory))ctx.addIssue({code:'custom',path:['subcategory'],message:'Incompatible taxonomy'});
  if(new Set(a.missingFields).size!==a.missingFields.length)ctx.addIssue({code:'custom',path:['missingFields'],message:'Duplicate missing field'});
  for(const key of ['customer','location','affectedCount','startedAt'] as const) {
    if(a.missingFields.includes(key)&&a.entities[key]!==null)ctx.addIssue({code:'custom',path:['entities',key],message:'Present entity cannot be missing'});
  }
  if(['NETWORK','IOT'].includes(a.category))for(const key of ['location','startedAt'] as const){
    if(a.entities[key]===null&&!a.missingFields.includes(key))ctx.addIssue({code:'custom',path:['missingFields'],message:'Absent required fact must be flagged'});
  }
});
export type Analysis = z.infer<typeof analysisSchema>;
export const aiRunStatusSchema=z.enum(['QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELED']);
export const aiJobSchema=z.object({aiRunId:z.uuid(),requestId:z.uuid(),purpose:z.literal('ANALYSIS'),status:aiRunStatusSchema,errorCode:z.string().nullable(),createdAt:z.iso.datetime(),finishedAt:z.iso.datetime().nullable(),contextVersion:z.number().int(),missingFields:z.array(z.enum(missingFieldNames)),analysis:analysisSchema.optional(),provider:z.string().optional(),model:z.string().nullable().optional(),latencyMs:z.number().nullable().optional(),grounding:groundingSchema.optional()});
export const aiJobResponseSchema=z.object({data:aiJobSchema,requestId:z.uuid()});
export const aiExplanationSchema=z.object({data:z.object({status:z.enum(['NOT_STARTED','RUNNING','SUCCEEDED','FAILED']),job:aiJobSchema.nullable(),missingFields:z.array(z.enum(missingFieldNames)),analysis:analysisSchema.optional(),entities:analysisSchema.shape.entities.optional(),grounding:groundingSchema.optional()}),requestId:z.uuid()});
