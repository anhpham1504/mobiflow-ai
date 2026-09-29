import {z} from 'zod';
import {sourceIdSchema} from '@mobiflow/contracts';
import {AiFailure} from './provider.js';

const bounded=(max:number)=>z.string().trim().min(1).max(max);
const unique=<T extends z.ZodType>(schema:T,max:number,min=0)=>z.array(schema).min(min).max(max).refine(values=>new Set(values).size===values.length,'Duplicate references');
const groundedAction=z.object({text:bounded(500),sourceIds:unique(sourceIdSchema,5,1)}).strict();

export const copilotModelSchemas={
  SUMMARIZE_REQUEST:z.object({summary:bounded(2000),eventIds:unique(z.uuid(),50)}).strict(),
  FIND_SOP:z.object({message:bounded(1000),sourceIds:unique(sourceIdSchema,5)}).strict(),
  SUGGEST_NEXT_STEP:z.object({message:bounded(1000),steps:z.array(groundedAction).max(5)}).strict(),
  GENERATE_CHECKLIST:z.object({message:bounded(1000),items:z.array(groundedAction).max(30)}).strict(),
  FIND_SIMILAR_REQUESTS:z.object({message:bounded(1000),caseIds:unique(z.uuid(),5)}).strict(),
  EXPLAIN_CLASSIFICATION:z.object({reasonSummary:bounded(1000)}).strict(),
} as const;

export type CopilotAction=keyof typeof copilotModelSchemas;

export function parseStrictOutput(action:CopilotAction,raw:string){
  if(Buffer.byteLength(raw,'utf8')>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  let clean=raw.replace(/^\uFEFF/,'').trim();
  const fenced=/^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(clean);if(fenced)clean=fenced[1]!.trim();
  let value:unknown;try{value=JSON.parse(clean);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true,'MALFORMED_JSON: Return exactly one JSON object without preamble or trailing text.',raw.slice(0,6000));}
  const parsed=copilotModelSchemas[action].safeParse(value);
  if(!parsed.success){
    const issues=parsed.error.issues.map(issue=>`${issue.path.join('.')||'<root>'}:${issue.code}`).join(';').slice(0,800);
    throw new AiFailure('AI_INVALID_OUTPUT',true,`SCHEMA_VALIDATION: ${issues}`,raw.slice(0,6000));
  }
  return parsed.data;
}

const summaryTimelineItem=z.object({eventId:z.uuid(),summary:bounded(240)}).strict();
export const summaryModelSchema=z.object({executiveSummary:bounded(800),timeline:z.array(summaryTimelineItem).min(1).max(8).refine(items=>new Set(items.map(item=>item.eventId)).size===items.length,'Duplicate event references')}).strict();

export function parseSummaryOutput(raw:string){
  if(Buffer.byteLength(raw,'utf8')>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  let clean=raw.replace(/^\uFEFF/,'').trim();const fenced=/^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(clean);if(fenced)clean=fenced[1]!.trim();
  let value:unknown;try{value=JSON.parse(clean);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true,'MALFORMED_JSON: Return exactly one JSON object.',raw.slice(0,6000));}
  const parsed=summaryModelSchema.safeParse(value);if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,`SCHEMA_VALIDATION: ${parsed.error.issues.map(issue=>`${issue.path.join('.')||'<root>'}:${issue.code}`).join(';').slice(0,800)}`,raw.slice(0,6000));
  return parsed.data;
}
