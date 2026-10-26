import {z} from 'zod';
import {Prisma,type Role} from '../generated/prisma/client.js';

const authorizationSchema=z.object({initiatingSessionId:z.string().uuid(),initiatingRole:z.enum(['USER','STAFF','MANAGER'])}).strict();
export type BackgroundAuthorization=z.infer<typeof authorizationSchema>;

export function authorizationSnapshot(actor:{sessionId:string;role:Role}):Prisma.InputJsonObject{
  return {_authorization:{initiatingSessionId:actor.sessionId,initiatingRole:actor.role}};
}

export function backgroundAuthorization(value:Prisma.JsonValue|null):BackgroundAuthorization|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const parsed=authorizationSchema.safeParse(value._authorization);
  return parsed.success?parsed.data:null;
}

export async function validateBackgroundAuthorization(
  tx:Prisma.TransactionClient,
  actorId:string|null,
  authorization:BackgroundAuthorization|null,
  lock=false,
):Promise<boolean>{
  if(!actorId||!authorization)return false;
  if(lock)await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "id"=${authorization.initiatingSessionId}::uuid FOR SHARE`);
  let origin=await tx.refreshSession.findFirst({where:{id:authorization.initiatingSessionId,userId:actorId}});
  if(!origin)return false;
  if(lock){
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "familyId"=${origin.familyId}::uuid ORDER BY "id" FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actorId}::uuid FOR SHARE`);
    origin=await tx.refreshSession.findFirst({where:{id:authorization.initiatingSessionId,userId:actorId}});
    if(!origin)return false;
  }
  const now=new Date();
  if(origin.revokedAt||origin.expiresAt<=now)return false;
  const [user,live]=await Promise.all([
    tx.user.findFirst({where:{id:actorId,active:true,role:authorization.initiatingRole},select:{id:true}}),
    tx.refreshSession.findFirst({where:{familyId:origin.familyId,userId:actorId,consumedAt:null,revokedAt:null,expiresAt:{gt:now}},select:{id:true}}),
  ]);
  return !!user&&!!live;
}
