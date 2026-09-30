import {Prisma} from '../generated/prisma/client.js';
import {SLA_RISK_RATIO,slaElapsed,slaRules} from './sla-clock.js';

// Allowlisted aliases only. Values (actor, clock, ratio) are always bound parameters.
export const slaElapsedSql=slaElapsed(
  Prisma.sql`EXTRACT(EPOCH FROM date_trunc('second',COALESCE(s."pausedAt",s."resolvedHoldAt",s."stoppedAt",clock."asOf")))`,
  Prisma.sql`EXTRACT(EPOCH FROM date_trunc('second',s."startedAt"))`,
  Prisma.sql`s."totalPausedSeconds"`,Prisma.sql`s."totalResolvedHoldSeconds"`,
  {subtract:(a,b)=>Prisma.sql`(${a}-${b})`,nonnegative:value=>Prisma.sql`GREATEST(0,${value})`},
);
export const slaRemainingSql=Prisma.sql`(s."targetSeconds"-${slaElapsedSql})`;
const rules=slaRules(Prisma.sql`s."pausedAt" IS NOT NULL`,Prisma.sql`s."breachedAt" IS NOT NULL OR ${slaRemainingSql}<0`,
  Prisma.sql`s."resolvedHoldAt" IS NOT NULL`,Prisma.sql`${slaRemainingSql}<=s."targetSeconds"*${SLA_RISK_RATIO}::numeric`);
export const slaStateSql=Prisma.sql`CASE WHEN s."id" IS NULL THEN NULL ${Prisma.join(rules.map(rule=>Prisma.sql`WHEN ${rule.when} THEN ${rule.state}`),' ')} ELSE 'SAFE' END`;
export async function databaseNow(prisma:{ $queryRaw<T>(query:Prisma.Sql):Promise<T> }){
  const [row]=await prisma.$queryRaw<{now:Date}[]>(Prisma.sql`SELECT clock_timestamp() AS now`);
  return row!.now;
}
