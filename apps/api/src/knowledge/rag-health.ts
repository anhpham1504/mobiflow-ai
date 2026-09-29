import {Inject,Injectable,type OnModuleInit,type OnModuleDestroy} from '@nestjs/common';
import type {ApiEnvironment} from '@mobiflow/config';
import {API_ENV} from '../tokens.js';
import {PrismaService} from '../database/prisma.service.js';
import {VectorRepository} from './vector.repository.js';
import {EMBEDDING_PROVIDER,KnowledgeFailure,type EmbeddingProvider} from './embedding-provider.js';
@Injectable()
export class RagHealth implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;private pending?:Promise<void>;private controller=new AbortController();
  private state={status:'NOT_READY' as 'READY'|'NOT_READY',embedding:'NOT_VERIFIED' as string,knowledge:'NOT_VERIFIED' as string,errorCode:null as string|null,documents:0,chunks:0,checkedAt:null as string|null};
  constructor(private readonly prisma:PrismaService,private readonly vectors:VectorRepository,@Inject(EMBEDDING_PROVIDER)private readonly provider:EmbeddingProvider,@Inject(API_ENV)private readonly env:ApiEnvironment){}
  onModuleInit(){if(this.env.NODE_ENV!=='test'&&this.env.AI_RAG_ENABLED){this.timer=setInterval(()=>{void this.refresh();},30000);this.timer.unref();void this.refresh();}}
  async onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.controller.abort();await this.pending;}
  view(){return {enabled:this.env.AI_RAG_ENABLED,...this.state,...(!this.env.AI_RAG_ENABLED?{status:'DISABLED' as const}:{})};}
  refresh(){return this.pending??=this.probe().finally(()=>{this.pending=undefined;});}
  private async probe(){
    const state={...this.state,status:'NOT_READY' as 'READY'|'NOT_READY',embedding:'DOWN',knowledge:'NOT_READY',errorCode:null as string|null,documents:0,chunks:0,checkedAt:new Date().toISOString()};
    try{
      const result=await this.provider.probe(AbortSignal.any([this.controller.signal,AbortSignal.timeout(30000)]));state.embedding='UP';
      await this.vectors.compatible(result.identity);
      state.documents=await this.prisma.knowledgeDocument.count({where:{status:'READY'}});
      const counts=await this.prisma.$queryRaw<{count:number}[]>`SELECT count(*)::int AS count FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId" WHERE d.status='READY' AND d."activeGeneration"=c.generation`;
      state.chunks=counts[0]!.count;
      state.knowledge=state.documents?'READY':'EMPTY';state.status=state.documents?'READY':'NOT_READY';
    }catch(error){state.errorCode=error instanceof KnowledgeFailure?error.code:'VECTOR_UNAVAILABLE';}
    this.state=state;
  }
}
