import {Inject,Injectable} from '@nestjs/common';
import type {ApiEnvironment} from '@mobiflow/config';
import type {Source} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {API_ENV} from '../tokens.js';
import {EMBEDDING_PROVIDER,KnowledgeFailure,type EmbeddingProvider,type EmbeddingIdentity} from './embedding-provider.js';
import {VectorRepository} from './vector.repository.js';
import {LexicalRepository,lexicalIdentity} from './lexical.repository.js';
import {hash} from './chunker.js';
import {exactEvidenceSpan} from './excerpt.js';
export const retrievalVersion='cosine-exact.v1';
export const lexicalRetrievalVersion='postgres-simple-trgm.v1';
export interface Retrieval {sources:Source[];identity:EmbeddingIdentity;retrievalMode:'lexical'|'vector';queryHash:string;queryChars:number;queryTruncated:boolean;configVersion:string;topK:number;maxDistance:number;embeddingMs:number;retrievalMs:number}
export function buildContext(candidates:Source[],maxChars=6000):Source[]{
  const ids=new Set<string>(),hashes=new Set<string>();const result:Source[]=[];let size=0;
  for(const source of candidates){
    if(!exactEvidenceSpan(source.excerpt,500,[source.title,source.section??'',source.sourceId]))continue;
    if(ids.has(source.sourceId)||hashes.has(source.contentHash)||result.some(s=>s.documentId===source.documentId&&s.generation===source.generation&&s.pageNumber===source.pageNumber&&s.excerpt.includes(source.excerpt)))continue;
    const chars=Array.from(source.excerpt).length;if(chars>1200||size+chars>maxChars)continue;
    if(!chars||source.contentHash!==hash(source.excerpt))throw new KnowledgeFailure('INVALID_SOURCE');
    result.push(source);ids.add(source.sourceId);hashes.add(source.contentHash);size+=chars;if(result.length===5)break;
  }
  return result;
}
@Injectable()
export class KnowledgeRetriever {
  constructor(private readonly prisma:PrismaService,private readonly vectors:VectorRepository,@Inject(EMBEDDING_PROVIDER)private readonly embeddings:EmbeddingProvider,@Inject(API_ENV)private readonly env:ApiEnvironment,private readonly lexical:LexicalRepository){}
  async search(query:string,signal:AbortSignal,topK=this.env.RAG_TOP_K):Promise<Retrieval>{
    if(!query.trim()||Array.from(query).length>2000)throw new KnowledgeFailure('INVALID_QUERY');
    const started=performance.now();
    if(this.env.RAG_RETRIEVAL_MODE==='lexical'){
      const candidates=await this.lexical.search(query,topK),sources=buildContext(candidates.filter(source=>source.distance<=this.env.RAG_MAX_DISTANCE),this.env.RAG_CONTEXT_CHARS);
      if(signal.aborted)throw new KnowledgeFailure('RETRIEVAL_TIMEOUT');
      return {sources,identity:lexicalIdentity,retrievalMode:'lexical',queryHash:hash(query),queryChars:Array.from(query).length,queryTruncated:false,configVersion:lexicalRetrievalVersion,topK,maxDistance:this.env.RAG_MAX_DISTANCE,embeddingMs:0,retrievalMs:Math.round(performance.now()-started)};
    }
    const result=await this.embeddings.embedQuery(query,signal);
    if(signal.aborted)throw new KnowledgeFailure('RETRIEVAL_TIMEOUT');
    const sources=buildContext(await this.vectors.search(result.vectors[0]!,result.identity,topK),this.env.RAG_CONTEXT_CHARS);
    if(signal.aborted)throw new KnowledgeFailure('RETRIEVAL_TIMEOUT');
    return {sources,identity:result.identity,retrievalMode:'vector',queryHash:hash(query),queryChars:Array.from(query).length,queryTruncated:false,configVersion:retrievalVersion,topK,maxDistance:this.env.RAG_MAX_DISTANCE,embeddingMs:result.latencyMs,retrievalMs:Math.round(performance.now()-started)};
  }
  compatible(identity:EmbeddingIdentity,tx:Prisma.TransactionClient=this.prisma){return this.env.RAG_RETRIEVAL_MODE==='lexical'?(identity.key!==lexicalIdentity.key?Promise.reject(new KnowledgeFailure('INDEX_MODEL_MISMATCH')):this.lexical.compatible(tx)):this.vectors.compatible(identity,tx);}
  validateCurrent(tx:Prisma.TransactionClient,sources:Source[],lock=true){return this.env.RAG_RETRIEVAL_MODE==='lexical'?this.lexical.validateCurrent(tx,sources,lock):this.vectors.validateCurrent(tx,sources,lock);}
  async forAnalysis(runId:string,description:string,signal:AbortSignal){
    // Full original request stays in the LLM input. Retrieval's smaller query is
    // deterministic and the omission is explicit in the persisted snapshot.
    const points=Array.from(description),query=points.slice(0,2000).join('');
    const result=await this.search(query,AbortSignal.any([signal,AbortSignal.timeout(30000)]));result.queryTruncated=points.length>2000;
    await this.prisma.$transaction(async tx=>{
      const run=await tx.aiRun.findUniqueOrThrow({where:{id:runId}});
      if(run.status!=='RUNNING')throw new KnowledgeFailure('KNOWLEDGE_CANCELED');
      const snapshot={...run.retrievalSnapshotJson as Prisma.JsonObject,...snapshotOf(result)};
      await tx.aiRun.update({where:{id:runId},data:{retrievalSnapshotJson:snapshot,promptVersion:'request-analysis-rag.v1'}});
      await tx.auditLog.create({data:{requestId:run.requestId,actorType:'SYSTEM',initiatingActorId:run.initiatingActorId,action:'KNOWLEDGE_RETRIEVED',resourceType:'AiRun',resourceId:runId,requestCorrelationId:runId,safeAfterJson:{sourceIds:result.sources.map(s=>s.sourceId),queryHash:result.queryHash,retrievalMode:result.retrievalMode,model:result.identity.model,embeddingMs:result.embeddingMs,retrievalMs:result.retrievalMs},outcome:'SUCCEEDED'}});
    });return result;
  }
}
export function snapshotOf(r:Retrieval){return {identity:{...r.identity},retrievalMode:r.retrievalMode,queryHash:r.queryHash,queryChars:r.queryChars,queryTruncated:r.queryTruncated,configVersion:r.configVersion,topK:r.topK,maxDistance:r.maxDistance,embeddingMs:r.embeddingMs,retrievalMs:r.retrievalMs,sources:r.sources.map(({excerpt:_excerpt,...s})=>{void _excerpt;return s;})};}
