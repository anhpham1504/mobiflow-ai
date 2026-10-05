import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../dist/database/prisma.service.js';
import {RequestVectors,requestInputVersion} from '../dist/ai/tools/request-vectors.js';
import {AnalysisWorker} from '../dist/ai/analysis-worker.js';
import {KnowledgeFailure,identityKey} from '../dist/knowledge/embedding-provider.js';
import {RagHealth} from '../dist/knowledge/rag-health.js';
import {RequestStateMachineService} from '../dist/requests/request-state-machine.service.js';
import {AuthorizationPolicyService} from '../dist/authorization/authorization-policy.service.js';

const url=process.env.M2_INTEGRATION_DATABASE_URL;
assert.ok(url&&new URL(url).pathname==='/mobiflow_m2_test'&&['127.0.0.1','localhost'].includes(new URL(url).hostname),'Dedicated synthetic test DB required');
const base={provider:'fixture',model:'stability-controlled',digest:'fixture-only',dimension:1024,revision:'m5.v1'},identity={...base,key:identityKey(base)},vector=[1,...Array(1023).fill(0)];
const batch={identity,vectors:[vector],latencyMs:0},signal=()=>AbortSignal.timeout(30000);

test('EMB-01–10 real PostgreSQL: bounded fair recovery, lifecycle and protected-state preservation',async t=>{
 const db=new PrismaService(url);t.after(()=>db.$disconnect());
 const user=await db.user.findFirstOrThrow({where:{role:'USER',active:true}}),prefix=randomUUID().slice(0,8),ids=[];
 for(let i=0;i<12;i++){const r=await db.request.create({data:{publicCode:`TEST-${prefix}-${i}`,createdById:user.id,title:'Synthetic embedding recovery '+i,description:'Synthetic only; private notes never enter this text.'}});ids.push(r.id);}
 const originalRows=async()=>({requests:await db.request.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}}),counts:await Promise.all(['requestStatusHistory','auditLog','requestMessage','assignment','slaInstance','notification'].map(k=>db[k].count()))});
 const rows=async(id)=>db.$queryRaw`SELECT "contextVersion" FROM "RequestEmbedding" WHERE "requestId"=${id}::uuid AND "modelIdentity"=${identity.key}`;
 let clock=100000,hook=async()=>{},providerCalls=0;
 const provider={probe:async()=>batch,embedQuery:async text=>{providerCalls++;await hook(text);return batch;}};
 const vectors=new RequestVectors(db,provider);
 const drain=async()=>{for(let i=0;i<100;i++){clock+=61000;await vectors.next(signal(),clock);const missing=await db.$queryRaw`SELECT count(*)::int AS n FROM "Request" r WHERE r.status<>'CANCELED' AND NOT EXISTS(SELECT 1 FROM "RequestEmbedding" e WHERE e."requestId"=r.id AND e."contextVersion"=r.version AND e."modelIdentity"=${identity.key})`;if(!missing[0].n)return;}assert.fail('Fair scan did not converge within100 bounded ticks');};
 await t.test('version changes during inference never persist stale vectors',async()=>{
  hook=async text=>{if(text.startsWith('Synthetic embedding recovery 0\n'))await db.request.update({where:{id:ids[0]},data:{version:{increment:1}}});};
  await assert.rejects(vectors.index(ids[0],signal()),e=>e.code==='STALE_CONTEXT');assert.deepEqual(await rows(ids[0]),[]);hook=async()=>{};
 });
 await t.test('a repeatedly stale request cannot starve a queue larger than one batch',async()=>{
  const hot=ids.toSorted()[0],title=(await db.request.findUniqueOrThrow({where:{id:hot}})).title;let races=0;
  hook=async text=>{if(text.startsWith(title+'\n')&&races++<3)await db.request.update({where:{id:hot},data:{version:{increment:1}}});};
  let stale=0;for(let i=0;i<75;i++){clock+=1000;try{await vectors.next(signal(),clock);}catch(e){assert.equal(e.code,'STALE_CONTEXT');stale++;}}
  assert.ok(stale>=1);hook=async()=>{};await drain();
  const indexed=await db.$queryRaw`SELECT count(DISTINCT r.id)::int AS n FROM "Request" r JOIN "RequestEmbedding" e ON e."requestId"=r.id AND e."contextVersion"=r.version AND e."modelIdentity"=${identity.key} WHERE r.id=ANY(${ids}::uuid[])`;assert.equal(indexed[0].n,12);
 });
 await t.test('provider outage backs off and automatically converges after recovery',async()=>{
  await db.request.update({where:{id:ids[1]},data:{version:{increment:1}}});const before=await originalRows();let faults=2;
  hook=async()=>{if(faults-->0)throw new KnowledgeFailure('EMBEDDING_UNAVAILABLE',true);};
  for(let i=0;i<2;i++){clock+=61000;await assert.rejects(vectors.next(signal(),clock),e=>e.code==='EMBEDDING_UNAVAILABLE');const calls=providerCalls;await vectors.next(signal(),clock+500);assert.equal(providerCalls,calls);}
  await drain();assert.deepEqual(await originalRows(),before);assert.equal(vectors.backfillStatus.state,'READY');
 });
  await t.test('EMB-04 provider DOWN to UP preserves manual commands and honest readiness until real PG convergence',async()=>{
   let available=true,calls=0;
   const controlled={probe:async()=>{calls++;if(!available)throw new KnowledgeFailure('EMBEDDING_UNAVAILABLE',true);return batch;},embedQuery:async()=>{calls++;if(!available)throw new KnowledgeFailure('EMBEDDING_UNAVAILABLE',true);return batch;}};
   const recovering=new RequestVectors(db,controlled);
   // Corpus/provider are controlled fixtures; current-index checks and writes use real PostgreSQL.
   const healthDb={knowledgeDocument:{count:async()=>1},$queryRaw:(parts,...values)=>parts[0].includes('KnowledgeChunk')?Promise.resolve([{count:1}]):db.$queryRaw(parts,...values)};
   const health=new RagHealth(healthDb,{compatible:async()=>{}},controlled,{NODE_ENV:'test',AI_RAG_ENABLED:true},recovering);
   await health.refresh();assert.equal(health.view().status,'READY');
   const session=await db.refreshSession.create({data:{id:randomUUID(),familyId:randomUUID(),userId:user.id,tokenHash:randomUUID().replaceAll('-','').repeat(2),expiresAt:new Date(Date.now()+60000)}});
   const actor={id:user.id,role:'USER',sessionId:session.id},policy=new AuthorizationPolicyService(),machine=new RequestStateMachineService(db,policy,{AI_AUTO_ANALYZE:false},{});
   available=false;await health.refresh();assert.equal(health.view().status,'NOT_READY');assert.equal(health.view().embedding,'DOWN');assert.equal(health.view().errorCode,'EMBEDDING_UNAVAILABLE');
   const before=await db.request.findFirstOrThrow({where:{id:ids[7],...policy.requestScope(actor)}});policy.assertCanReadRequest(actor,before);
   const body='Synthetic manual update remains available during embedding outage.';
   await machine.transition(before.id,'MESSAGE',actor,{expectedVersion:before.version,body},randomUUID());
   const after=await db.request.findFirstOrThrow({where:{id:before.id,...policy.requestScope(actor)}});assert.equal(after.version,before.version+1);assert.equal(after.status,before.status);assert.equal(await db.requestMessage.count({where:{requestId:before.id,body}}),1);
   const protectedAfterManual=await originalRows();await assert.rejects(machine.transition(before.id,'MESSAGE',actor,{expectedVersion:before.version,body:'Stale manual command must not write.'},randomUUID()),e=>e.code==='STALE_VERSION');assert.deepEqual(await originalRows(),protectedAfterManual);
   clock+=61000;await assert.rejects(recovering.next(signal(),clock),e=>e.code==='EMBEDDING_UNAVAILABLE');assert.equal(recovering.backfillStatus.state,'RETRY_WAIT');const failedCalls=calls;await recovering.next(signal(),clock+500);assert.equal(calls,failedCalls);assert.deepEqual(await originalRows(),protectedAfterManual);
   available=true;await health.refresh();assert.equal(health.view().embedding,'UP');assert.equal(health.view().status,'NOT_READY');assert.equal(health.view().errorCode,'REQUEST_INDEX_INCOMPLETE');
   clock+=1000;const recovered=await recovering.next(signal(),clock);assert.equal(recovered.previousErrorCode,'EMBEDDING_UNAVAILABLE');assert.equal(recovered.contextVersion,after.version);assert.equal(recovering.backfillStatus.state,'READY');
   const current=await db.$queryRaw`SELECT count(*)::int AS n FROM "RequestEmbedding" WHERE "requestId"=${after.id}::uuid AND "contextVersion"=${after.version} AND "modelIdentity"=${identity.key} AND dimension=${identity.dimension} AND "inputVersion"=${requestInputVersion}`;assert.equal(current[0].n,1);assert.deepEqual(await originalRows(),protectedAfterManual);
   await health.refresh();assert.equal(health.view().status,'READY');assert.equal(health.view().errorCode,null);await db.refreshSession.update({where:{id:session.id},data:{revokedAt:new Date()}});
  });
 await t.test('dimension/digest mismatch blocks without writing or repeated inference',async()=>{
  for(const changed of [{...identity,dimension:768},{...identity,key:'foreign-digest'}]){
   const failing=new RequestVectors(db,{probe:async()=>batch,embedQuery:async()=>({...batch,identity:changed})});
   await db.request.update({where:{id:ids[2]},data:{version:{increment:1}}});const before=await rows(ids[2]);
   await assert.rejects(failing.next(signal(),clock+=61000),e=>['EMBEDDING_DIMENSION_MISMATCH','INDEX_MODEL_MISMATCH'].includes(e.code));assert.equal(failing.backfillStatus.state,'BLOCKED');await failing.next(signal(),clock+999999);assert.deepEqual(await rows(ids[2]),before);
  }
  await drain();
 });
 await t.test('concurrent attempts deduplicate and preserve every business field',async()=>{
  const before=await originalRows(),prior=await rows(ids[3]);await Promise.all([vectors.index(ids[3],signal()),vectors.index(ids[3],signal())]);assert.deepEqual(await rows(ids[3]),prior);assert.deepEqual(await originalRows(),before);
 });
 await t.test('cancellation during inference cannot publish a vector',async()=>{
  hook=async text=>{if(text.startsWith('Synthetic embedding recovery 4\n'))await db.request.update({where:{id:ids[4]},data:{status:'CANCELED',version:{increment:1}}});};
  const prior=await rows(ids[4]);await assert.rejects(vectors.index(ids[4],signal()),e=>e.code==='STALE_CONTEXT');assert.deepEqual(await rows(ids[4]),prior);hook=async()=>{};await drain();
 });
 await t.test('worker shutdown aborts inference, waits for completion and fresh worker recovers',async()=>{
  await db.request.update({where:{id:ids[5]},data:{version:{increment:1}}});let entered;const started=new Promise(r=>{entered=r;});
  const pendingProvider={probe:async()=>batch,embedQuery:async(_text,s)=>{entered();await new Promise(resolve=>s.addEventListener('abort',resolve,{once:true}));throw new KnowledgeFailure('KNOWLEDGE_CANCELED');}};
  const paused=new RequestVectors(db,pendingProvider),logs=[];
  const workerDb={aiRun:{findMany:async()=>[],findFirst:async()=>null}};
  const worker=new AnalysisWorker(workerDb,{}, {},entry=>logs.push(entry),false,{}, {},{cycle:async()=>false},paused,{cycle:async()=>false});
  const before=await originalRows(),pending=worker.tick();await started;await worker.onModuleDestroy();await pending;assert.equal(paused.backfillStatus.state,'STOPPED');assert.ok(logs.some(l=>l.category==='LIFECYCLE'));assert.deepEqual(await originalRows(),before);
  await drain();assert.equal(vectors.backfillStatus.state,'READY');
 });
 await t.test('readiness distinguishes provider UP from incomplete current index',async()=>{
  await db.request.update({where:{id:ids[6]},data:{version:{increment:1}}});
  // Real request-index query with a controlled healthy corpus/provider, no fake vectors.
  const healthDb={knowledgeDocument:{count:async()=>1},$queryRaw:(parts,...values)=>parts[0].includes('KnowledgeChunk')?Promise.resolve([{count:1}]):db.$queryRaw(parts,...values)};
  const health=new RagHealth(healthDb,{compatible:async()=>{}},provider,{NODE_ENV:'test',AI_RAG_ENABLED:true},vectors);
  await health.refresh();assert.equal(health.view().status,'NOT_READY');assert.equal(health.view().errorCode,'REQUEST_INDEX_INCOMPLETE');await drain();await health.refresh();assert.equal(health.view().status,'READY');
 });
 assert.equal(await db.request.count({where:{id:{in:ids},status:'CANCELED'}}),1);
});
