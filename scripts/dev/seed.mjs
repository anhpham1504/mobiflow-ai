import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {seedDemo} from '../demo/seed-data.mjs';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:databaseUrl})});
try{
  const result=await seedDemo(prisma,{databaseUrl});
  console.log(JSON.stringify({event:'demo.seed.complete',...result}));
}finally{await prisma.$disconnect();}
