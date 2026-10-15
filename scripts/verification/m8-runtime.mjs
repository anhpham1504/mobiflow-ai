import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseApiEnvironment} from '@mobiflow/config';
import {createApplication} from '../../apps/api/dist/app.js';
import {AuthService} from '../../apps/api/dist/auth/auth.service.js';
import {RequestStateMachineService} from '../../apps/api/dist/requests/request-state-machine.service.js';
import {OperationalAiService} from '../../apps/api/dist/ai/operational-ai.service.js';
import {SlaMonitorService} from '../../apps/api/dist/requests/sla-monitor.service.js';
import {saveEvidence} from './evidence.mjs';

const baseEnv=parseApiEnvironment(process.env),report={at:new Date().toISOString(),result:'FAIL',checks:[]};
const record=(name,details)=>{report.checks.push({name,result:'PASS',details});console.log('PASS '+name);};

async function exercise(mode){
  const env=parseApiEnvironment({...process.env,NODE_ENV:'test',AI_AUTO_ANALYZE:'false',AI_RAG_ENABLED:'true',...(mode==='offline-llm'?{OLLAMA_BASE_URL:'http://127.0.0.1:1',AI_ATTEMPT_TIMEOUT_MS:'1000'}:{EMBEDDING_BASE_URL:'http://127.0.0.1:1',EMBEDDING_TIMEOUT_MS:'250'})});
  const service=await createApplication(env,{quiet:true,aiWorker:false,knowledgeWorker:false,log:()=>{}});
  try{
    await service.app.listen(0,'127.0.0.1');const origin=await service.app.getUrl();
    assert.equal((await fetch(origin+'/health/live')).status,200);const ready=await (await fetch(origin+'/health/ready')).json();assert.equal(ready.data.coreReady,true);
    const auth=service.app.get(AuthService),login=async email=>{const session=await auth.login(email,'MobiFlowDemo!2026',randomUUID());return auth.authenticateAccessToken('Bearer '+session.accessToken);};
    const [user,manager,staff]=await Promise.all(['user@mobiflow.local','manager@mobiflow.local','staff.iot@mobiflow.local'].map(login));
    const machine=service.app.get(RequestStateMachineService),operational=service.app.get(OperationalAiService),monitor=service.app.get(SlaMonitorService);
    const id=await machine.create(user,{title:'M8 '+mode+' '+Date.now(),description:'Synthetic M8 provider outage verification for an IoT connectivity request.'},randomUUID());
    let request=await service.prisma.request.findUniqueOrThrow({where:{id}});
    const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:staff.id,actions:[],acknowledgedMissingFields:[],reason:'Synthetic M8 outage manual path'};
    await machine.transition(id,'MANUAL_TRIAGE',manager,{expectedVersion:request.version,finalDecision:decision},randomUUID());request=await service.prisma.request.findUniqueOrThrow({where:{id}});
    await machine.transition(id,'SUBMIT_FOR_APPROVAL',manager,{expectedVersion:request.version,manualDraftRevision:request.manualDraftRevision},randomUUID());request=await service.prisma.request.findUniqueOrThrow({where:{id}});
    await machine.transition(id,'APPROVE_AND_ASSIGN',manager,{expectedVersion:request.version,reviewKind:'MANUAL',manualDraftRevision:request.manualDraftRevision,acknowledgedMissingFields:[]},randomUUID());request=await service.prisma.request.findUniqueOrThrow({where:{id}});
    await machine.transition(id,'START_WORK',staff,{expectedVersion:request.version},randomUUID());request=await service.prisma.request.findUniqueOrThrow({where:{id}});
    const drain=async runId=>{for(let i=0;i<100;i++){const run=await service.prisma.aiRun.findUniqueOrThrow({where:{id:runId}});if(['SUCCEEDED','FAILED','CANCELED'].includes(run.status))return run;await operational.cycle(AbortSignal.timeout(15000));}throw new Error('Bounded operational queue drain exceeded.');};
    const action=mode==='offline-llm'?'SUMMARIZE_REQUEST':'GENERATE_CHECKLIST',queued=await operational.scheduleCopilot(id,staff,{expectedVersion:request.version,action},randomUUID()),run=await drain(queued.id);
    assert.equal(run.status,'FAILED');assert.equal(run.errorCode,mode==='offline-llm'?'AI_PROVIDER_UNAVAILABLE':'EMBEDDING_UNAVAILABLE');
    request=await service.prisma.request.findUniqueOrThrow({where:{id}});assert.equal(request.status,'IN_PROGRESS');
    const sla=await service.prisma.slaInstance.findUniqueOrThrow({where:{requestId:id}}),notices=await service.prisma.notification.count(),riskAt=new Date(sla.startedAt.getTime()+sla.targetSeconds*800);await monitor.tick(riskAt);await monitor.tick(riskAt);assert.equal((await service.prisma.slaInstance.findUniqueOrThrow({where:{id:sla.id}})).status,'AT_RISK');assert.equal(await service.prisma.notification.count(),notices);
    const result={requestId:id,copilotRunId:run.id,copilotErrorCode:run.errorCode,manualStatus:request.status,slaStatus:'AT_RISK_PERSISTED_NO_LEGACY_DELIVERY',coreReady:true};
    if(mode==='offline-llm'){
      await machine.transition(id,'RESOLVE',staff,{expectedVersion:request.version,rootCause:'Thiết bị mất cấu hình kết nối hợp lệ',resolution:'Khôi phục cấu hình kết nối thiết bị',verification:'Thiết bị đã truyền dữ liệu ổn định'},randomUUID());request=await service.prisma.request.findUniqueOrThrow({where:{id}});
      const summary=await service.prisma.aiRun.findFirstOrThrow({where:{requestId:id,resolutionId:request.currentResolutionId,purpose:'RESOLUTION_SUMMARY'},orderBy:{createdAt:'desc'}}),terminal=await drain(summary.id);
      assert.equal(terminal.status,'FAILED');assert.equal(terminal.errorCode,'AI_PROVIDER_UNAVAILABLE');request=await service.prisma.request.findUniqueOrThrow({where:{id}});assert.equal(request.status,'RESOLVED');Object.assign(result,{summaryRunId:terminal.id,summaryErrorCode:terminal.errorCode,resolvedStatus:request.status});
    }
    return result;
  }finally{await service.app.close();await service.prisma.$disconnect();await service.database.close();}
}

try{
  const llm=await exercise('offline-llm');record('LLM outage leaves core, manual workflow, deterministic SLA and resolution intact',llm);
  const embedding=await exercise('offline-embedding');record('embedding outage fails Copilot retrieval closed while core, manual workflow and SLA remain intact',embedding);
  assert.equal(baseEnv.AI_PROVIDER,'ollama');report.result='PASS';
}finally{await saveEvidence((process.env.AI_EVAL_EVIDENCE_ROOT??'docs/verification/evidence')+'/M8_RUNTIME_OFFLINE.json',report);}
