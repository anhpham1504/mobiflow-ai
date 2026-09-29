import {Inject,Injectable} from '@nestjs/common';
import {setTimeout as delay} from 'node:timers/promises';
import type {ApiEnvironment} from '@mobiflow/config';
import {analysisSchema,recommendationVersion,recommendationEvidenceSchema,recommendationSchema,type RecommendationEvidence} from '@mobiflow/contracts';
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
import {recommendationMessages,recommendationFormat,recommendationPromptVersion} from './prompts/recommendation.js';
import {parseRecommendation} from './recommendation-output.js';
import {revalidateRecommendation} from './recommendation-validation.js';
import {VectorRepository} from '../knowledge/vector.repository.js';

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma:PrismaService,private readonly machine:RequestStateMachineService,private readonly tools:DomainTools,private readonly requests:RequestVectors,private readonly vectors:VectorRepository,@Inject(API_ENV)private readonly env:ApiEnvironment,@Inject(RECOMMENDATION_PROVIDER)private readonly provider:StructuredProvider){}
  async schedule(id:string,actor:AuthenticatedActor,version:number,correlationId:string){
    if(actor.role!=='MANAGER')throw new ApiError(403,'FORBIDDEN','Manager access required.');
    return this.prisma.$transaction(async tx=>{
      const user=await tx.user.findFirst({where:{id:actor.id,active:true,role:'MANAGER',sessions:{some:{id:actor.sessionId,revokedAt:null,consumedAt:null,expiresAt:{gt:new Date()}}}}});
      if(!user)throw new ApiError(401,'UNAUTHORIZED','Authentication required.');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Request" WHERE id=${id}::uuid FOR UPDATE`);
      const r=await tx.request.findUnique({where:{id}});if(!r)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
      if(r.version!==version)throw new ApiError(409,'STALE_VERSION','Reload the request.');
      if(r.status!=='TRIAGED'||!r.latestAnalysisId)throw new ApiError(409,'INVALID_STATE','A TRIAGED request with validated analysis is required.');
      const active=await tx.aiRun.findFirst({where:{requestId:id,purpose:'RECOMMENDATION',status:{in:['QUEUED','RUNNING']}}});if(active)return active;
      const run=await tx.aiRun.create({data:{requestId:id,purpose:'RECOMMENDATION',initiatingActorId:actor.id,contextVersion:r.version,provider:this.env.AI_PROVIDER,model:this.env.OLLAMA_MODEL,promptVersion:recommendationPromptVersion,schemaVersion:recommendationVersion,deadlineAt:new Date(Date.now()+this.env.AI_RUN_TIMEOUT_MS),retrievalSnapshotJson:{analysisId:r.latestAnalysisId}}});
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
      const request=await this.prisma.request.findUniqueOrThrow({where:{id:queued.requestId!},include:{latestAnalysis:true}}),a=request.latestAnalysis;
      if(!a||request.version!==queued.contextVersion||request.status!=='TRIAGED'||(queued.retrievalSnapshotJson as Prisma.JsonObject).analysisId!==a.id)throw new ToolFailure('STALE_CONTEXT');
      const analysis=analysisSchema.parse({intent:a.intent,category:a.category,subcategory:a.subcategory,prioritySuggestion:a.prioritySuggestion,entities:a.entitiesJson,missingFields:a.missingFieldsJson,confidence:Number(a.confidence),reasonSummary:a.reasonSummary});
      const route=routing(analysis),team=await this.prisma.team.findUniqueOrThrow({where:{code:route.team}});
      const indexed=await this.requests.index(request.id,signal);
      const ctx={runId:queued.id,requestId:request.id,actorId:queued.initiatingActorId!,requestVersion:queued.contextVersion,analysis,identity:indexed.identity,asOf:new Date()},session=this.tools.session(ctx,signal);
      await this.tools.authorize(ctx);
      const knowledge=await session.call('searchKnowledge',{query:Array.from(request.description).slice(0,2000).join('')});
      const similar=await session.call('findSimilarRequests',{requestId:request.id});
      let policy=(await session.call('getSlaPolicy',{category:analysis.category,priority:analysis.prioritySuggestion})).policy;
      const staff=await session.call('getCandidateStaff',{team:team.id,skills:route.skills});
      // Empty candidates cannot form the mandatory 1..10-ID workload input. Explicit empty snapshot; no fabricated call.
      const workload=staff.candidates.length?await session.call('getStaffWorkload',{staffIds:staff.candidates.map(c=>c.staffId)}):{workloads:[],asOf:new Date().toISOString()};
      staff.candidates=rankCandidates(staff.candidates.map(c=>({...c,activeWorkload:workload.workloads.find(w=>w.staffId===c.staffId)!.activeCount})));
      const history=await session.call('getRequestHistory',{requestId:request.id});
      const evidence:RecommendationEvidence={analysisId:a.id,analysis,requestVersion:queued.contextVersion,retrievedAt:new Date().toISOString(),sources:knowledge.sources,similar,candidates:staff,workload,policy,history,embeddingIdentity:indexed.identity};
      let feedback='';
      for(let attempt=0;attempt<2;attempt++){
        await this.tools.authorize(ctx);
        await this.prisma.aiRun.updateMany({where:{id:queued.id,status:'RUNNING'},data:{retryCount:attempt}});
        try{
          const messages=recommendationMessages(request,evidence,feedback||attempt>0),generation=await this.provider.generateStructured(messages,recommendationFormat(evidence),signal);
          let proposal:unknown;try{proposal=JSON.parse(generation.raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
          const shaped=recommendationSchema.safeParse(proposal);
          if(shaped.success&&shaped.data.suggestedPriority!==(policy?.priority??analysis.prioritySuggestion)){
            policy=(await session.call('getSlaPolicy',{category:analysis.category,priority:shaped.data.suggestedPriority})).policy;evidence.policy=policy;
          }
          const result=parseRecommendation(generation.raw,evidence);
          await this.prisma.aiRun.updateMany({where:{id:queued.id,status:'RUNNING'},data:{retrievalSnapshotJson:JSON.parse(JSON.stringify(evidence)),inputSize:JSON.stringify(messages).length}});
          await this.machine.publishRecommendation(queued.id,result,generation.identity,generation.outputSize,Math.round(performance.now()-start));return true;
        }catch(error){if(error instanceof AiFailure){feedback=error.repairFeedback;await this.prisma.auditLog.create({data:{requestId:request.id,actorType:'SYSTEM',initiatingActorId:queued.initiatingActorId,action:'RECOMMENDATION_ATTEMPT_FAILED',resourceType:'AiRun',resourceId:queued.id,requestCorrelationId:queued.id,safeAfterJson:{attempt:attempt+1,errorCode:error.code,validationRule:feedback.split(':')[0]||error.code},outcome:'FAILED'}});}if(!(error instanceof AiFailure)||!error.retryable||attempt===1||signal.aborted)throw error;await delay(1000,undefined,{signal});}
      }
    }catch(error){const code=signal.aborted?'AI_TIMEOUT':error instanceof ApiError||error instanceof AiFailure||error instanceof ToolFailure||error instanceof KnowledgeFailure?error.code:'RECOMMENDATION_UNAVAILABLE';await this.fail(queued.id,code,Math.round(performance.now()-start));}
    return true;
  }
  async view(requestId:string,actor:AuthenticatedActor,runId?:string){
    if(actor.role!=='MANAGER'||!await this.prisma.user.findFirst({where:{id:actor.id,role:'MANAGER',active:true}}))throw new ApiError(403,'FORBIDDEN','Manager access required.');
    const request=await this.prisma.request.findUnique({where:{id:requestId}});if(!request)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    const run=await this.prisma.aiRun.findFirst({where:{requestId,purpose:'RECOMMENDATION',...(runId?{id:runId}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],include:{recommendations:true,toolCalls:{orderBy:{ordinal:'asc'}}}});if(!run)return null;
    const r=run.recommendations[0],parsed=recommendationEvidenceSchema.safeParse(run.retrievalSnapshotJson),evidence=r&&parsed.success?parsed.data:null,staleReasons:string[]=[];
    if(r){
      if(r.invalidatedAt||request.pendingRecommendationId!==r.id||request.status!=='PENDING_APPROVAL'||request.version!==run.contextVersion+1)staleReasons.push('STALE_CONTEXT');
      if(evidence)try{await this.prisma.$transaction(async tx=>{await revalidateRecommendation(tx,evidence,false,r.suggestedPriority);await this.vectors.validateCurrent(tx,evidence.sources,false);await this.vectors.compatible(evidence.embeddingIdentity,tx);});}catch(error){staleReasons.push(error instanceof ToolFailure||error instanceof KnowledgeFailure?error.code:'REVALIDATION_UNAVAILABLE');}
    }
    return {aiRunId:run.id,requestId,purpose:'RECOMMENDATION' as const,status:run.status,errorCode:run.errorCode,createdAt:run.createdAt,finishedAt:run.finishedAt,contextVersion:run.contextVersion,recommendationId:r?.id??null,recommendation:r?run.safeResultJson:null,evidence,stale:staleReasons.length>0,staleReasons,model:run.model,latencyMs:run.latencyMs,toolCalls:run.toolCalls.map(c=>({toolName:c.toolName,ordinal:c.ordinal,latencyMs:c.latencyMs,status:c.status,errorCode:c.errorCode,summary:c.safeOutputSummaryJson}))};
  }
}
