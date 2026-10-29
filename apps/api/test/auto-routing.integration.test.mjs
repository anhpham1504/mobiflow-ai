import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {parseApiEnvironment} from '@mobiflow/config';
import {createApplication} from '../dist/app.js';
import {RequestStateMachineService} from '../dist/requests/request-state-machine.service.js';
import {RequestQueryService} from '../dist/requests/request-query.service.js';

const databaseUrl=process.env.V141_DATABASE_URL;if(!databaseUrl||new URL(databaseUrl).pathname!=='/mobiflow_m24_test')throw new Error('Dedicated v1.4.1 database required.');
const env=parseApiEnvironment({NODE_ENV:'test',AI_GENERATION_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector',AI_AUTO_ANALYZE:'false',DATABASE_URL:databaseUrl,WEB_ORIGIN:'http://localhost:3000',JWT_SECRET:'v141-test-jwt'.padEnd(48,'a'),REFRESH_TOKEN_SECRET:'v141-test-refresh'.padEnd(48,'b'),OLLAMA_BASE_URL:'http://127.0.0.1:1',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured',AUTH_COOKIE_SECURE:'false'});

test('v1.4.1 real PostgreSQL auto-assignment, exception, concurrency, visibility and manager override',async t=>{
  const server=await createApplication(env,{quiet:true,aiWorker:false,knowledgeWorker:false});await server.app.listen(0,'127.0.0.1');
  t.after(async()=>{await server.app.close();await server.database.close();await server.prisma.$disconnect();});
  const prisma=server.prisma,machine=server.app.get(RequestStateMachineService),queries=server.app.get(RequestQueryService);
  const owner=await prisma.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}}),manager=await prisma.user.findUniqueOrThrow({where:{email:'manager@mobiflow.local'}});
  const documentId=randomUUID(),chunkId=randomUUID(),content='SOP-IOT-04 áp dụng cho sự cố SIM IoT mất kết nối sau thay đổi APN. Kiểm tra đăng ký lại của thiết bị.';
  const contentHash=createHash('sha256').update(content).digest('hex'),sourceId=`KD-${documentId}-G1-C0`;
  await prisma.knowledgeDocument.create({data:{id:documentId,title:'SOP-IOT-04',originalFileName:'synthetic.txt',storageKey:'v141/'+documentId,mimeType:'text/plain',byteSize:BigInt(Buffer.byteLength(content)),sha256:createHash('sha256').update('document-'+documentId).digest('hex'),status:'READY',uploadedById:manager.id,pageCount:1,activeGeneration:1,indexedAt:new Date()}});
  await prisma.knowledgeChunk.create({data:{id:chunkId,sourceId,documentId,generation:1,chunkIndex:0,content,contentHash,pageNumber:1,section:'IoT APN',startOffset:0,endOffset:content.length,metadataJson:{synthetic:true}}});
  const sourceSnapshot={sourceId,chunkId,documentId,generation:1,title:'SOP-IOT-04',pageNumber:1,section:'IoT APN',contentHash,score:1,distance:0};
  async function fixture(label,{grounded=true,validCitation=true,category='NETWORK',subcategory='IOT_CONNECTIVITY'}={}){
    const request=await prisma.request.create({data:{publicCode:'AR-'+label+'-'+randomUUID().slice(0,8),createdById:owner.id,title:'Synthetic auto-routing '+label,description:'17 SIM IoT mất kết nối tại KCN Amata từ 8 giờ sau thay đổi APN.',status:'TRIAGED',priority:'MEDIUM',version:3,aiAnalysisStatus:'SUCCEEDED'}});
    const run=await prisma.aiRun.create({data:{requestId:request.id,purpose:'ANALYSIS',initiatingActorId:owner.id,contextVersion:2,provider:'test',model:'synthetic',promptVersion:'request-analysis.v4',schemaVersion:'analysis.v1',status:'SUCCEEDED',retrievalSnapshotJson:{sources:validCitation?[sourceSnapshot]:[]},safeResultJson:{mode:'RAG',evidenceStatus:grounded?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',citations:grounded?[{sourceId,quote:'Sự cố SIM IoT mất kết nối sau thay đổi APN.'}]:[]},finishedAt:new Date()}});
    const analysis=await prisma.aiAnalysis.create({data:{requestId:request.id,aiRunId:run.id,intent:'REPORT_INCIDENT',category,subcategory,prioritySuggestion:'HIGH',entitiesJson:{customer:null,location:'KCN Amata',affectedCount:17,startedAt:'8 giờ'},missingFieldsJson:[],confidence:.8,reasonSummary:'Synthetic grounded classification.',schemaVersion:'analysis.v1'}});
    await prisma.request.update({where:{id:request.id},data:{latestAnalysisId:analysis.id}});return {request,run};
  }
  const first=await fixture('SUCCESS'),race=await Promise.all([machine.autoRouteAnalysis(first.run.id),machine.autoRouteAnalysis(first.run.id)]);
  assert.equal(race.filter(Boolean).length,1);let assigned=await prisma.request.findUniqueOrThrow({where:{id:first.request.id}});
  assert.equal(assigned.status,'ASSIGNED');assert.equal(assigned.priority,'MEDIUM');assert.equal(assigned.version,4);assert.ok(assigned.currentAssigneeId);assert.ok(assigned.teamId);
  assert.equal(await prisma.assignment.count({where:{requestId:assigned.id,endedAt:null}}),1);assert.equal(await prisma.slaInstance.count({where:{requestId:assigned.id}}),1);
  assert.equal(await prisma.auditLog.count({where:{requestId:assigned.id,action:'REQUEST_AUTO_ASSIGNED',actorType:'SYSTEM'}}),1);
  assert.equal(await prisma.notification.count({where:{requestId:assigned.id,recipientId:assigned.currentAssigneeId,type:'REQUEST_ASSIGNED'}}),1);
  const managerView=await queries.detail(assigned.id,{...manager,sessionId:randomUUID()}),userView=await queries.detail(assigned.id,{...owner,sessionId:randomUUID()});
  assert.equal(managerView.autoRouting.outcome,'AUTO_ASSIGNED');assert.equal(managerView.assignmentSource,'AUTO_ROUTING');assert.equal('autoRouting' in userView,false);assert.equal(userView.assignmentSource,'AUTO_ROUTING');
  const staffActor=await prisma.user.findUniqueOrThrow({where:{id:assigned.currentAssigneeId}});assert.ok((await queries.list({...staffActor,sessionId:randomUUID()}, {}, 'queue')).data.some(row=>row.id===assigned.id));

  const managerToken=await login(await server.app.getUrl(),'manager@mobiflow.local'),alternatives=await prisma.user.findMany({where:{role:'STAFF',active:true,available:true,id:{not:assigned.currentAssigneeId},teamMembers:{some:{teamId:assigned.teamId,active:true}},staffSkills:{some:{skill:{code:'IOT'}}}}});assert.ok(alternatives.length);
  const override=await call(await server.app.getUrl(),managerToken,'/manager/requests/'+assigned.id+'/reassign',{expectedVersion:assigned.version,teamId:assigned.teamId,staffId:alternatives[0].id,reason:'Manager override for synthetic verification.'});assert.equal(override.status,200,JSON.stringify(override.body));
  assigned=await prisma.request.findUniqueOrThrow({where:{id:assigned.id}});assert.equal(assigned.currentAssigneeId,alternatives[0].id);assert.equal((await prisma.assignment.findFirstOrThrow({where:{requestId:assigned.id,endedAt:null}})).decisionKind,'REASSIGN');

  const invalidCitation=await fixture('INVALID-CITATION',{validCitation:false});await machine.autoRouteAnalysis(invalidCitation.run.id);assert.equal((await prisma.request.findUniqueOrThrow({where:{id:invalidCitation.request.id}})).status,'TRIAGED');
  await prisma.knowledgeDocument.update({where:{id:documentId},data:{status:'DISABLED'}});const staleSource=await fixture('STALE-SOURCE');await machine.autoRouteAnalysis(staleSource.run.id);assert.equal((await prisma.request.findUniqueOrThrow({where:{id:staleSource.request.id}})).status,'TRIAGED');await prisma.knowledgeDocument.update({where:{id:documentId},data:{status:'READY'}});

  const holders=await prisma.staffSkill.findMany({where:{skill:{code:'IOT'}},select:{staffId:true}});await prisma.user.updateMany({where:{id:{in:holders.map(row=>row.staffId)}},data:{available:false}});
  const exception=await fixture('NO-STAFF'),exceptionVersion=exception.request.version;await machine.autoRouteAnalysis(exception.run.id);const pending=await prisma.request.findUniqueOrThrow({where:{id:exception.request.id}});
  assert.equal(pending.status,'TRIAGED');assert.equal(pending.version,exceptionVersion);assert.equal(pending.currentAssigneeId,null);assert.equal(await prisma.assignment.count({where:{requestId:pending.id}}),0);
  const reviewAudit=await prisma.auditLog.findFirstOrThrow({where:{requestId:pending.id,action:'AUTO_ROUTING_REVIEW_REQUIRED'}});assert.equal(reviewAudit.actorType,'SYSTEM');assert.ok(await prisma.notification.count({where:{requestId:pending.id,type:'APPROVAL_REQUIRED'}}));
  assert.equal((await queries.detail(pending.id,{...manager,sessionId:randomUUID()})).autoRouting.outcome,'MANAGER_REVIEW_REQUIRED');

  await prisma.user.updateMany({where:{id:{in:holders.map(row=>row.staffId)}},data:{available:true}});
  const [capacityA,capacityB]=await Promise.all([fixture('CAPACITY-A'),fixture('CAPACITY-B')]);await Promise.all([machine.autoRouteAnalysis(capacityA.run.id),machine.autoRouteAnalysis(capacityB.run.id)]);
  for(const item of [capacityA,capacityB]){const row=await prisma.request.findUniqueOrThrow({where:{id:item.request.id}});assert.equal(row.status,'ASSIGNED');assert.equal(await prisma.assignment.count({where:{requestId:row.id}}),1);}
});

async function call(base,token,path,body){const response=await fetch(base+'/api/v1'+path,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
async function login(base,email){const response=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1','Content-Type':'application/json'},body:JSON.stringify({email,password:'MobiFlowDemo!2026'})});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body.data.accessToken;}
