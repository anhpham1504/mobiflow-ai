import {Client} from 'pg';
import {businessCounts,check,countsEqual,evidencePath,finalStatus,jsonRequest,ollamaInventory,printChecks,validateReleaseConfig,writeEvidence} from './release-core.mjs';
import {identityKey} from '../../apps/api/dist/knowledge/embedding-provider.js';

const checks=validateReleaseConfig(process.env),database=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
const add=(section,name,ok,pass,fail)=>checks.push(check(section,name,ok?'PASS':'FAIL',ok?pass:fail));
let before,after,llmLatencyMs,embeddingLatencyMs,similarity;
try{
  await database.connect();before=await businessCounts(database);
  const base=process.env.OLLAMA_BASE_URL,inventory=await ollamaInventory(base,{timeout:10000}),llm=inventory.get(process.env.OLLAMA_MODEL),embedding=inventory.get(process.env.OLLAMA_EMBEDDING_MODEL);
  if(!llm||!embedding)throw new Error('MODEL_UNAVAILABLE');
  let started=performance.now();
  const {body:chat}=await jsonRequest(new URL('/api/chat',new URL(base)),{timeout:120000,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OLLAMA_MODEL,messages:[{role:'system',content:'Return only JSON matching the schema.'},{role:'user',content:'Confirm local MobiFlow warmup readiness.'}],format:{type:'object',properties:{status:{type:'string',const:'READY'}},required:['status'],additionalProperties:false},stream:false,think:false,options:{temperature:0,num_predict:20,seed:42}})});
  llmLatencyMs=Math.round(performance.now()-started);let content;try{content=JSON.parse(chat.message?.content);}catch{content=null;}
  add('Warmup','LLM structured response',chat.model===process.env.OLLAMA_MODEL&&content?.status==='READY',`valid response in ${llmLatencyMs} ms`,'invalid or wrong-model response');
  started=performance.now();
  const {body:embedded}=await jsonRequest(new URL('/api/embed',new URL(process.env.EMBEDDING_BASE_URL??base)),{timeout:30000,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OLLAMA_EMBEDDING_MODEL,input:['SIM IoT mất kết nối cần quy trình kiểm tra'],truncate:false,keep_alive:'5m'})});
  embeddingLatencyMs=Math.round(performance.now()-started);const vector=embedded.embeddings?.[0];
  add('Warmup','embedding response',embedded.model===process.env.OLLAMA_EMBEDDING_MODEL&&Array.isArray(vector)&&vector.length===1024&&vector.some(value=>value!==0),`1024 dimensions in ${embeddingLatencyMs} ms`,'invalid embedding response');
  if(Array.isArray(vector)&&vector.length===1024){
    const identity={provider:'ollama',model:process.env.OLLAMA_EMBEDDING_MODEL,digest:embedding.digest,dimension:1024,revision:process.env.EMBEDDING_INDEX_REVISION??'m5.v1'};
    const result=await database.query('SELECT kc."sourceId",1-(kc.embedding <=> $1::vector) AS score FROM "KnowledgeChunk" kc JOIN "KnowledgeDocument" kd ON kd.id=kc."documentId" WHERE kd.status=\'READY\' AND kc."modelIdentity"=$2 ORDER BY kc.embedding <=> $1::vector,kc."sourceId" LIMIT 1',[`[${vector.join(',')}]`,identityKey(identity)]);
    similarity=result.rows[0]??null;add('Warmup','bound pgvector retrieval',result.rowCount===1&&Number.isFinite(Number(similarity.score)),similarity?`source ${similarity.sourceId} retrieved`:'','no compatible ready chunk returned');
  }
  after=await businessCounts(database);add('Warmup','business data immutability',countsEqual(before,after),'business mutation NONE','business row counts changed during warmup');
}catch(error){
  add('Warmup','bounded dependency run',false,'',error instanceof Error&&error.name==='TimeoutError'?'dependency timeout':'dependency unavailable or invalid response');
  if(before){after=await businessCounts(database).catch(()=>undefined);add('Warmup','business data immutability',Boolean(after)&&countsEqual(before,after),'business mutation NONE','unable to prove no mutation');}
}finally{await database.end().catch(()=>{});}
const status=finalStatus(checks),evidence={schemaVersion:'m10.warmup.v1',generatedAt:new Date().toISOString(),status,llmLatencyMs,embeddingLatencyMs,similarity:similarity?{sourceId:similarity.sourceId,score:Number(similarity.score)}:null,before,after,businessMutation:before&&after&&countsEqual(before,after)?'NONE':'UNVERIFIED',checks};
writeEvidence(evidencePath('M10_WARMUP.json'),evidence);printChecks('MobiFlow AI M10 warmup',checks);console.log(`Business mutation: ${evidence.businessMutation}`);console.log(`FINAL ${status}`);
if(status!=='PASS')process.exitCode=1;
