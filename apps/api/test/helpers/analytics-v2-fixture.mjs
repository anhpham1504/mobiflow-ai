import {randomUUID} from 'node:crypto';
import {copilotActions} from '@mobiflow/contracts';

export const customQuery={from:'2026-03-01',to:'2026-03-04'};
export const customFrom=new Date('2026-02-28T17:00:00Z'),customTo=new Date('2026-03-03T17:00:00Z');
const at=(day,seconds=0)=>new Date(customFrom.getTime()+day*86400000+seconds*1000);

export async function seedAnalyticsFixture(db,{bulk=false}={}){
  const owner=await db.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}}),staff=await db.user.findUniqueOrThrow({where:{email:'staff.iot@mobiflow.local'}}),manager=await db.user.findUniqueOrThrow({where:{email:'manager@mobiflow.local'}});
  const team=await db.team.findUniqueOrThrow({where:{code:'NETWORK_OPERATIONS'}}),policy=await db.slaPolicy.findFirstOrThrow({where:{category:null,priority:'HIGH',active:true}});
  const tag=randomUUID().slice(0,8),rows=[];
  const make=async(index,data={})=>{const r=await db.request.create({data:{id:randomUUID(),publicCode:`M13-${tag}-${index}`,createdById:owner.id,title:'Synthetic analytics '+index,description:'Synthetic analytics only; PRIVATE_PAYLOAD_M13 must not leak.',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',teamId:team.id,currentAssigneeId:staff.id,createdAt:at(0),version:100,priority:'MEDIUM',status:'IN_PROGRESS',...data}});rows.push(r);return r;};
  const event=async(r,action,time,actor='STAFF')=>db.auditLog.create({data:{id:randomUUID(),requestId:r.id,actorType:actor,actorId:actor==='STAFF'?staff.id:owner.id,action,resourceType:'Request',resourceId:r.id,requestCorrelationId:randomUUID(),outcome:'SUCCEEDED',createdAt:time}});
  async function resolution(r,cycle,time,reopened=null){
    const e=await event(r,'RESOLVE',time),record=await db.requestResolution.create({data:{requestId:r.id,cycle,resolvedById:staff.id,rootCause:'Synthetic root cause',resolution:'Synthetic resolution',verification:'Synthetic verification',resolvedAt:time,reopenedAt:reopened,eventId:e.id}});
    await db.requestStatusHistory.create({data:{requestId:r.id,fromStatus:'IN_PROGRESS',toStatus:'RESOLVED',action:'RESOLVE',actorType:'STAFF',actorId:staff.id,requestVersion:cycle*2+1,eventId:e.id,createdAt:time}});
    if(reopened){const e=await event(r,'USER_REOPEN',reopened,'USER');await db.requestStatusHistory.create({data:{requestId:r.id,fromStatus:'RESOLVED',toStatus:'IN_PROGRESS',action:'USER_REOPEN',actorType:'USER',actorId:owner.id,requestVersion:cycle*2+2,eventId:e.id,createdAt:reopened}});}
    if(r.resolvedAt?.getTime()===time.getTime())await db.request.update({where:{id:r.id},data:{currentResolutionId:record.id}});
    return record;
  }
  await make(0,{status:'NEW',priority:'LOW',currentAssigneeId:null,teamId:null,category:null,subcategory:null});
  const r1=await make(1,{status:'CLOSED',priority:'HIGH',createdAt:at(0,3600),resolvedAt:at(1,1800),closedAt:at(2)});
  const r2=await make(2,{status:'RESOLVED',priority:'URGENT',createdAt:at(1),resolvedAt:at(1,3600)});
  const r3=await make(3,{status:'CLOSED',priority:'HIGH',createdAt:at(-2),resolvedAt:at(2,3600),closedAt:at(2,7200)});
  const r4=await make(4,{createdAt:at(2),priority:'MEDIUM'});
  // The reopened request must predate its first immutable resolution.
  await db.request.update({where:{id:r4.id},data:{createdAt:at(0,7200)}});r4.createdAt=at(0,7200);
  const r5=await make(5,{status:'CANCELED',priority:'HIGH',canceledAt:at(1),cancellationReason:'Synthetic canceled fixture'});
  await make(6,{status:'NEW',currentAssigneeId:null,createdAt:new Date(customFrom.getTime()-1)});
  await make(7,{status:'NEW',currentAssigneeId:null,priority:'URGENT',createdAt:customTo});
  const r8=await make(8,{status:'CLOSED',priority:'LOW',createdAt:at(2),resolvedAt:at(2,1800),closedAt:at(2,3600)});
  const r9=await make(9,{status:'RESOLVED',priority:'LOW',resolvedAt:at(1,7200)});
  await resolution(r1,1,r1.resolvedAt);await resolution(r2,1,r2.resolvedAt);await resolution(r3,1,at(0,7200),at(1,60));await resolution(r3,2,r3.resolvedAt);await resolution(r4,1,at(1,7200),at(2,60));await resolution(r8,1,r8.resolvedAt);await resolution(r9,1,r9.resolvedAt);
  const clock=async(r,{elapsed=300,paused=120,hold=180,target=300,breachedAt=null,start,completed=true,stoppedAt=null,stopReason=null,holdAt}={})=>{
    const end=r.resolvedAt??at(1),startedAt=start??new Date(end.getTime()-(elapsed+paused+hold)*1000);
    return db.slaInstance.create({data:{requestId:r.id,policyId:policy.id,policyVersion:policy.version,startedAt,dueAt:new Date(startedAt.getTime()+(target+paused+hold)*1000),targetSeconds:target,totalPausedSeconds:paused,totalResolvedHoldSeconds:hold,resolvedHoldAt:completed?(holdAt??end):null,breachedAt,stoppedAt,stopReason,assessedAt:end,status:'SAFE'}});
  };
  await clock(r1,{stoppedAt:r1.closedAt,stopReason:'CLOSED'});await clock(r2,{elapsed:301});
  const firstStart=at(0,7100),priorHold=(at(1,60).getTime()-at(0,7200).getTime())/1000,stickyElapsed=(r3.resolvedAt.getTime()-firstStart.getTime())/1000-priorHold-120;
  await clock(r3,{start:firstStart,hold:priorHold,target:200000,breachedAt:at(0,7161),stoppedAt:r3.closedAt,stopReason:'CLOSED'});
  await clock(r4,{completed:false,start:at(0,7200),paused:0,hold:(at(2,60).getTime()-at(1,7200).getTime())/1000,target:200000});await clock(r5,{completed:false,paused:0,hold:0,stoppedAt:r5.canceledAt,stopReason:'CANCELED',breachedAt:at(0,61)});
  await clock(r9,{holdAt:new Date(r9.resolvedAt.getTime()+1000)}); // mismatched completion timestamp is not eligible.
  await db.feedback.createMany({data:[{requestId:r1.id,userId:owner.id,rating:5,comment:'PRIVATE_FEEDBACK_M13',createdAt:at(2,10)},{requestId:r3.id,userId:owner.id,rating:3,createdAt:at(2,7210)},{requestId:r8.id,userId:owner.id,rating:1,createdAt:customTo}]});
  const run=async(r,purpose,time,data={})=>db.aiRun.create({data:{requestId:r.id,purpose,contextVersion:1,provider:'synthetic-test',model:'fixture-only',promptVersion:'fixture.m13',schemaVersion:'fixture.m13',status:'SUCCEEDED',createdAt:time,startedAt:time,finishedAt:new Date(time.getTime()+100),latencyMs:100,...data}});
  const recommendation=async(r,status,createdAt,reviewedAt,invalidated=false)=>{
    const a=await run(r,'RECOMMENDATION',createdAt);
    return db.aiRecommendation.create({data:{requestId:r.id,aiRunId:a.id,suggestedPriority:'HIGH',procedureRefsJson:[],actionsJson:[],similarCaseAlertJson:{},evidenceStatus:'INSUFFICIENT_EVIDENCE',reasonSummary:'Synthetic decision fixture',confidence:.5,status,createdAt,reviewedAt,reviewedById:reviewedAt?manager.id:null,invalidatedAt:invalidated?at(2):null}});
  };
  await recommendation(r1,'ACCEPTED',at(-1),customFrom);await recommendation(r2,'MODIFIED',at(0,1),at(1));await recommendation(r3,'REJECTED',at(1),at(2));await recommendation(r4,'PENDING',at(2),null);await recommendation(r5,'PENDING',at(0,2),null,true);await recommendation(r8,'REJECTED',customTo,customTo);
  for(const [index,action] of copilotActions.entries())await run(r4,'COPILOT',at(1,8000+index),{action});
  await run(r4,'COPILOT',at(1,9000),{action:'FIND_SOP',status:'FAILED',retryCount:1,errorCode:'PROVIDER_UNAVAILABLE'});
  await run(r4,'COPILOT',at(1,9001),{action:'FIND_SOP',status:'CANCELED'});
  await run(r4,'COPILOT',at(1,9002),{action:'SUMMARIZE_REQUEST',status:'QUEUED',finishedAt:null,latencyMs:null});
  await run(r4,'COPILOT',at(1,9003),{action:null});
  await run(r4,'COPILOT',new Date(customFrom.getTime()-1),{action:'FIND_SOP'});await run(r4,'COPILOT',customTo,{action:'FIND_SOP'});
  const now=(await db.$queryRaw`SELECT statement_timestamp() AS now`)[0].now;
  const today=new Date(new Date(now.getTime()+7*3600000).toISOString().slice(0,10)+'T00:00:00+07:00');
  for(const age of [0,20,70])await make('preset-'+age,{status:'NEW',currentAssigneeId:null,createdAt:new Date(today.getTime()-age*86400000+1000)});
  if(bulk)await seedBulk(db,{owner,staff,manager,team,policy,tag});
  return {rows,team,manager,owner,staff,expected:{createdCount:7,resolvedCount:6,closedCount:3,reopenedRequestCount:2,slaEligibleCount:3,slaMetCount:1,slaBreachedCount:2,averageResolutionSeconds:(300+301+stickyElapsed)/3},now};
}

export async function seedBulk(db,{owner,staff,manager,team,policy,tag}){
  const count=5101,time=new Date('2030-01-01T00:00:00+07:00'),resolved=new Date(time.getTime()+300000),ids=Array.from({length:count},()=>randomUUID()),events=ids.map(()=>randomUUID()),runIds=ids.map(()=>randomUUID());
  await db.request.createMany({data:ids.map((id,index)=>({id,publicCode:`M13B-${tag}-${index}`,createdById:owner.id,title:'Synthetic bulk',description:'Isolated synthetic scale sample',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',teamId:team.id,currentAssigneeId:staff.id,status:'CLOSED',priority:'LOW',createdAt:time,resolvedAt:resolved,closedAt:resolved}))});
  await db.auditLog.createMany({data:ids.map((id,i)=>({id:events[i],requestId:id,actorType:'STAFF',actorId:staff.id,action:'RESOLVE',resourceType:'Request',resourceId:id,requestCorrelationId:events[i],outcome:'SUCCEEDED',createdAt:resolved}))});
  await db.requestResolution.createMany({data:ids.map((id,i)=>({requestId:id,cycle:1,resolvedById:staff.id,rootCause:'Synthetic bulk root cause',resolution:'Synthetic bulk resolution',verification:'Synthetic bulk verification',resolvedAt:resolved,eventId:events[i]}))});
  await db.slaInstance.createMany({data:ids.map(id=>({requestId:id,policyId:policy.id,policyVersion:policy.version,startedAt:time,dueAt:new Date(time.getTime()+600000),targetSeconds:600,resolvedHoldAt:resolved,stoppedAt:resolved,stopReason:'CLOSED',assessedAt:resolved}))});
  await db.feedback.createMany({data:ids.map(id=>({requestId:id,userId:owner.id,rating:4,createdAt:resolved}))});
  await db.aiRun.createMany({data:ids.map((id,i)=>({id:runIds[i],requestId:id,purpose:'RECOMMENDATION',contextVersion:1,provider:'synthetic-test',model:'fixture-only',promptVersion:'fixture.m13.bulk',schemaVersion:'fixture.m13',status:'SUCCEEDED',createdAt:time,finishedAt:resolved,latencyMs:100}))});
  await db.aiRecommendation.createMany({data:ids.map((id,i)=>({requestId:id,aiRunId:runIds[i],suggestedPriority:'LOW',procedureRefsJson:[],actionsJson:[],similarCaseAlertJson:{},evidenceStatus:'INSUFFICIENT_EVIDENCE',reasonSummary:'Synthetic bulk review',confidence:.5,status:'MODIFIED',reviewedById:manager.id,reviewedAt:resolved,createdAt:time}))});
  return count;
}
