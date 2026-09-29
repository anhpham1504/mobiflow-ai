import {Inject,Injectable} from '@nestjs/common';
import {createHash,randomUUID} from 'node:crypto';
import type {SimilarCase} from '@mobiflow/contracts';
import {Prisma} from '../../generated/prisma/client.js';
import {PrismaService} from '../../database/prisma.service.js';
import {EMBEDDING_PROVIDER,KnowledgeFailure,validateVector,type EmbeddingProvider,type EmbeddingIdentity} from '../../knowledge/embedding-provider.js';

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
  private backgroundPaused=false;
  constructor(private readonly prisma:PrismaService,@Inject(EMBEDDING_PROVIDER)private readonly embeddings:EmbeddingProvider){}
  async index(requestId:string,signal:AbortSignal){
    const request=await this.prisma.request.findUniqueOrThrow({where:{id:requestId}});
    if(request.status==='CANCELED')throw new KnowledgeFailure('STALE_CONTEXT');
    const input=requestEmbeddingInput(request.title,request.description),batch=await this.embeddings.embedQuery(input.text,signal);
    validateVector(batch.vectors[0],1024);
    if(batch.identity.dimension!==1024)throw new KnowledgeFailure('EMBEDDING_DIMENSION_MISMATCH');
    if(signal.aborted)throw new KnowledgeFailure('EMBEDDING_TIMEOUT');
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Request" WHERE id=${requestId}::uuid FOR SHARE`);
      const current=await tx.request.findUniqueOrThrow({where:{id:requestId}});
      if(current.version!==request.version||current.status==='CANCELED')throw new KnowledgeFailure('STALE_CONTEXT');
      await tx.$executeRaw(Prisma.sql`INSERT INTO "RequestEmbedding" (id,"requestId","contextVersion","modelIdentity",dimension,"inputVersion","inputHash","identityJson",embedding)
        VALUES (${randomUUID()}::uuid,${requestId}::uuid,${request.version},${batch.identity.key},${batch.identity.dimension},${input.inputVersion},${input.hash},${JSON.stringify({...batch.identity,inputTruncated:input.truncated})}::jsonb,${JSON.stringify(batch.vectors[0])}::vector)
        ON CONFLICT ("requestId","modelIdentity","contextVersion","inputVersion") DO NOTHING`);
    });
    return {identity:batch.identity,contextVersion:request.version};
  }
  async next(signal:AbortSignal){
    // One bounded background attempt. A failure pauses backfill until process restart;
    // explicit recommendation retry still calls index() directly. Never spin on an outage.
    if(this.backgroundPaused)return;
    try{
      if(!this.identity||Date.now()-this.probedAt>60000){this.identity=(await this.embeddings.probe(signal)).identity;this.probedAt=Date.now();}
      const [r]=await this.prisma.$queryRaw<{id:string}[]>(Prisma.sql`SELECT r.id FROM "Request" r WHERE r.status<>'CANCELED' AND NOT EXISTS (SELECT 1 FROM "RequestEmbedding" e WHERE e."requestId"=r.id AND e."contextVersion"=r.version AND e."inputVersion"=${requestInputVersion} AND e."modelIdentity"=${this.identity.key}) ORDER BY r."updatedAt" DESC,r.id LIMIT 1`);
      if(r)await this.index(r.id,signal);
    }catch(error){this.backgroundPaused=true;throw error;}
  }
  async similar(tx:Prisma.TransactionClient,requestId:string,identity:EmbeddingIdentity,timeWindow:number,limit:number,asOf:Date,staffScope?:string){
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
}
