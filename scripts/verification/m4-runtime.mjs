import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool} from 'pg';
import {analysisSchema,aiExplanationSchema,aiJobResponseSchema} from '@mobiflow/contracts';

const mode=process.env.M4_RUNTIME_MODE??'online';
const target=process.env.M4_RUNTIME_TARGET??'docker';
if(!['online','offline'].includes(mode)||!['native','docker'].includes(target))throw new Error('Invalid verification mode');
const base=process.env.VERIFY_API_URL??'http://localhost:3001';
const evidence={checkedAt:new Date().toISOString(),mode,target,result:'FAIL',checks:[],runs:[]};
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const headers={Origin:process.env.WEB_ORIGIN??'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json'};
const record=(name,details)=>{evidence.checks.push({name,result:'PASS',details});console.log('PASS '+name);};
async function call(token,path,body,status=200){
  const r=await fetch(base+'/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
  const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data;
}
async function terminal(token,id){
  const end=Date.now()+310000;
  while(Date.now()<end){const d=await call(token,'/requests/'+id+'/ai/explanation');aiExplanationSchema.shape.data.parse(d);if(d.job&&['SUCCEEDED','FAILED','CANCELED'].includes(d.job.status))return d;await delay(1000);}
  throw new Error('Durable AI run exceeded verification deadline');
}
try{
  const ready=await call(null,'/health/ready');assert.equal(ready.coreReady,true);assert.equal(ready.components.OLLAMA_EMBEDDING_MODEL.status,'NOT_CONFIGURED');
  assert.equal(ready.components.OLLAMA_SERVER.status,mode==='online'?'UP':'DOWN');record('truthful core and AI readiness',ready);
  const swagger=await(await fetch(base+'/api/docs-json')).json();
  for(const path of ['/api/v1/requests/{id}/ai/analyze','/api/v1/requests/{id}/ai/retry','/api/v1/requests/{id}/ai/explanation','/api/v1/ai/runs/{id}'])assert.ok(swagger.paths[path]);
  record('four canonical AI routes in OpenAPI',{version:swagger.info.version});
  const user=(await call(null,'/auth/login',{email:'user@mobiflow.local',password:'MobiFlowDemo!2026'})).accessToken;
  const manager=(await call(null,'/auth/login',{email:'manager@mobiflow.local',password:'MobiFlowDemo!2026'})).accessToken;
  const dataset=JSON.parse(readFileSync('datasets/ai-evaluation/requests.json','utf8'));
  for(const id of mode==='online'?['normal-01','normal-11','incomplete-01','ambiguous-01']:['incomplete-01']){
    const c=dataset.find(c=>c.id===id);
    const r=await call(user,'/requests',{title:'M4 runtime '+target+' '+id,description:c.input},201);
    const explanation=await terminal(manager,r.id),job=explanation.job;
    const detail=await call(manager,'/requests/'+r.id);
    assert.equal(detail.category,null);assert.equal(detail.priority,'MEDIUM');assert.equal(detail.teamId,null);assert.equal(detail.sla,null);
    const run=(await pool.query('SELECT "status","modelIdentityJson","promptVersion","schemaVersion","latencyMs","retryCount","contextVersion","inputSize","outputSize","errorCode" FROM "AiRun" WHERE id=$1',[job.aiRunId])).rows[0];
    assert.equal(run.status,mode==='online'?'SUCCEEDED':'FAILED');
    const owner=await call(user,'/ai/runs/'+job.aiRunId);aiJobResponseSchema.shape.data.parse(owner);assert.equal('analysis' in owner,false);assert.equal('model' in owner,false);
    if(mode==='online'){
      const a=analysisSchema.parse(explanation.analysis);assert.equal(detail.status,'TRIAGED');assert.equal(a.category,c.expected.category);
      assert.equal(run.modelIdentityJson.model,process.env.OLLAMA_MODEL);assert.ok(run.modelIdentityJson.digest);
      if(id==='normal-01'){assert.equal(a.prioritySuggestion,'HIGH');assert.equal(a.entities.affectedCount,17);assert.equal(a.entities.customer,'ABC');assert.equal(a.entities.location,'KCN Amata');}
      if(id==='incomplete-01'){assert.equal(a.entities.location,null);assert.ok(a.missingFields.includes('location'));}
      if(id==='ambiguous-01')assert.equal(a.subcategory,'UNSPECIFIED');
      assert.equal(Number((await pool.query('SELECT count(*)::int AS n FROM "AiAnalysis" WHERE "aiRunId"=$1',[job.aiRunId])).rows[0].n),1);
    }else{
      assert.equal(detail.status,'NEW');assert.equal(run.errorCode,'AI_PROVIDER_UNAVAILABLE');assert.equal(explanation.analysis,undefined);
      const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:'10000000-0000-4000-8000-000000000003',actions:[],acknowledgedMissingFields:[],reason:'Synthetic offline M4 manual verification'};
      let manual=await call(manager,'/manager/requests/'+r.id+'/triage',{expectedVersion:detail.version,finalDecision:decision});
      manual=await call(manager,'/manager/requests/'+r.id+'/submit-approval',{expectedVersion:manual.version,manualDraftRevision:manual.manualDraftRevision});
      manual=await call(manager,'/manager/approvals/'+r.id+'/accept',{expectedVersion:manual.version,reviewKind:'MANUAL',manualDraftRevision:manual.pendingDraftRevision,acknowledgedMissingFields:[]});assert.equal(manual.status,'ASSIGNED');
      const staff=(await call(null,'/auth/login',{email:'staff.iot@mobiflow.local',password:'MobiFlowDemo!2026'})).accessToken;
      manual=await call(staff,'/requests/'+r.id+'/start',{expectedVersion:manual.version});assert.equal(manual.status,'IN_PROGRESS');record('offline manual approval, assignment and staff start',{requestId:r.id,status:manual.status});
    }
    evidence.runs.push({caseId:id,requestId:r.id,runId:job.aiRunId,...run,...(explanation.analysis?{analysis:explanation.analysis}:{})});record(id+' actual persisted inference',{runId:job.aiRunId,status:run.status});
  }
  assert.equal((await fetch(base+'/health/live')).status,200);evidence.result='PASS';
}finally{await pool.end();writeFileSync('docs/verification/evidence/M4_RUNTIME_'+target.toUpperCase()+'_'+mode.toUpperCase()+'.json',JSON.stringify(evidence,null,2)+'\n');}
