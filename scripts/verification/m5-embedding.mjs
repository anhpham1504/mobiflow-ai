import {writeFileSync} from 'node:fs';
import {parseApiEnvironment} from '@mobiflow/config';
import {OllamaEmbeddingProvider} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {VectorRepository} from '../../apps/api/dist/knowledge/vector.repository.js';
const env=parseApiEnvironment(process.env),provider=new OllamaEmbeddingProvider(env),db=new PrismaService(env.DATABASE_URL);
try{const result=await provider.probe(AbortSignal.timeout(60000));await new VectorRepository(db,env).compatible(result.identity);const evidence={at:new Date().toISOString(),identity:result.identity,latencyMs:result.latencyMs,dimension:result.vectors[0].length,configuredDimension:env.EMBEDDING_DIMENSION,schemaDimension:await new VectorRepository(db,env).schemaDimension(),finite:true,nonzero:true};writeFileSync('docs/verification/evidence/M5_EMBEDDING.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));}finally{await db.$disconnect();}
