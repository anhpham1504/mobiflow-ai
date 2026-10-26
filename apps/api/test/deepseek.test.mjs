import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {parseApiEnvironment} from '@mobiflow/config';
import {DeepSeekProvider,redactCloudContent} from '../dist/ai/deepseek-provider.js';
import {executeAnalysis} from '../dist/ai/analysis-execution.js';

const base={NODE_ENV:'test',DATABASE_URL:'postgresql://a:b@localhost/test',JWT_SECRET:'a'.repeat(40),REFRESH_TOKEN_SECRET:'b'.repeat(40),AI_GENERATION_PROVIDER:'deepseek',RAG_RETRIEVAL_MODE:'lexical',AI_LIVE_CALLS_ENABLED:'true',DEEPSEEK_API_KEY:'ds-'+'x'.repeat(32),DEEPSEEK_MODEL:'deepseek-flash',AI_ATTEMPT_TIMEOUT_MS:'300'};
const output=JSON.stringify({ok:true});
async function fixture(t,mode='ok',responseContent=output){
  const calls=[];let release;const gate=new Promise(resolve=>{release=resolve;});
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;calls.push({url:req.url,authorization:req.headers.authorization,body:raw?JSON.parse(raw):null});
    const current=Array.isArray(mode)?mode[Math.min(calls.length-1,mode.length-1)]:mode;
    if(current==='slow')await gate;
    if(current==='disconnect'){res.destroy();return;}
    if(current==='timeout')return;
    if(['401','402','429','500'].includes(current)){res.statusCode=Number(current);res.end('{}');return;}
    res.setHeader('Content-Type','application/json');
    const content=current==='empty'?'':current==='invalid'?'not-json':responseContent;
    res.end(JSON.stringify({id:'fixture-completion',model:current==='wrong-model'?'other-model':'deepseek-flash',choices:[{finish_reason:current==='length'?'length':'stop',message:{content,reasoning_content:'PRIVATE_REASONING'}}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120,prompt_cache_hit_tokens:40,prompt_cache_miss_tokens:60}}));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>{release();server.closeAllConnections();server.close();});
  const env=parseApiEnvironment({...base,DEEPSEEK_BASE_URL:`http://127.0.0.1:${server.address().port}/`});
  return {provider:new DeepSeekProvider(env),env,calls,release};
}
const messages=[{role:'user',content:'Email synthetic@example.test, phone +84 912 345 678, return JSON.'}],format={type:'object',additionalProperties:false,required:['ok'],properties:{ok:{type:'boolean'}}};

test('DeepSeek adapter uses JSON mode, redacts outbound PII and records usage/cost without reasoning',async t=>{
  const {provider,calls,env}=await fixture(t),result=await provider.generateStructured(messages,format,AbortSignal.timeout(5000));
  assert.equal(result.raw,output);assert.equal(result.identity.provider,'deepseek');assert.equal(result.identity.model,'deepseek-flash');assert.equal(result.identity.usage.promptCacheHitTokens,40);assert.equal(result.identity.usage.promptCacheMissTokens,60);
  assert.equal(result.identity.estimatedCostUsd,(40*env.DEEPSEEK_PRICE_CACHE_HIT_INPUT_PER_MILLION_USD+60*env.DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD+20*env.DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD)/1e6);
  assert.equal(JSON.stringify(result).includes('PRIVATE_REASONING'),false);assert.equal(calls[0].url,'/chat/completions');assert.equal(calls[0].authorization,'Bearer '+base.DEEPSEEK_API_KEY);
  assert.deepEqual(calls[0].body.thinking,{type:'disabled'});assert.deepEqual(calls[0].body.response_format,{type:'json_object'});assert.equal(calls[0].body.stream,false);assert.equal(calls[0].body.model,'deepseek-flash');
  const sent=JSON.stringify(calls[0].body);assert.equal(sent.includes('synthetic@example.test'),false);assert.equal(sent.includes('+84 912 345 678'),false);assert.match(sent,/REDACTED_EMAIL/);assert.match(sent,/REDACTED_PHONE/);
});

test('DeepSeek adapter maps authentication, balance, rate, server, invalid JSON, truncation and wrong model',async t=>{
  for(const [mode,code,retryable] of [['401','AI_AUTHENTICATION_FAILED',false],['402','AI_INSUFFICIENT_BALANCE',false],['429','AI_RATE_LIMITED',true],['500','AI_PROVIDER_UNAVAILABLE',true],['empty','AI_INVALID_OUTPUT',true],['invalid','AI_INVALID_OUTPUT',true],['length','AI_INVALID_OUTPUT',true],['wrong-model','AI_UNEXPECTED_MODEL',false]]){
    await t.test(mode,async sub=>{const {provider}=await fixture(sub,mode);await assert.rejects(provider.generateStructured(messages,format,AbortSignal.timeout(5000)),error=>error.code===code&&error.retryable===retryable);});
  }
});

test('billable calls are disabled by default and budget/rate/concurrency guards stop before HTTP',async t=>{
  const offline=parseApiEnvironment({...base,AI_LIVE_CALLS_ENABLED:'false',DEEPSEEK_API_KEY:''}),disabled=new DeepSeekProvider(offline);
  await assert.rejects(disabled.generateStructured(messages,format,AbortSignal.timeout(1000)),error=>error.code==='AI_LIVE_CALLS_DISABLED');assert.deepEqual(disabled.healthSnapshot(),{status:'DISABLED',code:'LIVE_CALLS_DISABLED'});
  const budgetFixture=await fixture(t),tiny=parseApiEnvironment({...base,DEEPSEEK_BASE_URL:budgetFixture.env.DEEPSEEK_BASE_URL,DEEPSEEK_BUDGET_USD:'0.000001'});
  await assert.rejects(new DeepSeekProvider(tiny).generateStructured(messages,format,AbortSignal.timeout(1000)),error=>error.code==='AI_BUDGET_EXHAUSTED');assert.equal(budgetFixture.calls.length,0);
  const rateFixture=await fixture(t),rateEnv=parseApiEnvironment({...base,DEEPSEEK_BASE_URL:rateFixture.env.DEEPSEEK_BASE_URL,DEEPSEEK_MAX_REQUESTS_PER_MINUTE:'1'}),rated=new DeepSeekProvider(rateEnv);
  await rated.generateStructured(messages,format,AbortSignal.timeout(1000));await assert.rejects(rated.generateStructured(messages,format,AbortSignal.timeout(1000)),error=>error.code==='AI_LOCAL_RATE_LIMIT');assert.equal(rateFixture.calls.length,1);
  const slow=await fixture(t,'slow'),first=slow.provider.generateStructured(messages,format,AbortSignal.timeout(5000));
  while(slow.calls.length===0)await new Promise(resolve=>setTimeout(resolve,5));
  await assert.rejects(slow.provider.generateStructured(messages,format,AbortSignal.timeout(1000)),error=>error.code==='AI_LOCAL_CONCURRENCY_LIMIT');slow.release();await first;assert.equal(slow.calls.length,1);
});

test('DeepSeek timeout, cancellation and transport failures are bounded and never echo the key',async t=>{
  const timed=await fixture(t,'timeout'),started=Date.now();await assert.rejects(timed.provider.generateStructured(messages,format,new AbortController().signal),error=>error.code==='AI_TIMEOUT'&&error.retryable&&!String(error.stack).includes(base.DEEPSEEK_API_KEY));assert.ok(Date.now()-started<2000);
  const disconnected=await fixture(t,'disconnect');await assert.rejects(disconnected.provider.generateStructured(messages,format,AbortSignal.timeout(1000)),error=>error.code==='AI_PROVIDER_UNAVAILABLE'&&error.retryable&&!String(error).includes(base.DEEPSEEK_API_KEY));assert.deepEqual(disconnected.provider.healthSnapshot(),{status:'DOWN',code:'UNAVAILABLE'});
  const canceledFixture=await fixture(t,'timeout'),controller=new AbortController(),pending=canceledFixture.provider.generateStructured(messages,format,controller.signal);controller.abort();await assert.rejects(pending,error=>error.code==='AI_CANCELED'&&!String(error).includes(base.DEEPSEEK_API_KEY));
});

test('DeepSeek adapter classifies an untrusted TLS certificate without exposing transport details',async t=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>{const error=new TypeError('synthetic transport failure');error.cause={code:'SELF_SIGNED_CERT_IN_CHAIN'};throw error;};
  const env=parseApiEnvironment({...base,DEEPSEEK_BASE_URL:'https://api.deepseek.com/'}),provider=new DeepSeekProvider(env);
  await assert.rejects(provider.generateStructured(messages,format,AbortSignal.timeout(1000)),error=>error.code==='AI_TLS_CERTIFICATE_UNTRUSTED'&&!error.retryable&&!String(error).includes(base.DEEPSEEK_API_KEY));
  assert.deepEqual(provider.healthSnapshot(),{status:'DOWN',code:'UNAVAILABLE'});
});

test('bounded analysis orchestration retries DeepSeek 429 and 5xx once, then publishes only valid JSON',async t=>{
  const analysis={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'MEDIUM',entities:{customer:null,location:null,affectedCount:null,startedAt:null},missingFields:['location','startedAt'],confidence:.5,reasonSummary:'SIM IoT mất kết nối; cần bổ sung vị trí và thời gian.'},input={title:'Sự cố',description:'SIM IoT mất kết nối.',messages:[],historyTruncated:false};
  for(const first of ['429','500'])await t.test(first,async sub=>{const {provider,calls}=await fixture(sub,[first,'ok'],JSON.stringify(analysis)),result=await executeAnalysis(provider,input,AbortSignal.timeout(5000));assert.equal(result.retryCount,1);assert.equal(result.analysis.category,'NETWORK');assert.equal(calls.length,2);});
});

test('canary attempt limit disables orchestration retries before a second HTTP dispatch',async t=>{
  const analysis={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:'Công ty Mô phỏng Sao Mai',location:'Khu Thử Nghiệm Alpha',affectedCount:17,startedAt:'08:00'},missingFields:[],confidence:.8,reasonSummary:'Mười bảy thiết bị IoT synthetic mất kết nối tại địa điểm thử nghiệm.'},input={title:'Sự cố synthetic',description:'Mười bảy thiết bị IoT synthetic mất kết nối.',messages:[],historyTruncated:false};
  const {provider,calls}=await fixture(t,'429',JSON.stringify(analysis));
  await assert.rejects(executeAnalysis(provider,input,AbortSignal.timeout(5000),async()=>{},1),error=>error.code==='AI_RATE_LIMITED');
  assert.equal(calls.length,1);
});

test('privacy redactor never returns configured secret-like values',()=>{const synthetic='ds-'+'abcdefghijklmnop';assert.equal(redactCloudContent(`Bearer secret_token_1234567890 ${synthetic}`).includes('abcdefghijklmnop'),false);});

test('privacy redactor preserves ISO dates and numeric UUIDs while masking real phone numbers',()=>{
  const date='2026-10-23',uuid='10000000-0000-4000-8000-000000000003',phone='+84 901 234 567';
  const redacted=redactCloudContent(`Snapshot ${date}; staff ${uuid}; synthetic contact ${phone}.`);
  assert.match(redacted,new RegExp(date));assert.match(redacted,new RegExp(uuid));assert.equal(redacted.includes(phone),false);assert.match(redacted,/REDACTED_PHONE/u);
});
