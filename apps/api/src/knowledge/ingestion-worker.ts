import {Inject,Injectable,type OnModuleInit,type OnModuleDestroy} from '@nestjs/common';
import type {ApiEnvironment} from '@mobiflow/config';
import {Prisma,type KnowledgeDocument} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {API_ENV} from '../tokens.js';
import {AI_LOG} from '../ai/provider.js';
import type {LogSink} from '../http.js';
import {DocumentService,manifest} from './document.service.js';
import {VectorRepository} from './vector.repository.js';
import {EMBEDDING_PROVIDER,KNOWLEDGE_WORKER_ENABLED,KnowledgeFailure,type EmbeddingProvider,type EmbeddingIdentity} from './embedding-provider.js';
import {extract} from './parser.js';
import {chunkPages,chunkerVersion,parserVersion,hash,normalize} from './chunker.js';
@Injectable()
export class IngestionWorker implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;private running:Promise<void>|null=null;private controller?:AbortController;private stopped=false;
  constructor(private readonly prisma:PrismaService,private readonly documents:DocumentService,private readonly vectors:VectorRepository,@Inject(EMBEDDING_PROVIDER)private readonly embeddings:EmbeddingProvider,@Inject(API_ENV)private readonly env:ApiEnvironment,@Inject(KNOWLEDGE_WORKER_ENABLED)private readonly enabled:boolean,@Inject(AI_LOG)private readonly log:LogSink){}
  onModuleInit(){if(this.enabled){this.timer=setInterval(()=>{void this.tick();},1000);this.timer.unref();void this.tick();}}
  async onModuleDestroy(){this.stopped=true;if(this.timer)clearInterval(this.timer);this.controller?.abort();await this.running;}
  tick(){if(this.stopped||this.running)return this.running??Promise.resolve();return this.running=this.cycle().catch(()=>this.log({event:'knowledge.worker.failed',errorCode:'KNOWLEDGE_PERSISTENCE_UNAVAILABLE'})).finally(()=>{this.running=null;});}
  private async claim(){return this.prisma.$transaction(async tx=>{
    // DB advisory lock serializes claims across accidental duplicate API processes.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(500501)::text`;
    const expired=await tx.knowledgeDocument.findMany({where:{status:{in:['UPLOADED','PROCESSING']},OR:[{deadlineAt:{lte:new Date()}},{leaseUntil:{lte:new Date()}}]},take:20});
    for(const d of expired)await this.fail(tx,d,'INDEX_TIMEOUT');
    if(await tx.knowledgeDocument.count({where:{status:'PROCESSING',leaseUntil:{gt:new Date()}}}))return null;
    const d=await tx.knowledgeDocument.findFirst({where:{OR:[{status:'UPLOADED'},{status:'PROCESSING',leaseUntil:null}],deadlineAt:{gt:new Date()}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
    if(!d)return null;
    const updated=await tx.knowledgeDocument.updateMany({where:{id:d.id,version:d.version,status:d.status},data:{status:'PROCESSING',version:{increment:1},leaseUntil:d.deadlineAt}});
    if(!updated.count)return null;
    return {...d,status:'PROCESSING' as const,version:d.version+1,leaseUntil:d.deadlineAt};
  });}
  private async fail(tx:Prisma.TransactionClient,d:KnowledgeDocument,code:string){
    const changed=await tx.knowledgeDocument.updateMany({where:{id:d.id,version:d.version,status:{in:['UPLOADED','PROCESSING']}},data:{status:'FAILED',version:{increment:1},leaseUntil:null,errorCode:code,errorSummary:'Indexing failed. Restore dependencies or replace invalid input, then retry.'}});
    if(changed.count)await this.audit(tx,d,'KNOWLEDGE_INDEX_FAILED','FAILED',{errorCode:code});
  }
  private audit(tx:Prisma.TransactionClient,d:KnowledgeDocument,action:string,outcome:'SUCCEEDED'|'FAILED',data:Prisma.InputJsonObject){return tx.auditLog.create({data:{actorType:'SYSTEM',initiatingActorId:manifest(d)?.actorId??d.uploadedById,action,resourceType:'KnowledgeDocument',resourceId:d.id,requestCorrelationId:manifest(d)!.jobId,safeAfterJson:data,outcome}});}
  private async cycle(){
    const d=await this.claim();if(!d||this.stopped)return;
    const controller=new AbortController();this.controller=controller;
    const deadline=AbortSignal.timeout(Math.max(1,d.deadlineAt!.getTime()-Date.now())),signal=AbortSignal.any([deadline,controller.signal]),started=performance.now();
    const watcher=setInterval(()=>{void this.prisma.knowledgeDocument.findUnique({where:{id:d.id},select:{status:true,version:true}}).then(current=>{if(current?.status!=='PROCESSING'||current.version!==d.version)controller.abort();}).catch(()=>controller.abort());},500);watcher.unref();
    try{
      const bytes=await this.documents.files.get(d.storageKey);
      if(hash(bytes)!==d.sha256)throw new KnowledgeFailure('SOURCE_FILE_CHANGED');
      const pages=await extract(bytes,d.mimeType,signal),chunks=chunkPages(pages);
      const generation=(await this.prisma.knowledgeChunk.aggregate({where:{documentId:d.id},_max:{generation:true}}))._max.generation??0;
      let identity:EmbeddingIdentity|undefined;const vectors:number[][]=[];let embeddingMs=0;
      for(let i=0;i<chunks.length;i+=this.env.EMBEDDING_BATCH_SIZE){
        const result=await this.embeddings.embedDocuments(chunks.slice(i,i+this.env.EMBEDDING_BATCH_SIZE).map(c=>c.content),signal,identity);
        if(identity&&identity.key!==result.identity.key)throw new KnowledgeFailure('INDEX_MODEL_MISMATCH');
        identity=result.identity;await this.vectors.compatible(identity);vectors.push(...result.vectors);embeddingMs+=result.latencyMs;
      }
      if(!identity||vectors.length!==chunks.length||signal.aborted)throw new KnowledgeFailure('INCOMPLETE_EMBEDDING');
      const index={generation:generation+1,identity:{...identity},chunkerVersion,parserVersion,chunkCount:chunks.length,normalizedHash:hash(pages.map(p=>normalize(p.text)).join('\f')),jobId:manifest(d)!.jobId,actorId:manifest(d)!.actorId??d.uploadedById};
      await this.prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(500501)::text`;
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "KnowledgeDocument" WHERE id=${d.id}::uuid FOR UPDATE`);
        const current=await tx.knowledgeDocument.findUniqueOrThrow({where:{id:d.id}}),actor=await tx.user.findUnique({where:{id:index.actorId}});
        if(current.status!=='PROCESSING'||current.version!==d.version)throw new KnowledgeFailure('STALE_DOCUMENT');
        if(!actor?.active||actor.role!=='MANAGER')throw new KnowledgeFailure('FORBIDDEN');
        if(signal.aborted||!current.deadlineAt||current.deadlineAt<=new Date())throw new KnowledgeFailure('INDEX_TIMEOUT');
        await this.vectors.compatible(identity!,tx);
        await this.vectors.insert(tx,d.id,index.generation,chunks,vectors,identity!,{...index,documentHash:d.sha256});
        await tx.knowledgeDocument.update({where:{id:d.id,version:d.version},data:{status:'READY',version:{increment:1},activeGeneration:index.generation,pageCount:d.mimeType==='application/pdf'?pages.length:null,indexManifestJson:index,indexedAt:new Date(),leaseUntil:null,errorCode:null,errorSummary:null}});
        await this.audit(tx,d,'KNOWLEDGE_INDEX_READY','SUCCEEDED',{generation:index.generation,chunkCount:chunks.length,model:identity!.model,dimension:identity!.dimension,embeddingMs,latencyMs:Math.round(performance.now()-started)});
      },{timeout:30000});
      this.log({event:'knowledge.index.ready',documentId:d.id,generation:index.generation,chunkCount:chunks.length,model:identity.model,dimension:identity.dimension,embeddingMs,latencyMs:Math.round(performance.now()-started)});
    }catch(error){const code=deadline.aborted?'INDEX_TIMEOUT':error instanceof KnowledgeFailure?error.code:'INDEX_FAILED';await this.prisma.$transaction(tx=>this.fail(tx,d,code));this.log({event:'knowledge.index.failed',documentId:d.id,errorCode:code});}
    finally{clearInterval(watcher);this.controller=undefined;}
  }
}
