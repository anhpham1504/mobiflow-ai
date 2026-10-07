import {Inject,Injectable} from '@nestjs/common';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {copilotActionSchema,copilotResultSchema,resolutionSummarySchema,type RequestStatus,type SimilarCase,type Source} from '@mobiflow/contracts';
import type {ApiEnvironment} from '@mobiflow/config';
import {Prisma,type AiRun} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {AuthorizationPolicyService} from '../authorization/authorization-policy.service.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {ApiError} from '../http.js';
import {API_ENV} from '../tokens.js';
import {AiFailure,RECOMMENDATION_PROVIDER,normalizedFailure,type StructuredProvider} from './provider.js';
import {KnowledgeFailure} from '../knowledge/embedding-provider.js';
import {KnowledgeRetriever} from '../knowledge/retriever.js';
import {RequestVectors} from './tools/request-vectors.js';
import {checklistGenerationSchema,copilotModelSchemas,parseStrictOutput,parseSummaryOutput,validateChecklistSourcePlan,type CopilotAction} from './operational-output.js';
import {copilotFormat,copilotMessages,copilotPromptVersionFor,resolutionSummaryPromptVersion,summaryFormat,summaryMessages} from './prompts/copilot.js';
import {resolutionSummaryFacts,summaryEventLabels,validateSummaryFacts} from './resolution-summary-facts.js';

const allowedStates=new Set<RequestStatus>(['ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED']);
const copilotSchemaVersion='copilot.m8.v2',summarySchemaVersion='resolution-summary.m8.v3';
type CopilotResult=z.infer<typeof copilotResultSchema>;

@Injectable()
export class OperationalAiService {
  constructor(private readonly prisma:PrismaService,private readonly policy:AuthorizationPolicyService,@Inject(API_ENV)private readonly env:ApiEnvironment,@Inject(RECOMMENDATION_PROVIDER)private readonly provider:StructuredProvider,private readonly retriever:KnowledgeRetriever,private readonly requestVectors:RequestVectors){}

  async scheduleCopilot(requestId:string,actor:AuthenticatedActor,input:z.infer<typeof copilotActionSchema>,correlationId:string){
    if(actor.role!=='STAFF')throw new ApiError(403,'FORBIDDEN','Copilot is available only to assigned staff.');
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${requestId}::uuid FOR UPDATE`);
      const request=await tx.request.findFirst({where:{id:requestId,...this.policy.requestScope(actor)}});
      if(!request)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
      if(request.version!==input.expectedVersion)throw new ApiError(409,'STALE_VERSION','Reload before using Copilot.');
      if(!allowedStates.has(request.status))throw new ApiError(409,'INVALID_STATE','Copilot is unavailable in this request state.');
      const active=await tx.aiRun.findFirst({where:{requestId,purpose:'COPILOT',status:{in:['QUEUED','RUNNING']}}});
      if(active){if(active.action!==input.action||active.contextVersion!==request.version)throw new ApiError(409,'AI_RUN_ACTIVE','Another Copilot action is active.');return active;}
      const now=new Date();
      const run=await tx.aiRun.create({data:{requestId,purpose:'COPILOT',action:input.action,initiatingActorId:actor.id,contextVersion:request.version,provider:this.env.AI_PROVIDER,model:this.env.OLLAMA_MODEL,promptVersion:copilotPromptVersionFor(input.action),schemaVersion:copilotSchemaVersion,deadlineAt:new Date(now.getTime()+this.env.AI_RUN_TIMEOUT_MS),createdAt:now}});
      await tx.auditLog.create({data:{requestId,actorType:'STAFF',actorId:actor.id,action:'COPILOT_ACTION_QUEUED',resourceType:'AiRun',resourceId:run.id,requestCorrelationId:correlationId,safeAfterJson:{action:input.action,contextVersion:request.version},outcome:'SUCCEEDED',createdAt:now}});
      return run;
    });
  }

  async view(runId:string,actor:AuthenticatedActor){
    const run=await this.prisma.aiRun.findFirst({where:{id:runId,request:this.policy.requestScope(actor),...(actor.role==='STAFF'?{OR:[{purpose:'COPILOT',initiatingActorId:actor.id},{purpose:'RESOLUTION_SUMMARY'}]}:{purpose:'RESOLUTION_SUMMARY'})}});
    if(!run)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    const request=await this.prisma.request.findUnique({where:{id:run.requestId!},select:{version:true,currentResolutionId:true}});
    return {aiRunId:run.id,requestId:run.requestId!,purpose:run.purpose as 'COPILOT'|'RESOLUTION_SUMMARY',action:run.action,status:run.status,errorCode:run.errorCode,createdAt:run.createdAt,finishedAt:run.finishedAt,contextVersion:run.contextVersion,stale:run.purpose==='COPILOT'?request?.version!==run.contextVersion:request?.currentResolutionId!==run.resolutionId,result:run.status==='SUCCEEDED'?run.safeResultJson:null,model:run.status==='SUCCEEDED'?run.model:null,latencyMs:run.latencyMs};
  }

  async retrySummary(requestId:string,resolutionId:string,expectedVersion:number,actor:AuthenticatedActor){
    if(!['STAFF','MANAGER'].includes(actor.role))throw new ApiError(403,'FORBIDDEN','This role cannot retry a summary.');
    const request=await this.prisma.request.findFirst({where:{id:requestId,...this.policy.requestScope(actor)},include:{currentResolution:true}});
    if(!request)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    if(request.version!==expectedVersion)throw new ApiError(409,'STALE_VERSION','Reload before retrying.');
    if(!['RESOLVED','CLOSED'].includes(request.status)||request.currentResolutionId!==resolutionId)throw new ApiError(409,'STALE_RESOLUTION','Only the latest effective resolution can be summarized.');
    const prior=await this.prisma.aiRun.findFirst({where:{resolutionId,purpose:'RESOLUTION_SUMMARY'},orderBy:{createdAt:'desc'}});
    if(!prior||prior.status!=='FAILED')throw new ApiError(409,'INVALID_RETRY','A failed summary is required.');
    return this.prisma.aiRun.create({data:{requestId,resolutionId,purpose:'RESOLUTION_SUMMARY',contextVersion:request.version,provider:this.env.AI_PROVIDER,model:this.env.OLLAMA_MODEL,promptVersion:resolutionSummaryPromptVersion,schemaVersion:summarySchemaVersion,deadlineAt:new Date(Date.now()+this.env.AI_RUN_TIMEOUT_MS)}});
  }

  async cycle(parentSignal:AbortSignal){
    const expired=await this.prisma.aiRun.findMany({where:{purpose:{in:['COPILOT','RESOLUTION_SUMMARY']},status:{in:['QUEUED','RUNNING']},deadlineAt:{lte:new Date()}},take:20});
    if(expired.length)await this.prisma.aiRun.updateMany({where:{id:{in:expired.map(r=>r.id)},status:{in:['QUEUED','RUNNING']}},data:{status:'FAILED',finishedAt:new Date(),leaseUntil:null,errorCode:'AI_TIMEOUT',errorSummary:'AI did not complete before its bounded deadline.'}});
    const next=await this.prisma.aiRun.findFirst({where:{purpose:{in:['COPILOT','RESOLUTION_SUMMARY']},status:'QUEUED'},orderBy:[{createdAt:'asc'},{id:'asc'}]});
    if(!next)return false;
    const claimed=await this.prisma.aiRun.updateMany({where:{id:next.id,status:'QUEUED'},data:{status:'RUNNING',startedAt:new Date(),leaseUntil:next.deadlineAt}});if(!claimed.count)return true;
    const start=performance.now(),remaining=Math.max(1,(next.deadlineAt?.getTime()??Date.now()+this.env.AI_RUN_TIMEOUT_MS)-Date.now()),signal=AbortSignal.any([parentSignal,AbortSignal.timeout(remaining)]);
    try{
      const result=next.purpose==='COPILOT'?await this.executeCopilot(next,next.action as CopilotAction,signal):await this.executeSummary(next,signal);
      const current=await this.prisma.request.findUnique({where:{id:next.requestId!},select:{version:true,status:true,currentAssigneeId:true,currentResolutionId:true}});
      const valid=next.purpose==='COPILOT'?current?.version===next.contextVersion&&current.currentAssigneeId===next.initiatingActorId&&allowedStates.has(current.status):current?.currentResolutionId===next.resolutionId&&['RESOLVED','CLOSED'].includes(current.status);
      if(!valid){await this.prisma.aiRun.updateMany({where:{id:next.id,status:'RUNNING'},data:{status:'FAILED',finishedAt:new Date(),leaseUntil:null,errorCode:'STALE_CONTEXT',errorSummary:'Request context changed before publication.'}});return true;}
      await this.prisma.aiRun.updateMany({where:{id:next.id,status:'RUNNING'},data:{status:'SUCCEEDED',safeResultJson:result.data,finishedAt:new Date(),leaseUntil:null,latencyMs:Math.round(performance.now()-start),modelIdentityJson:result.identity,model:result.identity.model,outputSize:result.outputSize,inputSize:result.inputSize,retryCount:result.retryCount,retrievalSnapshotJson:result.snapshot}});
    }catch(error){const failure=error instanceof KnowledgeFailure?new AiFailure(error.code,error.retryable):normalizedFailure(error,signal);await this.prisma.aiRun.updateMany({where:{id:next.id,status:'RUNNING'},data:{status:'FAILED',finishedAt:new Date(),leaseUntil:null,latencyMs:Math.round(performance.now()-start),errorCode:failure.code,errorSummary:'AI output was unavailable or invalid; business state is unchanged.'}});}
    return true;
  }

  private async executeCopilot(run:AiRun,action:CopilotAction,signal:AbortSignal){
    const request=await this.prisma.request.findFirst({where:{id:run.requestId!,version:run.contextVersion,currentAssigneeId:run.initiatingActorId,status:{in:[...allowedStates]}},include:{currentAssignee:{select:{id:true,displayName:true}},latestAnalysis:true,slaInstance:true,currentResolution:true,checklist:{include:{items:{orderBy:{ordinal:'asc'},take:30}}},messages:{orderBy:{createdAt:'desc'},take:20},audits:{where:{outcome:'SUCCEEDED'},orderBy:{createdAt:'desc'},take:30}}});
    if(!request)throw new AiFailure('STALE_CONTEXT');
    let sources:Source[]=[],similarCases:SimilarCase[]=[];
    const history=request.audits.slice().reverse().map(a=>({eventId:a.id,action:a.action,at:a.createdAt.toISOString()}));
    if(['FIND_SOP','SUGGEST_NEXT_STEP','GENERATE_CHECKLIST'].includes(action)){
      const began=performance.now(),retrieval=await this.retriever.search(`${request.title}\n${request.description}`.slice(0,2000),signal,5);sources=retrieval.sources;await this.tool(run,'searchKnowledge',sources.map(s=>s.sourceId),Math.round(performance.now()-began));
    }
    if(['SUMMARIZE_REQUEST','SUGGEST_NEXT_STEP','GENERATE_CHECKLIST'].includes(action))await this.tool(run,'getRequestHistory',history.map(item=>item.eventId),0);
    if(action==='FIND_SIMILAR_REQUESTS'){
      const began=performance.now(),indexed=await this.requestVectors.index(request.id,signal);
      const similar=await this.prisma.$transaction(async tx=>{await tx.$executeRaw`SET TRANSACTION READ ONLY`;return this.requestVectors.similar(tx,request.id,indexed.identity,30,5,new Date(),run.initiatingActorId!);},{timeout:10000});
      similarCases=similar.cases;await this.tool(run,'findSimilarRequests',similarCases.map(item=>item.requestId),Math.round(performance.now()-began));
    }
    const messages=request.messages.map(m=>({kind:m.kind,body:m.body,at:m.createdAt.toISOString()})).reverse();
    const context={request:{id:request.id,title:request.title,description:request.description,status:request.status,version:request.version,category:request.category,subcategory:request.subcategory,priority:request.priority,assignee:request.currentAssignee},sla:request.slaInstance,analysis:request.latestAnalysis?{id:request.latestAnalysis.id,category:request.latestAnalysis.category,subcategory:request.latestAnalysis.subcategory,prioritySuggestion:request.latestAnalysis.prioritySuggestion,reasonSummary:request.latestAnalysis.reasonSummary}:null,checklist:request.checklist?.items.map(i=>({id:i.id,text:i.text,required:i.required,completed:!!i.completedAt,waived:!!i.waivedAt})),resolution:request.currentResolution,messages,history,sources:sources.map(s=>({sourceId:s.sourceId,title:s.title,excerpt:s.excerpt})),similarCases};
    const allowed={sourceIds:sources.map(s=>s.sourceId),eventIds:history.map(item=>item.eventId),caseIds:similarCases.map(item=>item.requestId)};
    let repair:{raw:string;feedback:string}|undefined,lastInputSize=0;
    for(let attempt=0;attempt<2;attempt++){
      const prompt=copilotMessages(action,context,allowed,repair);lastInputSize=JSON.stringify(prompt).length;if(lastInputSize>24000)throw new AiFailure('CONTEXT_TOO_LARGE');
      await this.prisma.aiRun.updateMany({where:{id:run.id,status:'RUNNING'},data:{retryCount:attempt,inputSize:lastInputSize}});
      try{
        const generated=await this.provider.generateStructured(prompt,copilotFormat(action,allowed,action==='GENERATE_CHECKLIST'?context:undefined),signal),output=parseStrictOutput(action,generated.raw),data=this.mapCopilot(action,output,generated.raw,sources,history,similarCases,request.latestAnalysis?.id??null);
        if(action==='GENERATE_CHECKLIST')validateChecklistSourcePlan(checklistGenerationSchema.parse(output),context,generated.raw);
        return {data,identity:generated.identity,outputSize:generated.outputSize,inputSize:lastInputSize,retryCount:attempt,snapshot:{action,sourceIds:allowed.sourceIds,eventIds:allowed.eventIds,caseIds:allowed.caseIds,analysisId:request.latestAnalysis?.id??null}};
      }catch(error){
        const failure=normalizedFailure(error,signal);await this.attemptFailed(run,attempt,failure);
        if(!failure.retryable||attempt===1||signal.aborted)throw failure;
        repair={raw:failure.invalidOutput,feedback:failure.repairFeedback||failure.code};if(!failure.invalidOutput)await delay(1000,undefined,{signal});
      }
    }
    throw new AiFailure('AI_INVALID_OUTPUT');
  }

  private mapCopilot(action:CopilotAction,value:unknown,raw:string,sources:Source[],history:{eventId:string;action:string;at:string}[],similarCases:SimilarCase[],analysisId:string|null):CopilotResult{
    const allowedSources=new Map(sources.map(source=>[source.sourceId,source])),allowedEvents=new Set(history.map(item=>item.eventId)),allowedCases=new Map(similarCases.map(item=>[item.requestId,item]));
    const invalid=(rule:string):never=>{throw new AiFailure('INVALID_REFERENCE',true,`${rule}: Use only IDs from ALLOWED_REFERENCES.`,raw.slice(0,6000));};
    const refs=(ids:string[])=>{if(ids.some(id=>!allowedSources.has(id)))invalid('SOURCE_MEMBERSHIP');return [...new Set(ids)].map(id=>{const source=allowedSources.get(id)!;return {sourceId:id,title:source.title,quote:source.excerpt};});};
    const base:CopilotResult={action,evidenceStatus:'INSUFFICIENT_EVIDENCE',answer:'Không đủ căn cứ từ dữ liệu được phép.',sources:[],warnings:[],suggestedNextSteps:[],checklistDraft:[],eventIds:[],similarCases:[],analysisId:null};
    if(action==='SUMMARIZE_REQUEST'){
      const output=copilotModelSchemas.SUMMARIZE_REQUEST.parse(value);if(output.eventIds.some(id=>!allowedEvents.has(id)))invalid('EVENT_MEMBERSHIP');return {...base,evidenceStatus:'SUFFICIENT',answer:output.summary,eventIds:output.eventIds};
    }
    if(action==='FIND_SOP'){
      const output=copilotModelSchemas.FIND_SOP.parse(value),canonical=refs(output.sourceIds);return {...base,evidenceStatus:canonical.length?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',answer:output.message,sources:canonical,warnings:canonical.length?[]:['Không có nguồn SOP phù hợp trong dữ liệu được phép.']};
    }
    if(action==='SUGGEST_NEXT_STEP'){
      const output=copilotModelSchemas.SUGGEST_NEXT_STEP.parse(value),canonical=refs(output.steps.flatMap(step=>step.sourceIds));return {...base,evidenceStatus:output.steps.length?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',answer:output.message,sources:canonical,suggestedNextSteps:output.steps.map(step=>step.text),warnings:output.steps.length?[]:['Không đủ căn cứ để đề xuất bước tiếp theo.']};
    }
    if(action==='GENERATE_CHECKLIST'){
      const output=checklistGenerationSchema.parse(value),canonical=refs(output.items.flatMap(item=>item.sourceIds));return {...base,evidenceStatus:output.items.length?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',answer:output.message,sources:canonical,checklistDraft:output.items.map(item=>({text:item.text,required:true,sourceIds:item.sourceIds})),warnings:output.items.length?[]:['Không đủ căn cứ để tạo checklist.']};
    }
    if(action==='FIND_SIMILAR_REQUESTS'){
      const output=copilotModelSchemas.FIND_SIMILAR_REQUESTS.parse(value);if(output.caseIds.some(id=>!allowedCases.has(id)))invalid('CASE_MEMBERSHIP');const cases=output.caseIds.map(id=>allowedCases.get(id)!);return {...base,evidenceStatus:cases.length?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',answer:output.message,similarCases:cases.map(item=>({requestId:item.requestId,publicCode:item.publicCode,title:item.title,status:item.status,score:item.score})),warnings:cases.length?[]:['Không có yêu cầu tương tự trong phạm vi được phép.']};
    }
    const output=copilotModelSchemas.EXPLAIN_CLASSIFICATION.parse(value);return {...base,evidenceStatus:analysisId?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',answer:analysisId?output.reasonSummary:'Không có phân tích AI đã lưu để giải thích.',analysisId};
  }

  private async executeSummary(run:AiRun,signal:AbortSignal){
    const resolution=await this.prisma.requestResolution.findUnique({where:{id:run.resolutionId!},include:{request:true}});
    if(!resolution||resolution.request.currentResolutionId!==resolution.id||!['RESOLVED','CLOSED'].includes(resolution.request.status))throw new AiFailure('STALE_CONTEXT');
    const audits=await this.prisma.auditLog.findMany({where:{requestId:resolution.requestId,outcome:'SUCCEEDED',createdAt:{lte:resolution.resolvedAt},action:{in:Object.keys(summaryEventLabels)}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50});
    const context=resolutionSummaryFacts(resolution,audits.reverse().map(a=>({eventId:a.id,action:a.action,actorType:a.actorType,at:a.createdAt.toISOString()}))),events=context.events,byId=new Map(events.map(event=>[event.eventId,event])),allowed=new Set(byId.keys());
    let repair:{raw:string;feedback:string}|undefined,lastInputSize=0;
    for(let attempt=0;attempt<2;attempt++){
      const prompt=summaryMessages(context,[...allowed],repair);lastInputSize=JSON.stringify(prompt).length;if(lastInputSize>24000)throw new AiFailure('CONTEXT_TOO_LARGE');await this.prisma.aiRun.updateMany({where:{id:run.id,status:'RUNNING'},data:{retryCount:attempt,inputSize:lastInputSize}});
      try{
        const generated=await this.provider.generateStructured(prompt,summaryFormat(context),signal),output=parseSummaryOutput(generated.raw);validateSummaryFacts(output,context,generated.raw);
        const sourceEventIds=[...new Set(output.timeline.map(item=>item.eventId))],data:z.infer<typeof resolutionSummarySchema>={executiveSummary:output.executiveSummary,timeline:output.timeline.map(item=>({eventId:item.eventId,at:byId.get(item.eventId)!.at,summary:item.summary})),rootCause:resolution.rootCause,resolution:resolution.resolution,verification:resolution.verification,resolutionSeconds:Math.max(0,Math.floor((resolution.resolvedAt.getTime()-resolution.request.createdAt.getTime())/1000)),sourceEventIds};
        return {data,identity:generated.identity,outputSize:generated.outputSize,inputSize:lastInputSize,retryCount:attempt,snapshot:{resolutionId:resolution.id,eventIds:[...allowed]}};
      }catch(error){const failure=normalizedFailure(error,signal);await this.attemptFailed(run,attempt,failure);if(!failure.retryable||attempt===1||signal.aborted)throw failure;repair={raw:failure.invalidOutput,feedback:failure.repairFeedback||failure.code};if(!failure.invalidOutput)await delay(1000,undefined,{signal});}
    }
    throw new AiFailure('AI_INVALID_OUTPUT');
  }

  private async attemptFailed(run:AiRun,attempt:number,failure:AiFailure){await this.prisma.auditLog.create({data:{requestId:run.requestId,actorType:'SYSTEM',initiatingActorId:run.initiatingActorId,action:run.purpose+'_ATTEMPT_FAILED',resourceType:'AiRun',resourceId:run.id,requestCorrelationId:run.id,safeAfterJson:{attempt:attempt+1,errorCode:failure.code,validationCategory:(failure.repairFeedback.split(':')[0]||failure.code).slice(0,120)},outcome:'FAILED'}});}
  private async tool(run:AiRun,name:string,ids:string[],latencyMs:number){const ordinal=await this.prisma.aiToolCall.count({where:{aiRunId:run.id}})+1;if(ordinal>3)throw new AiFailure('TOOL_BUDGET_EXCEEDED');const now=new Date();await this.prisma.aiToolCall.create({data:{aiRunId:run.id,ordinal,toolName:name,safeInputJson:{requestId:run.requestId,contextVersion:run.contextVersion},safeOutputSummaryJson:{sideEffect:'READ_ONLY',resultCount:ids.length,resultIds:ids.slice(0,50)},startedAt:new Date(now.getTime()-Math.max(0,latencyMs)),finishedAt:now,latencyMs:Math.max(0,latencyMs),status:'SUCCEEDED'}});}
}
