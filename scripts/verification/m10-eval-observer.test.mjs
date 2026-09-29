import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {parseApiEnvironment} from '@mobiflow/config';
import {analysisMessages,formatFor} from '../../apps/api/dist/ai/prompts/request-analysis.js';
import {installObserver,observeCase,inputFor,safeMetadata,safeRequest,sampleIds,summarize} from './m10-eval-observer.mjs';

const item={id:'synthetic-observer-test',input:'Khách hàng ABC có 17 SIM IoT bị mất kết nối.',expected:{category:'NETWORK',priority:'HIGH',team:'NETWORK_OPERATIONS'}};
const valid={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:'ABC',location:null,affectedCount:17,startedAt:null},missingFields:['location','startedAt'],confidence:.8,reasonSummary:'Cần xác nhận vị trí và thời gian.'};
async function fixture(t,mode){
  const calls=[];let chats=0;
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=raw?JSON.parse(raw):null;calls.push({path:req.url,body});
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/tags'){res.end(JSON.stringify({models:mode==='missing'?[]:[{name:'test:1',digest:'test-digest'}]}));return;}
    chats++;
    res.end(JSON.stringify({model:'test:1',done:true,done_reason:'stop',message:{content:mode==='repair'&&chats===1?'{}':JSON.stringify(valid),thinking:'DO_NOT_PERSIST_INTERNAL_REASONING'},total_duration:5000000,load_duration:1000000,prompt_eval_count:20,prompt_eval_duration:1000000,eval_count:4,eval_duration:3000000,unexpectedPrivateField:'DO_NOT_PERSIST_SECRET'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const observer=installObserver();t.after(()=>{observer.restore();server.closeAllConnections();server.close();});
  const env=parseApiEnvironment({NODE_ENV:'test',DATABASE_URL:'postgresql://a:b@localhost/test',JWT_SECRET:'a'.repeat(40),REFRESH_TOKEN_SECRET:'b'.repeat(40),OLLAMA_MODEL:'test:1',OLLAMA_EMBEDDING_MODEL:'unused',OLLAMA_BASE_URL:'http://127.0.0.1:'+server.address().port});
  return {env,provider:observer.provider(env),calls};
}
test('observer preserves the exact production request and captures only safe metadata',async t=>{
  const {env,provider,calls}=await fixture(t,'valid'),result=await observeCase(provider,env,item,'test',1);
  assert.equal(result.status,'SUCCEEDED');assert.equal(result.attempts,1);assert.equal(calls.length,2);
  assert.deepEqual(calls[1].body,{model:env.OLLAMA_MODEL,messages:analysisMessages(inputFor(item)),format:formatFor(inputFor(item)),stream:false,think:false,options:{temperature:0,num_predict:1200,seed:42,num_ctx:16384}});
  assert.deepEqual(result.analysis,valid);assert.equal(result.http[1].ollama.eval_duration_ms,3);
  assert.ok(result.timing.providerWallMs>=0);assert.ok(result.timing.finalValidationAndCompletionMs>=0);
  const persisted=JSON.stringify(result);assert.ok(!persisted.includes('DO_NOT_PERSIST'));assert.ok(!persisted.includes('DỮ LIỆU KHÔNG ĐÁNG TIN'));
});
test('observer retains a real two-attempt repair and its backoff, without an extra generation',async t=>{
  const {env,provider,calls}=await fixture(t,'repair'),result=await observeCase(provider,env,item,'test',1);
  assert.equal(result.attempts,2);assert.equal(result.firstAttemptValid,false);assert.equal(calls.length,4);assert.equal(result.schemaValid,true);
  assert.ok(result.timing.retryValidationAndBackoffMs[0]>=900);assert.equal(result.requests.length,2);
});
test('known missing model is a single safe failure, not silently retried or dropped',async t=>{
  const {env,provider,calls}=await fixture(t,'missing'),result=await observeCase(provider,env,item,'test',1);
  assert.equal(result.failureCategory,'AI_MODEL_UNAVAILABLE');assert.equal(result.attempts,1);assert.equal(calls.length,1);assert.equal(result.analysis,null);assert.equal(result.passed,false);
});
test('metadata projection rejects unknown fields and distinguishes missing durations from zero',()=>{
  assert.deepEqual(safeMetadata({eval_count:2,load_duration:0,eval_duration:-1,message:{content:'private'},done_reason:'unknown secret'}),{eval_count:2,load_duration:0,load_duration_ms:0});
  assert.deepEqual(safeMetadata({}),{});
});
test('safe prompt characteristics have hashes, not raw prompts or arbitrary request options',()=>{
  const input=inputFor(item),result=safeRequest({model:'test:1',messages:analysisMessages(input),format:formatFor(input),options:{temperature:0,private:'secret'}});
  assert.equal(result.messageCount,2);assert.equal(result.keepAliveExplicit,false);assert.equal(result.messagesHash.length,64);assert.equal('private' in result.options,false);assert.equal('messages' in result,false);
});
test('fixed diagnostic sample and nearest-rank statistics do not select favorable results',()=>{
  assert.equal(new Set(sampleIds).size,10);assert.ok(sampleIds.includes('normal-06'));assert.ok(sampleIds.includes('incomplete-06'));
  assert.deepEqual(summarize([9,1,5,3]),{count:4,mean:4.5,p50:3,p95:9,max:9});assert.equal(summarize([]).mean,null);
});
