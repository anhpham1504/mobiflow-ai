import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {ApiEnvironment} from '@mobiflow/config';
import {analysisMessages,formatFor,type AnalysisInput} from './prompts/request-analysis.js';
import {AiFailure,type AiProvider,type GenerationHealthSnapshot,type GenerationUsage} from './provider.js';
import {boundedJson} from './ollama-provider.js';

const completionSchema=z.object({
  id:z.string().min(1).max(300),
  model:z.string().min(1).max(200),
  choices:z.array(z.object({
    finish_reason:z.string().nullable(),
    message:z.object({content:z.string().nullable()}).passthrough(),
  }).passthrough()).length(1),
  usage:z.object({
    prompt_tokens:z.number().int().nonnegative(),
    completion_tokens:z.number().int().nonnegative(),
    total_tokens:z.number().int().nonnegative(),
    prompt_cache_hit_tokens:z.number().int().nonnegative().optional(),
    prompt_cache_miss_tokens:z.number().int().nonnegative().optional(),
  }).passthrough(),
}).passthrough();

const phoneCandidate=/(?<![\p{L}\p{N}])(?:\+?\d[\d .()-]{7,}\d)(?![\p{L}\p{N}])/gu;
const isoDate=/^\d{4}-\d{2}-\d{2}$/u;
const numericUuid=/^\d{8}-\d{4}-\d{4}-\d{4}-\d{12}$/u;
const tlsTrustErrorCodes=new Set(['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID']);
function isTlsTrustError(error:unknown){
  let current:unknown=error;
  for(let depth=0;depth<4&&current&&typeof current==='object';depth++){
    const candidate=current as {code?:unknown;cause?:unknown};
    if(typeof candidate.code==='string'&&tlsTrustErrorCodes.has(candidate.code))return true;
    current=candidate.cause;
  }
  return false;
}
function redactPhones(value:string){
  return value.replace(phoneCandidate,candidate=>{
    if(isoDate.test(candidate)||numericUuid.test(candidate))return candidate;
    return candidate.replace(/\D/gu,'').length>=9?'[REDACTED_PHONE]':candidate;
  });
}

export function redactCloudContent(value:string){
  return redactPhones(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,'[REDACTED_EMAIL]')
    .replace(/\b(?:sk|ds)-[A-Za-z0-9_-]{16,}\b/gu,'[REDACTED_SECRET]')
    .replace(/\bBearer\s+[A-Za-z0-9._~-]{12,}\b/giu,'Bearer [REDACTED_SECRET]');
}

interface Reservation {maximumUsd:number;settled:boolean}
export class DeepSeekBudgetGuard {
  private spentUsd=0;private reservedUsd=0;private calls=0;private inFlight=0;private starts:number[]=[];
  constructor(private readonly env:ApiEnvironment,private readonly now:()=>number=()=>Date.now()){}
  reserve(maximumUsd:number):Reservation{
    if(!this.env.AI_LIVE_CALLS_ENABLED)throw new AiFailure('AI_LIVE_CALLS_DISABLED');
    const now=this.now();this.starts=this.starts.filter(value=>now-value<60000);
    if(this.inFlight>=this.env.DEEPSEEK_MAX_CONCURRENT_REQUESTS)throw new AiFailure('AI_LOCAL_CONCURRENCY_LIMIT',true);
    if(this.starts.length>=this.env.DEEPSEEK_MAX_REQUESTS_PER_MINUTE)throw new AiFailure('AI_LOCAL_RATE_LIMIT',true);
    if(this.calls>=this.env.DEEPSEEK_MAX_CALLS_PER_PROCESS)throw new AiFailure('AI_LOCAL_CALL_LIMIT');
    if(this.spentUsd+this.reservedUsd+maximumUsd>this.env.DEEPSEEK_BUDGET_USD+Number.EPSILON)throw new AiFailure('AI_BUDGET_EXHAUSTED');
    this.calls++;this.inFlight++;this.starts.push(now);this.reservedUsd+=maximumUsd;
    return {maximumUsd,settled:false};
  }
  settle(reservation:Reservation,actualUsd:number){
    if(reservation.settled)return;reservation.settled=true;this.inFlight--;this.reservedUsd-=reservation.maximumUsd;this.spentUsd+=actualUsd;
  }
  release(reservation:Reservation){
    if(reservation.settled)return;reservation.settled=true;this.inFlight--;this.reservedUsd-=reservation.maximumUsd;
  }
  snapshot(){return {spentUsd:this.spentUsd,reservedUsd:this.reservedUsd,calls:this.calls,inFlight:this.inFlight,budgetUsd:this.env.DEEPSEEK_BUDGET_USD};}
}

export class DeepSeekProvider implements AiProvider {
  private readonly budget:DeepSeekBudgetGuard;
  private health:GenerationHealthSnapshot;
  constructor(private readonly env:ApiEnvironment,budget?:DeepSeekBudgetGuard){this.budget=budget??new DeepSeekBudgetGuard(env);this.health=env.AI_LIVE_CALLS_ENABLED?{status:'UP',code:'OK'}:{status:'DISABLED',code:'LIVE_CALLS_DISABLED'};}
  healthSnapshot(){return {...this.health};}
  async generate(input:AnalysisInput,signal:AbortSignal,repair:boolean|string=false){return this.generateStructured(analysisMessages(input,repair),formatFor(input),signal);}
  private pricing(){return {currency:'USD' as const,effectiveDate:this.env.DEEPSEEK_PRICING_EFFECTIVE_DATE,cacheHitInputPerMillion:this.env.DEEPSEEK_PRICE_CACHE_HIT_INPUT_PER_MILLION_USD,cacheMissInputPerMillion:this.env.DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD,outputPerMillion:this.env.DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD};}
  private cost(usage:GenerationUsage){const p=this.pricing();return (usage.promptCacheHitTokens*p.cacheHitInputPerMillion+usage.promptCacheMissTokens*p.cacheMissInputPerMillion+usage.completionTokens*p.outputPerMillion)/1000000;}
  async generateStructured(messages:{role:string;content:string}[],format:object,signal:AbortSignal){
    const schema=JSON.stringify(format),sanitized=messages.map(message=>({...message,content:redactCloudContent(message.content)}));
    const outbound=[{role:'system',content:'Return exactly one JSON object matching OUTPUT_JSON_SCHEMA. Do not include Markdown or extra text. OUTPUT_JSON_SCHEMA='+schema},...sanitized];
    const inputChars=Array.from(JSON.stringify(outbound)).length;
    if(inputChars>64000)throw new AiFailure('CONTEXT_TOO_LARGE');
    const maximumUsd=(inputChars*this.env.DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD+this.env.AI_MAX_OUTPUT_TOKENS*this.env.DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD)/1000000;
    let reservation:Reservation;try{reservation=this.budget.reserve(maximumUsd);}catch(error){if(error instanceof AiFailure&&!['AI_LIVE_CALLS_DISABLED','AI_LOCAL_CONCURRENCY_LIMIT','AI_LOCAL_RATE_LIMIT'].includes(error.code))this.health={status:'DOWN',code:'UNAVAILABLE'};throw error;}
    const deadline=AbortSignal.timeout(this.env.AI_ATTEMPT_TIMEOUT_MS),combined=AbortSignal.any([signal,deadline]);
    try{
      const response=await fetch(new URL('/chat/completions',this.env.DEEPSEEK_BASE_URL),{method:'POST',signal:combined,redirect:'error',headers:{Authorization:`Bearer ${this.env.DEEPSEEK_API_KEY!}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.env.DEEPSEEK_MODEL,thinking:{type:'disabled'},messages:outbound,response_format:{type:'json_object'},stream:false,temperature:this.env.AI_TEMPERATURE,max_tokens:this.env.AI_MAX_OUTPUT_TOKENS})});
      if(response.status===401)throw new AiFailure('AI_AUTHENTICATION_FAILED');
      if(response.status===402)throw new AiFailure('AI_INSUFFICIENT_BALANCE');
      if(response.status===429)throw new AiFailure('AI_RATE_LIMITED',true);
      if(response.status===408||response.status>=500)throw new AiFailure('AI_PROVIDER_UNAVAILABLE',true);
      if(!response.ok)throw new AiFailure('AI_PROVIDER_REJECTED');
      const parsed=completionSchema.safeParse(await boundedJson(response,65536));
      if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,'INVALID_PROVIDER_ENVELOPE: Return one JSON object matching the supplied schema.');
      const result=parsed.data,raw=result.choices[0]!.message.content??'',u=result.usage;
      const hit=u.prompt_cache_hit_tokens??0,miss=u.prompt_cache_miss_tokens??Math.max(0,u.prompt_tokens-hit);
      const usage:GenerationUsage={promptTokens:u.prompt_tokens,completionTokens:u.completion_tokens,totalTokens:u.total_tokens,promptCacheHitTokens:hit,promptCacheMissTokens:miss};
      const estimatedCostUsd=this.cost(usage);this.budget.settle(reservation,estimatedCostUsd);
      if(result.model!==this.env.DEEPSEEK_MODEL)throw new AiFailure('AI_UNEXPECTED_MODEL');
      const finish=result.choices[0]!.finish_reason;
      if(finish==='length')throw new AiFailure('AI_INVALID_OUTPUT',true,'TRUNCATED_GENERATION: Return a shorter JSON object and stay within every array/string bound.',raw.slice(0,6000));
      if(finish==='content_filter')throw new AiFailure('AI_CONTENT_FILTERED');
      if(finish!=='stop')throw new AiFailure('AI_PROVIDER_INCOMPLETE',finish==='insufficient_system_resource');
      const outputSize=Buffer.byteLength(raw,'utf8');if(!raw.trim())throw new AiFailure('AI_INVALID_OUTPUT',true,'EMPTY_GENERATION: Return one JSON object.');if(outputSize>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
      try{const value=JSON.parse(raw);if(value===null||Array.isArray(value)||typeof value!=='object')throw new Error('not object');}catch{throw new AiFailure('AI_INVALID_OUTPUT',true,'INVALID_JSON: Return one complete JSON object.',raw.slice(0,6000));}
      this.health={status:'UP',code:'OK'};return {raw,outputSize,identity:{provider:'deepseek',model:result.model,digest:createHash('sha256').update(`deepseek:${result.model}:chat-completions.v1`).digest('hex'),usage,estimatedCostUsd,pricing:this.pricing()}};
    }catch(error){
      this.budget.release(reservation);
      if(signal.aborted)throw new AiFailure('AI_CANCELED');
      if(deadline.aborted){this.health={status:'DOWN',code:'UNAVAILABLE'};throw new AiFailure('AI_TIMEOUT',true);}
      if(error instanceof AiFailure){if(!['AI_CANCELED','AI_LOCAL_CONCURRENCY_LIMIT','AI_LOCAL_RATE_LIMIT'].includes(error.code))this.health={status:'DOWN',code:'UNAVAILABLE'};throw error;}
      this.health={status:'DOWN',code:'UNAVAILABLE'};
      if(isTlsTrustError(error))throw new AiFailure('AI_TLS_CERTIFICATE_UNTRUSTED');
      throw new AiFailure('AI_PROVIDER_UNAVAILABLE',true);
    }
  }
}
