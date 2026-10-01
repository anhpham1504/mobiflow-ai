import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {apiBase,webOrigin,call,login,detail,poll,report,checkSecretFree} from './m16-client.mjs';

assert.equal(new URL(process.env.DATABASE_URL).port,'54616');assert.ok(process.env.COMPOSE_PROJECT_NAME.startsWith('mobiflow-m16-'));
const project=process.env.COMPOSE_PROJECT_NAME,prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),checks=[];
const pass=(name,detail={})=>{checks.push({name,status:'PASS',...detail});console.log('PASS '+name);};
function compose(args,offline=false){
  const result=spawnSync('docker',['compose','-p',project,'-f','docker-compose.yml',...(offline?['-f','artifacts/m16/offline.yml']:[]),...args],{encoding:'utf8',windowsHide:true,timeout:180000});
  checkSecretFree((result.stdout??'')+(result.stderr??''));assert.equal(result.status,0,'Isolated Compose operation failed: '+args.join(' '));return result.stdout;
}
let transientHealthErrors=0;
const health=async()=>{try{const r=await fetch(apiBase.replace('/api/v1','')+'/health/ready',{signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json()};}catch{transientHealthErrors++;return {status:0,body:{data:{coreReady:false,aiReady:false}}};}};
const stable=async()=>({requests:await prisma.request.findMany({orderBy:{id:'asc'},select:{id:true,status:true,version:true,priority:true,currentAssigneeId:true,teamId:true,currentResolutionId:true}}),assignments:await prisma.assignment.findMany({orderBy:{id:'asc'}}),sla:await prisma.slaInstance.findMany({orderBy:{id:'asc'},select:{id:true,requestId:true,targetSeconds:true,startedAt:true,dueAt:true,pausedAt:true,resolvedHoldAt:true,stoppedAt:true,stopReason:true}}),checklist:await prisma.checklistItem.findMany({orderBy:{id:'asc'}}),feedback:await prisma.feedback.findMany({orderBy:{id:'asc'}})});
let providerOffline=false,databaseOffline=false;
try{
  const baseline=await stable();compose(['restart','api','web']);await poll(health,r=>r.status===200&&r.body.data.coreReady,60000);await poll(async()=>{try{return (await fetch(webOrigin+'/login',{signal:AbortSignal.timeout(10000)})).status;}catch{return 0;}},status=>status===200,60000);assert.deepEqual(await stable(),baseline);pass('actual API and web container restart preserves business state');
  writeFileSync('artifacts/m16/offline.yml','services:\n  api:\n    environment:\n      OLLAMA_BASE_URL: http://host.docker.internal:1\n');
  compose(['up','-d','--wait','api'],true);providerOffline=true;
  const degraded=await poll(health,r=>r.status===200&&r.body.data.coreReady&&!r.body.data.aiReady,30000);assert.equal(degraded.body.data.status,'DEGRADED');pass('provider network outage is optional degradation; core stays ready',{readiness:degraded.body.data,method:'Only isolated API provider origin is unreachable. Host Ollama is preserved.'});
  const user=await login('user@mobiflow.local'),manager=await login();assert.equal((await call(user.token,'/requests/mine')).status,200);
  const created=await call(user.token,'/requests',{title:'M16 synthetic offline recovery',description:'Khách hàng ABC có 2 SIM IoT tại Amata mất kết nối lúc 11 giờ. Dữ liệu tổng hợp thử phục hồi khi AI offline.'});assert.equal(created.status,201);const id=created.body.data.id;
  const failed=await poll(()=>detail(manager.token,id),r=>r.aiAnalysisStatus==='FAILED',30000);assert.equal(failed.status,'NEW');assert.equal(failed.priority,'MEDIUM');assert.equal(failed.currentAssignee,null);assert.equal(failed.sla,null);pass('offline AI fails safely while request is saved and core reads work',{requestId:id,requestStatus:failed.status});
  const jobId=JSON.parse(readFileSync('artifacts/m16/browser-fixtures.json','utf8')).requests.billing.id,before=await detail(manager.token,jobId),generation=await call(manager.token,'/manager/requests/'+jobId+'/ai/recommend',{expectedVersion:before.version});assert.equal(generation.status,202);
  const job=await poll(async()=>{const r=await call(manager.token,'/manager/requests/'+jobId+'/ai/recommendation');assert.equal(r.status,200);return r.body.data;},r=>['FAILED','CANCELED'].includes(r?.status),40000);assert.equal(job.status,'FAILED');assert.equal(job.recommendation,null);const after=await detail(manager.token,jobId);assert.equal(after.status,before.status);assert.equal(after.version,before.version);assert.equal(after.currentAssignee,null);assert.equal(after.sla,null);pass('recommendation generation failure publishes no unchecked result or business action',{errorCode:job.errorCode});
  compose(['up','-d','--wait','api']);providerOffline=false;await poll(health,r=>r.status===200&&r.body.data.aiReady,30000);
  const retry=await call(manager.token,'/requests/'+id+'/ai/retry',{expectedVersion:failed.version});assert.equal(retry.status,202);const recovered=await poll(()=>detail(manager.token,id),r=>['SUCCEEDED','FAILED'].includes(r.aiAnalysisStatus)&&r.version>failed.version);assert.equal(recovered.aiAnalysisStatus,'SUCCEEDED');assert.equal(recovered.status,'TRIAGED');pass('restored Ollama supports explicit retry through existing worker and state machine');
  compose(['stop','postgres']);databaseOffline=true;
  const unavailable=await poll(health,r=>r.status===503&&!r.body.data.coreReady,20000);assert.equal(unavailable.body.data.components.DATABASE.status,'DOWN');checkSecretFree(JSON.stringify(unavailable.body));
  const live=await fetch(apiBase.replace('/api/v1','')+'/health/live');assert.equal(live.status,200);pass('database outage is NOT_READY 503 while process liveness remains 200',{readiness:unavailable.body.data});
  const protectedStarted=Date.now(),protectedRead=await call(manager.token,'/auth/me');assert.equal(protectedRead.status,503);assert.equal(protectedRead.body.error.code,'DATABASE_UNAVAILABLE');assert.ok(Date.now()-protectedStarted<10000);checkSecretFree(JSON.stringify(protectedRead.body));
  const loginStarted=Date.now(),error=await call(null,'/auth/login',{email:'manager@mobiflow.local',password:'MobiFlowDemo!2026'});assert.equal(error.status,503);assert.equal(error.body.error.code,'DATABASE_UNAVAILABLE');assert.equal(error.body.error.message,'The database is temporarily unavailable.');assert.ok(Date.now()-loginStarted<10000);assert.equal(/postgresql:|stack|Prisma|password/.test(JSON.stringify(error.body)),false);checkSecretFree(JSON.stringify(error.body));pass('database outage API error is bounded and sanitized in production',{protectedRead:'503 DATABASE_UNAVAILABLE; no authentication granted',login:'503 DATABASE_UNAVAILABLE; no database details or secrets'});
  compose(['up','-d','--wait','postgres']);databaseOffline=false;await poll(health,r=>r.status===200&&r.body.data.coreReady,30000);assert.equal((await call(manager.token,'/auth/me')).status,200);pass('database reconnect recovers without API restart or destructive state repair');
  const logs=compose(['logs','--no-color','api']);checkSecretFree(logs);assert.equal(logs.includes('MobiFlowDemo!2026'),false);assert.equal(/"(?:systemPrompt|rawPrompt|rawOutput|chainOfThought)"/.test(logs),false);pass('operator logs contain safe failure categories without secrets or prompts',{categories:{httpErrors:logs.includes('http.error'),aiFailures:logs.includes('ai.')||logs.includes('AI_'),readinessReported:true}});
  report('RECOVERY',{result:'PASS',checks,scope:'actual isolated containers/services and production worker; no global Ollama stop, no DB reset, no deployment',restartSnapshotExcludesClockAssessmentMetadata:true,transientHealthErrors});
}catch(error){report('RECOVERY',{result:'FAIL',failure:error.message,checks});throw error;}
finally{
  if(databaseOffline)compose(['up','-d','--wait','postgres']);if(providerOffline)compose(['up','-d','--wait','api']);await prisma.$disconnect();
}
