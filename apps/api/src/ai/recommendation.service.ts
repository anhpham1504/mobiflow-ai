import {Inject,Injectable} from '@nestjs/common';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import type {ApiEnvironment} from '@mobiflow/config';
import {analysisSchema,recommendationVersion,recommendationV2Version,recommendationEvidenceSchema,recommendationEvidenceV2Schema,recommendationSchema,recommendationV2Schema,finalDecisionSchema,recommendationJobSchema,type RecommendationEvidence,type RecommendationEvidenceV2} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {RequestStateMachineService} from '../requests/request-state-machine.service.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {ApiError} from '../http.js';
import {API_ENV} from '../tokens.js';
import {DomainTools} from './tools/domain-tools.js';
import {RequestVectors} from './tools/request-vectors.js';
import {routing,rankCandidates} from './tools/staff.js';
import {ToolFailure} from './tools/registry.js';
import {AiFailure,RECOMMENDATION_PROVIDER,type StructuredProvider} from './provider.js';
import {KnowledgeFailure} from '../knowledge/embedding-provider.js';
import {recommendationMessages,recommendationFormat,recommendationPromptVersion,recommendationMessagesV2,recommendationFormatV2,recommendationPromptV2Version} from './prompts/recommendation.js';
import {parseRecommendationForVersion} from './recommendation-output.js';
import {revalidateRecommendation} from './recommendation-validation.js';
import {VectorRepository} from '../knowledge/vector.repository.js';
import {assessSla} from '../requests/sla-clock.js';
import {recommendationSnapshot} from './recommendation-snapshot.js';
const storedDecisionSchema=finalDecisionSchema.safeExtend({policyId:z.uuid().optional(),policyVersion:z.number().int().positive().optional(),targetSeconds:z.number().int().positive().optional()});
const storedFailure=()=>new ApiError(500,'AI_INVALID_STORED_OUTPUT','The stored recommendation is unavailable. Reload or use manual work.');
function storedDecision(value:unknown){
  const parsed=storedDecisionSchema.safeParse(value);if(!parsed.success)throw storedFailure();
  const {policyId:_id,policyVersion:_version,targetSeconds:_seconds,...decision}=parsed.data;void _id;void _version;void _seconds;
  return finalDecisionSchema.parse(decision);
}

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma:PrismaService,private readonly machine:RequestStateMachineService,private readonly tools:DomainTools,private readonly requests:RequestVectors,private readonly vectors:VectorRepository,@Inject(API_ENV)private readonly env:ApiEnvironment,@Inject(RECOMMENDATION_PROVIDER)private readonly provider:StructuredProvider){}
  async schedule(id:string,actor:AuthenticatedActor,version:number,correlationId:string,schemaVersion:typeof recommendationVersion|typeof recommendationV2Version=recommendationV2Version){
    if(schemaVersion!==recommendationVersion&&schemaVersion!==recommendationV2Version)throw new ApiError(400,'INVALID_INPUT','Unsupported recommendation version.');
    if(actor.role!=='MANAGER')throw new ApiError(403,'FORBIDDEN','Manager access required.');
    return this.prisma.$transaction(async tx=>{
      const user=await tx.user.findFirst({where:{id:actor.id,active:true,role:'MANAGER',sessions:{some:{id:actor.sessionId,revokedAt:null,consumedAt:null,expiresAt:{gt:new Date()}}}}});
      if(!user)throw new ApiError(401,'UNAUTHORIZED','Authentication required.');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Request" WHERE id=${id}::uuid FOR UPDATE`);
      const r=await tx.request.findUnique({where:{id}});if(!r)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
      if(r.version!==version)throw new ApiError(409,'STALE_VERSION','Reload the request.');
      if(r.status!=='TRIAGED'||!r.latestAnalysisId)throw new ApiError(409,'INVALID_STATE','A TRIAGED request with validated analysis is required.');
      const active=await tx.aiRun.findFirst({where:{requestId:id,purpose:'RECOMMENDATION',status:{in:['QUEUED','RUNNING']}}});if(active)return active;
      const run=await tx.aiRun.create({data:{requestId:id,purpose:'RECOMMENDATION',initiatingActorId:actor.id,contextVersion:r.version,provider:this.env.AI_PROVIDER,model:this.env.OLLAMA_MODEL,promptVersion:schemaVersion===recommendationV2Version?recommendationPromptV2Version:recommendationPromptVersion,schemaVersion,deadlineAt:new Date(Date.now()+this.env.AI_RUN_TIMEOUT_MS),retrievalSnapshotJson:{analysisId:r.latestAnalysisId,...(schemaVersion===recommendationV2Version?{_authorization:{initiatingSessionId:actor.sessionId}}:{})}}});
      await tx.auditLog.create({data:{requestId:id,actorType:'MANAGER',actorId:actor.id,action:'RECOMMENDATION_QUEUED',resourceType:'AiRun',resourceId:run.id,requestCorrelationId:correlationId,outcome:'SUCCEEDED'}});return run;
    });
  }
  async fail(id:string,code:string,latencyMs?:number){
    await this.prisma.$transaction(async tx=>{
      const run=await tx.aiRun.findUnique({where:{id}});if(!run)return;
      const changed=await tx.aiRun.updateMany({where:{id,status:{in:['QUEUED','RUNNING']}},data:{status:'FAILED',errorCode:code,errorSummary:'Recommendation unavailable; retry from TRIAGED or use manual work.',finishedAt:new Date(),leaseUntil:null,latencyMs}});
      if(changed.count)await tx.auditLog.create({data:{requestId:run.requestId,actorType:'SYSTEM',initiatingActorId:run.initiatingActorId,action:code.startsWith('STALE')?'RECOMMENDATION_STALE':'RECOMMENDATION_FAILED',resourceType:'AiRun',resourceId:id,requestCorrelationId:id,safeAfterJson:{errorCode:code},outcome:'FAILED'}});
    });
  }
  async cycle(parentSignal:AbortSignal):Promise<boolean>{
    const expired=await this.prisma.aiRun.findMany({where:{purpose:'RECOMMENDATION',status:{in:['QUEUED','RUNNING']},OR:[{deadlineAt:{lte:new Date()}},{status:'RUNNING',leaseUntil:{lte:new Date()}}]},take:20});
    for(const r of expired)await this.fail(r.id,'AI_TIMEOUT');
    const queued=await this.prisma.aiRun.findFirst({where:{purpose:'RECOMMENDATION',status:'QUEUED'},orderBy:[{createdAt:'asc'},{id:'asc'}]});if(!queued)return false;
    const claimed=await this.prisma.aiRun.updateMany({where:{id:queued.id,status:'QUEUED'},data:{status:'RUNNING',startedAt:new Date(),leaseUntil:queued.deadlineAt}});if(!claimed.count)return true;
    const start=performance.now(),signal=AbortSignal.any([parentSignal,AbortSignal.timeout(Math.max(1,queued.deadlineAt!.getTime()-Date.now()))]);
    try{
      if(queued.schemaVersion!==recommendationVersion&&queued.schemaVersion!==recommendationV2Version)throw new AiFailure('AI_UNSUPPORTED_SCHEMA');
      const v2=queued.schemaVersion===recommendationV2Version;
      const snapshot=recommendationSnapshot(queued.retrievalSnapshotJson);
      if(v2&&!snapshot.authorization)throw new ToolFailure('FORBIDDEN');
      const authorizationContext={runId:queued.id,requestId:queued.requestId!,actorId:queued.initiatingActorId!,requestVersion:queued.contextVersion,...(v2?{initiatingSessionId:snapshot.authorization!.initiatingSessionId}:{})};
      await this.tools.authorize(authorizationContext);
      const request=await this.prisma.request.findUniqueOrThrow({where:{id:queued.requestId!},include:{latestAnalysis:true,slaInstance:true}}),a=request.latestAnalysis;
      if(!a||request.version!==queued.contextVersion||request.status!=='TRIAGED'||(queued.retrievalSnapshotJson as Prisma.JsonObject).analysisId!==a.id)throw new ToolFailure('STALE_CONTEXT');
      const analysis=analysisSchema.parse({intent:a.intent,category:a.category,subcategory:a.subcategory,prioritySuggestion:a.prioritySuggestion,entities:a.entitiesJson,missingFields:a.missingFieldsJson,confidence:Number(a.confidence),reasonSummary:a.reasonSummary});
      const route=routing(analysis),team=await this.prisma.team.findUniqueOrThrow({where:{code:route.team}});
      const indexed=await this.requests.index(request.id,signal);
      const ctx={...authorizationContext,analysis,identity:indexed.identity,asOf:new Date()},session=this.tools.session(ctx,signal);
      await this.tools.authorize(ctx);
      const knowledge=await session.call('searchKnowledge',{query:Array.from(request.description).slice(0,2000).join('')});
      const similar=await session.call('findSimilarRequests',{requestId:request.id});
      let policy=(await session.call('getSlaPolicy',{category:analysis.category,priority:analysis.prioritySuggestion})).policy;
      const staff=await session.call('getCandidateStaff',{team:team.id,skills:route.skills});
      // Empty candidates cannot form the mandatory 1..10-ID workload input. Explicit empty snapshot; no fabricated call.
      const workload=staff.candidates.length?await session.call('getStaffWorkload',{staffIds:staff.candidates.map(c=>c.staffId)}):{workloads:[],asOf:new Date().toISOString()};
      staff.candidates=rankCandidates(staff.candidates.map(c=>({...c,activeWorkload:workload.workloads.find(w=>w.staffId===c.staffId)!.activeCount})));
      const history=await session.call('getRequestHistory',{requestId:request.id});
      const capturedAt=new Date(),sla=request.slaInstance?assessSla(request.slaInstance,capturedAt):null;
      const base:RecommendationEvidence={analysisId:a.id,analysis,requestVersion:queued.contextVersion,retrievedAt:capturedAt.toISOString(),sources:knowledge.sources,similar,candidates:staff,workload,policy,history,embeddingIdentity:indexed.identity};
      const evidenceV2:RecommendationEvidenceV2={...base,requestContext:{id:request.id,version:request.version,status:request.status,title:request.title,description:request.description,category:request.category as RecommendationEvidenceV2['requestContext']['category'],subcategory:request.subcategory,priority:request.priority,location:analysis.entities.location,sla:sla?{state:sla.status,dueAt:sla.dueAt.toISOString(),remainingSeconds:sla.remainingSeconds}:null}};
      const evidence=v2?recommendationEvidenceV2Schema.parse(evidenceV2):base;
      let feedback='';
      for(let attempt=0;attempt<2;attempt++){
        await this.tools.authorize(ctx);
        await this.prisma.aiRun.updateMany({where:{id:queued.id,status:'RUNNING'},data:{retryCount:attempt}});
        try{
          const messages=v2?recommendationMessagesV2(request,evidenceV2,feedback||attempt>0):recommendationMessages(request,base,feedback||attempt>0),format=v2?recommendationFormatV2(evidenceV2):recommendationFormat(base);
          const generation=await this.provider.generateStructured(messages,format,signal);
          if(Buffer.byteLength(generation.raw)>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
          let proposal:unknown;try{proposal=JSON.parse(generation.raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
          const shaped=v2?recommendationV2Schema.safeParse(proposal):recommendationSchema.safeParse(proposal);
          if(shaped.success&&shaped.data.suggestedPriority!==(policy?.priority??analysis.prioritySuggestion)){
            policy=(await session.call('getSlaPolicy',{category:analysis.category,priority:shaped.data.suggestedPriority})).policy;base.policy=policy;evidenceV2.policy=policy;evidence.policy=policy;
          }
          const result=parseRecommendationForVersion(queued.schemaVersion,generation.raw,evidence);
          await this.prisma.aiRun.updateMany({where:{id:queued.id,status:'RUNNING'},data:{retrievalSnapshotJson:JSON.parse(JSON.stringify({...evidence,...(v2?{_authorization:snapshot.authorization}:{})})),inputSize:JSON.stringify(messages).length}});
          await this.machine.publishRecommendation(queued.id,result,generation.identity,generation.outputSize,Math.round(performance.now()-start));return true;
        }catch(error){if(error instanceof AiFailure){feedback=error.repairFeedback;await this.prisma.auditLog.create({data:{requestId:request.id,actorType:'SYSTEM',initiatingActorId:queued.initiatingActorId,action:'RECOMMENDATION_ATTEMPT_FAILED',resourceType:'AiRun',resourceId:queued.id,requestCorrelationId:queued.id,safeAfterJson:{attempt:attempt+1,errorCode:error.code,validationRule:feedback.split(':')[0]||error.code},outcome:'FAILED'}});}if(!(error instanceof AiFailure)||!error.retryable||attempt===1||signal.aborted)throw error;await delay(1000,undefined,{signal});}
      }
    }catch(error){const code=signal.aborted?'AI_TIMEOUT':error instanceof ApiError||error instanceof AiFailure||error instanceof ToolFailure||error instanceof KnowledgeFailure?error.code:'RECOMMENDATION_UNAVAILABLE';await this.fail(queued.id,code,Math.round(performance.now()-start));}
    return true;
  }
  async view(requestId:string,actor:AuthenticatedActor,runId?:string){
    if(actor.role!=='MANAGER')throw new ApiError(403,'FORBIDDEN','Manager access required.');
    if(!await this.prisma.user.findFirst({where:{id:actor.id,role:'MANAGER',active:true,sessions:{some:{id:actor.sessionId,revokedAt:null,consumedAt:null,expiresAt:{gt:new Date()}}}}}))throw new ApiError(401,'UNAUTHORIZED','Authentication required.');
    const request=await this.prisma.request.findUnique({where:{id:requestId}});if(!request)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    const run=await this.prisma.aiRun.findFirst({where:{requestId,purpose:'RECOMMENDATION',...(runId?{id:runId}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],include:{recommendations:true,toolCalls:{orderBy:{ordinal:'asc'}}}});if(!run){if(runId)throw new ApiError(404,'NOT_FOUND','The resource was not found.');return null;}
    if(run.schemaVersion!==recommendationVersion&&run.schemaVersion!==recommendationV2Version)throw storedFailure();
    const v2=run.schemaVersion===recommendationV2Version,r=run.recommendations[0],stored=recommendationSnapshot(run.retrievalSnapshotJson),parsed=v2?recommendationEvidenceV2Schema.safeParse(stored.evidence):recommendationEvidenceSchema.safeParse(stored.evidence),evidence=r&&parsed.success?parsed.data:null,staleReasons:string[]=[];
    let recommendation:ReturnType<typeof parseRecommendationForVersion>|null=null,finalDecision:ReturnType<typeof storedDecision>|null=null,managerChanges:unknown=null;
    if(r){
      if(!evidence||run.status!=='SUCCEEDED')throw storedFailure();
      try{recommendation=parseRecommendationForVersion(run.schemaVersion,JSON.stringify(run.safeResultJson),evidence);}catch{throw storedFailure();}
      if(r.finalDecisionJson!==null)finalDecision=storedDecision(r.finalDecisionJson);
      if(r.status==='MODIFIED'){
        const changes=z.object({original:z.unknown(),final:z.unknown()}).strict().safeParse(r.managerChangesJson);if(!changes.success||!finalDecision)throw storedFailure();
        const original=v2?parseRecommendationForVersion(run.schemaVersion,JSON.stringify(changes.data.original),evidence):storedDecision(changes.data.original),final=storedDecision(changes.data.final);
        if(v2&&JSON.stringify(original)!==JSON.stringify(recommendation)||JSON.stringify(final)!==JSON.stringify(finalDecision))throw storedFailure();
        managerChanges={original,final};
      }else if(r.status==='REJECTED'){
        const changes=z.object({decision:z.literal('REJECT'),reason:z.string().trim().min(1).max(2000)}).strict().safeParse(r.managerChangesJson);if(!changes.success)throw storedFailure();managerChanges=changes.data;
      }else if(r.status==='ACCEPTED'&&v2){
        const changes=z.object({decision:z.literal('ACCEPT'),acknowledgedMissingFields:finalDecisionSchema.shape.acknowledgedMissingFields}).strict().safeParse(r.managerChangesJson);if(!changes.success)throw storedFailure();managerChanges=changes.data;
      }else if(r.managerChangesJson!==null)throw storedFailure();
      if(v2){
        const snapshot=recommendationEvidenceV2Schema.parse(evidence).requestContext;
        const latest=r.status==='PENDING'?await this.prisma.aiRecommendation.findFirst({where:{requestId,status:'PENDING',invalidatedAt:null},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{id:true}}):null;
        if(r.invalidatedAt||request.version!==run.contextVersion||snapshot.id!==requestId||snapshot.version!==request.version||request.status!==snapshot.status||request.latestAnalysisId!==evidence.analysisId||r.status==='PENDING'&&latest?.id!==r.id)staleReasons.push('STALE_CONTEXT');
      }else if(r.invalidatedAt||request.pendingRecommendationId!==r.id||request.status!=='PENDING_APPROVAL'||request.version!==run.contextVersion+1)staleReasons.push('STALE_CONTEXT');
      if(evidence)try{await this.prisma.$transaction(async tx=>{await revalidateRecommendation(tx,evidence,false,r.suggestedPriority);await this.vectors.validateCurrent(tx,evidence.sources,false);await this.vectors.compatible(evidence.embeddingIdentity,tx);});}catch(error){staleReasons.push(error instanceof ToolFailure||error instanceof KnowledgeFailure?error.code:'REVALIDATION_UNAVAILABLE');}
    }else if(run.status==='SUCCEEDED')throw storedFailure();
    const job=recommendationJobSchema.safeParse({aiRunId:run.id,requestId,purpose:'RECOMMENDATION',status:run.status,errorCode:run.errorCode,createdAt:run.createdAt.toISOString(),finishedAt:run.finishedAt?.toISOString()??null,contextVersion:run.contextVersion,schemaVersion:run.schemaVersion,recommendationId:r?.id??null,recommendation,evidence,reviewStatus:r?.status??null,reviewerId:r?.reviewedById??null,reviewedAt:r?.reviewedAt?.toISOString()??null,finalDecision,managerChanges,stale:staleReasons.length>0,staleReasons,model:run.model,latencyMs:run.latencyMs,toolCalls:run.toolCalls.map(c=>({toolName:c.toolName,ordinal:c.ordinal,latencyMs:c.latencyMs,status:c.status,errorCode:c.errorCode,summary:c.safeOutputSummaryJson}))});
    if(!job.success)throw storedFailure();return job.data;
  }
}
