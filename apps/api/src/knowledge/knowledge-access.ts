import {Prisma} from '../generated/prisma/client.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {ApiError} from '../http.js';
export async function knowledgeIdentity(tx:Prisma.TransactionClient,actor:AuthenticatedActor,manage=false){
  if(manage?actor.role!=='MANAGER':!['MANAGER','STAFF'].includes(actor.role))throw new ApiError(403,'FORBIDDEN','This role cannot access knowledge.');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actor.id}::uuid FOR SHARE`);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "id"=${actor.sessionId}::uuid FOR SHARE`);
  const user=await tx.user.findUnique({where:{id:actor.id}}),session=await tx.refreshSession.findFirst({where:{id:actor.sessionId,userId:actor.id,consumedAt:null,revokedAt:null,expiresAt:{gt:new Date()}}});
  if(!user?.active||user.role!==actor.role||!session)throw new ApiError(401,'UNAUTHORIZED','Authentication is required.');
}
