import {z} from 'zod';
import {sourceIdSchema} from '@mobiflow/contracts';
import {AiFailure} from './provider.js';

const bounded=(max:number)=>z.string().trim().min(1).max(max);
const unique=<T extends z.ZodType>(schema:T,max:number,min=0)=>z.array(schema).min(min).max(max).refine(values=>new Set(values).size===values.length,'Duplicate references');
const groundedAction=z.object({text:bounded(500),sourceIds:unique(sourceIdSchema,5,1)}).strict();

// Internal generation bounds fit the longest current SOP's eight distinct
// obligations. Public/stored draft bounds remain unchanged below.
export const checklistGenerationLimits={maxItems:8,messageLength:160,textLength:120,maxSourcesPerItem:2} as const;
const checklistStepKey=(text:string)=>text.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g,' ').trim();
export const checklistGenerationSchema=z.object({
  message:bounded(checklistGenerationLimits.messageLength),
  items:z.array(z.object({text:bounded(checklistGenerationLimits.textLength),sourceIds:unique(sourceIdSchema,checklistGenerationLimits.maxSourcesPerItem,1)}).strict()).max(checklistGenerationLimits.maxItems)
    .refine(items=>new Set(items.map(item=>checklistStepKey(item.text))).size===items.length,'Duplicate checklist steps'),
}).strict();

export const checklistSourcePlanVersion='checklist.source-actions.v2';
const sourceContextSchema=z.object({sourceId:sourceIdSchema,excerpt:z.string()}).passthrough();
const normalizedSource=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
const instructionStart='(?:Ghi nhận|Thu thập|Kiểm tra|Đối chiếu|Xác minh|Xác nhận|Hỏi|Yêu cầu|Chuyển|Nếu|Khi|Sau xử lý|Sau khi xử lý|Không|Chỉ)';
const sourceSentenceBoundary=new RegExp('(?<=[.!?])\\s+|\\n(?='+instructionStart+'\\b)','gu');
const operationalInstruction=/^(?:ghi nhan|thu thap|kiem tra|doi chieu|xac minh|xac nhan|hoi|yeu cau|chuyen|neu|khi|sau (?:khi )?xu ly|khong|chi)\b/;
const nonChecklistDecision=/\b(?:phan loai|uu tien|tu (?:suy doan|ket luan|dong|phe duyet|phan cong)|doi (?:uu tien|sla))\b/;
const operationalVerb=/\b(?:ghi nhan|thu thap|kiem tra|doi chieu|xac minh|xac nhan|hoi|yeu cau|chuyen)\b/;
const sourceGroup=(id:string)=>{const match=/^KD-([0-9a-f-]{36})-G(\d+)-C(\d+)$/i.exec(id);if(!match)throw new AiFailure('AI_INVALID_CONTEXT');return {key:match[1]!.toLowerCase()+':'+match[2],ordinal:Number(match[3])};};

// A short draft must not paraphrase away a condition or a required intake label.
// Only positive canonical scope in actual retrieved text selects a procedure;
// sibling chunks inherit scope only within the same authorized document/generation.
// Overlong instructions/procedures fail closed, never silently lose a step.
export function checklistSourcePlan(context:unknown){
  const data=z.object({request:z.object({category:z.string().nullable().optional(),subcategory:z.string().nullable().optional()}).passthrough().optional(),sources:z.array(sourceContextSchema).max(5).optional()}).passthrough().parse(context);
  const sources=data.sources??[],category=data.request?.category,subcategory=data.request?.subcategory;
  if(new Set(sources.map(source=>source.sourceId)).size!==sources.length)throw new AiFailure('AI_INVALID_CONTEXT');
  const groups=new Map<string,{sources:typeof sources;declarations:{category:string;subcategory:string}[]}>();
  for(const source of sources){
    const key=sourceGroup(source.sourceId).key,group=groups.get(key)??{sources:[],declarations:[]};group.sources.push(source);
    const text=normalizedSource(source.excerpt);
    for(const match of text.matchAll(/\b(?:phan loai(?: tham khao)?|thuoc)\s*:?\s*([a-z]+)\s*\/\s*([a-z_]+)\b/g)){
      const clause=text.slice(Math.max(text.lastIndexOf('.',match.index),text.lastIndexOf('\n',match.index))+1,match.index);
      if(!/\b(?:khong|chua|not|never)\b/.test(clause))group.declarations.push({category:match[1]!.toUpperCase(),subcategory:match[2]!.toUpperCase()});
    }
    groups.set(key,group);
  }
  const eligible=[...groups.entries()].filter(([,group])=>category&&subcategory&&group.declarations.some(d=>d.category===category&&d.subcategory===subcategory)&&group.declarations.every(d=>d.category===category&&d.subcategory===subcategory));
  // Multiple independently applicable procedures need a larger planning contract.
  if(eligible.length>1)throw new AiFailure('AI_INVALID_CONTEXT',false,'CHECKLIST_SOURCE_PLAN_UNSUPPORTED: Multiple applicable procedures require human planning.');
  const items:{text:string;sourceIds:string[]}[]=[],seen=new Set<string>();
  for(const [,group] of eligible){
    for(const source of group.sources.sort((a,b)=>sourceGroup(a.sourceId).ordinal-sourceGroup(b.sourceId).ordinal)){
      for(const sentence of source.excerpt.split(sourceSentenceBoundary)){
        const text=sentence.replace(/\s+/g,' ').trim(),normal=normalizedSource(text);
        if(!operationalInstruction.test(normal)||!/[.!?]$/.test(text))continue;
        if(nonChecklistDecision.test(normal)){
          // A standalone human-control boundary is not an operational item.
          // A mixed sentence must fail closed rather than lose its procedure.
          const boundary=normal.replace(/^khong tu (?:dong|phe duyet|phan cong) yeu cau\b/,'khong tu');
          if(/^khong tu\b/.test(normal)&&!operationalVerb.test(boundary))continue;
          throw new AiFailure('AI_INVALID_CONTEXT',false,'CHECKLIST_SOURCE_PLAN_UNSUPPORTED: An operational instruction mixes procedure and protected decision policy; human planning is required.');
        }
        if(text.length>checklistGenerationLimits.textLength)throw new AiFailure('AI_INVALID_CONTEXT',false,'CHECKLIST_SOURCE_PLAN_UNSUPPORTED: A complete source instruction exceeds the generation field bound.');
        const key=checklistStepKey(text);if(seen.has(key))continue;seen.add(key);items.push({text,sourceIds:[source.sourceId]});
      }
    }
  }
  if(items.length>checklistGenerationLimits.maxItems)throw new AiFailure('AI_INVALID_CONTEXT',false,'CHECKLIST_SOURCE_PLAN_UNSUPPORTED: Complete procedure exceeds the generation item bound.');
  return {version:checklistSourcePlanVersion,message:items.length?'Bản nháp checklist chưa thực hiện.':'Không có SOP đúng phạm vi để tạo checklist.',items};
}

export function checklistSourceFormat(context:unknown){
  const plan=checklistSourcePlan(context),items=plan.items.map(item=>z.object({text:z.literal(item.text),sourceIds:z.tuple([z.literal(item.sourceIds[0]!)] )}).strict());
  const array=items.length?z.tuple([items[0]!,...items.slice(1)]):z.array(checklistGenerationSchema.shape.items.element).max(0);
  return z.toJSONSchema(z.object({message:z.literal(plan.message),items:array}).strict(),{io:'output',target:'draft-7'});
}

export function validateChecklistSourcePlan(value:z.infer<typeof checklistGenerationSchema>,context:unknown,raw:string){
  const plan=checklistSourcePlan(context);
  if(value.message!==plan.message||JSON.stringify(value.items)!==JSON.stringify(plan.items))throw new AiFailure('INVALID_REFERENCE',true,'CHECKLIST_SOURCE_PLAN_MISMATCH: Preserve all exact source instructions, their order and citation pairs.',raw.slice(0,6000));
}

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
  const parsed=(action==='GENERATE_CHECKLIST'?checklistGenerationSchema:copilotModelSchemas[action]).safeParse(value);
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
