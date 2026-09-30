import {Injectable} from '@nestjs/common';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {analyticsDataSchema,analyticsQuerySchema,dashboardTimeZone,evaluationSnapshotSchema,type AnalyticsData,type AnalyticsQuery,type EvaluationSnapshot} from '@mobiflow/contracts';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {PrismaService} from '../database/prisma.service.js';
import {ApiError} from '../http.js';
import {analyticsQuery} from './analytics-query.js';
import {parse} from '../requests/validation.js';

type AggregateRow=Pick<AnalyticsData,'operations'|'sla'|'reopen'|'feedback'|'copilot'|'trends'|'filterOptions'>&{
  asOf:string;from:string;to:string;fromDate:string;toDate:string;days:number;
  ai:Omit<AnalyticsData['ai'],'asOf'|'windowDays'>;overview:Omit<AnalyticsData['overview'],'asOf'|'windowDays'>;
};

@Injectable()
export class AnalyticsService{
  constructor(private readonly prisma:PrismaService){}
  private async manager(actor:AuthenticatedActor){if(actor.role!=='MANAGER'||!await this.prisma.user.findFirst({where:{id:actor.id,role:'MANAGER',active:true}}))throw new ApiError(403,'FORBIDDEN','Manager access required.');}
  async dashboard(actor:AuthenticatedActor,input:AnalyticsQuery|number,at?:Date):Promise<AnalyticsData>{
    await this.manager(actor);
    const query=parse(analyticsQuerySchema,typeof input==='number'?{windowDays:String(input)}:input);
    const [rows,evaluations]=await Promise.all([this.prisma.$queryRaw<AggregateRow[]>(analyticsQuery(query,at)),this.evaluationHistory(10)]);
    const row=rows[0]!,asOf=row.asOf;
    return analyticsDataSchema.parse({
      period:{asOf,from:row.from,to:row.to,fromDate:row.fromDate,toDate:row.toDate,days:row.days,timeZone:dashboardTimeZone,granularity:'day'},
      filters:{priority:query.priority??null,status:query.status??null,category:query.category??null,teamId:query.teamId??null},
      filterOptions:row.filterOptions,operations:row.operations,sla:row.sla,reopen:row.reopen,feedback:row.feedback,copilot:row.copilot,trends:row.trends,
      overview:{...row.overview,asOf,windowDays:row.days},ai:{...row.ai,asOf,windowDays:row.days},evaluations,
    });
  }
  async evaluationHistory(limit:number):Promise<EvaluationSnapshot[]>{const directory=join(process.cwd(),'docs','evaluation','results');try{const files=(await readdir(directory)).filter(f=>/^m9-.*\.json$/.test(f)).sort().reverse().slice(0,limit),results=[];for(const file of files){const parsed=evaluationSnapshotSchema.safeParse(JSON.parse(await readFile(join(directory,file),'utf8'))?.snapshot);if(parsed.success)results.push(parsed.data);}return results;}catch{return [];}}
}
