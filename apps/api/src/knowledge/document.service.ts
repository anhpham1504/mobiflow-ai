import {Inject,Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {ApiEnvironment} from '@mobiflow/config';
import {z} from 'zod';
import {Prisma,type KnowledgeDocument} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import type {AuthenticatedActor} from '../auth/auth.types.js';
import {API_ENV} from '../tokens.js';
import {ApiError} from '../http.js';
import {page,pagination} from '../requests/request-query.service.js';
import {parse} from '../requests/validation.js';
import {knowledgeIdentity} from './knowledge-access.js';
import {PrivateFileStore} from './file-store.js';
import {validateUpload,type UploadFile} from './parser.js';
import {hash} from './chunker.js';
import {KnowledgeFailure} from './embedding-provider.js';
import {VectorRepository} from './vector.repository.js';

export interface IndexManifest {generation:number;identity:{model:string;digest:string;dimension:number;key:string};chunkerVersion:string;parserVersion:string;chunkCount:number;normalizedHash:string;jobId:string;actorId:string}
export const manifest=(d:KnowledgeDocument)=>d.indexManifestJson as unknown as IndexManifest|null;
@Injectable()
export class DocumentService {
  readonly files:PrivateFileStore;
  constructor(private readonly prisma:PrismaService,private readonly vectors:VectorRepository,@Inject(API_ENV)private readonly env:ApiEnvironment){this.files=new PrivateFileStore(env.KNOWLEDGE_STORAGE_ROOT);}
  private view(d:KnowledgeDocument){const m=manifest(d);return {id:d.id,title:d.title,originalFileName:d.originalFileName,mimeType:d.mimeType,byteSize:Number(d.byteSize),sha256:d.sha256,status:d.status,version:d.version,activeGeneration:d.activeGeneration,pageCount:d.pageCount,chunkCount:m?.chunkCount??0,indexedAt:d.indexedAt,createdAt:d.createdAt,errorCode:d.errorCode,index:m?.identity?{model:m.identity.model,digest:m.identity.digest,dimension:m.identity.dimension,chunkerVersion:m.chunkerVersion,parserVersion:m.parserVersion}:null};}
  async upload(actor:AuthenticatedActor,titleInput:unknown,file:UploadFile|undefined,correlationId:string){
    const {title}=parse(z.object({title:z.string().trim().min(1).max(200)}).strict(),titleInput);
    let validated:ReturnType<typeof validateUpload>;
    try{validated=validateUpload(file);}catch(error){throw this.apiFailure(error);}
    const id=randomUUID(),storageKey=id+(validated.mimeType==='application/pdf'?'.pdf':'.txt'),sha256=hash(file!.buffer);
    await this.prisma.$transaction(tx=>knowledgeIdentity(tx,actor,true));
    const existing=await this.prisma.knowledgeDocument.findUnique({where:{sha256}});
    if(existing)throw new ApiError(409,'DUPLICATE_DOCUMENT','Identical document already exists: '+existing.id);
    try{await this.files.put(storageKey,file!.buffer);}catch{throw new ApiError(503,'STORAGE_UNAVAILABLE','Document storage is unavailable.');}
    let committed=false;
    try{
      const row=await this.prisma.$transaction(async tx=>{
        await knowledgeIdentity(tx,actor,true);
        const d=await tx.knowledgeDocument.create({data:{id,title,originalFileName:validated.name,mimeType:validated.mimeType,byteSize:file!.buffer.length,sha256,storageKey,uploadedById:actor.id,status:'UPLOADED',deadlineAt:new Date(Date.now()+this.env.KNOWLEDGE_JOB_TIMEOUT_MS),indexManifestJson:{jobId:randomUUID(),actorId:actor.id}}});
        await this.audit(tx,d,actor,'KNOWLEDGE_UPLOADED',correlationId);return d;
      });committed=true;return this.view(row);
    }catch(error){
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){
        const duplicate=await this.prisma.knowledgeDocument.findUnique({where:{sha256}});
        if(duplicate)throw new ApiError(409,'DUPLICATE_DOCUMENT','Identical document already exists: '+duplicate.id);
      }
      throw error;
    }finally{if(!committed)await this.files.discardUnpublished(storageKey);}
  }
  async list(actor:AuthenticatedActor,input:unknown){
    const query=parse(z.object({limit:z.string().optional(),cursor:z.string().optional()}).strict(),input),p=pagination(query);
    return this.prisma.$transaction(async tx=>{
      await knowledgeIdentity(tx,actor);
      const rows=await tx.knowledgeDocument.findMany({where:{AND:[p.where,actor.role==='STAFF'?{status:'READY'}:{}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:p.limit+1});
      const result=page(rows,p.limit);return {...result,data:result.data.map(d=>this.view(d))};
    });
  }
  async detail(id:string,actor:AuthenticatedActor){
    return this.prisma.$transaction(async tx=>{await knowledgeIdentity(tx,actor);const d=await this.allowed(tx,id,actor);const sources=d.status==='READY'&&d.activeGeneration!==null?await this.vectors.documentSources(tx,id,d.activeGeneration):[];return {...this.view(d),sources};});
  }
  private async allowed(tx:Prisma.TransactionClient,id:string,actor:AuthenticatedActor){
    const row=await tx.knowledgeDocument.findFirst({where:{id,...(actor.role==='STAFF'?{status:'READY'}:{})}});
    if(!row)throw new ApiError(404,'NOT_FOUND','The resource was not found.');return row;
  }
  async content(id:string,actor:AuthenticatedActor){
    const d=await this.prisma.$transaction(async tx=>{await knowledgeIdentity(tx,actor);return this.allowed(tx,id,actor);});
    let bytes:Buffer;try{bytes=await this.files.get(d.storageKey);}catch{throw new ApiError(503,'STORAGE_UNAVAILABLE','Document storage is unavailable.');}
    // Reauthorize after filesystem I/O; a disable while reading cannot reveal stale staff content.
    await this.prisma.$transaction(async tx=>{await knowledgeIdentity(tx,actor);await this.allowed(tx,id,actor);});
    return {bytes,mimeType:d.mimeType,name:d.originalFileName};
  }
  async command(id:string,actor:AuthenticatedActor,expectedVersion:number,kind:'reindex'|'disable',correlationId:string,reason?:string){
    return this.prisma.$transaction(async tx=>{
      await knowledgeIdentity(tx,actor,true);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "KnowledgeDocument" WHERE "id"=${id}::uuid FOR UPDATE`);
      const d=await this.allowed(tx,id,actor);
      if(d.version!==expectedVersion)throw new ApiError(409,'STALE_VERSION','Reload the document before retrying.');
      if(kind==='reindex'&&['UPLOADED','PROCESSING'].includes(d.status))throw new ApiError(409,'INDEXING_ACTIVE','The document already has an active job.');
      const row=await tx.knowledgeDocument.update({where:{id,version:expectedVersion},data:{version:{increment:1},status:kind==='disable'?'DISABLED':'PROCESSING',leaseUntil:null,deadlineAt:kind==='disable'?null:new Date(Date.now()+this.env.KNOWLEDGE_JOB_TIMEOUT_MS),errorCode:null,errorSummary:null,...(kind==='reindex'?{indexManifestJson:{...d.indexManifestJson as Prisma.JsonObject,jobId:randomUUID(),actorId:actor.id}}:{})}});
      await this.audit(tx,row,actor,kind==='disable'?'KNOWLEDGE_DISABLED':d.status==='DISABLED'?'KNOWLEDGE_REACTIVATED':'KNOWLEDGE_REINDEXED',correlationId,reason);
      return this.view(row);
    });
  }
  private audit(tx:Prisma.TransactionClient,d:KnowledgeDocument,actor:AuthenticatedActor,action:string,correlationId:string,reason?:string){return tx.auditLog.create({data:{actorType:actor.role,actorId:actor.id,action,resourceType:'KnowledgeDocument',resourceId:d.id,requestCorrelationId:correlationId,safeAfterJson:{status:d.status,version:d.version,sha256:d.sha256},reason,outcome:'SUCCEEDED'}});}
  private apiFailure(error:unknown){
    const code=error instanceof KnowledgeFailure?error.code:'INVALID_DOCUMENT';
    return new ApiError(code==='FILE_TOO_LARGE'||code==='EXTRACTED_TEXT_TOO_LARGE'?413:code==='UNSUPPORTED_DOCUMENT'?415:400,code,'Upload one valid UTF-8 TXT or text PDF, at most 10 MiB.');
  }
}
