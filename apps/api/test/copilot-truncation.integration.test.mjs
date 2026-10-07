import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {parseApiEnvironment} from '@mobiflow/config';
import {copilotActions,operationalJobResponseSchema} from '@mobiflow/contracts';
import {OllamaProvider} from '../dist/ai/ollama-provider.js';
import {OperationalAiService} from '../dist/ai/operational-ai.service.js';
import {createRecommendationHarness,businessSnapshot} from './helpers/recommendation-v2-fixture.mjs';

// No server or database connection is attempted until the exact isolated target
// has been verified. This suite never accepts the developer or demo database.
const databaseUrl=process.env.M14_DATABASE_URL;
if(!databaseUrl)throw new Error('Dedicated M14 test database required for Copilot truncation integration');
const target=new URL(databaseUrl);
if(target.pathname!=='/mobiflow_m14_test'||!['localhost','127.0.0.1'].includes(target.hostname))throw new Error('Dedicated loopback mobiflow_m14_test required');
const fixtureModel='copilot-truncation-fixture:1';
const foreignSource='KD-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-G1-C0';

function promptData(messages){
  const content=messages[1].content,separator=content.indexOf('\nALLOWED_REFERENCES\n');
  assert.ok(separator>0,'The owning prompt must delimit actual authorized references');
  const context=JSON.parse(content.slice(content.indexOf('{'),separator));
  const allowed=JSON.parse(content.slice(separator+'\nALLOWED_REFERENCES\n'.length));
  const action=/Action=([A-Z_]+)/.exec(messages[0].content)?.[1];
  assert.ok(copilotActions.includes(action),'Fixture must execute a real allowlisted action');
  return {context,allowed,action};
}
function fixtureOutput({allowed,action,context}){
  const sourceId=allowed.sourceIds[0],item={text:'Đối chiếu APN với cấu hình đã được phê duyệt.',sourceIds:sourceId?[sourceId]:[]};
  if(action==='SUMMARIZE_REQUEST')return {summary:'Dữ kiện synthetic hiện tại; chưa xác minh nguyên nhân.',eventIds:allowed.eventIds.slice(0,1)};
  if(action==='FIND_SOP')return {message:'Nguồn synthetic trong phạm vi được phép.',sourceIds:allowed.sourceIds.slice(0,1)};
  if(action==='SUGGEST_NEXT_STEP')return {message:'Bước đề xuất để nhân viên xem xét.',steps:sourceId?[item]:[]};
  if(action==='GENERATE_CHECKLIST')return {message:context.checklistGeneration.message,items:globalThis.structuredClone(context.checklistGeneration.items)};
  if(action==='FIND_SIMILAR_REQUESTS')return {message:'Chỉ các ca được cung cấp trong phạm vi phân công.',caseIds:allowed.caseIds.slice(0,1)};
  return {reasonSummary:'Phân loại hiện hành do con người quyết định; đây chỉ là giải thích.'};
}
async function httpProviderFixture(mode,{onChat}={}){
  const chats=[],errors=[];
  const server=createServer(async(req,res)=>{
    try{
      let raw='';for await(const part of req)raw+=part;
      res.setHeader('Content-Type','application/json');
      if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:fixtureModel,digest:'deterministic-test-only'}]}));return;}
      assert.equal(req.url,'/api/chat');
      const body=JSON.parse(raw),data=promptData(body.messages),ordinal=chats.length+1;
      chats.push({body,...data});
      const value=fixtureOutput(data);
      if(mode==='foreign-source')value.items[0].sourceIds=[foreignSource];
      if(mode==='oversized-generation')value.items=Array.from({length:9},(_,index)=>({...value.items[0],text:'Kiểm tra bước '+index}));
      const complete=JSON.stringify(value),truncate=mode==='always-truncate'||mode==='truncate-once'&&ordinal===1;
      if(onChat)await onChat({ordinal,...data});
      res.end(JSON.stringify({model:fixtureModel,done:true,done_reason:truncate?'length':'stop',message:{content:truncate?complete.slice(0,-1):complete,thinking:'DO NOT STORE PRIVATE REASONING'},eval_count:truncate?1200:100}));
    }catch(error){errors.push(error);res.statusCode=500;res.end('{}');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(33015,'127.0.0.1',resolve);});
  return {url:'http://127.0.0.1:33015',chats,errors,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
async function protectedSnapshot(prisma,requestId){
  const snapshot=await businessSnapshot(prisma,requestId);
  for(const table of ['requestMessage','requestResolution','feedback','aiRecommendation','requestInternalNote'])snapshot[table]=await prisma[table].findMany({where:{requestId},orderBy:{id:'asc'}});
  snapshot.checklistItems=await prisma.checklistItem.findMany({where:{checklist:{requestId}},orderBy:{id:'asc'}});
  return snapshot;
}
async function setup(mode,options={}){
  const fixture=await httpProviderFixture(mode,options);
  const env=parseApiEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:databaseUrl,OLLAMA_MODEL:fixtureModel,OLLAMA_BASE_URL:fixture.url});
  let harness;
  try{
    harness=await createRecommendationHarness(databaseUrl,{provider:new OllamaProvider(env),envOverrides:{OLLAMA_MODEL:fixtureModel,OLLAMA_BASE_URL:fixture.url},port:33014});
    const s=harness,operations=s.app.get(OperationalAiService);
    await s.upload('Áp dụng cho SIM IoT bị mất kết nối. Ghi nhận số thiết bị, địa điểm, thời gian và phạm vi ảnh hưởng. Đối chiếu APN được phê duyệt, ghi nhận đăng ký mạng và gateway. Không đổi cấu hình hoặc khởi động lại khi chưa có chấp thuận. Chuyển bộ phận mạng nếu nhiều SIM mất đăng ký; kèm thời gian và địa điểm xác nhận. Sau xử lý kiểm tra truyền dữ liệu và hỏi người dùng xác nhận. Không tự đóng yêu cầu. Phân loại NETWORK / IOT_CONNECTIVITY. '+randomUUID(),'Synthetic Copilot truncation SOP');
    let request=await s.create('17 SIM IoT tại Amata mất kết nối từ 8 giờ; dữ liệu synthetic, nguyên nhân chưa được xác minh.');
    const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:s.staff.actor.id,actions:[{text:'Kế hoạch riêng do MANAGER fixture lập, chưa hoàn thành.',required:true,sourceIds:[],provenance:'HUMAN'}],acknowledgedMissingFields:[],reason:'Automated synthetic workflow fixture, not independent human review.'};
    await s.machine.transition(request.id,'MANUAL_TRIAGE',s.manager.actor,{expectedVersion:request.version,finalDecision:decision},randomUUID());
    request=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});
    await s.machine.transition(request.id,'SUBMIT_FOR_APPROVAL',s.manager.actor,{expectedVersion:request.version,manualDraftRevision:request.manualDraftRevision},randomUUID());
    request=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});
    await s.machine.transition(request.id,'APPROVE_AND_ASSIGN',s.manager.actor,{expectedVersion:request.version,reviewKind:'MANUAL',manualDraftRevision:request.manualDraftRevision,acknowledgedMissingFields:[]},randomUUID());
    request=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});
    await s.machine.transition(request.id,'START_WORK',s.staff.actor,{expectedVersion:request.version},randomUUID());
    request=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});
    const drain=async runId=>{
      for(let cycle=0;cycle<12;cycle++){
        const current=await s.prisma.aiRun.findUniqueOrThrow({where:{id:runId}});
        if(['SUCCEEDED','FAILED','CANCELED'].includes(current.status))return current;
        await operations.cycle(AbortSignal.timeout(300000));
      }
      throw new Error('Bounded integration service drain did not complete');
    };
    const run=async(action='GENERATE_CHECKLIST')=>{
      const queued=await operations.scheduleCopilot(request.id,s.staff.actor,{expectedVersion:request.version,action},randomUUID());
      return drain(queued.id);
    };
    const failures=runId=>s.prisma.auditLog.findMany({where:{resourceId:runId,action:'COPILOT_ATTEMPT_FAILED'},orderBy:[{createdAt:'asc'},{id:'asc'}]});
    const close=async()=>{await s.close();await fixture.close();};
    return {...s,fixture,operations,request,run,failures,drain,close};
  }catch(error){if(harness)await harness.close();await fixture.close();throw error;}
}
function assertFrozenProviderCalls(chats){
  for(const {body} of chats){
    assert.deepEqual(body.options,{temperature:0,num_predict:1200,seed:42,num_ctx:16384});
    assert.equal(body.stream,false);assert.equal(body.think,false);assert.equal(body.model,fixtureModel);
    assert.equal('tools' in body,false);assert.equal('stop' in body,false);
  }
}

test('COP-TRUNC-09 real PostgreSQL service retains two length failures and stops without publication or business mutation',async()=>{
  const s=await setup('always-truncate');
  try{
    const before=await protectedSnapshot(s.prisma,s.request.id),run=await s.run(),failures=await s.failures(run.id);
    assert.equal(run.status,'FAILED');assert.equal(run.errorCode,'AI_INVALID_OUTPUT');assert.equal(run.retryCount,1);assert.equal(run.safeResultJson,null);
    assert.equal(s.fixture.chats.length,2);assert.equal(failures.length,2);
    assert.deepEqual(failures.map(failure=>failure.safeAfterJson),[{attempt:1,errorCode:'AI_INVALID_OUTPUT',validationCategory:'TRUNCATED_GENERATION'},{attempt:2,errorCode:'AI_INVALID_OUTPUT',validationCategory:'TRUNCATED_GENERATION'}]);
    assert.deepEqual(s.fixture.chats[0].body.format,s.fixture.chats[1].body.format);assert.deepEqual(s.fixture.chats[0].allowed,s.fixture.chats[1].allowed);
    assert.ok(s.fixture.chats[1].body.messages.at(-1).content.includes('TRUNCATED_GENERATION'));
    assertFrozenProviderCalls(s.fixture.chats);assert.deepEqual(s.fixture.errors,[]);
    assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);
    await s.operations.cycle(AbortSignal.timeout(300000));assert.equal(s.fixture.chats.length,2,'A terminal run cannot acquire a third provider attempt');
  }finally{await s.close();}
});

test('COP-TRUNC-10 real PostgreSQL repair publishes only valid output and retains first failure and retry count',async()=>{
  const s=await setup('truncate-once');
  try{
    const before=await protectedSnapshot(s.prisma,s.request.id),run=await s.run(),failures=await s.failures(run.id);
    assert.equal(run.status,'SUCCEEDED',run.errorCode);assert.equal(run.retryCount,1);assert.equal(s.fixture.chats.length,2);
    assert.equal(failures.length,1);assert.deepEqual(failures[0].safeAfterJson,{attempt:1,errorCode:'AI_INVALID_OUTPUT',validationCategory:'TRUNCATED_GENERATION'});
    assert.deepEqual(s.fixture.chats[0].body.format,s.fixture.chats[1].body.format);assert.deepEqual(s.fixture.chats[0].allowed,s.fixture.chats[1].allowed);
    assert.equal(run.safeResultJson.checklistDraft.length,5);assert.equal('completed' in run.safeResultJson.checklistDraft[0],false);
    assert.equal(JSON.stringify(run.safeResultJson).includes('DO NOT STORE PRIVATE REASONING'),false);
    assert.equal(run.safeResultJson.checklistDraft[0].sourceIds[0],s.fixture.chats[0].allowed.sourceIds[0]);
    assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);
    assertFrozenProviderCalls(s.fixture.chats);assert.deepEqual(s.fixture.errors,[]);
  }finally{await s.close();}
});

test('COP-TRUNC-07 real PostgreSQL rejects a shaped source outside captured retrieval on both attempts',async()=>{
  const s=await setup('foreign-source');
  try{
    const before=await protectedSnapshot(s.prisma,s.request.id),run=await s.run(),failures=await s.failures(run.id);
    assert.equal(run.status,'FAILED');assert.equal(run.errorCode,'INVALID_REFERENCE');assert.equal(run.retryCount,1);assert.equal(run.safeResultJson,null);
    assert.equal(s.fixture.chats.length,2);assert.equal(failures.length,2);
    assert.ok(failures.every(failure=>failure.safeAfterJson.validationCategory==='SOURCE_MEMBERSHIP'));
    assert.ok(s.fixture.chats.every(chat=>!chat.allowed.sourceIds.includes(foreignSource)));
    assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);assert.deepEqual(s.fixture.errors,[]);
  }finally{await s.close();}
});

test('checklist publication rejects public-valid excess items without silently shortening provider output',async()=>{
  const s=await setup('oversized-generation');
  try{
    const before=await protectedSnapshot(s.prisma,s.request.id),run=await s.run(),failures=await s.failures(run.id);
    assert.equal(run.status,'FAILED');assert.equal(run.errorCode,'AI_INVALID_OUTPUT');assert.equal(run.safeResultJson,null);
    assert.equal(s.fixture.chats.length,2);assert.equal(run.retryCount,1);assert.equal(failures.length,2);
    assert.ok(failures.every(failure=>failure.safeAfterJson.validationCategory==='SCHEMA_VALIDATION'));
    const chat=s.fixture.chats[0],value=fixtureOutput(chat);value.items=Array.from({length:9},(_,index)=>({...value.items[0],text:'Kiểm tra bước '+index}));
    assert.throws(()=>s.operations.mapCopilot('GENERATE_CHECKLIST',value,JSON.stringify(value),chat.context.sources,chat.context.history,[],null),'Independent publication mapping must reject the same excess when called without the generation parser');
    assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);assert.deepEqual(s.fixture.errors,[]);
  }finally{await s.close();}
});

test('all six real Copilot dispatches preserve business state, scoped references and private note exclusion',async()=>{
  const s=await setup('normal');
  try{
    const canary='COPILOT_PRIVATE_NOTE_'+randomUUID();
    const note=await s.call(s.staff.token,'/requests/'+s.request.id+'/internal-notes',{body:canary});assert.equal(note.status,201,JSON.stringify(note.body));
    const before=await protectedSnapshot(s.prisma,s.request.id);
    for(const action of copilotActions){
      const run=await s.run(action);assert.equal(run.status,'SUCCEEDED',action+' '+run.errorCode);assert.equal(run.retryCount,0);assert.equal((await s.failures(run.id)).length,0);
      assert.equal(run.promptVersion,action==='GENERATE_CHECKLIST'?'copilot.checklist.m8.v9':'copilot.m8.v3');
      const response=await s.call(s.staff.token,'/ai/operational-runs/'+run.id);assert.equal(response.status,200);operationalJobResponseSchema.parse(response.body);
      assert.equal(response.body.data.result.action,action);assert.equal(JSON.stringify(response.body).includes(canary),false);
      for(const source of response.body.data.result.sources){
        const actual=await s.call(s.staff.token,'/knowledge/sources/'+encodeURIComponent(source.sourceId));assert.equal(actual.status,200);assert.equal(actual.body.data.excerpt,source.quote);
      }
      const toolCalls=await s.prisma.aiToolCall.findMany({where:{aiRunId:run.id}});assert.ok(toolCalls.length<=3);
      assert.ok(toolCalls.every(call=>call.safeOutputSummaryJson.sideEffect==='READ_ONLY'));
      assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);
    }
    assert.equal(s.fixture.chats.length,6);assert.equal(JSON.stringify(s.fixture.chats).includes(canary),false);
    assertFrozenProviderCalls(s.fixture.chats);assert.deepEqual(s.fixture.errors,[]);
    const history=await s.call(s.user.token,'/requests/'+s.request.id+'/history?limit=100');assert.equal(history.status,200);assert.equal(JSON.stringify(history.body).includes(canary),false);
    assert.equal((await s.call(s.user.token,'/requests/'+s.request.id+'/internal-notes')).status,403);
    const source=s.fixture.chats.find(chat=>chat.action==='GENERATE_CHECKLIST').allowed.sourceIds[0];
    assert.equal((await s.call(s.user.token,'/knowledge/sources/'+encodeURIComponent(source))).status,403);
  }finally{await s.close();}
});

test('Copilot role, assignment and expectedVersion denials schedule nothing and expose no staff artifact to USER',async()=>{
  const s=await setup('normal');
  try{
    const other=await s.login('staff.network@mobiflow.local'),path='/requests/'+s.request.id+'/ai/copilot/action',payload={expectedVersion:s.request.version,action:'GENERATE_CHECKLIST'};
    const runsBefore=await s.prisma.aiRun.count({where:{requestId:s.request.id,purpose:'COPILOT'}}),before=await protectedSnapshot(s.prisma,s.request.id);
    for(const [token,status] of [[null,401],[s.user.token,403],[s.manager.token,403],[other.token,404]])assert.equal((await s.call(token,path,payload)).status,status);
    assert.equal((await s.call(s.staff.token,path,{...payload,expectedVersion:s.request.version-1})).status,409);
    assert.equal((await s.call(s.staff.token,path,{...payload,action:'CLOSE_REQUEST'})).status,400);
    assert.equal(await s.prisma.aiRun.count({where:{requestId:s.request.id,purpose:'COPILOT'}}),runsBefore);
    assert.equal(s.fixture.chats.length,0);assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);
    const run=await s.run();assert.equal(run.status,'SUCCEEDED');assert.equal(run.retryCount,0);
    for(const token of [s.user.token,other.token,s.manager.token])assert.equal((await s.call(token,'/ai/operational-runs/'+run.id)).status,404);
    assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),before);
  }finally{await s.close();}
});

test('a real public message changing expectedVersion during generation blocks stale Copilot publication',async()=>{
  let harness,afterHumanWrite;
  const s=await setup('normal',{onChat:async()=>{
    const response=await harness.call(harness.staff.token,'/requests/'+harness.request.id+'/messages',{expectedVersion:harness.request.version,body:'Thông tin synthetic do STAFF fixture bổ sung trong lúc AI chạy.'});
    assert.equal(response.status,201,JSON.stringify(response.body));afterHumanWrite=await protectedSnapshot(harness.prisma,harness.request.id);
  }});harness=s;
  try{
    const run=await s.run();assert.equal(run.status,'FAILED');assert.equal(run.errorCode,'STALE_CONTEXT');assert.equal(run.safeResultJson,null);
    assert.equal(s.fixture.chats.length,1);assert.equal(run.retryCount,0);assert.deepEqual(s.fixture.errors,[]);
    assert.ok(afterHumanWrite,'The concurrent write must execute through the real human endpoint');
    assert.deepEqual(await protectedSnapshot(s.prisma,s.request.id),afterHumanWrite,'AI cannot overwrite or lose the accepted human message');
  }finally{await s.close();}
});
