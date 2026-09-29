import {Injectable} from '@nestjs/common';
import {z} from 'zod';
import {sourceIdSchema,groundingSchema,citationSchema,type Source} from '@mobiflow/contracts';
import {PrismaService} from '../database/prisma.service.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import type {Prisma} from '../generated/prisma/client.js';
import {knowledgeIdentity} from './knowledge-access.js';
import {ApiError} from '../http.js';
import {parse} from '../requests/validation.js';
@Injectable()
export class SourceService {
  constructor(private readonly prisma:PrismaService){}
  private map(row:Prisma.KnowledgeChunkGetPayload<{include:{document:true}}>):Source{return {sourceId:row.sourceId,chunkId:row.id,documentId:row.documentId,generation:row.generation,title:row.document.title,pageNumber:row.pageNumber,section:row.section,excerpt:row.content,contentHash:row.contentHash,score:0,distance:1,unavailableForLiveUse:row.document.status!=='READY'||row.document.activeGeneration!==row.generation};}
  async get(id:string,actor:AuthenticatedActor,historical=false){
    parse(sourceIdSchema,id);
    return this.prisma.$transaction(async tx=>{
      await knowledgeIdentity(tx,actor);
      if(historical&&actor.role!=='MANAGER')throw new ApiError(403,'FORBIDDEN','Historical evidence is restricted to managers.');
      const row=await tx.knowledgeChunk.findUnique({where:{sourceId:id},include:{document:true}});
      if(!row)throw new ApiError(404,'NOT_FOUND','The source was not found.');
      const result=this.map(row);
      if(result.unavailableForLiveUse&&!historical)throw new ApiError(404,'NOT_FOUND','The source was not found.');
      return result;
    });
  }
  async grounding(value:Prisma.JsonValue|null,actor:AuthenticatedActor){
    if(actor.role==='USER')return undefined;
    const saved=z.object({mode:z.enum(['RAG','NON_RAG']),evidenceStatus:z.enum(['SUFFICIENT','INSUFFICIENT_EVIDENCE','NOT_REQUESTED']),citations:z.array(citationSchema).max(5)}).safeParse(value);
    if(!saved.success)return {mode:'NON_RAG' as const,evidenceStatus:'NOT_REQUESTED' as const,citations:[]};
    return this.prisma.$transaction(async tx=>{
      await knowledgeIdentity(tx,actor);
      const rows=await tx.knowledgeChunk.findMany({where:{sourceId:{in:saved.data.citations.map(c=>c.sourceId)}},include:{document:true}});
      const citations=saved.data.citations.flatMap(c=>{const row=rows.find(r=>r.sourceId===c.sourceId);if(!row)return [];const source=this.map(row);return source.unavailableForLiveUse?[]:[{...c,source}];});
      return groundingSchema.parse({...saved.data,evidenceStatus:citations.length!==saved.data.citations.length?'UNAVAILABLE':saved.data.evidenceStatus,citations});
    });
  }
}
