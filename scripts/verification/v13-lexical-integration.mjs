import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import pg from 'pg';
import {parseApiEnvironment} from '@mobiflow/config';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {VectorRepository} from '../../apps/api/dist/knowledge/vector.repository.js';
import {LexicalRepository} from '../../apps/api/dist/knowledge/lexical.repository.js';
import {KnowledgeRetriever} from '../../apps/api/dist/knowledge/retriever.js';
import {DocumentService} from '../../apps/api/dist/knowledge/document.service.js';
import {IngestionWorker} from '../../apps/api/dist/knowledge/ingestion-worker.js';
import {decideRecommendationEvidence} from '../../apps/api/dist/ai/recommendation-evidence-decision.js';

const {Pool}=pg,ownerUrl=process.env.MIGRATION_DATABASE_URL,appUrl=process.env.DATABASE_URL,testDatabase='mobiflow_v13_lexical_test';
assert.equal(process.env.V13_ISOLATED_DATABASE_ACK,'mobiflow-deepseek-lexical-20261023','Explicit isolated database acknowledgement required');
for(const raw of [ownerUrl,appUrl]){assert.ok(raw);const url=new URL(raw);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.port,'55439');assert.equal(url.pathname,process.env.V13_LEXICAL_CHILD==='1'?`/${testDatabase}`:'/mobiflow');}
if(process.env.V13_LEXICAL_CHILD!=='1'){
  const adminUrl=new URL(ownerUrl);adminUrl.pathname='/postgres';
  const ownerTestUrl=new URL(ownerUrl);ownerTestUrl.pathname=`/${testDatabase}`;
  const appTestUrl=new URL(appUrl);appTestUrl.pathname=`/${testDatabase}`;
  const admin=new Pool({connectionString:adminUrl.toString(),max:1});let exitCode=1;
  try{
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${testDatabase}' AND pid<>pg_backend_pid()`);
    await admin.query(`DROP DATABASE IF EXISTS ${testDatabase}`);await admin.query(`CREATE DATABASE ${testDatabase}`);
    const migration=spawnSync(process.execPath,['scripts/dev/prisma.mjs','migrate','deploy'],{cwd:process.cwd(),env:{...process.env,MIGRATION_DATABASE_URL:ownerTestUrl.toString()},stdio:'inherit'});
    if(migration.status!==0)throw new Error('V1.3 isolated migration failed');
    const child=spawnSync(process.execPath,['scripts/verification/v13-lexical-integration.mjs'],{cwd:process.cwd(),env:{...process.env,V13_LEXICAL_CHILD:'1',MIGRATION_DATABASE_URL:ownerTestUrl.toString(),DATABASE_URL:appTestUrl.toString()},stdio:'inherit'});
    exitCode=child.status??1;
  }finally{
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${testDatabase}' AND pid<>pg_backend_pid()`).catch(()=>{});
    await admin.query(`DROP DATABASE IF EXISTS ${testDatabase}`).catch(()=>{});await admin.end();
  }
  process.exit(exitCode);
}
const env=parseApiEnvironment({NODE_ENV:'test',DATABASE_URL:appUrl,JWT_SECRET:'A'.repeat(40),REFRESH_TOKEN_SECRET:'B'.repeat(40),AI_GENERATION_PROVIDER:'deepseek',RAG_RETRIEVAL_MODE:'lexical',AI_LIVE_CALLS_ENABLED:'false',AI_RAG_ENABLED:'true',KNOWLEDGE_STORAGE_ROOT:resolve('artifacts/v13/lexical-storage')});
const owner=new Pool({connectionString:ownerUrl,max:1}),appPool=new Pool({connectionString:appUrl,max:1}),prisma=new PrismaService(appUrl);
const managerId='13000000-0000-4000-8000-000000000001',sessionId='13000000-0000-4000-8000-000000000002',familyId='13000000-0000-4000-8000-000000000003';
const actor={id:managerId,role:'MANAGER',sessionId},embeddingCalls={probe:0,documents:0,query:0};
const forbiddenEmbeddings={
  probe:async()=>{embeddingCalls.probe++;throw new Error('LEXICAL_PROFILE_MUST_NOT_PROBE_EMBEDDINGS');},
  embedDocuments:async()=>{embeddingCalls.documents++;throw new Error('LEXICAL_PROFILE_MUST_NOT_EMBED_DOCUMENTS');},
  embedQuery:async()=>{embeddingCalls.query++;throw new Error('LEXICAL_PROFILE_MUST_NOT_EMBED_QUERY');},
};
const vector=new VectorRepository(prisma,env),lexical=new LexicalRepository(prisma),documents=new DocumentService(prisma,vector,env,lexical),logs=[];
const worker=new IngestionWorker(prisma,documents,vector,forbiddenEmbeddings,env,false,entry=>logs.push(entry),lexical),retriever=new KnowledgeRetriever(prisma,vector,forbiddenEmbeddings,env,lexical);
const upload=async(title,content)=>{const buffer=Buffer.from(content);const row=await documents.upload(actor,{title},{originalname:title.replace(/[^a-z0-9]+/giu,'-')+'.txt',mimetype:'text/plain',buffer,size:buffer.length},randomUUID());await worker.tick();return prisma.knowledgeDocument.findUniqueOrThrow({where:{id:row.id}});};
try{
  await owner.query(`INSERT INTO "User" (id,email,"passwordHash","displayName",role,active,available,"createdAt","updatedAt") VALUES ($1,'v13.manager@synthetic.invalid','not-used','V13 Synthetic Manager','MANAGER',true,true,now(),now())`,[managerId]);
  await owner.query(`INSERT INTO "RefreshSession" (id,"userId","familyId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4,now()+interval '1 day')`,[sessionId,managerId,familyId,'c'.repeat(64)]);
  await lexical.compatible();
  let network=await upload('SOP-IOT-04 - Xử lý mất kết nối IoT',`# SOP-IOT-04 - Xử lý mất kết nối IoT
Áp dụng khi SIM IoT mất kết nối mạng hoặc thiết bị báo offline.
Nhân viên kiểm tra trạng thái SIM, APN và vùng phủ sóng; ghi nhận kết quả đầy đủ trước khi đề xuất thay đổi cấu hình NETWORK.`);
  const billing=await upload('SOP-BILLING-02 - Đối soát cước',`# SOP-BILLING-02 - Đối soát cước
Đối chiếu hóa đơn, chu kỳ cước và giao dịch thanh toán trước khi xử lý khiếu nại. Không dùng tài liệu này để xử lý sự cố kết nối IoT.`);
  const disabled=await upload('FAQ-IOT-OLD - Nguồn phải bị loại',`# FAQ-IOT-OLD
SIM IoT mất kết nối mạng; nguồn này sẽ bị vô hiệu hóa và không được truy xuất.`);
  await documents.command(disabled.id,actor,disabled.version,'disable',randomUUID(),'Synthetic authorization/currentness check');
  await documents.command(network.id,actor,network.version,'reindex',randomUUID(),'Synthetic generation-currentness check');await worker.tick();network=await prisma.knowledgeDocument.findUniqueOrThrow({where:{id:network.id}});assert.equal(network.activeGeneration,2);
  assert.deepEqual(embeddingCalls,{probe:0,documents:0,query:0});

  const exact=await retriever.search('SOP-IOT-04',AbortSignal.timeout(5000));assert.ok(exact.sources.length);assert.equal(exact.sources[0].documentId,network.id);assert.ok(exact.sources.every(source=>source.generation===2));
  const accented=await retriever.search('SIM IoT mất kết nối mạng',AbortSignal.timeout(5000)),plain=await retriever.search('sim iot mat ket noi mang',AbortSignal.timeout(5000));assert.equal(accented.sources[0].sourceId,plain.sources[0].sourceId);
  const synonym=await retriever.search('thiết bị IoT offline kiểm tra APN',AbortSignal.timeout(5000)),typo=await retriever.search('sim iot mat ket noii',AbortSignal.timeout(5000));assert.equal(synonym.sources[0].documentId,network.id);assert.equal(typo.sources[0].documentId,network.id);
  const bill=await retriever.search('đối chiếu hóa đơn chu kỳ cước',AbortSignal.timeout(5000));assert.equal(bill.sources[0].documentId,billing.id);
  const none=await retriever.search('quasar xenolith orbital',AbortSignal.timeout(5000));assert.deepEqual(none.sources,[]);
  for(const result of [exact,accented,plain,synonym,typo,bill])assert.ok(result.sources.every(source=>source.documentId!==disabled.id));
  const repeat=await retriever.search('SIM IoT mất kết nối mạng',AbortSignal.timeout(5000));assert.deepEqual(repeat.sources.map(source=>source.sourceId),accented.sources.map(source=>source.sourceId));
  const decision=decideRecommendationEvidence({analysis:{category:'NETWORK',subcategory:'IOT_CONNECTIVITY',missingFields:[]},sources:accented.sources,requestContext:{status:'TRIAGED'}});assert.deepEqual(decision.selectedProcedureSourceIds,[accented.sources[0].sourceId]);assert.equal(decision.eligibleProcedureSourceIds.some(id=>accented.sources.find(source=>source.sourceId===id)?.documentId===billing.id),false);
  const mismatch=decideRecommendationEvidence({analysis:{category:'ACCOUNT',subcategory:'ACCESS_ISSUE',missingFields:[]},sources:accented.sources,requestContext:{status:'TRIAGED'}});assert.equal(mismatch.evidenceStatus,'INSUFFICIENT_EVIDENCE');
  await assert.rejects(retriever.search('x'.repeat(2001),AbortSignal.timeout(5000)),error=>error.code==='INVALID_QUERY');
  await retriever.search(`SIM'; DROP TABLE "KnowledgeChunk"; --`,AbortSignal.timeout(5000));assert.equal((await appPool.query(`SELECT to_regclass('public."KnowledgeChunk"') IS NOT NULL AS present`)).rows[0].present,true);
  const unicode=await retriever.search('📡 SIM IoT mất kết nối tại Khu Công Nghiệp',AbortSignal.timeout(5000));assert.equal(unicode.sources[0].documentId,network.id);
  assert.deepEqual(embeddingCalls,{probe:0,documents:0,query:0});

  const nullVectors=await appPool.query(`SELECT count(*)::int AS count FROM "KnowledgeChunk" WHERE "documentId"=$1 AND (embedding IS NOT NULL OR "modelIdentity" IS NOT NULL OR dimension IS NOT NULL)`,[network.id]);assert.equal(nullVectors.rows[0].count,0);
  const generations=await appPool.query(`SELECT generation,count(*)::int AS count FROM "KnowledgeChunk" WHERE "documentId"=$1 GROUP BY generation ORDER BY generation`,[network.id]);assert.deepEqual(generations.rows.map(row=>row.generation),[1,2]);
  const vectorState=await owner.query(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS extension,format_type(a.atttypid,a.atttypmod) AS type,EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='KnowledgeChunk_embedding_cosine_hnsw') AS index FROM pg_attribute a WHERE a.attrelid='"KnowledgeChunk"'::regclass AND a.attname='embedding'`);assert.deepEqual(vectorState.rows[0],{extension:true,type:'vector(1024)',index:true});
  await assert.rejects(appPool.query(`UPDATE "KnowledgeChunk" SET content='forbidden' WHERE "documentId"=$1`,[network.id]),error=>error.code==='42501');
  const plan=await appPool.query(`SET enable_seqscan=off; EXPLAIN (FORMAT JSON) SELECT id FROM "KnowledgeChunk" WHERE to_tsvector('simple',mobiflow_unaccent(content)) @@ websearch_to_tsquery('simple','sim OR iot OR ket OR noi')`);const planText=JSON.stringify(plan[1].rows);assert.match(planText,/KnowledgeChunk_content_fts_simple_gin/);
  for(const table of ['Request','Assignment','SlaInstance','Checklist','Notification'])assert.equal((await owner.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count,0);
  console.log(JSON.stringify({status:'PASS',profile:{generation:'deepseek',retrieval:'lexical',liveCalls:false},documents:3,networkGeneration:network.activeGeneration,embeddingCalls,queries:{exact:exact.sources.map(s=>s.sourceId),accented:accented.sources.map(s=>s.sourceId),plain:plain.sources.map(s=>s.sourceId),synonym:synonym.sources.map(s=>s.sourceId),typo:typo.sources.map(s=>s.sourceId),billing:bill.sources.map(s=>s.sourceId),none:none.sources},vectorRollback:vectorState.rows[0],ftsPlanUsesIndex:true,businessRowsUnchanged:true,logs:logs.map(({event,errorCode})=>({event,errorCode}))},null,2));
}finally{await prisma.$disconnect();await appPool.end();await owner.end();}
