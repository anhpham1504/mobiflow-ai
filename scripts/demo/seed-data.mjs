import {hash,argon2id} from 'argon2';
import {DEMO_MARKER_ACTION,DEMO_MARKER_ID,safeDatabaseTarget} from './release-core.mjs';

export const DEMO_PASSWORD='MobiFlowDemo!2026';
export const DEMO_USER_ID='10000000-0000-4000-8000-000000000001';
export const DEMO_MANAGER_ID='10000000-0000-4000-8000-000000000002';

export const users=[
  ['10000000-0000-4000-8000-000000000001','user@mobiflow.local','Demo Requester','USER',true],
  ['10000000-0000-4000-8000-000000000002','manager@mobiflow.local','Demo Manager','MANAGER',true],
  ['10000000-0000-4000-8000-000000000003','staff.iot@mobiflow.local','IoT Specialist','STAFF',true],
  ['10000000-0000-4000-8000-000000000004','staff.network@mobiflow.local','Network Specialist','STAFF',true],
  ['10000000-0000-4000-8000-000000000005','staff.support@mobiflow.local','Customer Support Specialist','STAFF',true],
  ['10000000-0000-4000-8000-000000000006','staff.billing@mobiflow.local','Billing Specialist','STAFF',true],
];
export const teams=[
  ['20000000-0000-4000-8000-000000000001','NETWORK_OPERATIONS','Network Operations'],
  ['20000000-0000-4000-8000-000000000002','CUSTOMER_SUPPORT','Customer Support'],
  ['20000000-0000-4000-8000-000000000003','BILLING_SUPPORT','Billing Support'],
  ['20000000-0000-4000-8000-000000000004','SERVICE_OPERATIONS','Service Operations'],
];
export const skills=[
  ['30000000-0000-4000-8000-000000000001','IOT','IoT'],
  ['30000000-0000-4000-8000-000000000002','NETWORK','Network'],
  ['30000000-0000-4000-8000-000000000003','BILLING','Billing'],
  ['30000000-0000-4000-8000-000000000004','ACCOUNT','Account'],
  ['30000000-0000-4000-8000-000000000005','CUSTOMER_SUPPORT','Customer Support'],
];
const teamMemberships=[
  ['40000000-0000-4000-8000-000000000001',users[2][0],teams[0][0]],
  ['40000000-0000-4000-8000-000000000002',users[3][0],teams[0][0]],
  ['40000000-0000-4000-8000-000000000003',users[4][0],teams[1][0]],
  ['40000000-0000-4000-8000-000000000004',users[4][0],teams[3][0]],
  ['40000000-0000-4000-8000-000000000005',users[5][0],teams[2][0]],
];
const staffSkills=[
  [users[2][0],skills[0][0]],[users[2][0],skills[1][0]],[users[3][0],skills[1][0]],
  [users[3][0],skills[0][0]],[users[4][0],skills[3][0]],[users[4][0],skills[4][0]],[users[5][0],skills[2][0]],
];
export const slaPolicies=[
  ['50000000-0000-4000-8000-000000000001','LOW',480],
  ['50000000-0000-4000-8000-000000000002','MEDIUM',240],
  ['50000000-0000-4000-8000-000000000003','HIGH',120],
  ['50000000-0000-4000-8000-000000000004','URGENT',60],
];

const requestId=index=>`60000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const eventId=index=>`90000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const entityId=(prefix,index)=>`${prefix}0000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const minutes=(date,value)=>new Date(date.getTime()+value*60000);
const daysAgo=(now,value)=>new Date(now.getTime()-value*86400000);

const storyDefinitions=[
  {code:'MF-DEMO-1001',title:'17 SIM IoT mất kết nối tại Amata',description:'Khách hàng ABC báo 17 SIM IoT tại KCN Amata mất kết nối từ 8 giờ sáng.',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',team:0,staff:2,status:'CLOSED',age:18,feedback:5},
  {code:'MF-DEMO-1002',title:'Hóa đơn bị tính trùng cước',description:'Hóa đơn tháng này xuất hiện hai lần cùng một khoản cước dữ liệu.',category:'BILLING',subcategory:'BILLING_DISCREPANCY',priority:'MEDIUM',team:2,staff:5,status:'RESOLVED',age:8},
  {code:'MF-DEMO-1003',title:'12 SIM IoT mất kết nối tại Amata',description:'Khách hàng ABC báo 12 SIM IoT tại KCN Amata mất kết nối từ 8 giờ sáng.',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',team:0,staff:3,status:'IN_PROGRESS',age:20/1440,stepMinutes:2},
  {code:'MF-DEMO-1004',title:'Tài khoản cổng dịch vụ bị khóa',description:'Người dùng không thể đăng nhập cổng dịch vụ sau khi đổi mật khẩu.',category:'ACCOUNT',subcategory:'ACCESS_ISSUE',priority:'MEDIUM',team:1,staff:4,status:'WAITING_USER',age:2},
  {code:'MF-DEMO-1005',title:'Cấu hình chu kỳ gửi dữ liệu cảm biến',description:'Cần hướng dẫn đổi chu kỳ gửi dữ liệu cho cảm biến IoT đang hoạt động bình thường.',category:'IOT',subcategory:'DEVICE_CONFIGURATION',priority:'LOW',team:0,staff:2,status:'ASSIGNED',age:.1},
  {code:'MF-DEMO-1006',title:'Kích hoạt gói dịch vụ mới',description:'Khách hàng yêu cầu kích hoạt gói dịch vụ doanh nghiệp mới.',category:'SERVICE',subcategory:'ACTIVATION',priority:'MEDIUM',team:3,staff:4,status:'CLOSED',age:12,feedback:4},
  {code:'MF-DEMO-1007',title:'Yêu cầu hỗ trợ không còn cần thiết',description:'Yêu cầu hỗ trợ chung đã được người gửi rút lại trước khi phân công.',category:null,subcategory:null,priority:'MEDIUM',team:null,staff:null,status:'CANCELED',age:4},
  {code:'MF-DEMO-1008',title:'5 SIM IoT mất kết nối kho hàng Amata',description:'Khách hàng ABC báo 5 SIM IoT tại kho hàng KCN Amata mất kết nối từ 8 giờ sáng; cần duyệt kế hoạch kiểm tra.',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',team:null,staff:null,status:'TRIAGED',age:15/1440,stepMinutes:2},
];

export function demoRequestIds(){return storyDefinitions.map((_,index)=>requestId(index+1));}

function transitionsFor(story){
  if(story.status==='CANCELED')return [['NEW','CANCEL','CANCELED','USER']];
  if(story.status==='TRIAGED')return [['NEW','MANUAL_TRIAGE','TRIAGED','MANAGER']];
  const rows=[['NEW','MANUAL_TRIAGE','TRIAGED','MANAGER'],['TRIAGED','SUBMIT_FOR_APPROVAL','PENDING_APPROVAL','MANAGER'],['PENDING_APPROVAL','APPROVE','ASSIGNED','MANAGER']];
  if(['IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED'].includes(story.status))rows.push(['ASSIGNED','START','IN_PROGRESS','STAFF']);
  if(story.status==='WAITING_USER')rows.push(['IN_PROGRESS','REQUEST_INFO','WAITING_USER','STAFF']);
  if(['RESOLVED','CLOSED'].includes(story.status))rows.push(['IN_PROGRESS','RESOLVE','RESOLVED','STAFF']);
  if(story.status==='CLOSED')rows.push(['RESOLVED','USER_CONFIRM','CLOSED','USER']);
  return rows;
}

function historicalData(now){
  const requests=[],audits=[],histories=[],assignments=[],slaInstances=[],resolutions=[],feedback=[],notifications=[];
  let nextEvent=100;
  for(const [offset,story] of storyDefinitions.entries()){
    const id=requestId(offset+1),createdAt=daysAgo(now,story.age),transitions=transitionsFor(story),version=transitions.length+1;
    const stepMinutes=story.stepMinutes??25,finalAt=minutes(createdAt,transitions.length*stepMinutes);
    const assigneeId=story.staff===null?null:users[story.staff][0],teamId=story.team===null?null:teams[story.team][0];
    requests.push({id,publicCode:story.code,createdById:DEMO_USER_ID,title:story.title,description:story.description,status:story.status,category:story.category,subcategory:story.subcategory,priority:story.priority,teamId,currentAssigneeId:assigneeId,version,aiAnalysisStatus:'NOT_STARTED',createdAt,updatedAt:finalAt,resolvedAt:['RESOLVED','CLOSED'].includes(story.status)?minutes(createdAt,125):null,closedAt:story.status==='CLOSED'?minutes(createdAt,150):null,canceledAt:story.status==='CANCELED'?minutes(createdAt,25):null,cancellationReason:story.status==='CANCELED'?'Người gửi xác nhận không còn cần hỗ trợ.':null});
    const createEvent=eventId(nextEvent++);
    audits.push({id:createEvent,requestId:id,actorType:'USER',actorId:DEMO_USER_ID,initiatingActorId:DEMO_USER_ID,action:'CREATE',resourceType:'Request',resourceId:id,requestCorrelationId:createEvent,safeAfterJson:{status:'NEW'},reason:'Synthetic M10 demonstration request.',outcome:'SUCCEEDED',createdAt});
    histories.push({id:entityId('7',nextEvent),requestId:id,fromStatus:null,toStatus:'NEW',action:'CREATE',actorType:'USER',actorId:DEMO_USER_ID,requestVersion:1,eventId:createEvent,createdAt});
    transitions.forEach(([fromStatus,action,toStatus,actorType],transitionOffset)=>{
      const event=eventId(nextEvent++),at=minutes(createdAt,(transitionOffset+1)*stepMinutes),actorId=actorType==='USER'?DEMO_USER_ID:actorType==='MANAGER'?DEMO_MANAGER_ID:assigneeId;
      audits.push({id:event,requestId:id,actorType,actorId,initiatingActorId:actorId,action,resourceType:'Request',resourceId:id,requestCorrelationId:event,safeBeforeJson:{status:fromStatus},safeAfterJson:{status:toStatus},reason:'Synthetic M10 demonstration history.',outcome:'SUCCEEDED',createdAt:at});
      histories.push({id:entityId('7',nextEvent),requestId:id,fromStatus,toStatus,action,actorType,actorId,requestVersion:transitionOffset+2,eventId:event,createdAt:at});
      if(transitionOffset===transitions.length-1)notifications.push({id:entityId('e',offset+1),recipientId:DEMO_MANAGER_ID,requestId:id,eventId:event,type:'STATUS_CHANGED',safeActorMetadataJson:{actorType,actorId,synthetic:true},createdAt:at});
    });
    if(assigneeId){
      const assignmentEvent=eventId(nextEvent++),assignedAt=minutes(createdAt,3*stepMinutes),endedAt=story.status==='CLOSED'?minutes(createdAt,150):null;
      audits.push({id:assignmentEvent,requestId:id,actorType:'MANAGER',actorId:DEMO_MANAGER_ID,initiatingActorId:DEMO_MANAGER_ID,action:'ASSIGN',resourceType:'Assignment',resourceId:id,requestCorrelationId:assignmentEvent,safeAfterJson:{teamId,staffId:assigneeId},reason:'Synthetic manager-approved assignment.',outcome:'SUCCEEDED',createdAt:assignedAt});
      assignments.push({id:entityId('8',offset+1),requestId:id,staffId:assigneeId,teamId,assignedById:DEMO_MANAGER_ID,assignedAt,endedAt,reason:'Synthetic manager-approved demonstration assignment.',decisionKind:'MANUAL',finalDecisionJson:{category:story.category,subcategory:story.subcategory,priority:story.priority,teamId,staffId:assigneeId,provenance:'SYNTHETIC_M10_HISTORY'},eventId:assignmentEvent});
      const policy=slaPolicies.find(([,priority])=>priority===story.priority),targetSeconds=policy[2]*60;
      const waiting=story.status==='WAITING_USER',terminal=['RESOLVED','CLOSED'].includes(story.status);
      const breached=story.status==='IN_PROGRESS'&&finalAt>minutes(assignedAt,policy[2]);
      slaInstances.push({id:entityId('b',offset+1),requestId:id,policyId:policy[0],policyVersion:1,targetSeconds,startedAt:assignedAt,dueAt:minutes(assignedAt,policy[2]),pausedAt:waiting?finalAt:null,totalPausedSeconds:0,resolvedHoldAt:terminal?minutes(createdAt,125):null,totalResolvedHoldSeconds:0,stoppedAt:story.status==='CLOSED'?minutes(createdAt,150):null,stopReason:story.status==='CLOSED'?'CLOSED':null,status:terminal?'MET':waiting?'PAUSED':breached?'BREACHED':'SAFE',breachedAt:breached?minutes(assignedAt,policy[2]):null,assessedAt:finalAt,version:1});
      if(terminal){
        const resolutionEvent=eventId(nextEvent++),resolutionId=entityId('c',offset+1),resolvedAt=minutes(createdAt,125);
        audits.push({id:resolutionEvent,requestId:id,actorType:'STAFF',actorId:assigneeId,initiatingActorId:assigneeId,action:'RESOLVE',resourceType:'RequestResolution',resourceId:resolutionId,requestCorrelationId:resolutionEvent,safeAfterJson:{cycle:1},reason:'Synthetic verified resolution.',outcome:'SUCCEEDED',createdAt:resolvedAt});
        resolutions.push({id:resolutionId,requestId:id,cycle:1,resolvedById:assigneeId,rootCause:story.category==='BILLING'?'Bản ghi cước nguồn được nhập trùng.':'Cấu hình hoặc tài nguyên dịch vụ cần được đồng bộ lại.',resolution:story.category==='BILLING'?'Đã đối soát và loại bỏ khoản cước trùng.':'Đã áp dụng quy trình khắc phục được phê duyệt.',verification:'Người xử lý đã kiểm tra lại trạng thái dịch vụ.',resolvedAt,confirmedAt:story.status==='CLOSED'?minutes(createdAt,150):null,eventId:resolutionEvent});
        requests.at(-1).currentResolutionId=resolutionId;
      }
    }
    if(story.feedback)feedback.push({id:entityId('d',offset+1),requestId:id,userId:DEMO_USER_ID,rating:story.feedback,comment:'Phản hồi tổng hợp cho dữ liệu trình diễn M10.',createdAt:minutes(createdAt,160)});
  }
  audits.unshift({id:DEMO_MARKER_ID,actorType:'SYSTEM',action:DEMO_MARKER_ACTION,resourceType:'DemoDataset',resourceId:'mobiflow-m10-synthetic',requestCorrelationId:DEMO_MARKER_ID,safeAfterJson:{synthetic:true,schema:'m10.v1',seedReferenceTime:now.toISOString()},reason:'Marks this allowlisted local database as synthetic demo data.',outcome:'SUCCEEDED',createdAt:now});
  return {requests,audits,histories,assignments,slaInstances,resolutions,feedback,notifications};
}

export async function seedDemo(prisma,{databaseUrl=process.env.DATABASE_URL,now=new Date(process.env.DEMO_SEED_REFERENCE_TIME??Date.now())}={}){
  if(!Number.isFinite(now.getTime()))throw new Error('DEMO_SEED_REFERENCE_TIME must be a valid ISO timestamp.');
  const target=safeDatabaseTarget(databaseUrl,{demoMode:process.env.DEMO_MODE});
  const existingRows=await prisma.user.findMany({where:{id:{in:users.map(([id])=>id)}},select:{id:true,passwordHash:true}});
  const passwordHashes=new Map(existingRows.map(row=>[row.id,row.passwordHash]));
  for(const [id] of users)if(!passwordHashes.has(id))passwordHashes.set(id,await hash(DEMO_PASSWORD,{type:argon2id,memoryCost:65536,timeCost:3,parallelism:1}));
  const history=historicalData(now);
  await prisma.$transaction(async tx=>{
    for(const [id,email,displayName,role,available] of users)await tx.user.upsert({where:{id},create:{id,email,displayName,role,active:true,available,passwordHash:passwordHashes.get(id)},update:{email,displayName,role,active:true,available}});
    for(const [id,code,name] of teams)await tx.team.upsert({where:{id},create:{id,code,name},update:{code,name,active:true}});
    for(const [id,code,name] of skills)await tx.skill.upsert({where:{id},create:{id,code,name},update:{code,name}});
    for(const [id,userId,teamId] of teamMemberships)await tx.teamMember.upsert({where:{id},create:{id,userId,teamId},update:{userId,teamId,active:true}});
    for(const [staffId,skillId] of staffSkills)await tx.staffSkill.upsert({where:{staffId_skillId:{staffId,skillId}},create:{staffId,skillId},update:{}});
    for(const [id,priority,targetMinutes] of slaPolicies)await tx.slaPolicy.upsert({where:{id},create:{id,category:null,priority,targetMinutes},update:{category:null,priority,targetMinutes,active:true,version:1}});
    await tx.request.createMany({data:history.requests.map(request=>{const create={...request};delete create.currentResolutionId;return create;}),skipDuplicates:true});
    await tx.auditLog.createMany({data:history.audits,skipDuplicates:true});
    await tx.requestStatusHistory.createMany({data:history.histories,skipDuplicates:true});
    await tx.assignment.createMany({data:history.assignments,skipDuplicates:true});
    await tx.slaInstance.createMany({data:history.slaInstances,skipDuplicates:true});
    await tx.requestResolution.createMany({data:history.resolutions,skipDuplicates:true});
    await tx.feedback.createMany({data:history.feedback,skipDuplicates:true});
    await tx.notification.createMany({data:history.notifications,skipDuplicates:true});
    for(const request of history.requests)if(request.currentResolutionId)await tx.request.update({where:{id:request.id},data:{currentResolutionId:request.currentResolutionId}});
  },{timeout:30000});
  const counts={
    users:await prisma.user.count({where:{id:{in:users.map(([id])=>id)}}}),teams:await prisma.team.count({where:{id:{in:teams.map(([id])=>id)}}}),
    skills:await prisma.skill.count({where:{id:{in:skills.map(([id])=>id)}}}),memberships:await prisma.teamMember.count({where:{id:{in:teamMemberships.map(([id])=>id)}}}),
    staffSkills:await prisma.staffSkill.count({where:{OR:staffSkills.map(([staffId,skillId])=>({staffId,skillId}))}}),slaPolicies:await prisma.slaPolicy.count({where:{id:{in:slaPolicies.map(([id])=>id)}}}),
    historicalRequests:await prisma.request.count({where:{id:{in:demoRequestIds()}}}),marker:await prisma.auditLog.count({where:{id:DEMO_MARKER_ID,action:DEMO_MARKER_ACTION}}),
  };
  const expected={users:6,teams:4,skills:5,memberships:5,staffSkills:7,slaPolicies:4,historicalRequests:8,marker:1};
  if(JSON.stringify(counts)!==JSON.stringify(expected))throw new Error(`Seed verification failed: ${JSON.stringify(counts)}`);
  return {database:target.database,counts};
}
