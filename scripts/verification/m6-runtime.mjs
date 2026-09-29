import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool} from 'pg';
import {parseApiEnvironment} from '@mobiflow/config';
import {recommendationResponseSchema} from '@mobiflow/contracts';
import {createApplication} from '../../apps/api/dist/app.js';
import {saveEvidence} from './evidence.mjs';
const env=parseApiEnvironment(process.env),target=process.env.M6_RUNTIME_TARGET??'docker',mode=process.env.M6_RUNTIME_MODE??'online';
assert.ok(['native','docker'].includes(target));assert.ok(['online','prepare','offline-llm','offline-embedding'].includes(mode));
let service,base=process.env.VERIFY_API_URL??'http://localhost:3001';
const report={at:new Date().toISOString(),target,mode,result:'FAIL',checks:[]},pool=new Pool({connectionString:env.DATABASE_URL});
async function call(token,path,body,expected=body===undefined?200:201){const res=await fetch(base+'/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const value=await res.json();assert.equal(res.status,expected,path+' '+JSON.stringify(value));return value;}
async function terminal(token,path,pick){const until=Date.now()+310000;while(Date.now()<until){const value=await call(token,path),job=pick(value.data);if(job&&['SUCCEEDED','FAILED','CANCELED'].includes(job.status))return value;await delay(2000);}throw Error('M6 runtime deadline exceeded');}
try{
  if(target==='native'){service=await createApplication({...env,NODE_ENV:'test',AI_AUTO_ANALYZE:true},{quiet:true,aiWorker:true,knowledgeWorker:false,log:entry=>console.log(JSON.stringify(entry))});await service.app.listen(0,'127.0.0.1');base=await service.app.getUrl();}
  const login=async email=>(await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'},200)).data.accessToken;
  const [user,manager,staff]=await Promise.all(['user@mobiflow.local','manager@mobiflow.local','staff.iot@mobiflow.local'].map(login));
  const ready=(await call(null,'/health/ready')).data;assert.equal(ready.coreReady,true);assert.equal((await fetch(base+'/health/live')).status,200);
  const create=async label=>{const r=(await call(user,'/requests',{title:'Synthetic M6 '+label+' '+Date.now(),description:'Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng.'})).data;const analysis=(await terminal(manager,'/requests/'+r.id+'/ai/explanation',v=>v.job)).data;assert.equal(analysis.job.status,'SUCCEEDED',analysis.job.errorCode);assert.equal(analysis.analysis.category,'NETWORK');return (await call(manager,'/requests/'+r.id)).data;};
  if(mode==='prepare'){
    const requests=[await create('offline-llm'),await create('offline-embedding')];await saveEvidence('docs/verification/evidence/M6_DOCKER_OFFLINE_PREP.json',{at:new Date().toISOString(),requests:requests.map(r=>({id:r.id,version:r.version}))});report.requests=requests.map(r=>r.id);
  }else{
    let request;
    if(mode==='online'){
      const peer=await create('related-case');
      const until=Date.now()+60000;let indexed=false;
      while(Date.now()<until){indexed=(await pool.query('SELECT count(*)::int AS n FROM "RequestEmbedding" WHERE "requestId"=$1 AND "contextVersion"=$2',[peer.id,peer.version])).rows[0].n>0;if(indexed)break;await delay(1000);}assert.equal(indexed,true,'Real historical embedding not ready');
      request=await create('primary');report.peerId=peer.id;
    }else{const prepared=JSON.parse(await readFile('docs/verification/evidence/M6_DOCKER_OFFLINE_PREP.json','utf8'));request=(await call(manager,'/requests/'+prepared.requests[mode==='offline-llm'?0:1].id)).data;}
    const path='/manager/requests/'+request.id+'/ai/recommendation';
    await call(manager,'/manager/requests/'+request.id+'/ai/recommend',{expectedVersion:request.version},202);
    const response=await terminal(manager,path,v=>v);recommendationResponseSchema.parse(response);const result=response.data;
    const detail=(await call(manager,'/requests/'+request.id)).data;
    for(const token of [user,staff])await call(token,path,undefined,403);
    const counts=(await pool.query('SELECT (SELECT count(*)::int FROM "Assignment" WHERE "requestId"=$1) assignments,(SELECT count(*)::int FROM "SlaInstance" WHERE "requestId"=$1) slas,(SELECT count(*)::int FROM "Checklist" WHERE "requestId"=$1) checklists',[request.id])).rows[0];assert.deepEqual(counts,{assignments:0,slas:0,checklists:0});assert.equal(detail.priority,'MEDIUM');assert.equal(detail.category,null);assert.equal(detail.currentAssignee,null);
    if(mode==='online'){
      assert.equal(result.status,'SUCCEEDED',result.errorCode);assert.equal(result.stale,false);assert.equal(detail.status,'PENDING_APPROVAL');assert.ok(result.evidence.sources.length);assert.ok(result.evidence.candidates.candidates.length);assert.ok(result.evidence.similar.cases.some(c=>c.requestId===report.peerId));assert.equal(result.recommendation.suggestedSlaMinutes,result.evidence.policy.targetMinutes);assert.ok(result.toolCalls.length>=6&&result.toolCalls.length<=8);
      for(const ref of result.recommendation.procedureSources)await call(manager,'/knowledge/sources/'+ref.sourceId);
      report.recommendation={...result,evidence:{...result.evidence,sources:result.evidence.sources.map(({excerpt,...s})=>{void excerpt;return s;})}};
    }else{
      assert.equal(result.status,'FAILED');assert.equal(result.errorCode,mode==='offline-llm'?'AI_PROVIDER_UNAVAILABLE':'EMBEDDING_UNAVAILABLE');assert.equal(detail.status,'TRIAGED');const manual=(await call(user,'/requests/'+request.id+'/messages',{expectedVersion:detail.version,body:'Synthetic: manual processing remains available during provider outage.'})).data;assert.equal(manual.version,detail.version+1);report.failure={runId:result.aiRunId,errorCode:result.errorCode,manualVersion:manual.version};
    }
    report.requestId=request.id;report.noBusinessMutation=counts;
  }
  report.result='PASS';console.log('PASS M6 '+target+' '+mode);
}finally{
  await pool.end();if(service){await service.app.close();await service.prisma.$disconnect();await service.database.close();}
  await saveEvidence('docs/verification/evidence/M6_RUNTIME_'+target.toUpperCase()+'_'+mode.toUpperCase().replaceAll('-','_')+'.json',report);
}
