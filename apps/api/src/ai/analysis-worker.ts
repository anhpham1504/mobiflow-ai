import {Inject,Injectable,type OnModuleInit,type OnModuleDestroy} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';
import {RequestStateMachineService} from '../requests/request-state-machine.service.js';
import {AI_PROVIDER_TOKEN,AI_LOG,AI_WORKER_ENABLED,normalizedFailure,type AiProvider} from './provider.js';
import type {LogSink} from '../http.js';
import {executeAnalysis} from './analysis-execution.js';
import type {ApiEnvironment} from '@mobiflow/config';
import {API_ENV} from '../tokens.js';
import {KnowledgeRetriever} from '../knowledge/retriever.js';
import {KnowledgeFailure} from '../knowledge/embedding-provider.js';
import {RecommendationService} from './recommendation.service.js';
import {RequestVectors} from './tools/request-vectors.js';

@Injectable()
export class AnalysisWorker implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  private running:Promise<void>|null=null;
  private controller?:AbortController;
  private stopped=false;
  constructor(private readonly prisma:PrismaService,private readonly machine:RequestStateMachineService,@Inject(AI_PROVIDER_TOKEN)private readonly provider:AiProvider,@Inject(AI_LOG)private readonly log:LogSink,@Inject(AI_WORKER_ENABLED)private readonly enabled:boolean,private readonly retriever:KnowledgeRetriever,@Inject(API_ENV)private readonly env:ApiEnvironment,private readonly recommendations:RecommendationService,private readonly requestVectors:RequestVectors){}
  onModuleInit(){if(this.enabled){this.timer=setInterval(()=>{void this.tick();},1000);this.timer.unref();void this.tick();}}
  async onModuleDestroy(){this.stopped=true;if(this.timer)clearInterval(this.timer);this.controller?.abort();await this.running;}
  tick():Promise<void>{
    if(this.stopped||this.running)return this.running??Promise.resolve();
    this.running=this.cycle().catch(()=>{this.log({event:'ai.worker.failed',errorCode:'AI_PERSISTENCE_UNAVAILABLE'});}).finally(()=>{this.running=null;});return this.running;
  }
  private async cycle(){
    const expired=await this.prisma.aiRun.findMany({where:{purpose:'ANALYSIS',status:{in:['QUEUED','RUNNING']},OR:[{deadlineAt:{lte:new Date()}},{status:'RUNNING',leaseUntil:{lte:new Date()}}]},orderBy:{createdAt:'asc'},take:20});
    for(const run of expired)await this.machine.finishAnalysis(run.id,undefined,'AI_TIMEOUT');
    if(this.stopped)return;
    const next=await this.prisma.aiRun.findFirst({where:{purpose:'ANALYSIS',status:'QUEUED'},orderBy:[{createdAt:'asc'},{id:'asc'}]});
    if(!next){
      const controller=new AbortController();this.controller=controller;
      try{if(!await this.recommendations.cycle(controller.signal))await this.requestVectors.next(AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]));}
      catch{this.log({event:'request.embedding.deferred',errorCode:'REQUEST_EMBEDDING_UNAVAILABLE'});}
      finally{this.controller=undefined;}return;
    }
    const job=await this.machine.claimAnalysis(next.id);if(!job)return;
    const start=performance.now(),controller=new AbortController();this.controller=controller;
    const deadline=AbortSignal.timeout(Math.max(1,job.run.deadlineAt!.getTime()-Date.now()));
    const signal=AbortSignal.any([controller.signal,deadline]);
    // Cancellation is persisted by the state machine; promptly stop wasted generation.
    const watcher=setInterval(()=>{
      void this.prisma.aiRun.findUnique({where:{id:job.run.id},select:{status:true}}).then(r=>{if(r?.status!=='RUNNING')controller.abort();}).catch(()=>controller.abort());
    },500);watcher.unref();
    this.log({event:'ai.run.started',runId:job.run.id,requestId:job.run.requestId,provider:job.run.provider,model:job.run.model});
    let generated=false;
    try{
      if(this.env.AI_RAG_ENABLED)job.input.retrieval=await this.retriever.forAnalysis(job.run.id,job.input.description,signal);
      const result=await executeAnalysis(this.provider,job.input,signal,async attempt=>{
        await this.prisma.aiRun.updateMany({where:{id:job.run.id,status:'RUNNING'},data:{retryCount:attempt}});
        this.log({event:'ai.run.attempt',runId:job.run.id,attempt:attempt+1});
      });
      result.latencyMs=Math.round(performance.now()-start);
      generated=true;await this.machine.finishAnalysis(job.run.id,result);
    }catch(error){
      const code=error instanceof KnowledgeFailure?error.code:generated?'AI_PERSISTENCE_UNAVAILABLE':deadline.aborted?'AI_TIMEOUT':normalizedFailure(error,signal).code;
      // If this transaction also fails, the durable lease remains recoverable.
      await this.machine.finishAnalysis(job.run.id,undefined,code,Math.round(performance.now()-start));
    }finally{clearInterval(watcher);this.controller=undefined;}
    const final=await this.prisma.aiRun.findUnique({where:{id:job.run.id},select:{status:true,errorCode:true,latencyMs:true,retryCount:true}});
    this.log({event:'ai.run.finished',runId:job.run.id,requestId:job.run.requestId,...final});
  }
}
