import assert from 'node:assert/strict';
import {parseApiEnvironment} from '@mobiflow/config';
import {sourceSchema} from '@mobiflow/contracts';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {OllamaEmbeddingProvider} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {VectorRepository} from '../../apps/api/dist/knowledge/vector.repository.js';
import {KnowledgeRetriever} from '../../apps/api/dist/knowledge/retriever.js';
import {hash} from '../../apps/api/dist/knowledge/chunker.js';
import {saveEvidence} from './evidence.mjs';

// Read-only checks against the current local synthetic corpus. No ingestion,
// reindex, reset, model change or production business write occurs here.
const env=parseApiEnvironment(process.env),prisma=new PrismaService(env.DATABASE_URL);
const vectors=new VectorRepository(prisma,env),retriever=new KnowledgeRetriever(prisma,vectors,new OllamaEmbeddingProvider(env),env);
const queries=[{id:'M15-RAG-001',text:'SIM IoT mất kết nối, kiểm tra trạng thái SIM và APN'},{id:'M15-RAG-002',text:'Đối soát chênh lệch cước trên hóa đơn'},{id:'M15-RAG-003',text:'Tài khoản không đăng nhập được, cần xác minh quyền truy cập'}];
const report={startedAt:new Date().toISOString(),kind:'development/synthetic evidence',method:'Existing KnowledgeRetriever + configured live Ollama embedding + existing PostgreSQL/pgvector, read-only current corpus. Membership/currentness, not calibrated retrieval recall.',queries:[],result:'NOT_RUN'};
try{
  report.readyDocuments=await prisma.knowledgeDocument.count({where:{status:'READY'}});
  for(const query of queries){
    const r=await retriever.search(query.text,AbortSignal.timeout(60000));
    for(const source of r.sources){sourceSchema.parse(source);assert.equal(source.contentHash,hash(source.excerpt));}
    await prisma.$transaction(tx=>vectors.validateCurrent(tx,r.sources,false));
    report.queries.push({id:query.id,queryHash:r.queryHash,queryChars:r.queryChars,identity:r.identity,sourceCount:r.sources.length,sourceIds:r.sources.map(s=>s.sourceId),sources:r.sources.map(({excerpt,...s})=>({...s,excerptHash:hash(excerpt)})),embeddingMs:r.embeddingMs,retrievalMs:r.retrievalMs,sourceMembership:'PASS'});
  }
  report.result='PASS';
}catch(error){report.errorCode=error.code??'RETRIEVAL_UNAVAILABLE';report.result=report.queries.length?'FAIL':'NOT_RUN';}
finally{await prisma.$disconnect();}
report.finishedAt=new Date().toISOString();
report.limitations='Three unlabeled current-corpus smoke queries do not establish recall/Hit@k or procedural entailment. The 100-case model benchmark uses committed supplied snapshots; live persisted source counts are reported separately. No product regression suite is substituted.';
await saveEvidence('docs/v1.2/evidence/M15_RETRIEVAL.json',report);
console.log(JSON.stringify(report));
if(report.result!=='PASS')process.exitCode=1;
