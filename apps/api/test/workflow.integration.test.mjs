import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {parseApiEnvironment} from '@mobiflow/config';
import {requestResponseSchema,historyResponseSchema,requestListSchema} from '@mobiflow/contracts';
import {createApplication} from '../dist/app.js';

test('M3 manager cancellation covers assigned, working, waiting and reserved analyzing states; new manual draft and current policy are mandatory',async t=>{
  const s=await setup(t),{prisma,command,manager,staff,user,call}=s;
  for(const state of ['ASSIGNED','IN_PROGRESS','WAITING_USER']){
    let r=await s.assign(await s.submit(await s.triage(await s.create())));
    if(state!=='ASSIGNED')r=await command(staff,'/requests/'+r.id+'/start',{expectedVersion:r.version});
    if(state==='WAITING_USER')r=await command(staff,'/requests/'+r.id+'/request-info',{expectedVersion:r.version,body:'Cần vị trí kiểm tra'});
    r=await command(manager,'/requests/'+r.id+'/cancel',{expectedVersion:r.version,reason:'Hủy yêu cầu demo tại '+state});
    assert.equal(r.status,'CANCELED');assert.equal(r.sla.stopReason,'CANCELED');assert.equal(r.sla.pausedAt,null);
    assert.equal(await prisma.assignment.count({where:{requestId:r.id,endedAt:null}}),0);
  }
  // Reserved future state fixture only: M3 never starts an AI run.
  for(const actor of [user,manager]){
    let r=await s.create();
    await prisma.request.update({where:{id:r.id},data:{status:'AI_ANALYZING',aiAnalysisStatus:'RUNNING'}});
    r=await command(actor,'/requests/'+r.id+'/cancel',{expectedVersion:r.version,reason:'Hủy trạng thái dành cho milestone sau'});
    assert.equal(r.status,'CANCELED');assert.equal(r.aiAnalysisStatus,'FAILED');
  }
  let r=await s.submit(await s.triage(await s.create()));
  const policy=await prisma.slaPolicy.findFirstOrThrow({where:{category:null,priority:'HIGH',active:true}});
  await prisma.slaPolicy.update({where:{id:policy.id},data:{version:{increment:1}}});
  await command(manager,'/manager/approvals/'+r.id+'/accept',s.review(r),422);
  r=await command(manager,'/manager/approvals/'+r.id+'/modify',{expectedVersion:r.version,manualDraftRevision:r.pendingDraftRevision,reviewKind:'MANUAL',finalDecision:s.decision});
  assert.equal(r.status,'ASSIGNED');assert.equal((await prisma.slaInstance.findUniqueOrThrow({where:{requestId:r.id}})).policyVersion,policy.version+1);
  await prisma.slaPolicy.update({where:{id:policy.id},data:{version:policy.version}});
  const requests=await call(manager,'/manager/requests?limit=2');
  assert.equal(requests.body.data.length,2);assert.equal(requests.body.page.hasMore,true);
  const next=await call(manager,'/manager/requests?limit=2&cursor='+requests.body.page.nextCursor);
  assert.ok(next.body.data.every(row=>!requests.body.data.some(first=>first.id===row.id)));
  const origin=await fetch((await s.app.getUrl())+'/api/v1/requests/'+r.id+'/messages',{method:'POST',headers:{Authorization:'Bearer '+user,Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({expectedVersion:r.version,body:'forged origin'})});
  assert.equal(origin.status,403);
});

const databaseUrl=process.env.M2_INTEGRATION_DATABASE_URL;
if(!databaseUrl||new URL(databaseUrl).pathname!=='/mobiflow_m2_test') throw new Error('A dedicated integration database is required.');
const env=parseApiEnvironment({NODE_ENV:'test',DATABASE_URL:databaseUrl,WEB_ORIGIN:'http://localhost:3000',JWT_SECRET:'m3-test-jwt'.padEnd(48,'a'),REFRESH_TOKEN_SECRET:'m3-test-refresh'.padEnd(48,'b'),OLLAMA_BASE_URL:'http://127.0.0.1:1',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured',AUTH_COOKIE_SECURE:'false'});
async function setup(t) {
  const server=await createApplication(env,{quiet:true,log:e=>{if(e.status===500)console.log(e);}});
  await server.app.listen(0,'127.0.0.1');const base=await server.app.getUrl();
  t.after(async()=>{await server.app.close();await server.database.close();await server.prisma.$disconnect();});
  async function call(token,path,body,method=body===undefined?'GET':'POST') {
    const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,body:await r.json()};
  }
  async function login(email) {const r=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});assert.equal(r.status,200);return r.body.data.accessToken;}
  const user=await login('user@mobiflow.local'),manager=await login('manager@mobiflow.local'),staff=await login('staff.iot@mobiflow.local'),otherStaff=await login('staff.network@mobiflow.local');
  const staffRow=await server.prisma.user.findUniqueOrThrow({where:{email:'staff.iot@mobiflow.local'},include:{teamMembers:true}});
  const otherStaffRow=await server.prisma.user.findUniqueOrThrow({where:{email:'staff.network@mobiflow.local'}});
  const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:staffRow.teamMembers[0].teamId,staffId:staffRow.id,actions:[{text:'Kiểm tra tín hiệu thiết bị',required:true,sourceIds:[],provenance:'HUMAN'}],acknowledgedMissingFields:[],reason:'Kế hoạch xử lý thủ công đã được xem xét'};
  async function command(token,path,body,status=200,method='POST') {const r=await call(token,path,body,method);assert.equal(r.status,status,JSON.stringify(r.body));if(status<300&&r.body.data?.publicCode)requestResponseSchema.parse(r.body);return r.body.data;}
  const create=()=>command(user,'/requests',{description:'Thiết bị IoT mất kết nối tại văn phòng thử nghiệm.'},201);
  const triage=r=>command(manager,'/manager/requests/'+r.id+'/triage',{expectedVersion:r.version,finalDecision:decision});
  const submit=r=>command(manager,'/manager/requests/'+r.id+'/submit-approval',{expectedVersion:r.version,manualDraftRevision:r.manualDraftRevision});
  const review=r=>({expectedVersion:r.version,manualDraftRevision:r.pendingDraftRevision,reviewKind:'MANUAL',acknowledgedMissingFields:[]});
  const assign=r=>command(manager,'/manager/approvals/'+r.id+'/accept',review(r));
  return {...server,call,command,user,manager,staff,otherStaff,decision,staffRow,otherStaffRow,create,triage,submit,review,assign};
}

test('M3 actual HTTP full manual lifecycle, scope, checklist, wait/reply, reopen, SLA, notifications, concurrency and rollback with Ollama offline',async t=>{
  const s=await setup(t);const {prisma,call,command,user,manager,staff,otherStaff}=s;
  const ready=await call(null,'/health/ready');assert.equal(ready.status,200);assert.equal(ready.body.data.components.OLLAMA_SERVER.status,'DOWN');
  let r=await s.create();assert.equal(r.status,'NEW');assert.equal(r.priority,'MEDIUM');assert.equal(r.version,1);assert.equal(r.title,r.description.slice(0,100));assert.match(r.publicCode,/^MF-\d{4}-\d{6,}$/);
  await command(manager,'/requests',{description:'Only requester can create.'},403);
  await command(user,'/requests',{description:'This is a forged request',status:'ASSIGNED'},400);
  const id=r.id;
  assert.equal((await call(null,'/requests/'+id)).status,401);
  assert.equal((await call(otherStaff,'/requests/'+id)).status,404);
  await command(user,'/requests/'+id+'/confirm',{expectedVersion:r.version},409);
  await command(manager,'/requests/'+id+'/start',{expectedVersion:r.version},403);
  const existingOwner=await prisma.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}});
  const foreign=await prisma.request.create({data:{createdById:(await prisma.user.create({data:{id:randomUUID(),email:'m3-foreign-'+randomUUID()+'@test.local',displayName:'Foreign',passwordHash:existingOwner.passwordHash,role:'USER'}})).id,publicCode:'FOREIGN-'+randomUUID().slice(0,8),title:'Hidden',description:'Foreign synthetic request'}});
  assert.equal((await call(user,'/requests/'+foreign.id)).status,404);
  const list=await call(user,'/requests/mine?limit=1');requestListSchema.parse(list.body);assert.ok(!list.body.data.some(x=>x.id===foreign.id));
  assert.equal((await call(user,'/requests/mine?limit=0')).status,400);
  assert.equal((await call(user,'/requests/mine?cursor=invalid')).status,400);
  for(const invalid of [
    {...s.decision,staffId:existingOwner.id},
    {...s.decision,teamId:'20000000-0000-4000-8000-000000000002'},
  ]) await command(manager,'/manager/requests/'+id+'/triage',{expectedVersion:r.version,finalDecision:invalid},422);
  await prisma.user.update({where:{id:s.staffRow.id},data:{available:false}});
  await command(manager,'/manager/requests/'+id+'/triage',{expectedVersion:r.version,finalDecision:s.decision},422);
  await prisma.user.update({where:{id:s.staffRow.id},data:{available:true,active:false}});
  await command(manager,'/manager/requests/'+id+'/triage',{expectedVersion:r.version,finalDecision:s.decision},422);
  await prisma.user.update({where:{id:s.staffRow.id},data:{active:true}});
  r=await s.triage(r);assert.equal(r.status,'TRIAGED');assert.equal(r.priority,'MEDIUM');assert.equal(r.category,null);
  const ownerView=await call(user,'/requests/'+id);assert.equal('manualDraft' in ownerView.body.data,false);
  r=await s.submit(r);
  await command(staff,'/manager/approvals/'+id+'/accept',s.review(r),403);
  const before=async()=>({request:await prisma.request.findUnique({where:{id}}),assignments:await prisma.assignment.count({where:{requestId:id}}),sla:await prisma.slaInstance.count({where:{requestId:id}}),events:await prisma.auditLog.count({where:{requestId:id}}),history:await prisma.requestStatusHistory.count({where:{requestId:id}}),notifications:await prisma.notification.count({where:{requestId:id}})});
  const snapshot=await before();
  await command(manager,'/manager/approvals/'+id+'/accept',{...s.review(r),expectedVersion:r.version-1},409);assert.deepEqual(await before(),snapshot);
  // All mutations roll back even when validation occurs after the event insert.
  await command(manager,'/manager/approvals/'+id+'/modify',{expectedVersion:r.version,manualDraftRevision:r.pendingDraftRevision,reviewKind:'MANUAL',finalDecision:{...s.decision,staffId:existingOwner.id}},422);
  assert.deepEqual(await before(),snapshot);
  const double=await Promise.all([call(manager,'/manager/approvals/'+id+'/accept',s.review(r)),call(manager,'/manager/approvals/'+id+'/accept',s.review(r))]);
  assert.deepEqual(double.map(x=>x.status).sort(),[200,409]);r=double.find(x=>x.status===200).body.data;
  assert.equal(r.status,'ASSIGNED');assert.equal(r.priority,'HIGH');assert.equal(await prisma.assignment.count({where:{requestId:id,endedAt:null}}),1);assert.equal(await prisma.slaInstance.count({where:{requestId:id}}),1);
  const slaStart=(await prisma.slaInstance.findUniqueOrThrow({where:{requestId:id}})).startedAt;
  const queue=await call(staff,'/staff/work-queue');assert.ok(queue.body.data.some(x=>x.id===id));
  await command(otherStaff,'/requests/'+id+'/start',{expectedVersion:r.version},404);
  r=await command(staff,'/requests/'+id+'/start',{expectedVersion:r.version});assert.equal(r.status,'IN_PROGRESS');
  await command(staff,'/requests/'+id+'/resolve',{expectedVersion:r.version,rootCause:'Mất kết nối thiết bị',resolution:'Đã khôi phục kết nối',verification:'Đã kiểm tra tín hiệu'},422);
  r=await command(staff,'/requests/'+id+'/messages',{expectedVersion:r.version,body:'Đã tiếp nhận kiểm tra.'},201);
  assert.equal(r.message.body,'Đã tiếp nhận kiểm tra.');assert.equal(r.message.kind,'COMMENT');assert.ok(r.message.id);
  r=await command(staff,'/requests/'+id+'/request-info',{expectedVersion:r.version,body:'Vui lòng cung cấp vị trí thiết bị.'});
  assert.equal(r.status,'WAITING_USER');assert.equal(r.sla.status,'PAUSED');
  await command(manager,'/requests/'+id+'/provide-info',{expectedVersion:r.version,body:'Không được giả danh'},403);
  r=await command(user,'/requests/'+id+'/messages',{expectedVersion:r.version,body:'Đang tìm thông tin'},201);assert.equal(r.status,'WAITING_USER');assert.equal(r.sla.status,'PAUSED');
  const pausedVersion=r.version;
  r=await command(user,'/requests/'+id+'/provide-info',{expectedVersion:r.version,body:'Thiết bị ở tầng 2 văn phòng.'});assert.equal(r.status,'IN_PROGRESS');
  const responseSnapshot=await before();
  await command(user,'/requests/'+id+'/provide-info',{expectedVersion:pausedVersion,body:'Lặp lại'},409);assert.deepEqual(await before(),responseSnapshot);
  const staffDetail=(await call(staff,'/requests/'+id)).body.data;
  const item=staffDetail.checklist.items[0];
  await command(staff,'/requests/'+id+'/checklist/'+randomUUID(),{expectedVersion:r.version,operation:'COMPLETE'},404,'PATCH');
  r=await command(staff,'/requests/'+id+'/checklist/'+item.id,{expectedVersion:r.version,operation:'COMPLETE'},200,'PATCH');
  r=await command(staff,'/requests/'+id+'/resolve',{expectedVersion:r.version,rootCause:'Mất nguồn bộ chuyển đổi',resolution:'Đã thay bộ chuyển đổi nguồn',verification:'Kết nối ổn định sau kiểm tra'});
  assert.equal(r.status,'RESOLVED');assert.equal(r.sla.status,'MET');const hold=r.sla.resolvedHoldAt;
  r=await command(user,'/requests/'+id+'/reopen',{expectedVersion:r.version,reason:'Kết nối vẫn gián đoạn sau một thời gian'});
  assert.equal(r.status,'IN_PROGRESS');assert.equal(r.currentResolution,null);assert.equal(r.sla.startedAt,slaStart.toISOString());assert.ok(hold);
  const oldClock=await prisma.slaInstance.findUniqueOrThrow({where:{requestId:id}});
  r=await command(manager,'/manager/requests/'+id+'/reassign',{expectedVersion:r.version,teamId:s.decision.teamId,staffId:s.otherStaffRow.id,reason:'Bàn giao cho kỹ thuật mạng'});
  assert.deepEqual(await prisma.slaInstance.findUniqueOrThrow({where:{requestId:id}}),oldClock);
  assert.equal((await call(staff,'/requests/'+id)).status,404);
  await command(staff,'/requests/'+id+'/resolve',{expectedVersion:r.version,rootCause:'Nguyên nhân thử nghiệm',resolution:'Khắc phục thử nghiệm',verification:'Kiểm chứng thử nghiệm'},404);
  r=await command(otherStaff,'/requests/'+id+'/resolve',{expectedVersion:r.version,rootCause:'Cáp mạng chập chờn',resolution:'Thay cáp mạng và kiểm tra',verification:'Theo dõi kết nối ổn định'});
  r=await command(user,'/requests/'+id+'/confirm',{expectedVersion:r.version});assert.equal(r.status,'CLOSED');assert.equal(r.sla.status,'MET');
  assert.equal(await prisma.assignment.count({where:{requestId:id,endedAt:null}}),0);assert.equal(await prisma.requestResolution.count({where:{requestId:id}}),2);
  await command(user,'/requests/'+id+'/reopen',{expectedVersion:r.version,reason:'Không thể mở lại đã đóng'},409);
  await command(user,'/requests/'+id+'/messages',{expectedVersion:r.version,body:'Không ghi vào terminal'},409);
  const history=await call(user,'/requests/'+id+'/history?limit=100');historyResponseSchema.parse(history.body);
  const events=history.body.data;assert.ok(events.every(e=>e.actorType!=='AI'));assert.ok(events.some(e=>e.action==='REASSIGN'));assert.ok(events.some(e=>e.messages.some(m=>m.kind==='INFO_REPLY')));
  assert.deepEqual(events.flatMap(e=>e.resolutions.map(resolution=>resolution.cycle)),[1,2]);
  assert.ok(events.every(e=>!['CHECKLIST_CHANGED','MANUAL_DRAFT_SAVED','SLA_POLICY_CHANGED'].includes(e.action)));
  assert.equal((await call(staff,'/requests/'+id+'/history')).status,404);
  assert.equal(await prisma.aiRun.count({where:{requestId:id}}),0);assert.equal(await prisma.aiRecommendation.count({where:{requestId:id}}),0);
  const notes=await prisma.notification.findMany({where:{requestId:id}});
  for(const type of ['APPROVAL_REQUIRED','REQUEST_ASSIGNED','USER_INFO_REQUIRED','USER_REPLIED','REQUEST_RESOLVED','REQUEST_REOPENED'])assert.ok(notes.some(n=>n.type===type),type);
  const userNote=notes.find(n=>n.recipientId===existingOwner.id);
  await command(otherStaff,'/notifications/'+userNote.id+'/read',{read:true},404,'PATCH');
  await command(user,'/notifications/'+userNote.id+'/read',{read:true},200,'PATCH');
  const userNotes=await call(user,'/notifications');assert.ok(userNotes.body.data.every(n=>!('safeActorMetadataJson' in n)));
  await assert.rejects(prisma.auditLog.updateMany({where:{requestId:id},data:{reason:'forbidden'}}));
});

test('M3 rejection requires a new draft, policy priority changes preserve clock, cancellation and race losers make no duplicate effects',async t=>{
  const s=await setup(t);const {command,call,manager,user,staff,prisma}=s;
  let r=await s.submit(await s.triage(await s.create()));
  r=await command(manager,'/manager/approvals/'+r.id+'/reject',{expectedVersion:r.version,manualDraftRevision:r.pendingDraftRevision,reviewKind:'MANUAL',reason:'Cần chuẩn bị lại phương án'});
  assert.equal(r.status,'TRIAGED');
  await command(manager,'/manager/requests/'+r.id+'/submit-approval',{expectedVersion:r.version,manualDraftRevision:r.manualDraftRevision},409);
  r=await s.assign(await s.submit(await s.triage(r)));
  const start=r.sla.startedAt;
  r=await command(manager,'/manager/requests/'+r.id+'/priority',{expectedVersion:r.version,priority:'URGENT',reason:'Xác nhận mức ảnh hưởng nghiêm trọng'});
  assert.equal(r.sla.targetSeconds,3600);assert.equal(r.sla.startedAt,start);
  await command(user,'/requests/'+r.id+'/cancel',{expectedVersion:r.version,reason:'Không được hủy sau phân công'},409);
  r=await command(staff,'/requests/'+r.id+'/start',{expectedVersion:r.version});
  const race=await Promise.all([
    call(manager,'/manager/requests/'+r.id+'/reassign',{expectedVersion:r.version,teamId:s.decision.teamId,staffId:s.otherStaffRow.id,reason:'Chuyển xử lý'}),
    call(staff,'/requests/'+r.id+'/request-info',{expectedVersion:r.version,body:'Cần thêm thông tin'}),
  ]);
  assert.equal(race.filter(x=>x.status===200).length,1);assert.ok(race.some(x=>[404,409].includes(x.status)));
  r=(await call(manager,'/requests/'+r.id)).body.data;
  r=await command(manager,'/requests/'+r.id+'/cancel',{expectedVersion:r.version,reason:'Hủy yêu cầu thử nghiệm'});
  assert.equal(r.status,'CANCELED');assert.equal(r.sla.stopReason,'CANCELED');assert.notEqual(r.sla.status,'PAUSED');
  assert.equal(await prisma.assignment.count({where:{requestId:r.id,endedAt:null}}),0);
  for(const phase of ['NEW','TRIAGED','PENDING_APPROVAL']) {
    let x=await s.create();if(phase!=='NEW')x=await s.triage(x);if(phase==='PENDING_APPROVAL')x=await s.submit(x);
    x=await command(user,'/requests/'+x.id+'/cancel',{expectedVersion:x.version,reason:'Người gửi hủy'});
    assert.equal(x.status,'CANCELED');assert.equal(x.sla,null);
  }
});

