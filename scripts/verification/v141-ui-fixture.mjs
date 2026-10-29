import {createHash,randomUUID} from 'node:crypto';
import {parseApiEnvironment} from '@mobiflow/config';
import {createApplication} from '../../apps/api/dist/app.js';
import {RequestStateMachineService} from '../../apps/api/dist/requests/request-state-machine.service.js';

const databaseUrl=process.env.V141_DATABASE_URL;if(!databaseUrl)throw new Error('V141_DATABASE_URL is required.');
const env=parseApiEnvironment({NODE_ENV:'test',AI_GENERATION_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector',AI_AUTO_ANALYZE:'false',DATABASE_URL:databaseUrl,WEB_ORIGIN:'http://127.0.0.1:34100',JWT_SECRET:'v141-ui-jwt'.padEnd(48,'a'),REFRESH_TOKEN_SECRET:'v141-ui-refresh'.padEnd(48,'b'),OLLAMA_BASE_URL:'http://127.0.0.1:1',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured',AUTH_COOKIE_SECURE:'false'});
const server=await createApplication(env,{quiet:true,aiWorker:false,knowledgeWorker:false});
try{
  const prisma=server.prisma,owner=await prisma.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}}),manager=await prisma.user.findUniqueOrThrow({where:{email:'manager@mobiflow.local'}}),id=randomUUID();
  const documentId=randomUUID(),chunkId=randomUUID(),content='SOP-IOT-04 áp dụng cho sự cố SIM IoT mất kết nối sau thay đổi APN.',contentHash=createHash('sha256').update(content).digest('hex'),sourceId=`KD-${documentId}-G1-C0`;
  await prisma.knowledgeDocument.create({data:{id:documentId,title:'SOP-IOT-04',originalFileName:'synthetic.txt',storageKey:'v141-ui/'+documentId,mimeType:'text/plain',byteSize:BigInt(Buffer.byteLength(content)),sha256:createHash('sha256').update('document-'+documentId).digest('hex'),status:'READY',uploadedById:manager.id,pageCount:1,activeGeneration:1,indexedAt:new Date()}});
  await prisma.knowledgeChunk.create({data:{id:chunkId,sourceId,documentId,generation:1,chunkIndex:0,content,contentHash,pageNumber:1,section:'IoT APN',startOffset:0,endOffset:content.length,metadataJson:{synthetic:true}}});
  const request=await prisma.request.create({data:{id,publicCode:'MF-AUTOROUTE-DEMO-001',createdById:owner.id,title:'17 SIM IoT mất kết nối sau thay đổi APN',description:'17 SIM IoT mất kết nối tại KCN Amata từ 8 giờ sau thay đổi APN; gateway vẫn reachable và 3 thiết bị chưa đăng ký lại.',status:'TRIAGED',priority:'MEDIUM',version:3,aiAnalysisStatus:'SUCCEEDED'}});
  const run=await prisma.aiRun.create({data:{requestId:id,purpose:'ANALYSIS',initiatingActorId:owner.id,contextVersion:2,provider:'test',model:'synthetic',promptVersion:'request-analysis.v4',schemaVersion:'analysis.v1',status:'SUCCEEDED',retrievalSnapshotJson:{sources:[{sourceId,chunkId,documentId,generation:1,title:'SOP-IOT-04',pageNumber:1,section:'IoT APN',contentHash,score:1,distance:0}]},safeResultJson:{mode:'RAG',evidenceStatus:'SUFFICIENT',citations:[{sourceId,quote:'Sự cố SIM IoT mất kết nối sau thay đổi APN.'}]},finishedAt:new Date()}});
  const analysis=await prisma.aiAnalysis.create({data:{requestId:id,aiRunId:run.id,intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entitiesJson:{customer:null,location:'KCN Amata',affectedCount:17,startedAt:'8 giờ'},missingFieldsJson:[],confidence:.8,reasonSummary:'Nhiều SIM IoT mất kết nối sau thay đổi APN.',schemaVersion:'analysis.v1'}});
  await prisma.request.update({where:{id},data:{latestAnalysisId:analysis.id}});await server.app.get(RequestStateMachineService).autoRouteAnalysis(run.id);
  console.log(JSON.stringify({requestId:id,publicCode:request.publicCode}));
}finally{await server.app.close();await server.database.close();await server.prisma.$disconnect();}
