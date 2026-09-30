import {Inject,Injectable,type OnModuleDestroy,type OnModuleInit} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {ApiEnvironment} from '@mobiflow/config';
import {Prisma} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {assessSla} from './sla-clock.js';
import {databaseNow} from './sla-sql.js';
import {API_ENV} from '../tokens.js';

@Injectable()
export class SlaMonitorService implements OnModuleInit,OnModuleDestroy{
  private timer?:ReturnType<typeof setInterval>;private running:Promise<{scanned:number;events:number}>|null=null;
  constructor(private readonly prisma:PrismaService,@Inject(API_ENV)private readonly env:ApiEnvironment){}
  onModuleInit(){if(this.env.NODE_ENV!=='test'){this.timer=setInterval(()=>{void this.tick().catch(()=>undefined);},30000);this.timer.unref();void this.tick().catch(()=>undefined);}}
  async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await this.running;}
  tick(at?:Date){if(this.running)return this.running;this.running=this.sweep(at).finally(()=>{this.running=null;});return this.running;}
  private async sweep(at?:Date){
    const now=at??await databaseNow(this.prisma);const rows=await this.prisma.slaInstance.findMany({where:{stoppedAt:null,request:{status:{in:['ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED']}},OR:[{status:{in:['SAFE','AT_RISK']}},{breachedAt:null}]},orderBy:[{dueAt:'asc'},{id:'asc'}],take:200,select:{id:true,requestId:true,version:true,request:{select:{status:true,currentAssigneeId:true}},startedAt:true,dueAt:true,targetSeconds:true,pausedAt:true,totalPausedSeconds:true,resolvedHoldAt:true,totalResolvedHoldSeconds:true,stoppedAt:true,stopReason:true,status:true,breachedAt:true,assessedAt:true}});let events=0;
    for(const row of rows){const assessment=assessSla(row,now);if(assessment.status===row.status&&assessment.breachedAt?.getTime()===row.breachedAt?.getTime()&&!['AT_RISK','BREACHED'].includes(assessment.status)){await this.prisma.slaInstance.updateMany({where:{id:row.id,version:row.version},data:{assessedAt:assessment.assessedAt,version:{increment:1}}});continue;}
      if(!['AT_RISK','BREACHED'].includes(assessment.status)){await this.prisma.slaInstance.updateMany({where:{id:row.id,version:row.version},data:{status:assessment.status,breachedAt:assessment.breachedAt,assessedAt:assessment.assessedAt,dueAt:assessment.dueAt,version:{increment:1}}});continue;}
      const recipients=[...(row.request.currentAssigneeId?[row.request.currentAssigneeId]:[]),...(await this.prisma.user.findMany({where:{role:'MANAGER',active:true},select:{id:true}})).map(u=>u.id)];
      const notified=new Set((await this.prisma.notification.findMany({where:{slaInstanceId:row.id,warningLevel:assessment.status,recipientId:{in:recipients}},select:{recipientId:true}})).map(n=>n.recipientId));
      const missing=recipients.filter(id=>!notified.has(id));
      if(!missing.length){await this.prisma.slaInstance.updateMany({where:{id:row.id,version:row.version},data:{assessedAt:assessment.assessedAt,status:assessment.status,breachedAt:assessment.breachedAt,dueAt:assessment.dueAt,version:{increment:1}}});continue;}
      await this.prisma.$transaction(async tx=>{
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SlaInstance" WHERE "id"=${row.id}::uuid FOR UPDATE`);
        const current=await tx.slaInstance.findUnique({where:{id:row.id},include:{request:true}});
        if(!current||current.version!==row.version||current.request.status!==row.request.status||current.request.currentAssigneeId!==row.request.currentAssigneeId)return;
        const eventId=randomUUID();
        await tx.auditLog.create({data:{id:eventId,requestId:row.requestId,actorType:'SYSTEM',action:'SLA_'+assessment.status,resourceType:'SlaInstance',resourceId:row.id,requestCorrelationId:eventId,safeBeforeJson:{status:row.status},safeAfterJson:{status:assessment.status,assessedAt:assessment.assessedAt.toISOString()},outcome:'SUCCEEDED',createdAt:now}});
        await tx.slaInstance.update({where:{id:row.id},data:{status:assessment.status,breachedAt:assessment.breachedAt,assessedAt:assessment.assessedAt,dueAt:assessment.dueAt,version:{increment:1}}});
        const notices=[...new Set(missing)].map(recipientId=>({recipientId,requestId:row.requestId,eventId,type:'SLA_'+assessment.status,safeActorMetadataJson:{actorType:'SYSTEM'},slaInstanceId:row.id,warningLevel:assessment.status,createdAt:now}));
        await tx.notification.createMany({data:notices,skipDuplicates:true});events++;
      });
    }return {scanned:rows.length,events};
  }
}
