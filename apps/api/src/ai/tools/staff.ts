import type {Analysis,Candidate} from '@mobiflow/contracts';
import {Prisma} from '../../generated/prisma/client.js';
import {eligibleStaffPredicate} from '../../requests/staff-eligibility.js';
export function routing(analysis:Pick<Analysis,'category'|'subcategory'>){
  const team=analysis.category==='NETWORK'||analysis.category==='IOT'?'NETWORK_OPERATIONS':analysis.category==='BILLING'?'BILLING_SUPPORT':analysis.category==='SERVICE'?'SERVICE_OPERATIONS':'CUSTOMER_SUPPORT';
  const skill=analysis.subcategory==='IOT_CONNECTIVITY'||analysis.category==='IOT'?'IOT':analysis.category==='NETWORK'?'NETWORK':analysis.category==='BILLING'?'BILLING':analysis.category==='ACCOUNT'?'ACCOUNT':'CUSTOMER_SUPPORT';
  return {team,skills:[skill] as Candidate['skillCodes']};
}
export function scoreStaff(activeWorkload:number){
  if(!Number.isInteger(activeWorkload)||activeWorkload<0)throw new Error('INVALID_WORKLOAD');
  const skillMatch=1,workloadScore=1/(1+activeWorkload);return {score:(60*skillMatch+25*workloadScore)/85,scoreComponents:{skillMatch,workloadScore}};
}
export function rankCandidates(candidates:Candidate[]){return candidates.map(c=>({...c,...scoreStaff(c.activeWorkload)})).sort((a,b)=>b.score-a.score||a.activeWorkload-b.activeWorkload||(a.staffId<b.staffId?-1:a.staffId>b.staffId?1:0));}
export async function candidates(tx:Prisma.TransactionClient,teamId:string,skills:Candidate['skillCodes']):Promise<Candidate[]>{
  // All hard predicates precede counting/ranking/LIMIT. The model never sees an ineligible worker.
  const rows=await tx.$queryRaw<{staffId:string;displayName:string;teamId:string;skillCodes:Candidate['skillCodes'];activeWorkload:number}[]>(Prisma.sql`
    SELECT u.id AS "staffId",u."displayName",t.id AS "teamId",
      ARRAY(SELECT s.code FROM "StaffSkill" ss JOIN "Skill" s ON s.id=ss."skillId" WHERE ss."staffId"=u.id ORDER BY s.code) AS "skillCodes",
      (SELECT count(*)::int FROM "Request" r WHERE r."currentAssigneeId"=u.id AND r.status IN ('ASSIGNED','IN_PROGRESS','WAITING_USER')) AS "activeWorkload"
    FROM "User" u JOIN "TeamMember" m ON m."userId"=u.id JOIN "Team" t ON t.id=m."teamId"
    WHERE t.id=${teamId}::uuid AND ${eligibleStaffPredicate()}
      AND (SELECT count(DISTINCT s.code)::int FROM "StaffSkill" ss JOIN "Skill" s ON s.id=ss."skillId" WHERE ss."staffId"=u.id AND s.code IN (${Prisma.join(skills)}))=${skills.length}
    ORDER BY "activeWorkload",u.id LIMIT 10`);
  return rankCandidates(rows.map(r=>({...r,...scoreStaff(r.activeWorkload)})));
}
