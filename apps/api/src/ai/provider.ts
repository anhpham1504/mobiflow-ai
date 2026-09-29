import { analysisSchema, type Analysis } from '@mobiflow/contracts';
import type { AnalysisInput } from './prompts/request-analysis.js';
export class AiFailure extends Error {
  constructor(readonly code:string,readonly retryable=false,readonly repairFeedback='',readonly invalidOutput=''){super(code);}
}
export interface Generation {raw:string;identity:{provider:string;model:string;digest:string};outputSize:number}
export interface AiProvider {generate(input:AnalysisInput,signal:AbortSignal,repair:boolean|string):Promise<Generation>}
export interface StructuredProvider {generateStructured(messages:{role:string;content:string}[],format:object,signal:AbortSignal):Promise<Generation>}
export const RECOMMENDATION_PROVIDER=Symbol('RECOMMENDATION_PROVIDER');
export const AI_PROVIDER_TOKEN=Symbol('AI_PROVIDER');
export const AI_LOG=Symbol('AI_LOG');
export const AI_WORKER_ENABLED=Symbol('AI_WORKER_ENABLED');
export function parseAnalysis(raw:string):Analysis {
  if(Buffer.byteLength(raw,'utf8')>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true,'Return one JSON object without markdown or surrounding text.');}
  const parsed=analysisSchema.safeParse(value);
  if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,parsed.error.issues.map(i=>i.path.join('.')+': '+(i.code==='custom'?i.message:'Invalid type, missing key or value outside schema bounds')).join('; ').slice(0,1000));
  return parsed.data;
}
export function normalizedFailure(error:unknown,signal?:AbortSignal):AiFailure {
  if(error instanceof AiFailure)return error;
  if(signal?.aborted)return new AiFailure('AI_CANCELED');
  return new AiFailure('AI_PROVIDER_UNAVAILABLE',true);
}
