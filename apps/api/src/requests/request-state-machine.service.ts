import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@mobiflow/config';
import { API_ENV } from '../tokens.js';
import { analysisSchema, analysisSchemaVersion } from '@mobiflow/contracts';
import { promptVersion, type AnalysisInput } from '../ai/prompts/request-analysis.js';
import type { executeAnalysis } from '../ai/analysis-execution.js';
import { randomUUID } from 'node:crypto';
import { finalDecisionSchema, type FinalDecision } from '@mobiflow/contracts';
import { Prisma, type Request as DomainRequest } from '../generated/prisma/client.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import { ApiError } from '../http.js';
import { transitionTarget, type Action } from './transition-rules.js';
import { changeSla, second } from './sla-clock.js';
import { parse } from './validation.js';
import {VectorRepository} from '../knowledge/vector.repository.js';
import {validateCitations} from '../knowledge/rag-output.js';
import {snapshotOf} from '../knowledge/retriever.js';

type Tx = Prisma.TransactionClient;
export interface Command {
  expectedVersion: number; reason?: string; body?: string; finalDecision?: FinalDecision;
  manualDraftRevision?: number; reviewKind?: 'MANUAL'; acknowledgedMissingFields?: string[];
  teamId?: string; staffId?: string; priority?: 'LOW'|'MEDIUM'|'HIGH'|'URGENT';
  rootCause?: string; resolution?: string; verification?: string;
  itemId?: string; text?: string; required?: boolean; operation?: 'COMPLETE'|'UNCOMPLETE'|'WAIVE'|'UNWAIVE';
  items?: { text: string; required: boolean; sourceIds: string[] }[];
}
@Injectable()
export class RequestStateMachineService {
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService, @Inject(API_ENV) private readonly env:ApiEnvironment,private readonly vectors:VectorRepository) {}

  private async identity(tx: Tx, actor: AuthenticatedActor) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actor.id}::uuid FOR SHARE`);
    const user = await tx.user.findUnique({ where:{id:actor.id} });
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "id"=${actor.sessionId}::uuid FOR SHARE`);
    const session = await tx.refreshSession.findFirst({ where:{id:actor.sessionId,userId:actor.id,consumedAt:null,revokedAt:null,expiresAt:{gt:new Date()}} });
    if (!user?.active || user.role !== actor.role || !session) throw new ApiError(401,'UNAUTHORIZED','Authentication is required.');
  }
  private async now(tx: Tx) {
    const [row] = await tx.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT clock_timestamp() AS now`);
    return row!.now;
  }
  async create(actor: AuthenticatedActor, input: {description:string;title?:string}, correlationId: string) {
    if (actor.role !== 'USER') throw new ApiError(403,'FORBIDDEN','Only a user may create a request.');
    return this.prisma.$transaction(async tx => {
      await this.identity(tx,actor);
      const now = await this.now(tx);
      const [seq] = await tx.$queryRaw<{value:bigint}[]>(Prisma.sql`SELECT nextval('request_public_code_seq') AS value`);
      const request = await tx.request.create({data:{
        publicCode:`MF-${now.getUTCFullYear()}-${String(seq!.value).padStart(6,'0')}`,
        createdById:actor.id,title:input.title ?? input.description.slice(0,100),description:input.description,
        status:'NEW',priority:'MEDIUM',version:1,createdAt:now,updatedAt:now,
      }});
      const event = await this.event(tx,request,actor,'CREATE',correlationId,now,undefined, {status:'NEW',version:1});
      await tx.requestStatusHistory.create({data:{requestId:request.id,toStatus:'NEW',action:'CREATE',actorType:actor.role,actorId:actor.id,requestVersion:1,eventId:event.id,createdAt:now}});
      if(this.env.AI_AUTO_ANALYZE)await this.queueAnalysis(tx,request,actor.id,now);
      return request.id;
    });
  }
  async transition(id: string, action: Action, actor: AuthenticatedActor, command: Command, correlationId: string) {
    return this.prisma.$transaction(async tx => {
      await this.identity(tx,actor);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${id}::uuid FOR UPDATE`);
      const request = await tx.request.findUnique({where:{id}});
      this.policy.assertCanReadRequest(actor,request);
      if (!request) throw new ApiError(404,'NOT_FOUND','The resource was not found.');
      if (request.version !== command.expectedVersion) throw new ApiError(409,'STALE_VERSION','The request changed. Reload and review before retrying.');
      const next = transitionTarget(request.status,action,actor.role);
      const now = await this.now(tx);
      const data: Prisma.RequestUncheckedUpdateInput = {version:{increment:1},updatedAt:now,status:next};
      const before = {status:request.status,version:request.version,priority:request.priority,teamId:request.teamId,currentAssigneeId:request.currentAssigneeId};
      const event = await this.event(tx,request,actor,action,correlationId,now,command.reason ?? command.finalDecision?.reason, {status:next,version:request.version+1},before);
      let notification: string | undefined;
      let message: {id:string;body:string;kind:string;createdAt:Date} | undefined;
      let recipients: string[] = [];
      const managers = async () => (await tx.user.findMany({where:{role:'MANAGER',active:true},select:{id:true}})).map(u=>u.id);
      if (action === 'MANUAL_TRIAGE') {
        await tx.aiRun.updateMany({where:{requestId:id,purpose:'ANALYSIS',status:'QUEUED'},data:{status:'CANCELED',finishedAt:now,errorCode:'MANUAL_TRIAGE',errorSummary:'Superseded by human triage.'}});
        const decision = command.finalDecision!;
        const policy = await this.validateDecision(tx,decision);
        data.triageDraftJson = {...decision,policyId:policy.id,policyVersion:policy.version,targetSeconds:policy.targetMinutes*60};
        data.manualDraftRevision = {increment:1};
        // Keep all draft revisions in immutable manager-only audit, never publish draft fields to USER.
        await tx.auditLog.create({data:{requestId:id,actorType:actor.role,actorId:actor.id,action:'MANUAL_DRAFT_SAVED',resourceType:'Request',resourceId:id,requestCorrelationId:correlationId,safeBeforeJson:request.triageDraftJson ?? Prisma.JsonNull,safeAfterJson:data.triageDraftJson,reason:decision.reason,outcome:'SUCCEEDED',createdAt:now}});
      }
      if (action === 'SUBMIT_FOR_APPROVAL') {
        if (!request.triageDraftJson || command.manualDraftRevision !== request.manualDraftRevision) throw new ApiError(409,'STALE_VERSION','The manual draft changed.');
        await this.validateDecision(tx,parse(finalDecisionSchema,this.draftFields(request.triageDraftJson)));
        data.reviewKind='MANUAL'; data.pendingDraftRevision=request.manualDraftRevision;
        notification='APPROVAL_REQUIRED'; recipients=await managers();
      }
      if (action === 'APPROVE_AND_ASSIGN' || action === 'REJECT_APPROVAL') {
        if (request.reviewKind !== 'MANUAL' || command.reviewKind !== 'MANUAL' || request.pendingDraftRevision !== command.manualDraftRevision || request.manualDraftRevision !== command.manualDraftRevision) throw new ApiError(409,'ALREADY_REVIEWED','The review is no longer current.');
        data.reviewKind=null; data.pendingDraftRevision=null; data.pendingRecommendationId=null;
        if (action === 'REJECT_APPROVAL') { data.triageDraftJson=Prisma.DbNull; }
        else {
          const original = parse(finalDecisionSchema,this.draftFields(request.triageDraftJson));
          const decision = command.finalDecision ?? {...original,acknowledgedMissingFields:command.acknowledgedMissingFields as FinalDecision['acknowledgedMissingFields']};
          const policy = await this.validateDecision(tx,decision);
          if(request.latestAnalysisId){
            const analysis=await tx.aiAnalysis.findUniqueOrThrow({where:{id:request.latestAnalysisId}});
            const missing=analysis.missingFieldsJson as string[];
            if(missing.some(field=>['location','startedAt'].includes(field)&&!decision.acknowledgedMissingFields.includes(field as 'location'|'startedAt')))throw new ApiError(422,'MISSING_ACKNOWLEDGMENT','Acknowledge missing location/time before approval.');
          }
          const draftSnapshot=request.triageDraftJson as Prisma.JsonObject;
          if(!command.finalDecision && (draftSnapshot.policyId!==policy.id || draftSnapshot.policyVersion!==policy.version || draftSnapshot.targetSeconds!==policy.targetMinutes*60)) throw new ApiError(422,'STALE_POLICY','The SLA policy changed. Modify or prepare a new draft before approval.');
          const snapshot = {...decision,policyId:policy.id,policyVersion:policy.version,targetSeconds:policy.targetMinutes*60};
          Object.assign(data,{category:decision.category,subcategory:decision.subcategory,priority:decision.priority,teamId:decision.teamId,currentAssigneeId:decision.staffId});
          await tx.assignment.create({data:{requestId:id,staffId:decision.staffId,teamId:decision.teamId,assignedById:actor.id,assignedAt:now,reason:decision.reason,decisionKind:'MANUAL',finalDecisionJson:snapshot,managerChangesJson:command.finalDecision ? {original,final:decision} : Prisma.JsonNull,eventId:event.id}});
          const start=second(now);
          await tx.slaInstance.create({data:{requestId:id,policyId:policy.id,policyVersion:policy.version,targetSeconds:policy.targetMinutes*60,startedAt:start,dueAt:new Date(start.getTime()+policy.targetMinutes*60000),assessedAt:start}});
          await tx.checklist.create({data:{requestId:id,createdById:actor.id,provenance:'APPROVAL',items:{create:decision.actions.map((item,i)=>({ordinal:i+1,text:item.text,required:item.required,sourceRefsJson:[],createdAt:now,updatedAt:now}))},createdAt:now,updatedAt:now}});
          notification='REQUEST_ASSIGNED'; recipients=[decision.staffId];
        }
      }
      if (['MESSAGE','REQUEST_USER_INFO','USER_PROVIDE_INFO'].includes(action)) {
        message=await tx.requestMessage.create({data:{requestId:id,authorId:actor.id,kind:action==='MESSAGE'?'COMMENT':action==='REQUEST_USER_INFO'?'INFO_REQUEST':'INFO_REPLY',body:command.body!,eventId:event.id,createdAt:now},select:{id:true,body:true,kind:true,createdAt:true}});
        if (action==='REQUEST_USER_INFO') {notification='USER_INFO_REQUIRED';recipients=[request.createdById];}
        if (action==='USER_PROVIDE_INFO') {notification='USER_REPLIED';recipients=[request.currentAssigneeId!];}
      }
      if (action==='RESOLVE') {
        const incomplete=await tx.checklistItem.count({where:{checklist:{requestId:id},required:true,completedAt:null,waivedAt:null}});
        if (incomplete) throw new ApiError(422,'INCOMPLETE_CHECKLIST','Complete or explicitly waive all required items.');
        const latest=await tx.requestResolution.aggregate({where:{requestId:id},_max:{cycle:true}});
        const resolution=await tx.requestResolution.create({data:{requestId:id,cycle:(latest._max.cycle??0)+1,resolvedById:actor.id,rootCause:command.rootCause!,resolution:command.resolution!,verification:command.verification!,resolvedAt:now,eventId:event.id}});
        data.resolvedAt=now;data.currentResolutionId=resolution.id;
        notification='REQUEST_RESOLVED';recipients=[request.createdById];
      }
      if (action==='USER_REOPEN' || action==='USER_CONFIRM') {
        if (!request.currentResolutionId) throw new ApiError(422,'INVALID_RESOLUTION','A current resolution is required.');
        await tx.requestResolution.update({where:{id:request.currentResolutionId},data:action==='USER_REOPEN'?{reopenedAt:now}:{confirmedAt:now}});
        if (action==='USER_REOPEN') {
          data.resolvedAt=null;data.currentResolutionId=null;
          notification='REQUEST_REOPENED';recipients=[request.currentAssigneeId!,...await managers()];
        } else {data.closedAt=now;}
      }
      if (action==='CANCEL') {
        data.canceledAt=now;data.cancellationReason=command.reason!;
        data.reviewKind=null;data.pendingDraftRevision=null;data.pendingRecommendationId=null;data.activeAnalysisRunId=null;
        if(request.aiAnalysisStatus==='RUNNING') data.aiAnalysisStatus='FAILED';
        await tx.aiRun.updateMany({where:{requestId:id,status:{in:['QUEUED','RUNNING']}},data:{status:'CANCELED',finishedAt:now,errorCode:'REQUEST_CANCELED'}});
        await tx.aiRecommendation.updateMany({where:{requestId:id,status:'PENDING',invalidatedAt:null},data:{invalidatedAt:now,invalidationReason:'REQUEST_CANCELED'}});
      }
      if(action==='USER_CONFIRM'||action==='CANCEL'||action==='REASSIGN') {
        await tx.assignment.updateMany({where:{requestId:id,endedAt:null},data:{endedAt:now}});
      }
      if(action==='REASSIGN') {
        await this.eligibleStaff(tx,command.teamId!,command.staffId!);
        const previous=await tx.assignment.findFirst({where:{requestId:id},orderBy:{assignedAt:'desc'}});
        if(!previous) throw new ApiError(422,'INVALID_ASSIGNMENT','Assignment is required.');
        await tx.assignment.create({data:{requestId:id,staffId:command.staffId!,teamId:command.teamId!,assignedById:actor.id,assignedAt:now,reason:command.reason!,decisionKind:'REASSIGN',finalDecisionJson:{...(previous.finalDecisionJson as Prisma.JsonObject),teamId:command.teamId!,staffId:command.staffId!},eventId:event.id}});
        data.currentAssigneeId=command.staffId!;data.teamId=command.teamId!;
        notification='REQUEST_ASSIGNED';recipients=[command.staffId!];
      }
      if(action==='CHECKLIST_ADD'||action==='CHECKLIST_EDIT') {
        const checklistBefore=await tx.checklist.findUnique({where:{requestId:id},include:{items:true}});
        await this.checklist(tx,request,actor,command,now);
        const checklistAfter=await tx.checklist.findUnique({where:{requestId:id},include:{items:true}});
        const snapshot=(value:typeof checklistBefore)=>({items:value?.items.map(i=>({id:i.id,text:i.text,required:i.required,completedAt:i.completedAt?.toISOString()??null,waivedAt:i.waivedAt?.toISOString()??null,waiverReason:i.waiverReason}))??[]});
        await tx.auditLog.create({data:{requestId:id,actorType:actor.role,actorId:actor.id,action:'CHECKLIST_CHANGED',resourceType:'Checklist',resourceId:checklistAfter!.id,requestCorrelationId:correlationId,safeBeforeJson:snapshot(checklistBefore),safeAfterJson:snapshot(checklistAfter),reason:command.reason,outcome:'SUCCEEDED',createdAt:now}});
      }
      const sla=await tx.slaInstance.findUnique({where:{requestId:id}});
      if(sla && !['REASSIGN','MESSAGE','CHECKLIST_ADD','CHECKLIST_EDIT','APPROVE_AND_ASSIGN'].includes(action)) {
        const policy=action==='PRIORITY'?await this.slaPolicy(tx,request.category!,command.priority!):null;
        if(policy) data.priority=command.priority;
        await tx.slaInstance.update({where:{id:sla.id},data:{...changeSla(sla,action,now,policy?policy.targetMinutes*60:undefined),version:{increment:1},...(policy?{policyId:policy.id,policyVersion:policy.version}:{})}});
        if(policy) await tx.auditLog.create({data:{requestId:id,actorType:actor.role,actorId:actor.id,action:'SLA_POLICY_CHANGED',resourceType:'SlaInstance',resourceId:sla.id,requestCorrelationId:correlationId,safeBeforeJson:{policyId:sla.policyId,targetSeconds:sla.targetSeconds,dueAt:sla.dueAt.toISOString()},safeAfterJson:{policyId:policy.id,targetSeconds:policy.targetMinutes*60,dueAt:changeSla(sla,action,now,policy.targetMinutes*60).dueAt.toISOString()},reason:command.reason,outcome:'SUCCEEDED',createdAt:now}});
      }
      await tx.request.update({where:{id,version:command.expectedVersion},data});
      if(next!==request.status) await tx.requestStatusHistory.create({data:{requestId:id,fromStatus:request.status,toStatus:next,action,actorType:actor.role,actorId:actor.id,requestVersion:request.version+1,eventId:event.id,createdAt:now}});
      if(notification) await tx.notification.createMany({data:[...new Set(recipients)].map(recipientId=>({recipientId,requestId:id,eventId:event.id,type:notification!,safeActorMetadataJson:{actorType:actor.role},createdAt:now})),skipDuplicates:true});
      return {id,message};
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:15000});
  }
  private queueAnalysis(tx:Tx,request:DomainRequest,initiatingActorId:string,now:Date) {
    return tx.aiRun.create({data:{requestId:request.id,purpose:'ANALYSIS',initiatingActorId,contextVersion:request.version,provider:this.env.AI_PROVIDER,model:this.env.OLLAMA_MODEL,promptVersion,schemaVersion:analysisSchemaVersion,deadlineAt:new Date(now.getTime()+this.env.AI_RUN_TIMEOUT_MS),createdAt:now}});
  }
  async scheduleAnalysis(id:string,actor:AuthenticatedActor,expectedVersion:number,retry:boolean,correlationId:string){
    if(!['USER','MANAGER'].includes(actor.role))throw new ApiError(403,'FORBIDDEN','This role cannot schedule intake.');
    return this.prisma.$transaction(async tx=>{
      await this.identity(tx,actor);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${id}::uuid FOR UPDATE`);
      const request=await tx.request.findUnique({where:{id}});this.policy.assertCanReadRequest(actor,request);
      if(!request)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
      if(request.version!==expectedVersion)throw new ApiError(409,'STALE_VERSION','Reload and review before retrying.');
      const active=await tx.aiRun.findFirst({where:{requestId:id,purpose:'ANALYSIS',status:{in:['QUEUED','RUNNING']}}});
      if(active)return active;
      if(request.status!=='NEW'||(retry&&request.aiAnalysisStatus!=='FAILED'))throw new ApiError(409,'INVALID_STATE','Intake requires NEW; retry requires failed intake.');
      const now=await this.now(tx),run=await this.queueAnalysis(tx,request,actor.id,now);
      await this.event(tx,request,actor,retry?'AI_RETRY_QUEUED':'AI_ANALYSIS_QUEUED',correlationId,now);
      return run;
    });
  }
  private async systemEdge(tx:Tx,request:DomainRequest,runId:string,action:'START_AI_ANALYSIS'|'COMPLETE_AI_ANALYSIS'|'FAIL_AI_ANALYSIS',now:Date,data:Prisma.RequestUncheckedUpdateInput,initiator:string|null){
    const target={START_AI_ANALYSIS:'AI_ANALYZING',COMPLETE_AI_ANALYSIS:'TRIAGED',FAIL_AI_ANALYSIS:'NEW'} as const;
    const expected=action==='START_AI_ANALYSIS'?'NEW':'AI_ANALYZING';
    if(request.status!==expected||(action!=='START_AI_ANALYSIS'&&request.activeAnalysisRunId!==runId))throw new ApiError(409,'INVALID_STATE','The intake capability is no longer active.');
    const version=request.version+1;
    const event=await tx.auditLog.create({data:{requestId:request.id,actorType:'SYSTEM',initiatingActorId:initiator,action,resourceType:'AiRun',resourceId:runId,requestCorrelationId:runId,safeBeforeJson:{status:request.status,version:request.version},safeAfterJson:{status:target[action],version},outcome:action==='FAIL_AI_ANALYSIS'?'FAILED':'SUCCEEDED',createdAt:now}});
    await tx.request.update({where:{id:request.id,version:request.version},data:{...data,status:target[action],version,updatedAt:now}});
    await tx.requestStatusHistory.create({data:{requestId:request.id,fromStatus:request.status,toStatus:target[action],action,actorType:'SYSTEM',requestVersion:version,eventId:event.id,createdAt:now}});
  }
  private async analysisActor(tx:Tx,actorId:string|null,request:DomainRequest){
    if(!actorId)return false;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actorId}::uuid FOR SHARE`);
    const actor=await tx.user.findUnique({where:{id:actorId}});
    return !!actor?.active&&(actor.role==='MANAGER'||(actor.role==='USER'&&actor.id===request.createdById));
  }
  async claimAnalysis(runId:string){
    const pending=await this.prisma.aiRun.findUnique({where:{id:runId}});if(!pending?.requestId)return null;
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${pending.requestId}::uuid FOR UPDATE`);
      const request=await tx.request.findUniqueOrThrow({where:{id:pending.requestId!}});
      const run=await tx.aiRun.findUniqueOrThrow({where:{id:runId}}),now=await this.now(tx);
      if(run.status!=='QUEUED'||run.purpose!=='ANALYSIS')return null;
      const authorized=await this.analysisActor(tx,run.initiatingActorId,request);
      if(!authorized||request.status!=='NEW'||request.version!==run.contextVersion||!run.deadlineAt||run.deadlineAt<=now){
        await this.failAnalysisLocked(tx,request,run,now,!authorized?'FORBIDDEN':run.deadlineAt&&run.deadlineAt<=now?'AI_TIMEOUT':'STALE_CONTEXT');return null;
      }
      const rows=await tx.requestMessage.findMany({where:{requestId:request.id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,select:{id:true,body:true}});
      const input:AnalysisInput={title:request.title,description:request.description,messages:[],historyTruncated:rows.length>50};
      for(const message of rows.slice(0,50)){
        if(JSON.stringify({...input,messages:[message,...input.messages]}).length>24000){input.historyTruncated=true;break;}
        input.messages.unshift(message);
      }
      if(JSON.stringify(input).length>24000){await this.failAnalysisLocked(tx,request,run,now,'CONTEXT_TOO_LARGE');return null;}
      const claimed=await tx.aiRun.update({where:{id:runId},data:{status:'RUNNING',startedAt:now,leaseUntil:run.deadlineAt,contextVersion:request.version+1,inputSize:JSON.stringify(input).length,retrievalSnapshotJson:{messageIds:input.messages.map(m=>m.id),historyTruncated:input.historyTruncated}}});
      await this.systemEdge(tx,request,runId,'START_AI_ANALYSIS',now,{aiAnalysisStatus:'RUNNING',activeAnalysisRunId:runId},run.initiatingActorId);
      return {run:claimed,input};
    });
  }
  private async failAnalysisLocked(tx:Tx,request:DomainRequest,run:Prisma.AiRunGetPayload<object>,now:Date,code:string,latencyMs?:number){
    if(!['QUEUED','RUNNING'].includes(run.status))return;
    await tx.aiRun.update({where:{id:run.id},data:{status:'FAILED',finishedAt:now,leaseUntil:null,errorCode:code,errorSummary:'Analysis failed; retry or use manual triage.',...(latencyMs===undefined?{}:{latencyMs})}});
    if(request.status==='AI_ANALYZING'&&request.activeAnalysisRunId===run.id){
      await this.systemEdge(tx,request,run.id,'FAIL_AI_ANALYSIS',now,{activeAnalysisRunId:null,aiAnalysisStatus:'FAILED'},run.initiatingActorId);
    }else{
      if(request.status==='NEW')await tx.request.update({where:{id:request.id},data:{aiAnalysisStatus:'FAILED'}});
      await tx.auditLog.create({data:{requestId:request.id,actorType:'SYSTEM',initiatingActorId:run.initiatingActorId,action:'AI_ANALYSIS_FAILED',resourceType:'AiRun',resourceId:run.id,requestCorrelationId:run.id,safeAfterJson:{errorCode:code},outcome:'FAILED',createdAt:now}});
    }
  }
  async finishAnalysis(runId:string,result?:Awaited<ReturnType<typeof executeAnalysis>>,errorCode='AI_ANALYSIS_FAILED',latencyMs?:number){
    const initial=await this.prisma.aiRun.findUnique({where:{id:runId}});if(!initial?.requestId)return;
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${initial.requestId}::uuid FOR UPDATE`);
      const request=await tx.request.findUniqueOrThrow({where:{id:initial.requestId!}}),run=await tx.aiRun.findUniqueOrThrow({where:{id:runId}}),now=await this.now(tx);
      if(!['QUEUED','RUNNING'].includes(run.status))return;
      const authorized=await this.analysisActor(tx,run.initiatingActorId,request);
      const matches=request.status==='AI_ANALYZING'&&request.activeAnalysisRunId===runId&&request.version===run.contextVersion;
      const expired=!run.deadlineAt||run.deadlineAt<=now;
      if(!result||!matches||!authorized||expired){await this.failAnalysisLocked(tx,request,run,now,!authorized?'FORBIDDEN':expired?'AI_TIMEOUT':result&&!matches?'STALE_CONTEXT':errorCode,latencyMs??result?.latencyMs);return;}
      const a=analysisSchema.parse(result.analysis);
      if('retrieval' in result&&result.retrieval&&'grounding' in result&&result.grounding){
        validateCitations(result.grounding.citations,result.retrieval.sources);
        const snapshot=run.retrievalSnapshotJson as Prisma.JsonObject;
        const expected=snapshotOf(result.retrieval).sources;
        const saved=Array.isArray(snapshot.sources)?snapshot.sources:[];
        if(saved.length!==expected.length||expected.some(s=>!saved.some(v=>v&&typeof v==='object'&&!Array.isArray(v)&&v.sourceId===s.sourceId&&v.chunkId===s.chunkId&&v.documentId===s.documentId&&v.generation===s.generation&&v.contentHash===s.contentHash)))throw new ApiError(422,'INVALID_CITATION','The evidence snapshot does not match.');
        await this.vectors.validateCurrent(tx,result.retrieval.sources);
        await this.vectors.compatible(result.retrieval.identity,tx);
      }
      const analysis=await tx.aiAnalysis.create({data:{requestId:request.id,aiRunId:run.id,intent:a.intent,category:a.category,subcategory:a.subcategory,prioritySuggestion:a.prioritySuggestion,entitiesJson:a.entities,missingFieldsJson:a.missingFields,confidence:a.confidence,reasonSummary:a.reasonSummary,schemaVersion:analysisSchemaVersion,createdAt:now}});
      await tx.aiRun.update({where:{id:runId},data:{status:'SUCCEEDED',finishedAt:now,leaseUntil:null,latencyMs:result.latencyMs,retryCount:result.retryCount,outputSize:result.outputSize,modelIdentityJson:result.identity,safeResultJson:'grounding' in result&&result.grounding?result.grounding:{mode:'NON_RAG',evidenceStatus:'NOT_REQUESTED',citations:[]},errorCode:null,errorSummary:null}});
      await this.systemEdge(tx,request,runId,'COMPLETE_AI_ANALYSIS',now,{aiAnalysisStatus:'SUCCEEDED',activeAnalysisRunId:null,latestAnalysisId:analysis.id},run.initiatingActorId);
    });
  }
  private draftFields(value: Prisma.JsonValue | null) {
    if(!value||typeof value!=='object'||Array.isArray(value)) return null;
    const {policyId: _id,policyVersion: _version,targetSeconds: _target,...fields}=value;
    void _id;void _version;void _target;return fields;
  }
  private async eligibleStaff(tx:Tx,teamId:string,staffId:string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${staffId}::uuid FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Team" WHERE "id"=${teamId}::uuid FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "TeamMember" WHERE "teamId"=${teamId}::uuid AND "userId"=${staffId}::uuid FOR SHARE`);
    const member=await tx.teamMember.findFirst({where:{teamId,userId:staffId,active:true,team:{active:true},user:{active:true,available:true,role:'STAFF'}}});
    if(!member) throw new ApiError(422,'INELIGIBLE_STAFF','Choose active available staff in the selected active team.');
  }
  private async slaPolicy(tx:Tx,category:string,priority:'LOW'|'MEDIUM'|'HIGH'|'URGENT') {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SlaPolicy" WHERE "active" AND "priority"::text=${priority} AND ("category"=${category} OR "category" IS NULL) ORDER BY "id" FOR SHARE`);
    const policies=await tx.slaPolicy.findMany({where:{active:true,priority,OR:[{category},{category:null}]}});
    const policy=policies.find(p=>p.category===category)??policies.find(p=>p.category===null);
    if(!policy) throw new ApiError(422,'MISSING_SLA_POLICY','No active SLA policy matches this decision.');
    return policy;
  }
  private async validateDecision(tx:Tx,decision:FinalDecision) {
    if(decision.actions.some(a=>a.provenance!=='HUMAN'||a.sourceIds.length)) throw new ApiError(422,'MANUAL_PLAN_REQUIRED','M3 accepts human-authored unsourced actions only.');
    await this.eligibleStaff(tx,decision.teamId,decision.staffId);
    return this.slaPolicy(tx,decision.category,decision.priority);
  }
  private async event(tx:Tx,request:DomainRequest,actor:AuthenticatedActor,action:string,correlationId:string,now:Date,reason?:string,after?:Prisma.InputJsonObject,before?:Prisma.InputJsonObject) {
    return tx.auditLog.create({data:{id:randomUUID(),requestId:request.id,actorType:actor.role,actorId:actor.id,action,resourceType:'Request',resourceId:request.id,requestCorrelationId:correlationId,safeBeforeJson:before,safeAfterJson:after,reason,outcome:'SUCCEEDED',createdAt:now}});
  }
  private async checklist(tx:Tx,request:DomainRequest,actor:AuthenticatedActor,command:Command,now:Date) {
    const checklist=await tx.checklist.findUnique({where:{requestId:request.id},include:{items:true}});
    if(!checklist) throw new ApiError(422,'MISSING_CHECKLIST','No approved checklist exists.');
    if(command.items) {
      if(checklist.items.length+command.items.length>30) throw new ApiError(422,'CHECKLIST_LIMIT','At most 30 checklist items are allowed.');
      await tx.checklistItem.createMany({data:command.items.map((item,i)=>({checklistId:checklist.id,ordinal:checklist.items.length+i+1,text:item.text,required:item.required,sourceRefsJson:[],createdAt:now,updatedAt:now}))});
    } else {
      const item=checklist.items.find(i=>i.id===command.itemId);
      if(!item) throw new ApiError(404,'NOT_FOUND','The checklist item was not found.');
      const data:Prisma.ChecklistItemUncheckedUpdateInput={};
      if(command.text!==undefined) {data.text=command.text;data.sourceRefsJson=[];}
      if(command.required!==undefined) data.required=command.required;
      if(command.operation==='COMPLETE') Object.assign(data,{completedAt:now,completedById:actor.id,waivedAt:null,waivedById:null,waiverReason:null});
      if(command.operation==='UNCOMPLETE') Object.assign(data,{completedAt:null,completedById:null});
      if(command.operation==='WAIVE') Object.assign(data,{waivedAt:now,waivedById:actor.id,waiverReason:command.reason,completedAt:null,completedById:null});
      if(command.operation==='UNWAIVE') Object.assign(data,{waivedAt:null,waivedById:null,waiverReason:null});
      await tx.checklistItem.update({where:{id:item.id},data});
    }
    await tx.checklist.update({where:{id:checklist.id},data:{version:{increment:1}}});
  }
}

