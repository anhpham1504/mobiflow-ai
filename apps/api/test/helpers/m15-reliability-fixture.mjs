import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {parseApiEnvironment} from '@mobiflow/config';
import {statuses} from '@mobiflow/contracts';
import {RecommendationService} from '../../dist/ai/recommendation.service.js';
import {OllamaProvider} from '../../dist/ai/ollama-provider.js';
import {DomainTools} from '../../dist/ai/tools/domain-tools.js';
import {RequestVectors} from '../../dist/ai/tools/request-vectors.js';
import {OllamaEmbeddingProvider} from '../../dist/knowledge/embedding-provider.js';
import {KnowledgeRetriever} from '../../dist/knowledge/retriever.js';
import {VectorRepository} from '../../dist/knowledge/vector.repository.js';
import {RequestStateMachineService} from '../../dist/requests/request-state-machine.service.js';
import {AuthorizationPolicyService} from '../../dist/authorization/authorization-policy.service.js';
import {recommendationFixture} from './recommendation-v2-fixture.mjs';

const copy=value=>deserialize(serialize(value));
const uuid=n=>`15000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const protectedTables=['assignment','slaInstance','checklist','requestStatusHistory','notification'];
export const M15_FAILURE_MODES=['ollama-unavailable','ollama-timeout','invalid-json','schema-invalid','oversized-output','invalid-reference','embedding-unavailable','retrieval-empty','postgresql-temporary-error','revoked-session','expired-session','stale-request-version','stale-source','stale-history'];

// This adapter is deliberately a service-test fixture, not a PostgreSQL emulator.
// It applies the Prisma predicates used by these real services, records writes,
// and restores its own rows on transaction failure. It proves orchestration and
// rollback intent; M14 real PostgreSQL evidence owns database semantics.
function repository(mode){
  const now=new Date(),manager={id:uuid(1),role:'MANAGER',active:true,available:true,email:'m15.manager@synthetic.invalid',displayName:'Synthetic manager'},staff={id:uuid(2),role:'STAFF',active:true,available:true,email:'m15.staff@synthetic.invalid',displayName:'Synthetic staff'},team={id:uuid(3),code:'NETWORK_OPERATIONS',active:true};
  const sessions=[{id:uuid(4),userId:manager.id,revokedAt:null,consumedAt:null,expiresAt:new Date(now.getTime()+3600000)},{id:uuid(5),userId:manager.id,revokedAt:null,consumedAt:null,expiresAt:new Date(now.getTime()+3600000)}];
  const analysis={id:uuid(6),intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entitiesJson:{customer:null,location:'Synthetic M15 lab',affectedCount:17,startedAt:'8 giờ'},missingFieldsJson:[],confidence:.8,reasonSummary:'Synthetic fixed intake; no model quality claim.'};
  const request={id:uuid(7),publicCode:'MF-2026-015007',title:'Synthetic connection incident',description:'17 SIM IoT mất kết nối tại Synthetic M15 lab từ 8 giờ.',createdById:uuid(8),currentAssigneeId:null,teamId:null,category:null,subcategory:null,status:'TRIAGED',priority:'MEDIUM',version:4,latestAnalysisId:analysis.id,manualDraftRevision:0,triageDraftJson:null,pendingDraftRevision:null,reviewKind:null,createdAt:now,updatedAt:now};
  const prior={id:uuid(9),publicCode:'MF-2026-015009',title:'Synthetic related incident',status:'RESOLVED',category:'NETWORK',location:'Synthetic M15 lab',version:2,createdAt:now};
  const doc={id:uuid(10),status:'READY',activeGeneration:1,title:'Synthetic M15 SOP'};
  const content='Áp dụng cho SIM IoT bị mất kết nối. Kiểm tra trạng thái SIM và APN, ghi lại kết quả để quản lý xem xét. Phân loại tham khảo NETWORK / IOT_CONNECTIVITY.';
  const source={sourceId:`KD-${doc.id}-G1-C0`,chunkId:uuid(11),documentId:doc.id,generation:1,title:doc.title,pageNumber:1,section:null,excerpt:content,contentHash:createHash('sha256').update(content).digest('hex'),distance:.2,score:.8};
  let tables={user:[manager,staff],refreshSession:sessions,request:[request,prior],team:[team],aiAnalysis:[analysis],slaPolicy:['HIGH','MEDIUM'].map((priority,i)=>({id:uuid(12+i),priority,category:'NETWORK',active:true,version:1,targetMinutes:120})),knowledgeDocument:[doc],knowledgeChunk:[{id:source.chunkId,sourceId:source.sourceId,documentId:doc.id,generation:1,content,contentHash:source.contentHash}],aiRun:[],aiRecommendation:[],auditLog:[],aiToolCall:[],assignment:[],slaInstance:[],checklist:[],requestStatusHistory:[],notification:[],requestWatcher:[]};
  let persistenceFault=false;
  const writes=[],external=[];
  const relation=(table,row,key)=>{
    if(table==='user'&&key==='sessions')return tables.refreshSession.filter(s=>s.userId===row.id);
    if(table==='aiRun'&&key==='initiatingActor')return tables.user.find(u=>u.id===row.initiatingActorId);
    if(table==='aiRun'&&key==='request')return tables.request.find(r=>r.id===row.requestId);
    if(table==='aiRecommendation'&&key==='aiRun')return tables.aiRun.find(r=>r.id===row.aiRunId);
    if(table==='knowledgeChunk'&&key==='document')return tables.knowledgeDocument.find(d=>d.id===row.documentId);
    if(table==='auditLog'&&['histories','messages'].includes(key))return [];
    return row[key];
  };
  const relatedTable=key=>({sessions:'refreshSession',initiatingActor:'user',request:'request',aiRun:'aiRun',document:'knowledgeDocument'})[key];
  function matches(table,row,where={}){
    if(!row)return false;
    return Object.entries(where).every(([key,wanted])=>{
      if(key==='OR')return wanted.some(w=>matches(table,row,w));
      if(key==='AND')return (Array.isArray(wanted)?wanted:[wanted]).every(w=>matches(table,row,w));
      const actual=relation(table,row,key);
      if(wanted===null||typeof wanted!=='object'||wanted instanceof Date)return actual===wanted;
      if('some' in wanted)return (actual??[]).some(value=>matches(relatedTable(key),value,wanted.some));
      if('in' in wanted)return wanted.in.includes(actual);
      if('not' in wanted)return actual!==wanted.not;
      if('gt' in wanted)return actual>wanted.gt;
      if('lte' in wanted)return actual!==null&&actual!==undefined&&actual<=wanted.lte;
      return matches(relatedTable(key),actual,wanted);
    });
  }
  function result(table,row,args){
    if(!row)return null;
    const value=copy(row);
    if(args.include?.latestAnalysis)value.latestAnalysis=copy(tables.aiAnalysis.find(a=>a.id===row.latestAnalysisId));
    if(args.include?.slaInstance)value.slaInstance=copy(tables.slaInstance.find(a=>a.requestId===row.id)??null);
    if(args.include?.document)value.document=copy(relation(table,row,'document'));
    if(args.include?.aiRun)value.aiRun=copy(relation(table,row,'aiRun'));
    if(args.include?.recommendations)value.recommendations=copy(tables.aiRecommendation.filter(r=>r.aiRunId===row.id));
    if(args.include?.toolCalls)value.toolCalls=copy(tables.aiToolCall.filter(r=>r.aiRunId===row.id));
    if(args.select)return Object.fromEntries(Object.entries(args.select).filter(([,enabled])=>enabled).map(([key])=>[key,value[key]]));
    return value;
  }
  const update=(table,row,data)=>{
    writes.push({table,kind:'update',keys:Object.keys(data)});
    for(const [key,value] of Object.entries(data))row[key]=value&&typeof value==='object'&&'increment' in value?(row[key]??0)+value.increment:copy(value);
    return copy(row);
  };
  const prisma={};
  for(const table of Object.keys(tables))prisma[table]={
    findFirst:async(args={})=>result(table,tables[table].find(row=>matches(table,row,args.where)),args),
    findUnique:async(args={})=>result(table,tables[table].find(row=>matches(table,row,args.where)),args),
    findUniqueOrThrow:async(args={})=>{const row=tables[table].find(row=>matches(table,row,args.where));assert.ok(row,`Fixture missing ${table}`);return result(table,row,args);},
    findMany:async(args={})=>tables[table].filter(row=>matches(table,row,args.where)).slice(0,args.take??Infinity).map(row=>result(table,row,args)),
    create:async({data})=>{const row={id:randomUUID(),createdAt:new Date(),...(table==='aiRun'?{status:'QUEUED',retryCount:0,errorCode:null,safeResultJson:null,finishedAt:null,leaseUntil:null}:{}),...(table==='aiRecommendation'?{status:'PENDING',invalidatedAt:null,finalDecisionJson:null,managerChangesJson:null,reviewedById:null,reviewedAt:null}:{}),...copy(data)};tables[table].push(row);writes.push({table,kind:'create'});return copy(row);},
    createMany:async({data})=>{for(const row of data)await prisma[table].create({data:row});return {count:data.length};},
    update:async({where,data})=>{
      if(mode==='postgresql-temporary-error'&&table==='aiRun'&&data.status==='SUCCEEDED'&&!persistenceFault){persistenceFault=true;const error=new Error('Synthetic injected temporary persistence conflict');error.code='P2034';error.meta={database_error:'40001'};throw error;}
      const row=tables[table].find(r=>matches(table,r,where));assert.ok(row,`Fixture missing update ${table}`);return update(table,row,data);
    },
    updateMany:async({where,data})=>{const rows=tables[table].filter(r=>matches(table,r,where));rows.forEach(row=>update(table,row,data));return {count:rows.length};},
    groupBy:async()=>[],
  };
  prisma.$transaction=async fn=>{const before=copy(tables),beforeWrites=writes.length;try{return await fn(prisma);}catch(error){tables=before;writes.length=beforeWrites;throw error;}};
  prisma.$executeRaw=async query=>{const sql=query.strings?.join('')??String(query);assert.ok(/SET |INSERT INTO "RequestEmbedding"/.test(sql),`Unhandled fixture execute: ${sql}`);return 1;};
  prisma.$queryRaw=async query=>{
    const sql=query.strings?.join('')??String(query);
    if(sql.includes('clock_timestamp'))return [{now:new Date()}];
    if(sql.includes('pg_attribute'))return [{type:'vector(1024)',index:true}];
    if(sql.includes('AS count FROM "KnowledgeChunk"'))return [{count:0}];
    if(sql.includes('WITH eligible AS MATERIALIZED'))return mode==='retrieval-empty'?[]:[copy(source)];
    if(sql.includes('WITH current_request AS MATERIALIZED'))return mode==='stale-history'?[{requestId:prior.id,publicCode:prior.publicCode,title:prior.title,status:prior.status,category:prior.category,location:prior.location,createdAt:prior.createdAt,contextVersion:2,cosine:.9,vector:.95,categoryMatch:1,locationMatch:1,recency:1,score:.97}]:[];
    if(sql.includes('SELECT u.id AS "staffId"'))return [{staffId:staff.id,displayName:staff.displayName,teamId:team.id,skillCodes:['IOT'],activeWorkload:0}];
    if(sql.includes('SELECT m.id FROM "TeamMember"'))return [{id:uuid(14)}];
    if(sql.includes('FOR SHARE')||sql.includes('FOR UPDATE'))return [{id:request.id}];
    assert.fail(`Unhandled fixture query: ${sql}`);
  };
  return {prisma,writes,external,source,manager,requestId:request.id,priorId:prior.id,teamId:team.id,staffId:staff.id,sessionId:sessions[0].id,freshSessionId:sessions[1].id,get tables(){return tables;}};
}

const business=(store)=>({request:copy(store.tables.request.find(r=>r.id===store.requestId)),...Object.fromEntries(protectedTables.map(table=>[table,copy(store.tables[table])]))});

async function harness(mode){
  const store=repository(mode),calls={chat:0,tags:0,embed:0};
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=raw?JSON.parse(raw):null;res.setHeader('Content-Type','application/json');
    if(req.url==='/api/tags'){
      calls.tags++;if(mode==='ollama-unavailable'||mode==='embedding-unavailable'){res.statusCode=503;res.end('{}');return;}
      res.end(JSON.stringify({models:[{name:'qwen3:4b-instruct-2507-q4_K_M',digest:'m15-http-fixture-no-live-model'},{name:'bge-m3:latest',digest:'m15-http-fixture-no-live-embedding'}]}));return;
    }
    if(req.url==='/api/embed'){calls.embed++;res.end(JSON.stringify({model:'bge-m3:latest',embeddings:body.input.map(()=>Array.from({length:1024},(_,i)=>i===0?1:0))}));return;}
    assert.equal(req.url,'/api/chat');calls.chat++;
    if(mode==='ollama-timeout')return;
    const evidence=JSON.parse(body.messages[1].content).evidence,proposal=recommendationFixture(evidence);
    if(mode==='revoked-session'){store.tables.refreshSession[0].revokedAt=new Date();store.external.push('initiating session revoked');}
    if(mode==='expired-session'){store.tables.refreshSession[0].expiresAt=new Date(Date.now()-1);store.external.push('initiating session expired');}
    if(mode==='stale-request-version'){store.tables.request[0].version++;store.external.push('request version changed by concurrent actor');}
    if(mode==='stale-source'){store.tables.knowledgeDocument[0].status='DISABLED';store.external.push('knowledge source disabled by concurrent actor');}
    if(mode==='stale-history'){store.tables.request[1].version++;store.external.push('historical request version changed by concurrent actor');}
    if(mode==='invalid-reference')proposal.evidence[0].referenceId=uuid(99);
    const output=mode==='invalid-json'?'{broken':mode==='schema-invalid'?JSON.stringify({...proposal,execute:'assignAutomatically'}):mode==='oversized-output'?'x'.repeat(32769):JSON.stringify(proposal);
    res.end(JSON.stringify({model:body.model,done:true,done_reason:'stop',message:{content:output,thinking:'Fixture private reasoning must not escape'}}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const env=parseApiEnvironment({NODE_ENV:'test',DATABASE_URL:'postgresql://synthetic:synthetic@localhost/m15_in_memory_only',JWT_SECRET:'a'.repeat(40),REFRESH_TOKEN_SECRET:'b'.repeat(40),AI_GENERATION_PROVIDER:'ollama',AI_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector',OLLAMA_MODEL:'qwen3:4b-instruct-2507-q4_K_M',OLLAMA_EMBEDDING_MODEL:'bge-m3:latest',OLLAMA_BASE_URL:`http://127.0.0.1:${server.address().port}`,EMBEDDING_DIMENSION:'1024',AI_ATTEMPT_TIMEOUT_MS:'150',AI_RUN_TIMEOUT_MS:'15000'});
  const realEmbeddings=new OllamaEmbeddingProvider(env);
  // Keep provider-offline injection at generation so request/retrieval preparation
  // still executes. Embedding failure uses the real HTTP embedding adapter.
  const fixed={provider:'fixture',model:'m15-only',digest:'test-only',dimension:1024,revision:'test',key:'m15-only'};
  const embeddings=mode==='ollama-unavailable'?{embedQuery:async()=>({identity:fixed,vectors:[Array.from({length:1024},(_,i)=>i===0?1:0)],latencyMs:0})}:realEmbeddings;
  const vectors=new VectorRepository(store.prisma,env),requests=new RequestVectors(store.prisma,embeddings),retriever=new KnowledgeRetriever(store.prisma,vectors,embeddings,env),tools=new DomainTools(store.prisma,retriever,requests),machine=new RequestStateMachineService(store.prisma,new AuthorizationPolicyService(),env,vectors);
  const service=new RecommendationService(store.prisma,machine,tools,requests,vectors,env,new OllamaProvider(env));
  return {store,calls,machine,service,actor:{...store.manager,sessionId:store.sessionId},close:()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));}};
}

async function manualWorkflow(h){
  const actor={...h.actor,sessionId:h.store.freshSessionId},request=()=>h.store.tables.request.find(r=>r.id===h.store.requestId);
  const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'MEDIUM',teamId:h.store.teamId,staffId:h.store.staffId,actions:[{text:'Human-authored connection check.',required:true,sourceIds:[],provenance:'HUMAN'}],acknowledgedMissingFields:[],reason:'Explicit synthetic manager fallback after reliability scenario.'};
  await h.machine.transition(h.store.requestId,'MANUAL_TRIAGE',actor,{expectedVersion:request().version,finalDecision:decision},randomUUID());
  await h.machine.transition(h.store.requestId,'SUBMIT_FOR_APPROVAL',actor,{expectedVersion:request().version,manualDraftRevision:request().manualDraftRevision},randomUUID());
  await h.machine.transition(h.store.requestId,'APPROVE_AND_ASSIGN',actor,{expectedVersion:request().version,manualDraftRevision:request().manualDraftRevision,reviewKind:'MANUAL'},randomUUID());
  assert.equal(request().status,'ASSIGNED');assert.equal(h.store.tables.assignment.length,1);assert.equal(h.store.tables.slaInstance.length,1);assert.equal(h.store.tables.checklist.length,1);
}

export async function runM15ReliabilityScenario(mode){
  assert.ok(M15_FAILURE_MODES.includes(mode));
  const h=await harness(mode),started=performance.now();
  try{
    const before=business(h.store),run=await h.service.schedule(h.store.requestId,h.actor,before.request.version,randomUUID());
    assert.equal(await h.service.cycle(new AbortController().signal),true);
    const final=h.store.tables.aiRun.find(r=>r.id===run.id),expected={
      'ollama-unavailable':'AI_PROVIDER_UNAVAILABLE','ollama-timeout':'AI_TIMEOUT','invalid-json':'AI_INVALID_OUTPUT','schema-invalid':'AI_INVALID_OUTPUT','oversized-output':'AI_OUTPUT_TOO_LARGE','invalid-reference':'INVALID_REFERENCE','embedding-unavailable':'EMBEDDING_UNAVAILABLE','retrieval-empty':null,'postgresql-temporary-error':'RECOMMENDATION_UNAVAILABLE','revoked-session':'UNAUTHORIZED','expired-session':'UNAUTHORIZED','stale-request-version':'STALE_CONTEXT','stale-source':'STALE_SOURCE','stale-history':'STALE_CASES',
    }[mode];
    assert.equal(final.errorCode,expected);assert.equal(final.status,mode==='retrieval-empty'?'SUCCEEDED':'FAILED');
    const after=business(h.store);if(mode==='stale-request-version')before.request.version++;
    assert.deepEqual(after,before,'AI execution must not change protected business state; concurrent test mutation is explicit');
    const publications=h.store.tables.aiRecommendation.length;
    assert.equal(publications,mode==='retrieval-empty'?1:0);
    if(mode==='retrieval-empty'){
      assert.equal(final.safeResultJson.evidenceStatus,'INSUFFICIENT_EVIDENCE');assert.deepEqual(final.safeResultJson.procedureSources,[]);assert.deepEqual(final.safeResultJson.suggestedChecklist,[]);
      const view=await h.service.view(h.store.requestId,h.actor);assert.equal(view.recommendation.evidenceStatus,'INSUFFICIENT_EVIDENCE');assert.equal(view.stale,false);
    }else{
      assert.equal(final.safeResultJson,null,'Failed run must expose no accepted partial result');
      assert.equal(h.store.tables.auditLog.filter(r=>r.action==='AI_RECOMMENDATION_V2_CREATED').length,0,'No successful publication audit survives a failed transaction');
      const view=await h.service.view(h.store.requestId,{...h.actor,sessionId:h.store.freshSessionId});assert.equal(view.recommendation,null);assert.equal(view.evidence,null);
    }
    if(['revoked-session','expired-session'].includes(mode)){
      const beforeDenied=copy(h.store.tables);
      await assert.rejects(h.service.view(h.store.requestId,h.actor),error=>error.code==='UNAUTHORIZED');
      await assert.rejects(h.service.schedule(h.store.requestId,h.actor,h.store.tables.request[0].version,randomUUID()),error=>error.code==='UNAUTHORIZED');
      assert.deepEqual(h.store.tables,beforeDenied,'Revoked/expired session read and scheduling fail without writes');
    }
    assert.ok(h.calls.chat<=2);assert.ok(final.retryCount<=1);
    const attempts=h.store.tables.auditLog.filter(r=>r.action==='RECOMMENDATION_ATTEMPT_FAILED');
    if(['ollama-unavailable','ollama-timeout','invalid-json','schema-invalid','invalid-reference'].includes(mode)){assert.equal(final.retryCount,1);assert.equal(attempts.length,2);}
    if(mode==='oversized-output'){assert.equal(h.calls.chat,1);assert.equal(final.retryCount,0);}
    if(mode==='embedding-unavailable'){assert.equal(h.calls.chat,0);assert.equal(h.calls.tags,2);}
    assert.ok(!JSON.stringify(h.store.tables).includes('Fixture private reasoning'));
    await manualWorkflow(h);
    return {id:mode,status:'PASS',expectedObserved:mode==='retrieval-empty'?'bounded insufficient advisory, no procedural claims':'safe failure; no partial publication; no business mutation; explicit human fallback',errorCode:final.errorCode,attempts:mode==='ollama-unavailable'?attempts.length:h.calls.chat,embeddingHttpInventoryAttempts:mode==='embedding-unavailable'?h.calls.tags:null,retryCount:final.retryCount,publicationCount:publications,businessUnchanged:true,manualAvailable:true,externalChanges:h.store.external,method:'Real worker, HTTP provider/embedding adapters, tool registry, retrieval/reference validation, and state machine; in-memory repositories with transaction rollback fixture (not real PostgreSQL).',durationMs:Math.round(performance.now()-started)};
  }finally{await h.close();}
}

export async function runM15StateRejectionScenario(state){
  assert.ok(statuses.includes(state)&&state!=='TRIAGED');
  const h=await harness('invalid-json');
  try{
    h.store.tables.request[0].status=state;const before=copy(h.store.tables);
    await assert.rejects(h.service.schedule(h.store.requestId,h.actor,h.store.tables.request[0].version,randomUUID()),error=>error.code==='INVALID_STATE');
    assert.deepEqual(h.store.tables,before);assert.equal(h.calls.chat,0);
    if(state==='NEW')await manualWorkflow(h);
    return {id:`state-${state.toLowerCase()}`,status:'PASS',expectedObserved:'generation rejected before queue/provider work; all rows unchanged',errorCode:'INVALID_STATE',attempts:0,publicationCount:0,businessUnchanged:true,manualAvailable:['NEW'].includes(state)?true:null,method:'Real RecommendationService.schedule state guard with in-memory repository; manual approval applicability follows canonical state machine.'};
  }finally{await h.close();}
}

export async function runM15PublishedStaleScenario(){
  const h=await harness('retrieval-empty');
  try{
    const run=await h.service.schedule(h.store.requestId,h.actor,h.store.tables.request[0].version,randomUUID());
    await h.service.cycle(new AbortController().signal);
    const fresh=await h.service.view(h.store.requestId,h.actor);assert.equal(fresh.stale,false);assert.ok(fresh.recommendationId);
    // Change happens after successful generation and publication, independent of
    // fixture prose. Both accept and reject must preserve stale history intact.
    h.store.tables.request[0].version++;
    const stale=await h.service.view(h.store.requestId,h.actor);assert.equal(stale.stale,true);assert.ok(stale.staleReasons.includes('STALE_CONTEXT'));
    const before=copy(h.store.tables);
    for(const action of ['APPROVE_AND_ASSIGN','REJECT_APPROVAL'])await assert.rejects(h.machine.transition(h.store.requestId,action,h.actor,{expectedVersion:h.store.tables.request[0].version,reviewKind:'AI',recommendationId:fresh.recommendationId,acknowledgedMissingFields:[],reason:'Synthetic stale review should be refused.'},randomUUID()),error=>error.code==='STALE_RECOMMENDATION');
    assert.deepEqual(h.store.tables,before,'Every stale artifact review changes nothing');
    assert.equal(h.store.tables.aiRun.find(r=>r.id===run.id).status,'SUCCEEDED');assert.equal(h.store.tables.aiRecommendation[0].status,'PENDING');
    await manualWorkflow(h);
    return {id:'published-request-stale',status:'PASS',expectedObserved:'published artifact marked stale; accept/reject denied with no writes; fresh manual fallback succeeds',errorCode:'STALE_RECOMMENDATION',attempts:h.calls.chat,publicationCount:1,businessUnchanged:true,manualAvailable:true,method:'Real RecommendationService.view and RequestStateMachineService advisory review, with explicit post-publication version change and in-memory repository.'};
  }finally{await h.close();}
}

export async function runM15FailureMatrix(){
  const rows=[];
  for(const mode of M15_FAILURE_MODES)rows.push(await runM15ReliabilityScenario(mode));
  for(const state of statuses.filter(s=>s!=='TRIAGED'))rows.push(await runM15StateRejectionScenario(state));
  rows.push(await runM15PublishedStaleScenario());
  return rows;
}
