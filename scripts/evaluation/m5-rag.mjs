import {readFileSync} from 'node:fs';
import {writeEvaluationFile as writeFileSync} from './evidence-output.mjs';
import {createHash} from 'node:crypto';
import {parseApiEnvironment} from '@mobiflow/config';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {OllamaEmbeddingProvider} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {VectorRepository} from '../../apps/api/dist/knowledge/vector.repository.js';
import {KnowledgeRetriever} from '../../apps/api/dist/knowledge/retriever.js';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {executeAnalysis} from '../../apps/api/dist/ai/analysis-execution.js';
const raw=readFileSync('datasets/ai-evaluation/rag-analysis.json','utf8'),cases=JSON.parse(raw),env=parseApiEnvironment(process.env),db=new PrismaService(env.DATABASE_URL),retriever=new KnowledgeRetriever(db,new VectorRepository(db,env),new OllamaEmbeddingProvider(env),env),provider=new OllamaProvider(env),results=[];
const latency=rows=>{const v=rows.map(r=>r.latencyMs).sort((a,b)=>a-b);return {p50:v[Math.ceil(v.length*.5)-1]??null,p95:v[Math.ceil(v.length*.95)-1]??null};};
try{
 const docs=await db.knowledgeDocument.findMany({where:{status:'READY'}}),manifest=JSON.parse(readFileSync('datasets/knowledge/manifest.json','utf8'));
 for(const c of cases)for(const mode of ['NON_RAG','RAG']){const start=performance.now();try{
  const signal=AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS),retrieval=mode==='RAG'?await retriever.search(c.input,signal):undefined,input={title:c.input.slice(0,100),description:c.input,messages:[],historyTruncated:false,...(retrieval?{retrieval}:{})};
  const r=await executeAnalysis(provider,input,signal),expectedIds=(c.acceptableDocuments??(c.document?[c.document]:[])).map(code=>docs.find(d=>d.title===manifest.find(m=>m.code===code)?.title)?.id).filter(Boolean);
  results.push({id:c.id,mode,status:'SUCCEEDED',latencyMs:Math.round(performance.now()-start),firstAttemptValid:r.firstAttemptValid,identity:r.identity,analysis:r.analysis,grounding:r.grounding??null,retrievedSourceIds:retrieval?.sources.map(s=>s.sourceId)??[],citationValid:mode==='RAG',citationRelevant:mode==='RAG'?(expectedIds.length?r.grounding.citations.some(c=>expectedIds.includes(retrieval.sources.find(s=>s.sourceId===c.sourceId)?.documentId)):r.grounding.citations.length===0):null,categoryMatch:r.analysis.category===c.category,priorityMatch:r.analysis.prioritySuggestion===c.priority});
 }catch(e){results.push({id:c.id,mode,status:'FAILED',errorCode:e.code??'RAG_FAILED',latencyMs:Math.round(performance.now()-start),categoryMatch:false,priorityMatch:false,citationValid:false});}console.log(JSON.stringify({id:c.id,mode,status:results.at(-1).status}));}
 const metrics=Object.fromEntries(['NON_RAG','RAG'].map(mode=>{const rows=results.filter(r=>r.mode===mode);return [mode,{cases:rows.length,schemaValid:rows.filter(r=>r.status==='SUCCEEDED').length,citationValid:mode==='RAG'?rows.filter(r=>r.citationValid).length:null,citationRelevant:mode==='RAG'?rows.filter(r=>r.citationRelevant).length:null,category:rows.filter(r=>r.categoryMatch).length,priority:rows.filter(r=>r.priorityMatch).length,...latency(rows)}];}));
 const report={at:new Date().toISOString(),datasetHash:createHash('sha256').update(raw).digest('hex'),prompt:'request-analysis.v4 / request-analysis-rag.v1',warmState:'Alternating non-RAG/RAG serial calls, no prewarm; first call can include load.',metrics,results,unsupportedClaims:'Exact quotes validated against supplied chunks. Semantic claims require review; ID/quote membership alone is not semantic correctness.',limitations:'12 synthetic specification-labeled development cases; no holdout or numeric quality gate. Failures retained. No recommendation/actions or model-directed tools.'};writeFileSync('docs/verification/evidence/M5_RAG_EVAL.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(metrics));if(results.some(r=>r.status==='FAILED'))process.exitCode=1;
}finally{await db.$disconnect();}
