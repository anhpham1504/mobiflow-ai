import {Injectable} from '@nestjs/common';
import {analysisSchema,routingFactsSchema,type Analysis,type AutoRoutingReason,type AutoRoutingView,type Priority} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {RoutingService} from './routing.service.js';
import {candidates,routing} from '../ai/tools/staff.js';

type Tx=Prisma.TransactionClient;
export interface AutoRouteInput {analysis:Analysis;grounded:boolean;appliedPriority:Priority;requestVersion:number;evaluatedAt:Date}
export interface AutoRouteDecision {view:AutoRoutingView;policy:{id:string;version:number;targetMinutes:number}|null}

@Injectable()
export class AutoRoutingService {
  constructor(private readonly rules:RoutingService){}
  private view(input:AutoRouteInput,values:Partial<AutoRoutingView>&Pick<AutoRoutingView,'outcome'|'reasons'>):AutoRoutingView{
    const route=routing(input.analysis),{outcome,reasons,...overrides}=values;
    return {source:'AUTO_ROUTING',outcome,category:input.analysis.category,subcategory:input.analysis.subcategory,
      prioritySuggestion:input.analysis.prioritySuggestion,appliedPriority:input.appliedPriority,requiredSkills:[...route.skills],recommendedTeamCode:route.team,
      teamId:null,staffId:null,candidateCount:0,selectedWorkload:null,requestVersion:input.requestVersion,evaluatedAt:input.evaluatedAt.toISOString(),...overrides,reasons};
  }
  async evaluate(tx:Tx,raw:AutoRouteInput):Promise<AutoRouteDecision>{
    const input={...raw,analysis:analysisSchema.parse(raw.analysis)};
    if(!input.grounded)return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',reasons:['WEAK_RAG_GROUNDING']}),policy:null};
    if(input.analysis.category==='OTHER'||input.analysis.subcategory==='UNSPECIFIED')return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',reasons:['MISSING_ROUTING_FACT']}),policy:null};
    const projected=routing(input.analysis),facts=routingFactsSchema.parse({category:input.analysis.category,subcategory:input.analysis.subcategory,priority:input.appliedPriority});
    const evaluation=await this.rules.evaluateFacts(tx,facts,input.requestVersion);
    if(evaluation.status==='CONFLICT')return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',reasons:['ROUTING_RULE_CONFLICT','AMBIGUOUS_TEAM']}),policy:null};
    if(evaluation.status==='NO_MATCH'&&evaluation.diagnostic==='INVALID_TARGET')return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',reasons:['INVALID_ROUTING_TARGET']}),policy:null};
    const ruleMatched=evaluation.status==='MATCH',team=ruleMatched
      ?await tx.team.findFirst({where:{id:evaluation.suggestedTarget!.id,active:true},select:{id:true,code:true}})
      :await tx.team.findFirst({where:{code:projected.team,active:true},select:{id:true,code:true}});
    if(!team)return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',reasons:['INVALID_ROUTING_TARGET']}),policy:null};
    const staff=await candidates(tx,team.id,projected.skills);
    if(!staff.length)return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',teamId:team.id,reasons:[ruleMatched?'ROUTING_RULE_MATCH':'DEFAULT_TEAM_MAPPING','TEAM_MATCH','NO_ELIGIBLE_STAFF']}),policy:null};
    const policies=await tx.slaPolicy.findMany({where:{active:true,priority:input.appliedPriority,OR:[{category:input.analysis.category},{category:null}]},orderBy:{id:'asc'}});
    const policy=policies.find(value=>value.category===input.analysis.category)??policies.find(value=>value.category===null)??null;
    if(!policy)return {view:this.view(input,{outcome:'MANAGER_REVIEW_REQUIRED',teamId:team.id,candidateCount:staff.length,reasons:[ruleMatched?'ROUTING_RULE_MATCH':'DEFAULT_TEAM_MAPPING','TEAM_MATCH','MISSING_SLA_POLICY']}),policy:null};
    const selected=staff[0]!,reasons:AutoRoutingReason[]=['GROUNDED_RAG',ruleMatched?'ROUTING_RULE_MATCH':'DEFAULT_TEAM_MAPPING','EXACT_SKILL_MATCH','TEAM_MATCH','AVAILABLE','LOWEST_WORKLOAD'];
    if(staff.length>1&&staff[1]!.activeWorkload===selected.activeWorkload)reasons.push('STABLE_TIE_BREAK');
    reasons.push('SLA_POLICY_MATCH');
    return {view:this.view(input,{outcome:'AUTO_ASSIGNED',teamId:team.id,staffId:selected.staffId,candidateCount:staff.length,selectedWorkload:selected.activeWorkload,reasons}),policy:{id:policy.id,version:policy.version,targetMinutes:policy.targetMinutes}};
  }
}
