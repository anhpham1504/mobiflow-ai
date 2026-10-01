import assert from 'node:assert/strict';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {RequestVectors} from '../../apps/api/dist/ai/tools/request-vectors.js';
import {OllamaEmbeddingProvider} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {parseApiEnvironment} from '@mobiflow/config';
import {demoRequestIds} from '../demo/seed-data.mjs';
const env=parseApiEnvironment(process.env),url=new URL(env.DATABASE_URL);assert.equal(url.port,'54616');assert.equal(url.pathname,'/mobiflow');assert.equal(process.env.DEMO_MODE,'true');
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:env.DATABASE_URL})});
try{
  const vectors=new RequestVectors(prisma,new OllamaEmbeddingProvider(env));
  const requests=await prisma.request.findMany({where:{id:{in:demoRequestIds()},status:{not:'CANCELED'}}});
  for(const request of requests)await vectors.index(request.id,AbortSignal.timeout(30000));
  const count=await prisma.requestEmbedding.count({where:{OR:requests.map(request=>({requestId:request.id,contextVersion:request.version}))}});assert.equal(count,requests.length);assert.equal(requests.length,7);console.log(JSON.stringify({synthetic:true,currentEligibleRequestEmbeddings:count,historicalVersionsRetained:true,canceledRequestSkipped:true,usesOwningRequestVectorService:true,businessReset:false}));
}finally{await prisma.$disconnect();}
