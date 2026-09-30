import {Injectable} from '@nestjs/common';
import {dashboardSchema,dashboardTimeZone} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {AuthorizationPolicyService} from '../authorization/authorization-policy.service.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {slaStateSql} from '../requests/sla-sql.js';

const open=Prisma.sql`status NOT IN ('CLOSED','CANCELED')`;
const common={slaAtRisk:Prisma.sql`${open} AND "slaState"='AT_RISK'`,slaBreached:Prisma.sql`${open} AND "slaState"='BREACHED'`};
const resolvedToday=Prisma.sql`status IN ('RESOLVED','CLOSED') AND "resolvedAt">=clock."dayFrom" AND "resolvedAt"<clock."dayTo"`;
export const metricPredicates={
  USER:{openRequests:open,inProgress:Prisma.sql`status='IN_PROGRESS'`,waitingForUser:Prisma.sql`status='WAITING_USER'`,resolved:Prisma.sql`status='RESOLVED'`,closed:Prisma.sql`status='CLOSED'`,...common},
  STAFF:{assignedToMe:Prisma.sql`TRUE`,active:Prisma.sql`status IN ('ASSIGNED','IN_PROGRESS','WAITING_USER')`,waitingForUser:Prisma.sql`status='WAITING_USER'`,...common,resolvedToday},
  MANAGER:{open,pendingApproval:Prisma.sql`status='PENDING_APPROVAL'`,unassigned:Prisma.sql`status='PENDING_APPROVAL' AND "currentAssigneeId" IS NULL`,...common,resolvedToday},
} as const;

export function dashboardQuery(actor:AuthenticatedActor,policy:AuthorizationPolicyService,at?:Date):Prisma.Sql{
  const fields=Object.entries(metricPredicates[actor.role]).map(([name,predicate])=>Prisma.sql`${name}::text,COUNT(scoped.id) FILTER (WHERE ${predicate})::int`);
  const instant=at?Prisma.sql`${at}::timestamptz`:Prisma.sql`statement_timestamp()`;
  return Prisma.sql`WITH instant AS (SELECT date_trunc('second',${instant}) AS "asOf"),
    clock AS (SELECT "asOf",date_trunc('day',"asOf" AT TIME ZONE ${dashboardTimeZone}) AT TIME ZONE ${dashboardTimeZone} AS "dayFrom",
      (date_trunc('day',"asOf" AT TIME ZONE ${dashboardTimeZone})+interval '1 day') AT TIME ZONE ${dashboardTimeZone} AS "dayTo" FROM instant),
    scoped AS (SELECT r.id,r.status,r."currentAssigneeId",r."resolvedAt",${slaStateSql} AS "slaState"
      FROM "Request" r LEFT JOIN "SlaInstance" s ON s."requestId"=r.id CROSS JOIN clock WHERE ${policy.requestScopeSql(actor)})
    SELECT clock."asOf",clock."dayFrom",clock."dayTo",jsonb_build_object(${Prisma.join(fields)}) AS metrics
      FROM clock LEFT JOIN scoped ON TRUE GROUP BY clock."asOf",clock."dayFrom",clock."dayTo"`;
}

@Injectable()
export class DashboardService{
  constructor(private readonly prisma:PrismaService,private readonly policy:AuthorizationPolicyService){}
  async snapshot(actor:AuthenticatedActor,at?:Date){
    const [row]=await this.prisma.$queryRaw<{asOf:Date;dayFrom:Date;dayTo:Date;metrics:Record<string,number>}[]>(dashboardQuery(actor,this.policy,at));
    return dashboardSchema.parse({role:actor.role,asOf:row!.asOf.toISOString(),timeZone:dashboardTimeZone,day:{from:row!.dayFrom.toISOString(),to:row!.dayTo.toISOString()},metrics:row!.metrics});
  }
}
