import {Injectable} from '@nestjs/common';
import type {Source} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {PrismaService} from '../database/prisma.service.js';
import {KnowledgeFailure,type EmbeddingIdentity} from './embedding-provider.js';
import type {Chunk} from './chunker.js';
import {sourceId} from './vector.repository.js';
import {randomUUID} from 'node:crypto';

type Tx=Prisma.TransactionClient;
const fields=Prisma.sql`c."sourceId", c."id" AS "chunkId", c."documentId", c."generation", d."title", c."pageNumber", c."section", c."content" AS "excerpt", c."contentHash"`;
export const lexicalIdentity:EmbeddingIdentity={provider:'postgresql',model:'simple+unaccent+pg_trgm',digest:'lexical-v1',dimension:0,revision:'lexical.v1',key:'postgresql-lexical-v1'};
const fold=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('vi').replace(/đ/gu,'d');
const tokens=(value:string)=>fold(value).match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)??[];
const groups:[RegExp,string[]][]=[
  [/\b(?:mat\s+(?:mang|ket\s+noi)|offline|disconnect(?:ed|ion)?)\b/u,['mat','mang','ket','noi','offline','disconnect']],
  [/\b(?:sim|iot|thiet\s+bi)\b/u,['sim','iot','thiet','bi','device']],
  [/\b(?:cuoc|billing|hoa\s+don)\b/u,['cuoc','billing','hoa','don']],
  [/\b(?:dang\s+nhap|truy\s+cap|login|access)\b/u,['dang','nhap','truy','cap','login','access']],
];
export function lexicalQuery(value:string){
  const normalized=fold(value).replace(/[^\p{L}\p{N}-]+/gu,' ').replace(/\s+/gu,' ').trim(),terms=new Set(tokens(normalized).filter(token=>token.length>=2));
  for(const [pattern,expanded] of groups)if(pattern.test(normalized))for(const term of expanded)terms.add(term);
  return {normalized,websearch:[...terms].slice(0,40).map(term=>`"${term}"`).join(' OR '),exactCode:(value.match(/\b(?:SOP|FAQ|SLA)-[A-Z0-9-]{2,}\b/iu)?.[0]??'').toUpperCase()};
}

@Injectable()
export class LexicalRepository {
  constructor(private readonly prisma:PrismaService){}
  async compatible(tx:Tx=this.prisma){
    const [row]=await tx.$queryRaw<{trgm:boolean;unaccent:boolean;ftsIndex:boolean;trgmIndex:boolean}[]>(Prisma.sql`SELECT
      EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm') AS trgm,
      EXISTS(SELECT 1 FROM pg_extension WHERE extname='unaccent') AS unaccent,
      EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='KnowledgeChunk_content_fts_simple_gin') AS "ftsIndex",
      EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='KnowledgeChunk_content_trgm_gin') AS "trgmIndex"`);
    if(!row?.trgm||!row.unaccent||!row.ftsIndex||!row.trgmIndex)throw new KnowledgeFailure('LEXICAL_SCHEMA_UNAVAILABLE');
  }
  async insert(tx:Tx,documentId:string,generation:number,chunks:Chunk[],metadata:Prisma.InputJsonObject){
    for(let start=0;start<chunks.length;start+=100){
      const values=chunks.slice(start,start+100).map(c=>Prisma.sql`(${randomUUID()}::uuid,${sourceId(documentId,generation,c.chunkIndex)},${documentId}::uuid,${generation},${c.chunkIndex},${c.content},${c.contentHash},${c.pageNumber},${c.section},${c.startOffset},${c.endOffset},${JSON.stringify(metadata)}::jsonb)`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "KnowledgeChunk" (id,"sourceId","documentId",generation,"chunkIndex",content,"contentHash","pageNumber",section,"startOffset","endOffset","metadataJson") VALUES ${Prisma.join(values)}`);
    }
  }
  async search(query:string,topK:number):Promise<Source[]>{
    if(!Number.isInteger(topK)||topK<1||topK>5)throw new KnowledgeFailure('INVALID_TOP_K');
    if(!query.trim()||Array.from(query).length>2000)throw new KnowledgeFailure('INVALID_QUERY');
    const q=lexicalQuery(query);if(!q.normalized)throw new KnowledgeFailure('INVALID_QUERY');
    try{return await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;await tx.$executeRaw`SET LOCAL pg_trgm.word_similarity_threshold = 0.18`;await this.compatible(tx);
      const rows=await tx.$queryRaw<Source[]>(Prisma.sql`WITH query AS MATERIALIZED (
        SELECT websearch_to_tsquery('simple',${q.websearch}) AS tsq,mobiflow_unaccent(${q.normalized}) AS needle,${q.exactCode}::text AS code
      ), eligible AS MATERIALIZED (
        SELECT ${fields},
          ts_rank_cd(to_tsvector('simple',mobiflow_unaccent(c.content)),q.tsq,32) AS fts,
          word_similarity(q.needle,mobiflow_unaccent(c.content)) AS trgm,
          CASE WHEN q.code<>'' AND (mobiflow_unaccent(d.title) ILIKE '%'||mobiflow_unaccent(q.code)||'%' OR mobiflow_unaccent(c.content) ILIKE '%'||mobiflow_unaccent(q.code)||'%') THEN 1.0 ELSE 0.0 END AS code_match,
          CASE WHEN mobiflow_unaccent(d.title) ILIKE '%'||q.needle||'%' THEN 1.0 ELSE 0.0 END AS title_match
        FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId" CROSS JOIN query q
        WHERE d.status='READY' AND d."activeGeneration"=c.generation AND (
          to_tsvector('simple',mobiflow_unaccent(c.content)) @@ q.tsq OR
          q.needle <% mobiflow_unaccent(c.content) OR
          (q.code<>'' AND (mobiflow_unaccent(d.title) ILIKE '%'||mobiflow_unaccent(q.code)||'%' OR mobiflow_unaccent(c.content) ILIKE '%'||mobiflow_unaccent(q.code)||'%'))
        )
      ), scored AS (
        SELECT *,least(1.0,code_match+least(0.70,fts*4.0)+least(0.25,trgm*0.25)+title_match*0.05)::float8 AS score
        FROM eligible
      ), dedup AS (SELECT *,row_number() OVER (PARTITION BY "contentHash" ORDER BY score DESC,"chunkId") AS rank FROM scored)
      SELECT "sourceId","chunkId","documentId",generation,title,"pageNumber",section,excerpt,"contentHash",score,(1-score)::float8 AS distance
      FROM dedup WHERE rank=1 ORDER BY score DESC,"chunkId" LIMIT ${topK}`);
      return rows;
    },{timeout:10000});}catch(error){if(error instanceof KnowledgeFailure)throw error;throw new KnowledgeFailure('LEXICAL_RETRIEVAL_UNAVAILABLE',true);}
  }
  async documentSources(tx:Tx,id:string,generation:number){const rows=await tx.$queryRaw<Omit<Source,'score'|'distance'>[]>(Prisma.sql`SELECT ${fields} FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId" WHERE d.id=${id}::uuid AND c.generation=${generation} ORDER BY c."chunkIndex" LIMIT 5`);return rows.map(r=>({...r,score:0,distance:1}));}
  async validateCurrent(tx:Tx,sources:Source[],lock=true){
    if(!sources.length)return;const ids=[...new Set(sources.map(s=>s.documentId))].sort();
    if(lock)await tx.$queryRaw(Prisma.sql`SELECT id FROM "KnowledgeDocument" WHERE id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`);
    const rows=await tx.knowledgeChunk.findMany({where:{sourceId:{in:sources.map(s=>s.sourceId)}},include:{document:true}});
    if(sources.some(s=>!rows.some(r=>r.sourceId===s.sourceId&&r.id===s.chunkId&&r.documentId===s.documentId&&r.generation===s.generation&&r.contentHash===s.contentHash&&r.document.status==='READY'&&r.document.activeGeneration===s.generation)))throw new KnowledgeFailure('STALE_SOURCE');
  }
}
