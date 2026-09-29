import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {OllamaProvider,boundedJson} from '../../apps/api/dist/ai/ollama-provider.js';
import {executeAnalysis} from '../../apps/api/dist/ai/analysis-execution.js';
import {promptVersion} from '../../apps/api/dist/ai/prompts/request-analysis.js';

// Diagnostic only. No change to production messages, options, validation or retry.
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const inputFor=item=>({title:item.input.slice(0,100),description:item.input,messages:[],historyTruncated:false});
// This is the existing M9 evaluator mapping, not a new production routing rule.
export const route={NETWORK:'NETWORK_OPERATIONS',IOT:'NETWORK_OPERATIONS',BILLING:'BILLING_SUPPORT',ACCOUNT:'CUSTOMER_SUPPORT',SERVICE:'SERVICE_OPERATIONS',OTHER:'SERVICE_OPERATIONS'};
export const sampleIds=Object.freeze(['normal-01','normal-06','normal-11','incomplete-01','incomplete-06','ambiguous-01','M9-057','M9-065','M9-075','M9-085']);
export const priorityIds=Object.freeze(['normal-06','incomplete-06']);
const round=value=>Math.round(value*1000)/1000;
export function summarize(values){
  const sorted=[...values].sort((a,b)=>a-b);
  return {count:sorted.length,mean:sorted.length?round(sorted.reduce((a,b)=>a+b,0)/sorted.length):null,p50:sorted[Math.ceil(sorted.length*.5)-1]??null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null};
}
export function safeRequest(body){
  return {model:body.model,stream:body.stream,think:body.think,
    options:Object.fromEntries(['temperature','num_predict','seed','num_ctx','top_p','top_k'].filter(k=>Object.hasOwn(body.options??{},k)).map(k=>[k,body.options[k]])),
    keep_alive:body.keep_alive??null,keepAliveExplicit:Object.hasOwn(body,'keep_alive'),
    systemChars:body.messages.filter(m=>m.role==='system').reduce((n,m)=>n+m.content.length,0),
    userChars:body.messages.filter(m=>m.role==='user').reduce((n,m)=>n+m.content.length,0),
    messagesHash:hash(JSON.stringify(body.messages)),schemaChars:JSON.stringify(body.format).length,schemaHash:hash(JSON.stringify(body.format)),
    requestHash:hash(JSON.stringify(body)),messageCount:body.messages.length,structuredFormat:typeof body.format==='object'};
}
export function safeMetadata(value){
  const output={};
  for(const key of ['total_duration','load_duration','prompt_eval_count','prompt_eval_duration','eval_count','eval_duration']){
    if(typeof value?.[key]==='number'&&Number.isFinite(value[key])&&value[key]>=0){
      output[key]=value[key];
      if(key.endsWith('_duration'))output[key+'_ms']=round(value[key]/1e6);
    }
  }
  if(['stop','length','load','unload'].includes(value?.done_reason))output.done_reason=value.done_reason;
  return output;
}

// Async-local scope prevents observing unrelated fetches. The original response
// and request are returned unchanged. A size-bounded clone yields metadata only.
export function installObserver(){
  const scope=new AsyncLocalStorage(),original=globalThis.fetch;
  globalThis.fetch=async function observedFetch(url,options){
    const attempt=scope.getStore(),path=new URL(url).pathname;
    if(!attempt||!['/api/chat','/api/tags'].includes(path))return original(url,options);
    const record={path,started:performance.now()};
    if(path==='/api/chat')record.request=safeRequest(JSON.parse(options.body));
    attempt.http.push(record);
    try{
      const response=await original(url,options);
      record.status=response.status;
      attempt.pending.push(boundedJson(response.clone(),path==='/api/chat'?65536:1048576).then(value=>{
        record.wallMs=round(performance.now()-record.started);
        if(path==='/api/chat')record.ollama=safeMetadata(value);
      }).catch(()=>{record.metadataUnavailable=true;record.wallMs=round(performance.now()-record.started);}));
      return response;
    }catch(error){record.wallMs=round(performance.now()-record.started);throw error;}
  };
  class ObservedProvider extends OllamaProvider {
    async generate(input,signal,repair){
      const attempt=this.current;
      attempt.generateStarted=performance.now();
      return scope.run(attempt,async()=>{
        try{return await super.generate(input,signal,repair);}
        finally{attempt.generateEnded=performance.now();}
      });
    }
    async generateStructured(messages,format,signal){
      this.current.contextConstructionMs=round(performance.now()-this.current.generateStarted);
      return super.generateStructured(messages,format,signal);
    }
  }
  return {provider:env=>new ObservedProvider(env),restore:()=>{globalThis.fetch=original;scope.disable();}};
}

export async function observeCase(provider,env,item,phase,ordinal){
  const started=performance.now(),input=inputFor(item),prepared=performance.now(),attempts=[];
  let generated,failureCategory=null;
  try{
    generated=await executeAnalysis(provider,input,AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS),async index=>{
      const attempt={index:index+1,began:performance.now(),http:[],pending:[]};
      attempts.push(attempt);provider.current=attempt;
    });
  }catch(error){failureCategory=/^AI_[A-Z_]+$|^CONTEXT_TOO_LARGE$/.test(error?.code??'')?error.code:'AI_ANALYSIS_FAILED';}
  const completed=performance.now();
  await Promise.all(attempts.flatMap(a=>a.pending));
  const final=attempts.at(-1),validationAndCompletionMs=final?.generateEnded?round(completed-final.generateEnded):null;
  const retryIntervals=attempts.slice(1).map((a,index)=>round(a.began-attempts[index].generateEnded));
  const http=attempts.flatMap(a=>a.http),chat=http.filter(r=>r.path==='/api/chat');
  return {id:item.id,phase,ordinal,promptVersion,schemaVersion:'analysis.v1',attempts:attempts.length,
    failureCategory,status:generated?'SUCCEEDED':'FAILED',schemaValid:Boolean(generated),
    firstAttemptValid:generated?.firstAttemptValid??false,identity:generated?.identity??null,
    analysis:generated?.analysis??null,actualTeam:generated?route[generated.analysis.category]:null,
    expected:{category:item.expected.category,priority:item.expected.priority,team:item.expected.team},
    passed:Boolean(generated&&generated.analysis.category===item.expected.category&&generated.analysis.prioritySuggestion===item.expected.priority&&route[generated.analysis.category]===item.expected.team),
    // Official latency is untouched; observer bookkeeping is not subtracted.
    latencyMs:generated?.latencyMs??Math.round(completed-prepared),
    timing:{casePreparationMs:round(prepared-started),contextConstructionMs:round(attempts.reduce((n,a)=>n+(a.contextConstructionMs??0),0)),
      providerWallMs:round(attempts.reduce((n,a)=>n+(a.generateEnded-a.generateStarted-(a.contextConstructionMs??0)),0)),
      finalValidationAndCompletionMs:validationAndCompletionMs,retryValidationAndBackoffMs:retryIntervals,
      repairProviderMs:round(attempts.slice(1).reduce((n,a)=>n+a.generateEnded-a.generateStarted,0)),
      runnerWallMs:round(completed-started),metadataCollectionTailMs:round(performance.now()-completed)},
    requests:chat.map(r=>r.request),http:http.map(({path,status,wallMs,ollama,metadataUnavailable})=>({path,status,wallMs,ollama,metadataUnavailable})),
    timingLimitation:'Final validation includes promise completion. Retry intervals include failed validation and the unchanged 1000ms backoff; those two components cannot be separated by passive observation. Provider wall includes inventory/envelope parsing. Metadata clone adds small uncorrected observer overhead.'};
}
