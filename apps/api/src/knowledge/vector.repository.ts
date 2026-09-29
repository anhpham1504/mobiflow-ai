import {Inject,Injectable} from '@nestjs/common';
import type {ApiEnvironment} from '@mobiflow/config';
import type {Source} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {API_ENV} from '../tokens.js';
import {KnowledgeFailure,validateVector,type EmbeddingIdentity} from './embedding-provider.js';
import type {Chunk} from './chunker.js';
import {randomUUID} from 'node:crypto';
type Tx=Prisma.TransactionClient;
const fields=Prisma.sql`c."sourceId", c."id" AS "chunkId", c."documentId", c."generation", d."title", c."pageNumber", c."section", c."content" AS "excerpt", c."contentHash"`;
export const sourceId=(id:string,generation:number,index:number)=>`KD-${id}-G${generation}-C${index}`;
export function distanceScore(distance:number){if(!Number.isFinite(distance))throw new KnowledgeFailure('INVALID_VECTOR_RESULT');return 1-Math.min(2,Math.max(0,distance));}
@Injectable()
export class VectorRepository {
  constructor(private readonly prisma:PrismaService,@Inject(API_ENV)private readonly env:ApiEnvironment){}
  async schemaDimension(tx:Tx=this.prisma){
    const rows=await tx.$queryRaw<{type:string;index:boolean}[]>(Prisma.sql`SELECT format_type(a.atttypid,a.atttypmod) AS type, EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='KnowledgeChunk_embedding_cosine_hnsw') AS index FROM pg_attribute a WHERE a.attrelid='"KnowledgeChunk"'::regclass AND a.attname='embedding' AND NOT a.attisdropped`);
    const dimension=Number(/^vector\((\d+)\)$/.exec(rows[0]?.type??'')?.[1]);
    if(!dimension||!rows[0]?.index)throw new KnowledgeFailure('VECTOR_SCHEMA_UNAVAILABLE');return dimension;
  }
  async compatible(identity:EmbeddingIdentity,tx:Tx=this.prisma){
    if(identity.dimension!==await this.schemaDimension(tx)||(this.env.EMBEDDING_DIMENSION!==undefined&&identity.dimension!==this.env.EMBEDDING_DIMENSION))throw new KnowledgeFailure('EMBEDDING_DIMENSION_MISMATCH');
    const incompatible=await tx.$queryRaw<{count:number}[]>(Prisma.sql`SELECT count(*)::int AS count FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId" WHERE d.status='READY' AND d."activeGeneration"=c.generation AND (c."modelIdentity" IS DISTINCT FROM ${identity.key} OR c.dimension IS DISTINCT FROM ${identity.dimension})`);
    if(incompatible[0]!.count)throw new KnowledgeFailure('INDEX_MODEL_MISMATCH');
  }
  async insert(tx:Tx,documentId:string,generation:number,chunks:Chunk[],vectors:number[][],identity:EmbeddingIdentity,metadata:Prisma.InputJsonObject){
    if(chunks.length!==vectors.length)throw new KnowledgeFailure('INCOMPLETE_EMBEDDING');
    for(let start=0;start<chunks.length;start+=100){
      const values=chunks.slice(start,start+100).map((c,i)=>Prisma.sql`(${randomUUID()}::uuid,${sourceId(documentId,generation,c.chunkIndex)},${documentId}::uuid,${generation},${c.chunkIndex},${c.content},${c.contentHash},${c.pageNumber},${c.section},${c.startOffset},${c.endOffset},${JSON.stringify(metadata)}::jsonb,${identity.key},${identity.dimension},${JSON.stringify(validateVector(vectors[start+i],identity.dimension))}::vector)`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "KnowledgeChunk" (id,"sourceId","documentId",generation,"chunkIndex",content,"contentHash","pageNumber",section,"startOffset","endOffset","metadataJson","modelIdentity",dimension,embedding) VALUES ${Prisma.join(values)}`);
    }
  }
  async search(vector:number[],identity:EmbeddingIdentity,topK:number,maxDistance=this.env.RAG_MAX_DISTANCE):Promise<Source[]>{
    if(!Number.isInteger(topK)||topK<1||topK>5)throw new KnowledgeFailure('INVALID_TOP_K');
    validateVector(vector,identity.dimension);
    try{return await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      await this.compatible(identity,tx);
      // Exact baseline: materialize scoped distances, deduplicate before LIMIT. The small
      // V1 corpus deliberately does not use approximate HNSW candidate truncation.
      const rows=await tx.$queryRaw<Source[]>(Prisma.sql`WITH eligible AS MATERIALIZED (
        SELECT ${fields}, c.embedding <=> ${JSON.stringify(vector)}::vector AS distance
        FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId"
        WHERE d.status='READY' AND d."activeGeneration"=c.generation AND c."modelIdentity"=${identity.key} AND c.dimension=${identity.dimension} AND c.embedding IS NOT NULL
      ), dedup AS (SELECT *,row_number() OVER (PARTITION BY "contentHash" ORDER BY distance,"chunkId") AS rank FROM eligible)
      SELECT "sourceId","chunkId","documentId",generation,title,"pageNumber",section,excerpt,"contentHash",distance FROM dedup WHERE rank=1 AND distance<=${maxDistance} ORDER BY distance,"chunkId" LIMIT ${topK}`);
      return rows.map(r=>({...r,score:distanceScore(r.distance)}));
    },{timeout:10000});}catch(error){if(error instanceof KnowledgeFailure)throw error;throw new KnowledgeFailure('VECTOR_UNAVAILABLE');}
  }
  async documentSources(tx:Tx,id:string,generation:number){const rows=await tx.$queryRaw<Omit<Source,'score'|'distance'>[]>(Prisma.sql`SELECT ${fields} FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId" WHERE d.id=${id}::uuid AND c.generation=${generation} ORDER BY c."chunkIndex" LIMIT 5`);return rows.map(r=>({...r,score:0,distance:1}));}
  async validateCurrent(tx:Tx,sources:Source[],lock=true){
    if(!sources.length)return;
    const ids=[...new Set(sources.map(s=>s.documentId))].sort();
    if(lock)await tx.$queryRaw(Prisma.sql`SELECT id FROM "KnowledgeDocument" WHERE id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`);
    const rows=await tx.knowledgeChunk.findMany({where:{sourceId:{in:sources.map(s=>s.sourceId)}},include:{document:true}});
    if(sources.some(s=>!rows.some(r=>r.sourceId===s.sourceId&&r.id===s.chunkId&&r.documentId===s.documentId&&r.generation===s.generation&&r.contentHash===s.contentHash&&r.document.status==='READY'&&r.document.activeGeneration===s.generation)))throw new KnowledgeFailure('STALE_SOURCE');
  }
}
