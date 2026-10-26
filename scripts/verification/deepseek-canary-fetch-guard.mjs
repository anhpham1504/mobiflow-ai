import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rmdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const version='mobiflow-deepseek-m3-ledger.v2';
const email=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const phoneCandidate=/(?<![\p{L}\p{N}])(?:\+?\d[\d .()-]{7,}\d)(?![\p{L}\p{N}])/gu;
const keyLike=/\b(?:sk|ds)-[A-Za-z0-9_-]{16,}\b/u;
const forbiddenNote='CANARY_INTERNAL_NOTE_FORBIDDEN';
const isoDate=/^\d{4}-\d{2}-\d{2}$/u;
const numericUuid=/^\d{8}-\d{4}-\d{4}-\d{4}-\d{12}$/u;

export class CanaryGuardError extends Error {
  constructor(code){super(code);this.name='CanaryGuardError';this.code=code;}
}
const finite=(value,code)=>{const parsed=Number(value);if(!Number.isFinite(parsed)||parsed<0)throw new CanaryGuardError(code);return parsed;};
const integer=(value,min,max,code)=>{const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new CanaryGuardError(code);return parsed;};
const sha256=value=>createHash('sha256').update(value).digest('hex');
function containsPhone(value){
  for(const match of value.matchAll(phoneCandidate)){
    const candidate=match[0];
    if(isoDate.test(candidate)||numericUuid.test(candidate))continue;
    if(candidate.replace(/\D/gu,'').length>=9)return true;
  }
  return false;
}

async function withLock(path,work){
  const lock=path+'.lock';let acquired=false;
  for(let attempt=0;attempt<80;attempt++){
    try{await mkdir(lock);acquired=true;break;}catch(error){if(error?.code!=='EEXIST')throw new CanaryGuardError('CANARY_LEDGER_UNAVAILABLE');await delay(25);}
  }
  if(!acquired)throw new CanaryGuardError('CANARY_LEDGER_LOCK_TIMEOUT');
  try{
    let current=null;
    try{current=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error?.code!=='ENOENT')throw new CanaryGuardError('CANARY_LEDGER_INVALID');}
    const result=await work(current);
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path,JSON.stringify(result.state,null,2)+'\n',{encoding:'utf8',mode:0o600});
    return result.value;
  }finally{await rmdir(lock).catch(()=>{});}
}

function validateState(state,settings){
  if(!state)return summarize({schemaVersion:version,createdAt:new Date().toISOString(),maxHttpAttempts:settings.maxHttpAttempts,budgetUsd:settings.budgetUsd,attemptCount:0,completedCount:0,failedCount:0,timeoutCount:0,reservedCostUsd:0,reportedCostUsd:0,uncertainCostUsd:0,entries:[]});
  if(state.schemaVersion!==version||state.maxHttpAttempts!==settings.maxHttpAttempts||state.budgetUsd!==settings.budgetUsd||!Number.isInteger(state.attemptCount)||state.attemptCount<0||!Number.isInteger(state.completedCount)||state.completedCount<0||!Number.isInteger(state.failedCount)||state.failedCount<0||!Number.isInteger(state.timeoutCount)||state.timeoutCount<0||![state.reservedCostUsd,state.reportedCostUsd,state.uncertainCostUsd].every(value=>Number.isFinite(value)&&value>=0)||!Array.isArray(state.entries))throw new CanaryGuardError('CANARY_LEDGER_INVALID');
  summarize(state);
  return state;
}

function summarize(state){
  const committed=state.reservedCostUsd+state.reportedCostUsd+state.uncertainCostUsd;
  state.remainingAttempts=Math.max(0,state.maxHttpAttempts-state.attemptCount);
  state.remainingBudgetUsd=Math.max(0,state.budgetUsd-committed);
  state.actualOrReservedSpendUsd=committed;
  state.updatedAt=new Date().toISOString();
  return state;
}

function validateRequest(input,init,settings){
  const url=input instanceof URL?input:new URL(typeof input==='string'?input:input.url);
  if(url.protocol!=='https:'||url.hostname!=='api.deepseek.com'||url.port!==''||url.pathname!=='/chat/completions'||url.search||url.hash)throw new CanaryGuardError('CANARY_EGRESS_BLOCKED');
  if((init?.method??'GET').toUpperCase()!=='POST'||init?.redirect!=='error')throw new CanaryGuardError('CANARY_HTTP_CONTRACT_INVALID');
  const headers=new globalThis.Headers(init?.headers);const authorization=headers.get('authorization')??'';
  if(!authorization.startsWith('Bearer ')||authorization.length<=20)throw new CanaryGuardError('CANARY_KEY_MISSING');
  if(typeof init?.body!=='string')throw new CanaryGuardError('CANARY_BODY_INVALID');
  let body;try{body=JSON.parse(init.body);}catch{throw new CanaryGuardError('CANARY_BODY_INVALID');}
  if(body.model!=='deepseek-flash'||body.thinking?.type!=='disabled'||body.stream!==false||body.temperature!==0||body.response_format?.type!=='json_object'||!Number.isInteger(body.max_tokens)||body.max_tokens<128||body.max_tokens>settings.maxOutputTokens||!Array.isArray(body.messages)||!body.messages.length)throw new CanaryGuardError('CANARY_MODEL_CONTRACT_INVALID');
  const serializedMessages=JSON.stringify(body.messages);
  if(!/json/iu.test(serializedMessages)||!serializedMessages.includes('OUTPUT_JSON_SCHEMA'))throw new CanaryGuardError('CANARY_JSON_PROMPT_INVALID');
  if(serializedMessages.includes(forbiddenNote)||email.test(serializedMessages)||containsPhone(serializedMessages)||keyLike.test(serializedMessages))throw new CanaryGuardError('CANARY_PRIVACY_BLOCKED');
  const bodyBytes=Buffer.byteLength(init.body,'utf8');
  const reservedUsd=(bodyBytes*settings.cacheMissInputPerMillion+body.max_tokens*settings.outputPerMillion)/1_000_000;
  return {url,body,bodyBytes,reservedUsd,bodyHash:sha256(init.body)};
}

async function reserve(path,settings,request){
  return withLock(path,async raw=>{
    const state=validateState(raw,settings);
    if(state.attemptCount>=settings.maxHttpAttempts)throw new CanaryGuardError('CANARY_HTTP_LIMIT_REACHED');
    if(state.actualOrReservedSpendUsd+request.reservedUsd>settings.budgetUsd+Number.EPSILON)throw new CanaryGuardError('CANARY_BUDGET_EXHAUSTED');
    const entry={dispatchId:randomUUID(),attempt:state.attemptCount+1,dispatchStartedAt:new Date().toISOString(),origin:'https://api.deepseek.com',path:'/chat/completions',model:'deepseek-flash',thinking:'disabled',bodyBytes:request.bodyBytes,bodySha256:request.bodyHash,maxOutputTokens:request.body.max_tokens,reservedCostUsd:request.reservedUsd,reportedCostUsd:0,uncertainCostUsd:0,status:'DISPATCH_RESERVED'};
    state.attemptCount++;state.reservedCostUsd+=request.reservedUsd;state.entries.push(entry);summarize(state);
    return {state,value:entry.dispatchId};
  });
}

async function settle(path,settings,dispatchId,patch){
  return withLock(path,async raw=>{
    const state=validateState(raw,settings),entry=state.entries.find(item=>item.dispatchId===dispatchId);
    if(!entry)throw new CanaryGuardError('CANARY_LEDGER_INVALID');
    if(entry.status!=='DISPATCH_RESERVED')return {state,value:undefined};
    const reservation=entry.reservedCostUsd;
    state.reservedCostUsd-=reservation;
    if(patch.responseReceived)state.completedCount++;
    if(patch.failed)state.failedCount++;
    if(patch.timedOut)state.timeoutCount++;
    const reported=Number.isFinite(patch.reportedCostUsd)?patch.reportedCostUsd:0;
    const uncertain=Number.isFinite(patch.uncertainCostUsd)?patch.uncertainCostUsd:0;
    state.reportedCostUsd+=reported;state.uncertainCostUsd+=uncertain;
    Object.assign(entry,patch,{reservedCostUsd:0,reportedCostUsd:reported,uncertainCostUsd:uncertain,completedAt:new Date().toISOString()});
    delete entry.responseReceived;delete entry.failed;delete entry.timedOut;
    summarize(state);
    return {state,value:undefined};
  });
}

export function createCanaryFetchGuard({fetchImpl,ledgerPath,maxHttpAttempts=20,budgetUsd=.50,maxOutputTokens=1200,cacheHitInputPerMillion=.006,cacheMissInputPerMillion=.30,outputPerMillion=1.20}){
  if(typeof fetchImpl!=='function')throw new CanaryGuardError('CANARY_FETCH_UNAVAILABLE');
  const settings={maxHttpAttempts:integer(maxHttpAttempts,1,20,'CANARY_LIMIT_INVALID'),budgetUsd:finite(budgetUsd,'CANARY_BUDGET_INVALID'),maxOutputTokens:integer(maxOutputTokens,128,4096,'CANARY_OUTPUT_LIMIT_INVALID'),cacheHitInputPerMillion:finite(cacheHitInputPerMillion,'CANARY_PRICE_INVALID'),cacheMissInputPerMillion:finite(cacheMissInputPerMillion,'CANARY_PRICE_INVALID'),outputPerMillion:finite(outputPerMillion,'CANARY_PRICE_INVALID')};
  if(settings.budgetUsd<=0||settings.budgetUsd>.50||!ledgerPath)throw new CanaryGuardError('CANARY_BUDGET_INVALID');
  if(settings.cacheHitInputPerMillion<.006||settings.cacheMissInputPerMillion<.30||settings.outputPerMillion<1.20)throw new CanaryGuardError('CANARY_PRICE_INVALID');
  const path=resolve(ledgerPath);
  return async(input,init)=>{
    const request=validateRequest(input,init,settings),dispatchId=await reserve(path,settings,request);
    let response;
    try{response=await fetchImpl(input,init);}catch(error){const timedOut=error?.name==='TimeoutError'||error?.name==='AbortError';await settle(path,settings,dispatchId,{status:timedOut?'TIMEOUT':'TRANSPORT_ERROR',failed:true,timedOut,uncertainCostUsd:request.reservedUsd});throw error;}
    let observed={status:response.ok?'HTTP_OK':'HTTP_ERROR',httpStatus:response.status};
    let hasUsage=false;
    try{
      const envelope=JSON.parse(await response.clone().text()),usage=envelope?.usage,hit=Number(usage?.prompt_cache_hit_tokens??0),prompt=Number(usage?.prompt_tokens??0),miss=Number(usage?.prompt_cache_miss_tokens??Math.max(0,prompt-hit)),completion=Number(usage?.completion_tokens??0);
      const validUsage=[hit,miss,completion].every(value=>Number.isInteger(value)&&value>=0);
      hasUsage=validUsage&&usage!==undefined;
      observed={...observed,providerRequestId:typeof envelope?.id==='string'?envelope.id.slice(0,300):null,model:typeof envelope?.model==='string'?envelope.model.slice(0,200):null,finishReason:typeof envelope?.choices?.[0]?.finish_reason==='string'?envelope.choices[0].finish_reason.slice(0,100):null,...(hasUsage?{usage:{promptTokens:prompt,completionTokens:completion,totalTokens:Number(usage?.total_tokens??prompt+completion),promptCacheHitTokens:hit,promptCacheMissTokens:miss},reportedCostUsd:(hit*settings.cacheHitInputPerMillion+miss*settings.cacheMissInputPerMillion+completion*settings.outputPerMillion)/1_000_000}:{})};
    }catch{observed={...observed,envelope:'UNAVAILABLE_OR_INVALID'};}
    await settle(path,settings,dispatchId,{...observed,responseReceived:true,failed:!response.ok,...(!hasUsage?{usageStatus:'MISSING',uncertainCostUsd:request.reservedUsd}:{usageStatus:'REPORTED'})});return response;
  };
}

function liveSettingsFromEnvironment(env){
  const required={AI_LIVE_CALLS_ENABLED:'true',AI_GENERATION_PROVIDER:'deepseek',RAG_RETRIEVAL_MODE:'lexical',AI_GENERATION_MAX_ATTEMPTS:'1',DEEPSEEK_MAX_CALLS_PER_PROCESS:'20',DEEPSEEK_MAX_REQUESTS_PER_MINUTE:'10',DEEPSEEK_MAX_CONCURRENT_REQUESTS:'1',DEEPSEEK_MODEL:'deepseek-flash',AI_MAX_OUTPUT_TOKENS:'1200',DEEPSEEK_PRICING_EFFECTIVE_DATE:'2026-10-24'};
  for(const [key,value] of Object.entries(required))if(env[key]!==value)throw new CanaryGuardError('CANARY_RUNTIME_CONFIG_INVALID');
  if(env.DEEPSEEK_BASE_URL!=='https://api.deepseek.com/'||!env.DEEPSEEK_CANARY_LEDGER_PATH)throw new CanaryGuardError('CANARY_RUNTIME_CONFIG_INVALID');
  return {ledgerPath:env.DEEPSEEK_CANARY_LEDGER_PATH,maxHttpAttempts:env.DEEPSEEK_CANARY_MAX_HTTP_ATTEMPTS,budgetUsd:env.DEEPSEEK_CANARY_BUDGET_USD,maxOutputTokens:env.AI_MAX_OUTPUT_TOKENS,cacheHitInputPerMillion:env.DEEPSEEK_PRICE_CACHE_HIT_INPUT_PER_MILLION_USD,cacheMissInputPerMillion:env.DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD,outputPerMillion:env.DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD};
}

if(process.env.DEEPSEEK_CANARY_GUARD_ENABLED==='true')globalThis.fetch=createCanaryFetchGuard({fetchImpl:globalThis.fetch.bind(globalThis),...liveSettingsFromEnvironment(process.env)});
