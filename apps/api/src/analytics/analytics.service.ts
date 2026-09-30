import {Injectable} from '@nestjs/common';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {evaluationSnapshotSchema,type EvaluationSnapshot} from '@mobiflow/contracts';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {PrismaService} from '../database/prisma.service.js';
import {ApiError} from '../http.js';
import {counts,mean,percentile} from './metrics.js';
import {Prisma} from '../generated/prisma/client.js';
import {databaseNow,slaStateSql} from '../requests/sla-sql.js';

@Injectable()
export class AnalyticsService{
  constructor(private readonly prisma:PrismaService){}
  private async manager(actor:AuthenticatedActor){if(actor.role!=='MANAGER'||!await this.prisma.user.findFirst({where:{id:actor.id,role:'MANAGER',active:true}}))throw new ApiError(403,'FORBIDDEN','Manager access required.');}
  async dashboard(actor:AuthenticatedActor,windowDays:number){await this.manager(actor);const asOf=await databaseNow(this.prisma),since=new Date(asOf.getTime()-windowDays*86400000);
    const [created,open,highUrgent,resolved,slas,runs,recommendations,evaluations]=await Promise.all([
      this.prisma.request.count({where:{createdAt:{gte:since}}}),this.prisma.request.count({where:{status:{notIn:['CLOSED','CANCELED']}}}),this.prisma.request.count({where:{priority:{in:['HIGH','URGENT']},status:{notIn:['CLOSED','CANCELED']}}}),
      this.prisma.request.findMany({where:{resolvedAt:{gte:since}},select:{createdAt:true,resolvedAt:true},take:1000}),
      this.prisma.$queryRaw<{atRisk:number;breached:number;met:number;denominator:number}[]>(Prisma.sql`WITH clock AS (SELECT ${asOf}::timestamptz AS "asOf"),
        assessed AS (SELECT ${slaStateSql} AS state FROM "SlaInstance" s JOIN "Request" r ON r.id=s."requestId" CROSS JOIN clock WHERE r."createdAt">=${since} AND r.status<>'CANCELED')
        SELECT COUNT(*) FILTER (WHERE state='AT_RISK')::int AS "atRisk",COUNT(*) FILTER (WHERE state='BREACHED')::int AS breached,COUNT(*) FILTER (WHERE state='MET')::int AS met,COUNT(*)::int AS denominator FROM assessed`),
      this.prisma.aiRun.findMany({where:{createdAt:{gte:since}},select:{purpose:true,status:true,model:true,promptVersion:true,schemaVersion:true,latencyMs:true,retryCount:true,errorCode:true},take:5000}),
      this.prisma.aiRecommendation.findMany({where:{reviewedAt:{gte:since}},select:{status:true},take:5000}),this.evaluationHistory(10)
    ]);
    const latencies=runs.flatMap(run=>run.latencyMs===null?[]:[run.latencyMs]),succeeded=runs.filter(run=>run.status==='SUCCEEDED'),failed=runs.filter(run=>run.status==='FAILED');
    return {overview:{asOf:asOf.toISOString(),windowDays,requests:{created,open,highUrgent,resolved:resolved.length,averageResolutionSeconds:mean(resolved.flatMap(r=>r.resolvedAt?[Math.max(0,(r.resolvedAt.getTime()-r.createdAt.getTime())/1000)]:[]))},sla:slas[0]!},ai:{asOf:asOf.toISOString(),windowDays,runs:{total:runs.length,succeeded:succeeded.length,failed:failed.length,firstAttemptValid:succeeded.filter(r=>r.retryCount===0).length,repairedSuccess:succeeded.filter(r=>r.retryCount>0).length,averageAttempts:mean(runs.map(r=>r.retryCount+1)),averageLatencyMs:mean(latencies),p50LatencyMs:percentile(latencies,.5),p95LatencyMs:percentile(latencies,.95)},byPurpose:counts(runs.map(r=>r.purpose)),byModel:counts(runs.map(r=>r.model??'UNKNOWN')),byVersion:counts(runs.map(r=>`${r.promptVersion} / ${r.schemaVersion}`)),failures:counts(failed.map(r=>r.errorCode??'UNCLASSIFIED')),recommendations:{accepted:recommendations.filter(r=>r.status==='ACCEPTED').length,modified:recommendations.filter(r=>r.status==='MODIFIED').length,rejected:recommendations.filter(r=>r.status==='REJECTED').length,denominator:recommendations.length}},evaluations};
  }
  async evaluationHistory(limit:number):Promise<EvaluationSnapshot[]>{const directory=join(process.cwd(),'docs','evaluation','results');try{const files=(await readdir(directory)).filter(f=>/^m9-.*\.json$/.test(f)).sort().reverse().slice(0,limit),results=[];for(const file of files){const parsed=evaluationSnapshotSchema.safeParse(JSON.parse(await readFile(join(directory,file),'utf8'))?.snapshot);if(parsed.success)results.push(parsed.data);}return results;}catch{return [];}}
}
