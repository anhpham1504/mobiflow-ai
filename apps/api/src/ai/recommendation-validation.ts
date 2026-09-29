import type {RecommendationEvidence} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {candidates,routing} from './tools/staff.js';
import {ToolFailure} from './tools/registry.js';
export async function revalidateRecommendation(tx:Prisma.TransactionClient,e:RecommendationEvidence,lock=false,priority=e.policy?.priority??e.analysis.prioritySuggestion){
  const teamId=e.candidates.candidates[0]?.teamId;
  if(lock){
    // Fixed ordered locks retain eligibility/source identity through publication.
    if(teamId){
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Team" WHERE id=${teamId}::uuid FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT u.id FROM "User" u JOIN "TeamMember" m ON m."userId"=u.id WHERE m."teamId"=${teamId}::uuid ORDER BY u.id FOR SHARE OF u,m`);
      await tx.$queryRaw(Prisma.sql`SELECT ss."staffId" FROM "StaffSkill" ss JOIN "TeamMember" m ON m."userId"=ss."staffId" WHERE m."teamId"=${teamId}::uuid ORDER BY ss."staffId",ss."skillId" FOR SHARE OF ss`);
    }
    if(e.policy)await tx.$queryRaw(Prisma.sql`SELECT id FROM "SlaPolicy" WHERE id=${e.policy.id}::uuid FOR SHARE`);
  }
  const route=routing(e.analysis),team=await tx.team.findUnique({where:{code:route.team}});
  const current=team?await candidates(tx,team.id,route.skills):[];
  const signature=(rows:typeof current)=>JSON.stringify(rows.map(c=>[c.staffId,c.teamId,[...c.skillCodes].sort(),c.activeWorkload,c.score]));
  if(signature(current)!==signature(e.candidates.candidates))throw new ToolFailure('STALE_CANDIDATES');
  const policies=await tx.slaPolicy.findMany({where:{active:true,priority,OR:[{category:e.analysis.category},{category:null}]},take:2});
  const policy=policies.find(p=>p.category!==null)??policies[0];
  if((policy?.id??null)!==(e.policy?.id??null)||policy&&(policy.version!==e.policy?.version||policy.targetMinutes!==e.policy.targetMinutes))throw new ToolFailure('STALE_POLICY');
  if(e.similar.cases.length){
    if(lock)await tx.$queryRaw(Prisma.sql`SELECT id FROM "Request" WHERE id::text IN (${Prisma.join(e.similar.cases.map(c=>c.requestId))}) ORDER BY id FOR SHARE`);
    const cases=await tx.request.findMany({where:{id:{in:e.similar.cases.map(c=>c.requestId)},status:{not:'CANCELED'}},select:{id:true,version:true}});
    if(e.similar.cases.some(c=>!cases.some(r=>r.id===c.requestId&&r.version===c.contextVersion)))throw new ToolFailure('STALE_CASES');
  }
}
