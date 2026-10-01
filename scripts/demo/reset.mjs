import {createHash,randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {Client} from 'pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {identityKey} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {requestEmbeddingInput} from '../../apps/api/dist/ai/tools/request-vectors.js';
import {assertResetAuthorization,DEMO_DATABASES,DEMO_MARKER_ACTION,DEMO_MARKER_ID,evidencePath,ollamaInventory,portOpen,safeDatabaseTarget,jsonRequest} from './release-core.mjs';
import {demoRequestIds,seedDemo} from './seed-data.mjs';
import {saveEvidence} from '../verification/evidence.mjs';

const applicationTables=['RefreshSession','RequestMessage','RequestAttachment','RequestStatusHistory','Assignment','RequestResolution','ChecklistItem','Checklist','Feedback','AiToolCall','AiRecommendation','AiAnalysis','AiRun','RequestEmbedding','KnowledgeChunk','KnowledgeDocument','Notification','SlaInstance','AuditLog','Request','StaffSkill','TeamMember','Skill','Team','SlaPolicy','User'];
const quotedTables=applicationTables.map(name=>`"${name}"`).join(', ');

function sameTarget(left,right){return left.host===right.host&&left.port===right.port&&left.database===right.database;}
function vectorLiteral(vector){return `[${vector.map(value=>Number(value)).join(',')}]`;}

async function embedInputs(inputs){
  const base=process.env.EMBEDDING_BASE_URL??process.env.OLLAMA_BASE_URL;
  const inventory=await ollamaInventory(base,{timeout:10000}),model=inventory.get(process.env.OLLAMA_EMBEDDING_MODEL);
  if(!model)throw new Error('Required embedding model is not installed; reset has not started.');
  const {body}=await jsonRequest(new URL('/api/embed',new URL(base)),{timeout:30000,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OLLAMA_EMBEDDING_MODEL,input:inputs,truncate:false,keep_alive:'5m'})});
  if(body.model!==process.env.OLLAMA_EMBEDDING_MODEL||!Array.isArray(body.embeddings)||body.embeddings.length!==inputs.length||body.embeddings.some(vector=>!Array.isArray(vector)||vector.length!==1024||vector.some(value=>!Number.isFinite(value))))throw new Error('Embedding capability probe returned an invalid shape; reset has not started.');
  const baseIdentity={provider:'ollama',model:process.env.OLLAMA_EMBEDDING_MODEL,digest:model.digest,dimension:1024,revision:process.env.EMBEDDING_INDEX_REVISION??'m5.v1'};
  return {vectors:body.embeddings,identity:{...baseIdentity,key:identityKey(baseIdentity)}};
}

const ownerUrl=process.env.MIGRATION_DATABASE_URL,runtimeUrl=process.env.DATABASE_URL;
if(!ownerUrl||!runtimeUrl)throw new Error('DATABASE_URL and MIGRATION_DATABASE_URL are required.');
const ownerTarget=safeDatabaseTarget(ownerUrl,{demoMode:process.env.DEMO_MODE,allowedDatabases:DEMO_DATABASES});
const runtimeTarget=safeDatabaseTarget(runtimeUrl,{demoMode:process.env.DEMO_MODE,allowedDatabases:DEMO_DATABASES});
if(!sameTarget(ownerTarget,runtimeTarget))throw new Error('Runtime and migration URLs must target the same allowlisted demo database.');
const apiActive=await portOpen('127.0.0.1',Number(process.env.API_PORT??3001),500);

// Probe the real embedding dependency before any destructive statement.
await embedInputs(['MobiFlow M10 reset capability probe.']);
const owner=new Client({connectionString:ownerUrl});
let preview,migrationsBefore;
await owner.connect();
try{
  const marker=await owner.query('SELECT 1 FROM "AuditLog" WHERE id=$1::uuid AND action=$2 LIMIT 1',[DEMO_MARKER_ID,DEMO_MARKER_ACTION]);
  const migrationRows=await owner.query('SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name');
  const completed=migrationRows.rows.filter(row=>row.finished_at&&!row.rolled_back_at);
  assertResetAuthorization({apiActive,markerCount:marker.rowCount,completedMigrationNames:completed.map(row=>row.migration_name),totalMigrations:migrationRows.rows.length});
  migrationsBefore=completed.map(row=>row.migration_name);
  preview={};
  for(const table of applicationTables)preview[table]=Number((await owner.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count);
  console.log(JSON.stringify({event:'demo.reset.preview',database:ownerTarget.database,syntheticMarker:true,preserveMigrations:completed.length,storageAction:'NONE',counts:preview}));
  await owner.query('BEGIN');
  try{await owner.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);await owner.query('COMMIT');}catch(error){await owner.query('ROLLBACK');throw error;}
}finally{await owner.end();}

const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:ownerUrl})});
try{
  const seeded=await seedDemo(prisma,{databaseUrl:ownerUrl});
  const ids=demoRequestIds(),requests=await prisma.request.findMany({where:{id:{in:ids}},orderBy:{id:'asc'},select:{id:true,title:true,description:true,version:true}});
  const inputs=requests.map(request=>requestEmbeddingInput(request.title,request.description)),batch=await embedInputs(inputs.map(input=>input.text));
  const client=new Client({connectionString:ownerUrl});await client.connect();
  try{
    await client.query('BEGIN');
    for(let index=0;index<requests.length;index++){
      const request=requests[index],input=inputs[index];
      await client.query('INSERT INTO "RequestEmbedding" (id,"requestId","contextVersion","modelIdentity",dimension,"inputVersion","inputHash","identityJson",embedding) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::vector)',[randomUUID(),request.id,request.version,batch.identity.key,batch.identity.dimension,input.inputVersion,input.hash,JSON.stringify({...batch.identity,inputTruncated:input.truncated}),vectorLiteral(batch.vectors[index])]);
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
  const verification={...seeded.counts,requestEmbeddings:await prisma.requestEmbedding.count({where:{requestId:{in:ids}}}),migrationHistoryPreserved:true,storageAction:'NONE'};
  if(verification.requestEmbeddings!==ids.length)throw new Error('Reset verification failed: historical request embeddings are incomplete.');
  const migrationsAfter=await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  if(JSON.stringify(migrationsBefore)!==JSON.stringify(migrationsAfter.map(row=>row.migration_name)))throw new Error('Reset verification failed: migration history changed.');
  await saveEvidence(evidencePath('M10_RESET.json'),{at:new Date().toISOString(),status:'PASS',database:ownerTarget.database,apiActive,syntheticMarker:true,preview,counts:verification,migrationsBefore,migrationsAfter:migrationsAfter.map(row=>row.migration_name),storageAction:'NONE',embeddingModel:process.env.OLLAMA_EMBEDDING_MODEL,embeddingDimension:batch.identity.dimension});
  console.log(JSON.stringify({event:'demo.reset.complete',database:ownerTarget.database,embeddingIdentity:createHash('sha256').update(batch.identity.key).digest('hex').slice(0,12),counts:verification}));
}finally{await prisma.$disconnect();}
