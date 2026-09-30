import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {DEMO_DATABASES,safeDatabaseTarget} from '../demo/release-core.mjs';
import {seedDemo} from '../demo/seed-data.mjs';

const databaseUrl=process.env.DATABASE_URL;
safeDatabaseTarget(databaseUrl,{demoMode:process.env.DEMO_MODE,allowedDatabases:new Set(['mobiflow_m14_test'])});
DEMO_DATABASES.add('mobiflow_m14_test');
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:databaseUrl})});
try{console.log(JSON.stringify({event:'m14.synthetic.seed',...await seedDemo(prisma,{databaseUrl})}));}finally{await prisma.$disconnect();}
