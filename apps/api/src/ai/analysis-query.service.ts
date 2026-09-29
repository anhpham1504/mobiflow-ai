import {Injectable} from '@nestjs/common';
import {analysisSchema} from '@mobiflow/contracts';
import type {AiRun,AiAnalysis} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {AuthorizationPolicyService} from '../authorization/authorization-policy.service.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {ApiError} from '../http.js';
import {SourceService} from '../knowledge/source.service.js';
import {RecommendationService} from './recommendation.service.js';
@Injectable()
export class AnalysisQueryService {
  constructor(private readonly prisma:PrismaService,private readonly policy:AuthorizationPolicyService,private readonly sources:SourceService,private readonly recommendations:RecommendationService){}
  private analysis(a:AiAnalysis){return analysisSchema.parse({intent:a.intent,category:a.category,subcategory:a.subcategory,prioritySuggestion:a.prioritySuggestion,entities:a.entitiesJson,missingFields:a.missingFieldsJson,confidence:Number(a.confidence),reasonSummary:a.reasonSummary});}
  private async job(run:AiRun,analysis:AiAnalysis|undefined,actor:AuthenticatedActor){
    const result=analysis?this.analysis(analysis):undefined;
    return {aiRunId:run.id,requestId:run.requestId!,purpose:'ANALYSIS' as const,status:run.status,errorCode:run.errorCode,createdAt:run.createdAt,finishedAt:run.finishedAt,contextVersion:run.contextVersion,missingFields:result?.missingFields??[],...(actor.role==='MANAGER'?{analysis:result,provider:run.provider,model:run.model,latencyMs:run.latencyMs,grounding:await this.sources.grounding(run.safeResultJson,actor)}:{})};
  }
  async run(id:string,actor:AuthenticatedActor){
    if(actor.role==='STAFF')throw new ApiError(403,'FORBIDDEN','Intake runs are for the owner or manager.');
    if(actor.role==='MANAGER'){
      const recommendation=await this.prisma.aiRun.findFirst({where:{id,purpose:'RECOMMENDATION'},select:{requestId:true}});
      if(recommendation?.requestId)return this.recommendations.view(recommendation.requestId,actor,id);
    }
    const run=await this.prisma.aiRun.findFirst({where:{id,purpose:'ANALYSIS',request:this.policy.requestScope(actor)},include:{analyses:true}});
    if(!run)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    return this.job(run,run.analyses[0],actor);
  }
  async explanation(id:string,actor:AuthenticatedActor){
    const request=await this.prisma.request.findFirst({where:{id,...this.policy.requestScope(actor)},include:{latestAnalysis:true,aiRuns:{where:{purpose:'ANALYSIS'},orderBy:[{createdAt:'desc'},{id:'desc'}],take:1,include:{analyses:true}}}});
    if(!request)throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    const analysis=request.latestAnalysis?this.analysis(request.latestAnalysis):undefined,run=request.aiRuns[0];
    return {status:request.aiAnalysisStatus,job:actor.role==='STAFF'||!run?null:await this.job(run,run.analyses[0],actor),missingFields:analysis?.missingFields??[],...(actor.role==='MANAGER'?{analysis}:actor.role==='STAFF'&&analysis?{entities:analysis.entities}:{}),...(actor.role!=='USER'&&run?{grounding:await this.sources.grounding(run.safeResultJson,actor)}:{})};
  }
}
