import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {TextEncoder} from 'node:util';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {SignJWT,decodeJwt} from 'jose';
import {recommendationResponseSchema,requestResponseSchema} from '@mobiflow/contracts';
import {apiBase,webOrigin,call,login,detail,poll,report,checkSecretFree} from './m16-client.mjs';

assert.equal(new URL(process.env.DATABASE_URL).port,'54616');assert.equal(process.env.DEMO_MODE,'true');
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),checks=[],smoke=[],fixtures={requests:{}};
const pass=(name,details={})=>{checks.push({name,status:'PASS',...details});console.log('PASS '+name);};
const expectStatus=async(token,path,status,body,method)=>{const result=await call(token,path,body,method);assert.equal(result.status,status,path);checkSecretFree(JSON.stringify(result.body));return result;};
const canonical=async id=>({request:await prisma.request.findUniqueOrThrow({where:{id}}),assignments:await prisma.assignment.findMany({where:{requestId:id},orderBy:{id:'asc'}}),sla:await prisma.slaInstance.findMany({where:{requestId:id}}),checklist:await prisma.checklist.findMany({where:{requestId:id},include:{items:true}}),notifications:await prisma.notification.findMany({where:{requestId:id},orderBy:{id:'asc'}})});
try{
  const ready=await fetch(apiBase.replace('/api/v1','')+'/health/ready').then(r=>r.json());assert.equal(ready.data.coreReady,true);assert.equal(ready.data.aiReady,true);pass('normal startup core and optional AI ready',{readiness:ready.data});
  const web=await fetch(webOrigin+'/login');assert.equal(web.status,200);assert.match(web.headers.get('content-security-policy'),/object-src 'none'/);assert.equal(web.headers.get('x-frame-options'),'DENY');pass('web CSP framing MIME protections',{csp:web.headers.get('content-security-policy')});
  const user=await login('user@mobiflow.local'),staff=await login('staff.iot@mobiflow.local'),manager=await login(),seedId='60000000-0000-4000-8000-000000000008';
  for(const actor of [user,staff]){await expectStatus(actor.token,'/manager/requests',403);await expectStatus(actor.token,'/manager/requests/'+seedId+'/ai/recommend',403,{expectedVersion:2});await expectStatus(actor.token,'/manager/requests/'+seedId+'/ai/recommendation',403);}
  pass('USER and STAFF denied MANAGER list recommendation read and generation',{negativeRequests:6});
  await expectStatus(staff.token,'/requests/'+seedId,404);pass('unassigned STAFF IDOR denied');
  const owner=await prisma.user.findUniqueOrThrow({where:{id:user.user.id}}),otherId=randomUUID();
  const other=await prisma.user.upsert({where:{email:'m16.synthetic.other@mobiflow.local'},create:{id:otherId,email:'m16.synthetic.other@mobiflow.local',displayName:'Synthetic other requester',role:'USER',passwordHash:owner.passwordHash},update:{}});
  const otherRequest=await prisma.request.upsert({where:{publicCode:'MF-M16-IDOR'},create:{publicCode:'MF-M16-IDOR',createdById:other.id,title:'Synthetic ownership fixture',description:'Synthetic request belonging to a different approved fixture identity.'},update:{}});
  const hidden=await expectStatus(user.token,'/requests/'+otherRequest.id,404),absent=await expectStatus(user.token,'/requests/'+randomUUID(),404);assert.deepEqual(hidden.body.error,absent.body.error);pass('USER cross-owner IDOR matches unknown-resource response');
  const revoked=await login();const logout=await fetch(apiBase+'/auth/logout',{method:'POST',headers:{Origin:webOrigin,'X-CSRF-Protection':'1',Cookie:revoked.cookie}});assert.equal(logout.status,204);await expectStatus(revoked.token,'/auth/me',401);pass('revoked session denies existing access token');
  const expiring=await login(),payload=decodeJwt(expiring.token),expired=await new SignJWT({...payload}).setExpirationTime(Math.floor(Date.now()/1000)-10).setProtectedHeader({alg:'HS256'}).sign(new TextEncoder().encode(process.env.JWT_SECRET));
  await expectStatus(expired,'/auth/me',401);pass('expired access token denied');
  const sid=decodeJwt(expiring.token).sid;assert.equal(typeof sid,'string');await prisma.refreshSession.update({where:{id:sid},data:{createdAt:new Date(Date.now()-60000),expiresAt:new Date(Date.now()-1000)}});await expectStatus(expiring.token,'/auth/me',401);pass('expired persisted session denied');
  const staleBefore=await canonical(seedId);await expectStatus(manager.token,'/manager/requests/'+seedId+'/triage',409,{expectedVersion:1,finalDecision:{category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:staff.user.id,actions:[],acknowledgedMissingFields:[],reason:'Synthetic stale write must be rejected.'}});assert.deepEqual(await canonical(seedId),staleBefore);pass('stale expectedVersion rejects without business mutation');
  const cache=await expectStatus(manager.token,'/analytics?preset=30d',200);assert.equal(cache.headers.get('cache-control'),'no-store');pass('authenticated responses are no-store');
  for(const key of ['DATABASE_URL','JWT_SECRET','REFRESH_TOKEN_SECRET']){
    const invalid=spawnSync(process.execPath,['apps/api/dist/main.js'],{env:{...process.env,[key]:'invalid-sensitive-value-m16'},encoding:'utf8',windowsHide:true,timeout:15000});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Invalid environment keys:/);assert.equal((invalid.stdout+invalid.stderr).includes('invalid-sensitive-value-m16'),false);checkSecretFree(invalid.stdout+invalid.stderr);
  }
  pass('real API startup rejects invalid critical config with key-only diagnostics',{keys:['DATABASE_URL','JWT_SECRET','REFRESH_TOKEN_SECRET']});
  const occupied=spawnSync(process.execPath,['apps/api/dist/main.js'],{env:process.env,encoding:'utf8',windowsHide:true,timeout:20000});assert.notEqual(occupied.status,null,'Startup must exit instead of hanging when its port is occupied');assert.notEqual(occupied.status,0);assert.match(occupied.stderr,/startup.failed/);assert.match(occupied.stderr,/PORT_OCCUPIED/);checkSecretFree(occupied.stdout+occupied.stderr);pass('occupied API port fails startup clearly without secrets',{exitCode:occupied.status,code:'PORT_OCCUPIED'});
  if(process.argv.includes('--security-only')){
    const before=await canonical(seedId);await expectStatus(manager.token,'/manager/requests/'+seedId+'/ai/recommend',400,{expectedVersion:before.request.version,rawOutput:{approve:true},schemaVersion:'recommendation.v1'});assert.deepEqual(await canonical(seedId),before);pass('raw model output and client schema selection cannot bypass endpoint');
    report('SECURITY_FINAL',{result:'PASS',checks,scope:'final backend authentication and dependency-error regression; no extra live generation'});
  }else{
  const cases=[
    ['complete','Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng; toàn bộ thiết bị ngừng gửi dữ liệu. Dữ liệu trình diễn tổng hợp.'],
    ['missing','Khách hàng DEMO có 5 SIM IoT mất kết nối từ 9 giờ sáng, không gửi được dữ liệu. Chưa có thông tin địa điểm. Dữ liệu trình diễn tổng hợp.'],
    ['billing','Khách hàng SYNTHETIC phản ánh hóa đơn dịch vụ tháng này có hai khoản cước giống nhau tại văn phòng Amata từ 10 giờ. Một tài khoản cần đối soát, dịch vụ vẫn hoạt động. Dữ liệu trình diễn tổng hợp.'],
  ];
  for(const [name,description] of cases){
    const created=await expectStatus(user.token,'/requests',201,{title:'M16 synthetic '+name,description});requestResponseSchema.parse(created.body);const id=created.body.data.id;
    const analyzed=await poll(()=>detail(manager.token,id),r=>r.aiAnalysisStatus==='SUCCEEDED'||r.aiAnalysisStatus==='FAILED');assert.equal(analyzed.aiAnalysisStatus,'SUCCEEDED','Live intake failed for '+name);assert.equal(analyzed.status,'TRIAGED');
    const before=await canonical(id),started=Date.now();const queued=await expectStatus(manager.token,'/manager/requests/'+id+'/ai/recommend',202,{expectedVersion:analyzed.version});recommendationResponseSchema.parse(queued.body);
    const job=await poll(async()=>{const r=await expectStatus(manager.token,'/manager/requests/'+id+'/ai/recommendation',200);return recommendationResponseSchema.parse(r.body).data;},r=>r&&['SUCCEEDED','FAILED','CANCELED'].includes(r.status));
    assert.equal(job.status,'SUCCEEDED','Live Recommendation V2 failed for '+name+': '+job.errorCode);assert.equal(job.schemaVersion,'recommendation.v2');assert.deepEqual(await canonical(id),before);checkSecretFree(JSON.stringify(job));assert.equal(/"(?:systemPrompt|rawPrompt|rawResponse|rawOutput|chainOfThought)"/.test(JSON.stringify(job)),false);
    assert.ok(job.evidence.sources.length>0);assert.ok(job.recommendation.procedureSources.length>0);for(const source of job.recommendation.procedureSources)assert.ok(job.evidence.sources.some(s=>s.sourceId===source.sourceId));
    if(name==='missing'){assert.ok(job.recommendation.missingInformation.some(m=>m.field==='location'));assert.equal(job.evidence.analysis.entities.location,null);}
    fixtures.requests[name]={id,publicCode:analyzed.publicCode,version:analyzed.version,aiRunId:job.aiRunId};
    smoke.push({name,requestId:id,status:'PASS',durationMs:Date.now()-started,job,canonicalBusinessUnchanged:true});pass('live V2 smoke '+name,{sourceCount:job.evidence.sources.length,missing:job.recommendation.missingInformation.map(m=>m.field)});
  }
  const id=fixtures.requests.complete.id,job=smoke[0].job,before=await canonical(id),original=await prisma.aiRecommendation.findUniqueOrThrow({where:{id:job.recommendationId}});
  await expectStatus(manager.token,'/manager/approvals/'+id+'/accept',200,{expectedVersion:before.request.version,reviewKind:'AI',recommendationId:job.recommendationId,acknowledgedMissingFields:job.evidence.analysis.missingFields});assert.deepEqual(await canonical(id),before);
  const review=await prisma.aiRecommendation.findUniqueOrThrow({where:{id:job.recommendationId}});assert.equal(review.status,'ACCEPTED');assert.deepEqual(review.actionsJson,original.actionsJson);assert.deepEqual(review.procedureRefsJson,original.procedureRefsJson);assert.equal(review.reasonSummary,original.reasonSummary);pass('AI review stores human agreement and preserves original suggestion without assignment SLA checklist or request writes');
  const malformed=await expectStatus(manager.token,'/manager/requests/'+id+'/ai/recommend',400,{expectedVersion:before.request.version,rawOutput:{approve:true},schemaVersion:'recommendation.v1'});assert.equal(malformed.body.error.code,'INVALID_INPUT');assert.deepEqual(await canonical(id),before);pass('raw model output and client schema selection cannot bypass endpoint');
  mkdirSync('artifacts/m16',{recursive:true});writeFileSync('artifacts/m16/browser-fixtures.json',JSON.stringify(fixtures,null,2)+'\n');
  const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
  report('RUNTIME',{result:'PASS',kind:'targeted release hardening; no penetration test or accuracy claim',checks,smoke,sourceHashes:Object.fromEntries(['apps/api/src/ai/prompts/recommendation.ts','apps/api/src/ai/recommendation-output.ts','packages/contracts/src/recommendation.ts','datasets/ai-evaluation/m15-recommendation-v2.json'].map(file=>[file,hash(file)])),fullM15EvaluationRerun:false,model:process.env.OLLAMA_MODEL});
  }
}catch(error){report(process.argv.includes('--security-only')?'SECURITY_FINAL':'RUNTIME',{result:'FAIL',failure:error.message,checks,smoke});throw error;}
finally{await prisma.$disconnect();}
