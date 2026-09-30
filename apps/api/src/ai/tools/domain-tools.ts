import {Injectable} from '@nestjs/common';
import {toolSchemas,type Analysis,type Candidate,type ToolName,type ToolOutput} from '@mobiflow/contracts';
import {PrismaService} from '../../database/prisma.service.js';
import {Prisma} from '../../generated/prisma/client.js';
import {KnowledgeRetriever,type Retrieval} from '../../knowledge/retriever.js';
import type {EmbeddingIdentity} from '../../knowledge/embedding-provider.js';
import {ToolFailure,ToolRegistry} from './registry.js';
import {candidates,routing} from './staff.js';
import {RequestVectors} from './request-vectors.js';

export interface ToolContext {runId:string;requestId:string;actorId:string;requestVersion:number;analysis:Analysis;identity:EmbeddingIdentity;asOf:Date;initiatingSessionId?:string}
@Injectable()
export class DomainTools {
  constructor(private readonly prisma:PrismaService,private readonly retriever:KnowledgeRetriever,private readonly requests:RequestVectors){}
  async authorize(context:Pick<ToolContext,'runId'|'requestId'|'actorId'|'requestVersion'|'initiatingSessionId'>){
    const run=await this.prisma.aiRun.findFirst({where:{id:context.runId,requestId:context.requestId,contextVersion:context.requestVersion,purpose:'RECOMMENDATION',status:'RUNNING',deadlineAt:{gt:new Date()},initiatingActorId:context.actorId,initiatingActor:{active:true,role:'MANAGER',...(context.initiatingSessionId?{sessions:{some:{id:context.initiatingSessionId,revokedAt:null,consumedAt:null,expiresAt:{gt:new Date()}}}}:{})},request:{version:context.requestVersion,status:'TRIAGED'}}});
    if(!run)throw new ToolFailure('STALE_CONTEXT');
  }
  session(context:ToolContext,signal:AbortSignal){
    let currentCandidates:Candidate[]=[],retrieval:Retrieval|undefined;
    const db=<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>this.prisma.$transaction(async tx=>{await tx.$executeRaw`SET TRANSACTION READ ONLY`;await tx.$executeRaw`SET LOCAL statement_timeout='4000ms'`;if(signal.aborted)throw new ToolFailure('TIMEOUT');return fn(tx);},{timeout:5000});
    const execute=async(name:ToolName,input:unknown,callSignal:AbortSignal):Promise<unknown>=>{
      switch(name){
        case 'searchKnowledge':{
          const p=toolSchemas.searchKnowledge.input.parse(input);retrieval=await this.retriever.search(p.query,callSignal,p.topK);
          if(retrieval.identity.key!==context.identity.key)throw new ToolFailure('STALE_CONTEXT');
          return {sources:retrieval.sources,indexModel:retrieval.identity.model,indexGeneration:retrieval.identity.key};
        }
        case 'findSimilarRequests':{
          const p=toolSchemas.findSimilarRequests.input.parse(input);if(p.requestId!==context.requestId)throw new ToolFailure('FORBIDDEN');
          return db(tx=>this.requests.similar(tx,p.requestId,context.identity,p.timeWindow,p.limit,context.asOf));
        }
        case 'getSlaPolicy':{
          const p=toolSchemas.getSlaPolicy.input.parse(input);if(p.category!==context.analysis.category)throw new ToolFailure('FORBIDDEN');
          return db(async tx=>{
            const policies=await tx.slaPolicy.findMany({where:{active:true,priority:p.priority,OR:[{category:p.category},{category:null}]},take:2});
            const row=policies.find(p=>p.category!==null)??policies[0];
            return {policy:row?{id:row.id,category:row.category,version:row.version,priority:row.priority,targetMinutes:row.targetMinutes}:null};
          });
        }
        case 'getCandidateStaff':{
          const p=toolSchemas.getCandidateStaff.input.parse(input),route=routing(context.analysis);
          return db(async tx=>{
            const team=await tx.team.findUnique({where:{id:p.team}});
            if(team?.code!==route.team||JSON.stringify([...p.skills].sort())!==JSON.stringify([...route.skills].sort()))throw new ToolFailure('FORBIDDEN');
            currentCandidates=await candidates(tx,p.team,p.skills);return {candidates:currentCandidates,scoringVersion:'staff.v1'};
          });
        }
        case 'getStaffWorkload':{
          const p=toolSchemas.getStaffWorkload.input.parse(input);if(p.staffIds.some(id=>!currentCandidates.some(c=>c.staffId===id)))throw new ToolFailure('FORBIDDEN');
          return db(async tx=>{
            const counts=await tx.request.groupBy({by:['currentAssigneeId'],where:{currentAssigneeId:{in:p.staffIds},status:{in:['ASSIGNED','IN_PROGRESS','WAITING_USER']}},_count:true});
            return {workloads:p.staffIds.map(staffId=>({staffId,activeCount:counts.find(c=>c.currentAssigneeId===staffId)?._count??0})),asOf:new Date().toISOString()};
          });
        }
        case 'getRequestHistory':{
          const p=toolSchemas.getRequestHistory.input.parse(input);if(p.requestId!==context.requestId)throw new ToolFailure('FORBIDDEN');
          return db(async tx=>{
            const rows=await tx.auditLog.findMany({where:{requestId:p.requestId,outcome:'SUCCEEDED',OR:[{histories:{some:{}}},{messages:{some:{}}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,select:{id:true,action:true,actorType:true,createdAt:true,histories:{take:1,select:{fromStatus:true,toStatus:true,requestVersion:true}},messages:{take:1,select:{body:true,kind:true}}}});
            const events=rows.slice(0,50).map(r=>({id:r.id,type:r.action,actorType:r.actorType,timestamp:r.createdAt.toISOString(),payload:r.messages[0]??r.histories[0]!}));
            let truncated=rows.length>50;
            // Optional history omits whole oldest events, never slices facts or JSON.
            while(events.length&&JSON.stringify(events).length>6000){events.pop();truncated=true;}
            return {events:events.reverse(),truncated};
          });
        }
      }
    };
    const registry=new ToolRegistry(()=>this.authorize(context),execute,async trace=>{
      await this.prisma.aiToolCall.create({data:{aiRunId:context.runId,ordinal:trace.ordinal,toolName:trace.toolName,safeInputJson:{requestId:context.requestId,requestVersion:context.requestVersion},safeOutputSummaryJson:{toolVersion:trace.toolVersion,sideEffect:'READ_ONLY',resultCount:trace.resultCount,resultIds:trace.resultIds},startedAt:trace.startedAt,finishedAt:trace.finishedAt,latencyMs:trace.latencyMs,status:trace.status,errorCode:trace.errorCode}});
    },signal);
    return {call:<N extends ToolName>(name:N,input:unknown):Promise<ToolOutput<N>>=>registry.call(name,input),getRetrieval:()=>retrieval};
  }
}
