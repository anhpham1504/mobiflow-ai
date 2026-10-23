import {Inject,Injectable} from '@nestjs/common';
import {createHash,randomUUID} from 'node:crypto';
import type {SimilarCase} from '@mobiflow/contracts';
import {Prisma} from '../../generated/prisma/client.js';
import {PrismaService} from '../../database/prisma.service.js';
import {EMBEDDING_PROVIDER,KnowledgeFailure,validateVector,type EmbeddingProvider,type EmbeddingIdentity} from '../../knowledge/embedding-provider.js';
import {isDatabaseUnavailable} from '../../http.js';
import type {ApiEnvironment} from '@mobiflow/config';
import {API_ENV} from '../../tokens.js';
import {lexicalIdentity} from '../../knowledge/lexical.repository.js';

export const requestInputVersion='request-title-description-head.v1';
export function requestEmbeddingInput(title:string,description:string){
  const full=(title+'\n'+description).normalize('NFC').trim(),points=Array.from(full),text=points.slice(0,2000).join('');
  return {text,truncated:points.length>2000,hash:createHash('sha256').update(text).digest('hex'),inputVersion:requestInputVersion};
}
export const normalizeLocation=(s:string|null)=>s?.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase()??null;
export function similarityScore(cosine:number,category:boolean,location:boolean,ageMinutes:number,windowMinutes:number){
  const vector=Math.max(0,Math.min(1,(cosine+1)/2)),recency=Math.max(0,Math.min(1,1-ageMinutes/windowMinutes));
  const scoreComponents={cosineSimilarity:cosine,vector,category:category?1:0,location:location?1:0,recency};
  return {score:.6*vector+.2*scoreComponents.category+.1*scoreComponents.location+.1*recency,scoreComponents};
}
@Injectable()
export class RequestVectors {
  private identity?:EmbeddingIdentity;
  private probedAt=0;
  private state:'READY'|'RETRY_WAIT'|'BLOCKED'|'STOPPED'='READY';
  private failureCount=0;
  private errorCode:string|null=null;
  private nextRetryAt=0;
  private cursor='00000000-0000-0000-0000-000000000000';
  private busy=false;
  private observation:{correlationId:string;stage:string;requestId:string|null;contextVersion:number|null;category:string|null;errorType:string|null}|null=null;
  get backfillStatus(){return {...this.observation,state:this.env.RAG_RETRIEVAL_MODE==='lexical'?'STOPPED':this.state,failureCount:this.failureCount,errorCode:this.errorCode,nextRetryAt:this.nextRetryAt?new Date(this.nextRetryAt).toISOString():null,attemptTimeoutMs:30000,maxBackoffMs:60000};}
  constructor(private readonly prisma:PrismaService,@Inject(EMBEDDING_PROVIDER)private readonly embeddings:EmbeddingProvider,@Inject(API_ENV)private readonly env:Pick<ApiEnvironment,'RAG_RETRIEVAL_MODE'>={RAG_RETRIEVAL_MODE:'vector'}){}
  async index(requestId:string,signal:AbortSignal,observe?:(stage:string,version:number)=>void){
    if(signal.aborted)throw new KnowledgeFailure('KNOWLEDGE_CANCELED');
    const request=await this.prisma.request.findUniqueOrThrow({where:{id:requestId}});
    if(request.status==='CANCELED')throw new KnowledgeFailure('STALE_CONTEXT');
    if(this.env.RAG_RETRIEVAL_MODE==='lexical'){observe?.('LEXICAL',request.version);return {identity:lexicalIdentity,contextVersion:request.version};}
    observe?.('INFERENCE',request.version);
    const input=requestEmbeddingInput(request.title,request.description),batch=await this.embeddings.embedQuery(input.text,signal);
    validateVector(batch.vectors[0],1024);
    if(batch.identity.dimension!==1024)throw new KnowledgeFailure('EMBEDDING_DIMENSION_MISMATCH');
    if(this.identity&&batch.identity.key!==this.identity.key)throw new KnowledgeFailure('INDEX_MODEL_MISMATCH');
    this.identity??=batch.identity;
    if(signal.aborted)throw new KnowledgeFailure('EMBEDDING_TIMEOUT');
    observe?.('PERSIST',request.version);
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Request" WHERE id=${requestId}::uuid FOR SHARE`);
      const current=await tx.request.findUniqueOrThrow({where:{id:requestId}});
      if(signal.aborted)throw new KnowledgeFailure('KNOWLEDGE_CANCELED');
      if(current.version!==request.version||current.status==='CANCELED')throw new KnowledgeFailure('STALE_CONTEXT');
      await tx.$executeRaw(Prisma.sql`INSERT INTO "RequestEmbedding" (id,"requestId","contextVersion","modelIdentity",dimension,"inputVersion","inputHash","identityJson",embedding)
        VALUES (${randomUUID()}::uuid,${requestId}::uuid,${request.version},${batch.identity.key},${batch.identity.dimension},${input.inputVersion},${input.hash},${JSON.stringify({...batch.identity,inputTruncated:input.truncated})}::jsonb,${JSON.stringify(batch.vectors[0])}::vector)
        ON CONFLICT ("requestId","modelIdentity","contextVersion","inputVersion") DO NOTHING`);
      if(signal.aborted)throw new KnowledgeFailure('KNOWLEDGE_CANCELED');
    });
    return {identity:batch.identity,contextVersion:request.version};
  }
  async next(signal:AbortSignal,now?:number){
    if(this.env.RAG_RETRIEVAL_MODE==='lexical')return;
    // One candidate per worker tick, with capped backoff for temporary failures.
    // Identity/schema failures remain blocked and require operator intervention.
    const asOf=now??Date.now();
    if(this.busy||this.state==='BLOCKED'||asOf<this.nextRetryAt)return;
    this.busy=true;
    this.observation={correlationId:randomUUID(),stage:'PROBE',requestId:null,contextVersion:null,category:null,errorType:null};
    try{
      if(signal.aborted)throw new KnowledgeFailure('KNOWLEDGE_CANCELED');
      if(!this.identity||asOf-this.probedAt>60000){
        const probed=(await this.embeddings.probe(signal)).identity;
        if(this.identity&&probed.key!==this.identity.key)throw new KnowledgeFailure('INDEX_MODEL_MISMATCH');
        if(probed.dimension!==1024)throw new KnowledgeFailure('EMBEDDING_DIMENSION_MISMATCH');
        this.identity=probed;this.probedAt=asOf;
      }
      this.observation.stage='SCAN';
      // Circular ID order advances even after a stale request. A hot newest
      // request cannot indefinitely hide older pending requests.
      const [r]=await this.prisma.$queryRaw<{id:string}[]>(Prisma.sql`SELECT r.id FROM "Request" r WHERE r.status<>'CANCELED' AND NOT EXISTS (SELECT 1 FROM "RequestEmbedding" e WHERE e."requestId"=r.id AND e."contextVersion"=r.version AND e."inputVersion"=${requestInputVersion} AND e."modelIdentity"=${this.identity.key}) ORDER BY CASE WHEN r.id>${this.cursor}::uuid THEN 0 ELSE 1 END,r.id LIMIT 1`);
      if(r){this.cursor=r.id;this.observation.requestId=r.id;this.observation.stage='READ_REQUEST';}
      const indexed=r?await this.index(r.id,signal,(stage,version)=>{this.observation!.stage=stage;this.observation!.contextVersion=version;}):undefined;
      const recovery=this.failureCount?{event:'request.embedding.recovered',...this.observation,previousErrorCode:this.errorCode,failureCount:this.failureCount,...(r?{requestId:r.id,contextVersion:indexed!.contextVersion}:{})}:undefined;
      this.state='READY';this.failureCount=0;this.errorCode=null;this.nextRetryAt=0;
      return recovery;
    }catch(error){
      const failure=signal.aborted?new KnowledgeFailure(signal.reason?.name==='TimeoutError'?'EMBEDDING_TIMEOUT':'KNOWLEDGE_CANCELED',true):error instanceof KnowledgeFailure?error:isDatabaseUnavailable(error)?new KnowledgeFailure('DATABASE_UNAVAILABLE',true):new KnowledgeFailure('REQUEST_EMBEDDING_UNAVAILABLE');
      const stale=failure.code==='STALE_CONTEXT',canceled=failure.code==='KNOWLEDGE_CANCELED';
      const temporary=failure.retryable||failure.code==='EMBEDDING_TIMEOUT';
      this.observation.category=canceled?'LIFECYCLE':stale?'REQUEST_STALE':temporary?'TRANSIENT':failure.code==='REQUEST_EMBEDDING_UNAVAILABLE'?'UNEXPECTED':'CONFIGURATION';
      this.observation.errorType=error instanceof KnowledgeFailure?'KnowledgeFailure':isDatabaseUnavailable(error)?'DatabaseError':error instanceof TypeError?'TypeError':error instanceof Error?'Error':'Unknown';
      this.errorCode=failure.code;this.failureCount++;
      this.state=canceled?'STOPPED':stale?'READY':temporary?'RETRY_WAIT':'BLOCKED';
      this.nextRetryAt=!stale&&!canceled&&temporary?(now??Date.now())+Math.min(60000,1000*2**Math.min(this.failureCount-1,6)):0;
      throw failure;
    }finally{this.busy=false;}
  }
  async similar(tx:Prisma.TransactionClient,requestId:string,identity:EmbeddingIdentity,timeWindow:number,limit:number,asOf:Date,staffScope?:string){
    if(identity.key===lexicalIdentity.key)return this.similarLexical(tx,requestId,timeWindow,limit,asOf,staffScope);
    const rows=await tx.$queryRaw<(SimilarCase&{cosine:number;vector:number;categoryMatch:number;locationMatch:number;recency:number})[]>(Prisma.sql`
      WITH current_request AS MATERIALIZED (
        SELECT r.*,COALESCE(r.category,a.category) AS category_value,
          NULLIF(lower(regexp_replace(trim(normalize(a."entitiesJson"->>'location',NFC)), '[[:space:]]+', ' ', 'g')),'') AS location_value,e.embedding
        FROM "Request" r LEFT JOIN "AiAnalysis" a ON a.id=r."latestAnalysisId"
        JOIN "RequestEmbedding" e ON e."requestId"=r.id AND e."contextVersion"=r.version
        WHERE r.id=${requestId}::uuid AND e."modelIdentity"=${identity.key} AND e.dimension=${identity.dimension} AND e."inputVersion"=${requestInputVersion}
      ), eligible AS MATERIALIZED (
        SELECT r.id AS "requestId",r."publicCode",r.title,r.status,COALESCE(r.category,a.category) AS category,
          a."entitiesJson"->>'location' AS location,r."createdAt",r.version AS "contextVersion",
          1-(e.embedding <=> q.embedding) AS cosine,
          CASE WHEN COALESCE(r.category,a.category)=q.category_value THEN 1 ELSE 0 END AS "categoryMatch",
          CASE WHEN NULLIF(lower(regexp_replace(trim(normalize(a."entitiesJson"->>'location',NFC)), '[[:space:]]+', ' ', 'g')),'')=q.location_value THEN 1 ELSE 0 END AS "locationMatch",
          1-EXTRACT(EPOCH FROM (${asOf}::timestamptz-r."createdAt"))::float8/(${timeWindow}*60) AS recency
        FROM "Request" r JOIN "RequestEmbedding" e ON e."requestId"=r.id AND e."contextVersion"=r.version
        LEFT JOIN "AiAnalysis" a ON a.id=r."latestAnalysisId" CROSS JOIN current_request q
        WHERE r.id<>${requestId}::uuid AND r.status<>'CANCELED'
          AND r."createdAt">=${asOf}::timestamptz-(${timeWindow}*interval '1 minute') AND r."createdAt"<=${asOf}::timestamptz
          AND e."modelIdentity"=${identity.key} AND e.dimension=${identity.dimension} AND e."inputVersion"=${requestInputVersion}
          ${staffScope?Prisma.sql`AND r."currentAssigneeId"=${staffScope}::uuid`:Prisma.empty}
      ), scored AS (SELECT *, greatest(0,least(1,(cosine+1)/2)) AS vector FROM eligible)
      SELECT *, .60*vector+.20*"categoryMatch"+.10*"locationMatch"+.10*recency AS score FROM scored
      WHERE vector>=0.70 ORDER BY score DESC,"createdAt" DESC,"requestId" ASC LIMIT ${limit+1}`);
    const cases:SimilarCase[]=rows.slice(0,limit).map(r=>({requestId:r.requestId,publicCode:r.publicCode,title:r.title,status:r.status,category:r.category,location:r.location,createdAt:new Date(r.createdAt).toISOString(),contextVersion:r.contextVersion,score:r.score,scoreComponents:{cosineSimilarity:Math.max(-1,Math.min(1,r.cosine)),vector:r.vector,category:r.categoryMatch,location:r.locationMatch,recency:r.recency}}));
    return {cases,windowMinutes:timeWindow,returnedCount:cases.length,truncated:rows.length>limit};
  }
  private async similarLexical(tx:Prisma.TransactionClient,requestId:string,timeWindow:number,limit:number,asOf:Date,staffScope?:string){
    const rows=await tx.$queryRaw<(SimilarCase&{cosine:number;vector:number;categoryMatch:number;locationMatch:number;recency:number})[]>(Prisma.sql`
      WITH current_request AS MATERIALIZED (
        SELECT r.*,COALESCE(r.category,a.category) AS category_value,
          NULLIF(lower(regexp_replace(trim(normalize(a."entitiesJson"->>'location',NFC)), '[[:space:]]+', ' ', 'g')),'') AS location_value,
          mobiflow_unaccent(r.title||' '||r.description) AS lexical_text
        FROM "Request" r LEFT JOIN "AiAnalysis" a ON a.id=r."latestAnalysisId" WHERE r.id=${requestId}::uuid
      ), eligible AS MATERIALIZED (
        SELECT r.id AS "requestId",r."publicCode",r.title,r.status,COALESCE(r.category,a.category) AS category,
          a."entitiesJson"->>'location' AS location,r."createdAt",r.version AS "contextVersion",
          greatest(ts_rank_cd(to_tsvector('simple',mobiflow_unaccent(r.title||' '||r.description)),websearch_to_tsquery('simple',q.lexical_text),32),word_similarity(q.lexical_text,mobiflow_unaccent(r.title||' '||r.description)))::float8 AS vector,
          CASE WHEN COALESCE(r.category,a.category)=q.category_value THEN 1 ELSE 0 END AS "categoryMatch",
          CASE WHEN NULLIF(lower(regexp_replace(trim(normalize(a."entitiesJson"->>'location',NFC)), '[[:space:]]+', ' ', 'g')),'')=q.location_value THEN 1 ELSE 0 END AS "locationMatch",
          1-EXTRACT(EPOCH FROM (${asOf}::timestamptz-r."createdAt"))::float8/(${timeWindow}*60) AS recency
        FROM "Request" r LEFT JOIN "AiAnalysis" a ON a.id=r."latestAnalysisId" CROSS JOIN current_request q
        WHERE r.id<>${requestId}::uuid AND r.status<>'CANCELED'
          AND r."createdAt">=${asOf}::timestamptz-(${timeWindow}*interval '1 minute') AND r."createdAt"<=${asOf}::timestamptz
          ${staffScope?Prisma.sql`AND r."currentAssigneeId"=${staffScope}::uuid`:Prisma.empty}
      ), scored AS (SELECT *,greatest(-1,least(1,2*vector-1)) AS cosine FROM eligible WHERE vector>=0.20)
      SELECT *, .60*vector+.20*"categoryMatch"+.10*"locationMatch"+.10*recency AS score FROM scored
      ORDER BY score DESC,"createdAt" DESC,"requestId" ASC LIMIT ${limit+1}`);
    const cases:SimilarCase[]=rows.slice(0,limit).map(r=>({requestId:r.requestId,publicCode:r.publicCode,title:r.title,status:r.status,category:r.category,location:r.location,createdAt:new Date(r.createdAt).toISOString(),contextVersion:r.contextVersion,score:r.score,scoreComponents:{cosineSimilarity:r.cosine,vector:r.vector,category:r.categoryMatch,location:r.locationMatch,recency:r.recency}}));
    return {cases,windowMinutes:timeWindow,returnedCount:cases.length,truncated:rows.length>limit};
  }
}
