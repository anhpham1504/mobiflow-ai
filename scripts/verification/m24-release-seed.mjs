import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {seedDemo} from '../demo/seed-data.mjs';
assert.equal(process.env.DEMO_MODE,'true');const url=new URL(process.env.DATABASE_URL);assert.equal(url.host,'127.0.0.1:5432');assert.equal(url.pathname,'/mobiflow');
execFileSync(process.execPath,['scripts/dev/prisma.mjs','migrate','deploy'],{stdio:'inherit'});
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString()})});
const models=['request','requestMessage','requestInternalNote','requestInternalNoteMention','requestWatcher','operationalTemplate','operationalTemplateRevision','routingRule','routingRuleRevision','savedRequestView','slaOperationalAlert','notification','auditLog','requestStatusHistory','slaInstance'];
const snapshot=async()=>Object.fromEntries(await Promise.all(models.map(async name=>[name,(await prisma[name].findMany()).map(row=>JSON.stringify(row)).sort()])));
try{const original=await snapshot();await seedDemo(prisma,{databaseUrl:url.toString()});if(original.request.length)assert.deepEqual(await snapshot(),original);const before=await snapshot();await seedDemo(prisma,{databaseUrl:url.toString()});assert.deepEqual(await snapshot(),before);
 const count=await prisma.$queryRaw`SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;assert.equal(count[0].count,13);
 const report={result:'PASS',migrationCount:13,repeatSeedRowsUnchanged:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.length])),synthetic:true};writeFileSync('/evidence/release-seed-report.json',JSON.stringify(report));console.log(JSON.stringify({event:'m24.release-seed',...report}));
}finally{await prisma.$disconnect();}
