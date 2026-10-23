import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseApiEnvironment} from '@mobiflow/config';
import {createApplication} from '../../dist/app.js';
import {AuthService} from '../../dist/auth/auth.service.js';
import {RequestStateMachineService} from '../../dist/requests/request-state-machine.service.js';
import {RecommendationService} from '../../dist/ai/recommendation.service.js';
import {DocumentService} from '../../dist/knowledge/document.service.js';
import {IngestionWorker} from '../../dist/knowledge/ingestion-worker.js';
import {identityKey} from '../../dist/knowledge/embedding-provider.js';
import {recommendationEvidenceRelevance,recommendationMissingActionText,recommendationMissingPresentation} from '../../dist/ai/recommendation-output.js';
import {exactEvidenceSpan} from '../../dist/knowledge/excerpt.js';

export const syntheticAnalysis={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:null,location:'Amata',affectedCount:17,startedAt:'8 giờ'},missingFields:[],confidence:.8,reasonSummary:'Synthetic M14 test analysis; no live inference claim.'};
const baseIdentity={provider:'test',model:'m14-fixture',digest:'deterministic-test-only',dimension:1024,revision:'test.v1'};
const identity={...baseIdentity,key:identityKey(baseIdentity)},vector=Array.from({length:1024},(_,i)=>i===0?1:0);
export const syntheticEmbeddings={probe:async()=>({identity,vectors:[vector],latencyMs:0}),embedDocuments:async texts=>({identity,vectors:texts.map(()=>vector),latencyMs:0}),embedQuery:async()=>({identity,vectors:[vector],latencyMs:0})};
export function recommendationFixture(e,version=e.requestContext?'recommendation.v2':'recommendation.v1',decision){
  const candidate=e.candidates.candidates[0],source=decision?e.sources.find(source=>source.sourceId===decision.selectedProcedureSourceIds[0]):e.sources[0],missing=e.analysis.missingFields;
  const shared={suggestedPriority:e.policy?.priority??e.analysis.prioritySuggestion,suggestedTeamId:candidate?.teamId??null,suggestedStaffId:candidate?.staffId??null,suggestedSlaMinutes:e.policy?.targetMinutes??null,procedureSources:source?[{sourceId:source.sourceId}]:[],similarCaseAlert:{detected:e.similar.returnedCount>0,count:e.similar.returnedCount},reasonSummary:'Nguồn được cung cấp hỗ trợ quản lý xem xét; đây chỉ là đề xuất.',evidenceStatus:source?'SUFFICIENT':'INSUFFICIENT_EVIDENCE'};
  const actions=source?[{text:'Sau khi quản lý duyệt và phân công, kiểm tra SIM và APN theo SOP.',sourceIds:[source.sourceId]}]:[];
  if(version==='recommendation.v1')return {...shared,actions,confidence:.5};
  const request=e.requestContext;
  return {...shared,schemaVersion:'recommendation.v2',summary:'Yêu cầu mô tả sự cố kết nối. Quản lý cần xác nhận phương án trước khi triển khai.',classification:{category:e.analysis.category,subcategory:e.analysis.subcategory,priority:shared.suggestedPriority},recommendedAction:{action:missing.length?'REQUEST_USER_INFO':'START_WORK',text:missing.length?recommendationMissingActionText:'Sau khi quản lý duyệt phương án và phân công, nhân viên bắt đầu kiểm tra kết nối.'},evidence:[{type:'REQUEST',referenceId:request.id,excerpt:request.description.slice(0,200),relevance:recommendationEvidenceRelevance.REQUEST},...(source?[{type:'KNOWLEDGE',referenceId:source.sourceId,excerpt:exactEvidenceSpan(source.excerpt,200,[source.title,source.section??'',source.sourceId]),relevance:recommendationEvidenceRelevance.KNOWLEDGE}]:[])],warnings:[...(!source?[{code:'INSUFFICIENT_EVIDENCE',text:'Chưa có SOP phù hợp để đưa ra checklist nghiệp vụ.',referenceIds:[request.id]}]:[]),...(missing.length?[{code:'MISSING_INFORMATION',text:'Thông tin cần được con người bổ sung trước khi sử dụng phương án.',referenceIds:[request.id]}]:[])],missingInformation:missing.map(field=>({field,...recommendationMissingPresentation[field]})),suggestedChecklist:missing.length?[]:actions};
}
export function fixtureProvider({hook}={}){return {generateStructured:async(messages,format,signal)=>{
  const {evidence,evidenceDecision}=JSON.parse(messages[1].content),result=recommendationFixture(evidence,undefined,evidenceDecision);
  if(hook)await hook(evidence,result,signal,format,evidenceDecision);
  const raw=JSON.stringify(result);return {raw,outputSize:Buffer.byteLength(raw),identity:{provider:'test',model:'m14-fixture',digest:'test-only'}};
}};}

// Serialized isolated M14 runners own this fixed high port. Random Windows ports can
// fall on Fetch's forbidden-port list; an occupied port fails setup without killing it.
export async function createRecommendationHarness(databaseUrl,{provider,hook,embeddingProvider=syntheticEmbeddings,envOverrides={},port=33014}={}){
  const target=new URL(databaseUrl);
  if(target.pathname!=='/mobiflow_m14_test'||!['localhost','127.0.0.1'].includes(target.hostname))throw new Error('Dedicated local M14 test DB required');
  const env=parseApiEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:databaseUrl,AI_AUTO_ANALYZE:'false',AI_RAG_ENABLED:'false',KNOWLEDGE_STORAGE_ROOT:'artifacts/m14/knowledge-storage',EMBEDDING_DIMENSION:1024,WEB_ORIGIN:'http://localhost:3000',...envOverrides});
  const s=await createApplication(env,{quiet:true,log:()=>{},aiWorker:false,knowledgeWorker:false,recommendationProvider:provider??fixtureProvider({hook}),...(embeddingProvider?{embeddingProvider}:{})});
  try{
    await s.app.listen(port,'127.0.0.1');const base=await s.app.getUrl();
    const call=async(token,path,body,method)=>{
      // Each short-lived harness closes/reopens the owned port. Do not reuse a
      // keep-alive socket belonging to the preceding server instance.
      const response=await fetch(base+'/api/v1'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Connection:'close',Origin:'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null,headers:response.headers};
    };
    const auth=s.app.get(AuthService),login=async email=>{const response=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});assert.equal(response.status,200,JSON.stringify(response.body));const token=response.body.data.accessToken;return {token,actor:await auth.authenticateAccessToken('Bearer '+token)};};
    const manager=await login('manager@mobiflow.local'),user=await login('user@mobiflow.local'),staff=await login('staff.iot@mobiflow.local');
    const machine=s.app.get(RequestStateMachineService),service=s.app.get(RecommendationService),docs=s.app.get(DocumentService),ingestion=s.app.get(IngestionWorker);
    for(const doc of await s.prisma.knowledgeDocument.findMany({where:{status:{not:'DISABLED'}}}))await docs.command(doc.id,manager.actor,doc.version,'disable',randomUUID(),'Isolate synthetic M14 knowledge corpus');
    const create=async(description='17 SIM IoT tại Amata mất kết nối từ 8 giờ. Synthetic M14.',analysis=syntheticAnalysis)=>{
      const id=await machine.create(user.actor,{description},randomUUID());const request=await s.prisma.request.findUniqueOrThrow({where:{id}});
      const run=await machine.scheduleAnalysis(id,manager.actor,request.version,false,randomUUID());await machine.claimAnalysis(run.id);
      await machine.finishAnalysis(run.id,{analysis,identity:{provider:'test',model:'m14-analysis-fixture',digest:'test-only'},outputSize:500,retryCount:0,latencyMs:1,firstAttemptValid:true});
      return s.prisma.request.findUniqueOrThrow({where:{id}});
    };
    const recommend=async(request,version)=>{
      const run=await service.schedule(request.id,manager.actor,request.version,randomUUID(),version);
      for(let attempt=0;attempt<30;attempt++){
        const latest=await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}});if(['SUCCEEDED','FAILED','CANCELED'].includes(latest.status))return latest;
        await service.cycle(AbortSignal.timeout(300000));
      }
      throw new Error('Bounded M14 recommendation drain exhausted');
    };
    const upload=async(text='# Synthetic M14 procedure\nÁp dụng cho SIM IoT bị mất kết nối. Kiểm tra SIM và APN, ghi lại kết quả trước khi đề xuất xử lý. Phân loại tham khảo NETWORK / IOT_CONNECTIVITY. ' + randomUUID(),title='Nguồn kiểm tra '+randomUUID())=>{
      const buffer=Buffer.from(text),doc=await docs.upload(manager.actor,{title},{originalname:'m14.txt',mimetype:'text/plain',buffer,size:buffer.length},randomUUID());
      await ingestion.tick();assert.equal((await docs.detail(doc.id,manager.actor)).status,'READY');return doc;
    };
    const close=async()=>{await s.app.close();await s.prisma.$disconnect();await s.database.close();};
    return {...s,env,base,call,login,manager,user,staff,machine,service,docs,ingestion,create,recommend,upload,close};
  }catch(error){await s.app.close();await s.prisma.$disconnect();await s.database.close();throw error;}
}
export async function businessSnapshot(prisma,requestId){
  const request=await prisma.request.findUniqueOrThrow({where:{id:requestId}}),snapshot={request};
  for(const table of ['assignment','slaInstance','checklist','requestStatusHistory','notification'])snapshot[table]=await prisma[table].findMany({where:{requestId},orderBy:{id:'asc'}});
  return snapshot;
}
export function humanDecision(view){const candidate=view.evidence.candidates.candidates[0];return {category:view.evidence.analysis.category,subcategory:view.evidence.analysis.subcategory,priority:'MEDIUM',teamId:candidate.teamId,staffId:candidate.staffId,actions:[{text:'Kế hoạch riêng do quản lý lập để kiểm tra thiết bị.',required:true,sourceIds:[],provenance:'HUMAN'}],acknowledgedMissingFields:view.evidence.analysis.missingFields,reason:'Quản lý thay đổi phương án sau khi xem xét nguồn.'};}
