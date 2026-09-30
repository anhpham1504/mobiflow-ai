import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { categories, priorities, statuses } from '@mobiflow/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { ApiError } from '../http.js';
import { slaView } from './sla-clock.js';
import { databaseNow } from './sla-sql.js';
import { parse } from './validation.js';

const querySchema=z.object({
  limit:z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  cursor:z.string().max(500).optional(),status:z.enum(statuses).optional(),priority:z.enum(priorities).optional(),category:z.enum(categories).optional(),
  assigneeId:z.uuid().optional(),from:z.iso.datetime().optional(),to:z.iso.datetime().optional(),unreadOnly:z.enum(['true','false']).optional(),
}).strict().refine(q=>!q.from||!q.to||q.from<q.to,'Invalid date range');
const cursorSchema=z.object({id:z.uuid(),createdAt:z.iso.datetime()}).strict();
export function pagination(input:unknown) {
  const query=parse(querySchema,input);
  let cursor:z.infer<typeof cursorSchema>|undefined;
  if(query.cursor) {try {cursor=parse(cursorSchema,JSON.parse(Buffer.from(query.cursor,'base64url').toString('utf8')));}catch {throw new ApiError(400,'INVALID_CURSOR','Invalid pagination cursor.');}}
  const where=cursor?{OR:[{createdAt:{lt:new Date(cursor.createdAt)}},{createdAt:new Date(cursor.createdAt),id:{lt:cursor.id}}]}:{};
  return {query,where,limit:query.limit??20};
}
export function page<T extends {id:string;createdAt:Date}>(rows:T[],limit:number) {
  const data=rows.slice(0,limit),last=data.at(-1);
  return {data,page:{hasMore:rows.length>limit,nextCursor:rows.length>limit&&last?Buffer.from(JSON.stringify({id:last.id,createdAt:last.createdAt.toISOString()})).toString('base64url'):null}};
}
const relations={currentAssignee:{select:{id:true,displayName:true}},slaInstance:true,currentResolution:{select:{id:true,cycle:true,rootCause:true,resolution:true,verification:true,resolvedAt:true}},feedback:{select:{rating:true,comment:true,createdAt:true}},aiRuns:{where:{purpose:'RESOLUTION_SUMMARY' as const},orderBy:{createdAt:'desc' as const},take:1}} satisfies Prisma.RequestInclude;
type Row=Prisma.RequestGetPayload<{include:typeof relations}>;
@Injectable()
export class RequestQueryService {
  constructor(private readonly prisma:PrismaService,private readonly policy:AuthorizationPolicyService) {}
  private view(r:Row,actor:AuthenticatedActor,now:Date) {
    const sla=r.slaInstance?slaView(r.slaInstance,now):null;
    return {id:r.id,publicCode:r.publicCode,title:r.title,description:r.description,status:r.status,version:r.version,category:r.category,subcategory:r.subcategory,priority:r.priority,teamId:r.teamId,currentAssignee:r.currentAssignee,
      createdAt:r.createdAt,updatedAt:r.updatedAt,resolvedAt:r.resolvedAt,closedAt:r.closedAt,canceledAt:r.canceledAt,aiAnalysisStatus:r.aiAnalysisStatus,
      sla,
      currentResolution:r.currentResolution,feedback:r.feedback,resolutionSummary:r.aiRuns[0]?{aiRunId:r.aiRuns[0].id,requestId:r.id,purpose:'RESOLUTION_SUMMARY' as const,action:null,status:r.aiRuns[0].status,errorCode:r.aiRuns[0].errorCode,createdAt:r.aiRuns[0].createdAt,finishedAt:r.aiRuns[0].finishedAt,contextVersion:r.aiRuns[0].contextVersion,stale:r.currentResolution?.id!==r.aiRuns[0].resolutionId,result:r.aiRuns[0].status==='SUCCEEDED'?r.aiRuns[0].safeResultJson:null,model:r.aiRuns[0].status==='SUCCEEDED'?r.aiRuns[0].model:null,latencyMs:r.aiRuns[0].latencyMs}:null,
      ...(actor.role==='MANAGER'?{manualDraft:r.triageDraftJson,manualDraftRevision:r.manualDraftRevision,reviewKind:r.reviewKind,pendingDraftRevision:r.pendingDraftRevision,pendingRecommendationId:r.pendingRecommendationId}:{}),
    };
  }
  async detail(id:string,actor:AuthenticatedActor) {
    const r=await this.prisma.request.findFirst({where:{id,...this.policy.requestScope(actor)},include:{...relations,checklist:{select:{id:true,version:true,items:{orderBy:{ordinal:'asc'},take:30,select:{id:true,text:true,required:true,completedAt:true,waivedAt:true,waiverReason:true}}}}}});
    this.policy.assertCanReadRequest(actor,r);
    if(!r) throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    const checklist=actor.role==='USER'?null:r.checklist;
    return {...this.view(r,actor,await databaseNow(this.prisma)),...(checklist?{checklist}: {})};
  }
  async list(actor:AuthenticatedActor,input:unknown,kind:'mine'|'queue'|'manager'|'approvals') {
    const {query,where,limit}=pagination(input);
    const filters:Prisma.RequestWhereInput={...(query.status?{status:query.status}:{}),...(query.priority?{priority:query.priority}:{}),...(query.category?{category:query.category}:{}),...(query.assigneeId?{currentAssigneeId:query.assigneeId}:{}),...(query.from||query.to?{createdAt:{gte:query.from?new Date(query.from):undefined,lt:query.to?new Date(query.to):undefined}}:{})};
    const scope:Prisma.RequestWhereInput=kind==='queue'?{status:{in:['ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED']}}:kind==='approvals'?{status:'PENDING_APPROVAL',reviewKind:{in:['AI','MANUAL']}}:{};
    const rows=await this.prisma.request.findMany({where:{AND:[this.policy.requestScope(actor),filters,scope,where]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,include:relations});
    const result=page(rows,limit),now=await databaseNow(this.prisma);
    return {...result,data:result.data.map(r=>this.view(r,actor,now))};
  }
  async history(id:string,actor:AuthenticatedActor,input:unknown) {
    await this.detail(id,actor);
    const {where,limit}=pagination(input);
    const rows=await this.prisma.auditLog.findMany({where:{AND:[{requestId:id,request:this.policy.requestScope(actor),outcome:'SUCCEEDED'},where,{action:{notIn:['MANUAL_DRAFT_SAVED','SLA_POLICY_CHANGED','CHECKLIST_CHANGED']}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,
      select:{id:true,createdAt:true,action:true,actorType:true,actorId:true,messages:{select:{body:true,kind:true}},histories:{select:{fromStatus:true,toStatus:true,requestVersion:true}},resolutions:{select:{cycle:true,rootCause:true,resolution:true,verification:true}}}});
    const result=page(rows,limit);
    return {...result,data:result.data.reverse()};
  }
  async notifications(actor:AuthenticatedActor,input:unknown) {
    const {query,where,limit}=pagination(input);
    const rows=await this.prisma.notification.findMany({where:{AND:[{recipientId:actor.id,...(query.unreadOnly==='true'?{readAt:null}:{})},where]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,
      select:{id:true,requestId:true,type:true,createdAt:true,readAt:true}});
    return page(rows,limit);
  }
  async readNotification(id:string,actor:AuthenticatedActor,read:boolean) {
    const existing=await this.prisma.notification.findFirst({where:{id,recipientId:actor.id},select:{id:true}});
    if(!existing) throw new ApiError(404,'NOT_FOUND','The resource was not found.');
    await this.prisma.notification.updateMany({where:{id,recipientId:actor.id,...(read?{readAt:null}:{})},data:{readAt:read?new Date():null}});
    return this.prisma.notification.findUnique({where:{id},select:{id:true,requestId:true,type:true,readAt:true,createdAt:true}});
  }
}

