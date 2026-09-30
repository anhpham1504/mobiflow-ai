import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {DEMO_DATABASES,safeDatabaseTarget} from '../demo/release-core.mjs';
import {seedDemo} from '../demo/seed-data.mjs';

const databaseUrl=process.env.DATABASE_URL;
// Test-process-only addition after exact target validation. Production seed/reset
// allowlists and the running demo data are unchanged.
safeDatabaseTarget(databaseUrl,{demoMode:process.env.DEMO_MODE,allowedDatabases:new Set(['mobiflow_m13_test'])});
DEMO_DATABASES.add('mobiflow_m13_test');
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:databaseUrl})});
try{console.log(JSON.stringify({event:'m13.synthetic.seed',...await seedDemo(prisma,{databaseUrl})}));}finally{await prisma.$disconnect();}
