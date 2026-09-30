import {spawnSync} from 'node:child_process';
import {Client} from 'pg';

// Fixed, synthetic test target only. This never operates on the running demo DB.
export async function withM13Database(work){
  if(process.env.DEMO_MODE!=='true')throw new Error('M13 gates require explicit DEMO_MODE=true');
  const owner=new URL(process.env.MIGRATION_DATABASE_URL),runtime=new URL(process.env.DATABASE_URL),name='mobiflow_m13_test';
  if([owner,runtime].some(url=>!['localhost','127.0.0.1'].includes(url.hostname)||url.protocol!=='postgresql:'))throw new Error('Loopback PostgreSQL URLs required');
  const adminUrl=new URL(owner);adminUrl.pathname='/postgres';
  const ownerUrl=new URL(owner);ownerUrl.pathname='/'+name;
  const databaseUrl=new URL(runtime);databaseUrl.pathname='/'+name;
  const admin=new Client({connectionString:adminUrl.toString()});await admin.connect();
  let locked=false,created=false;
  try{
    locked=(await admin.query('SELECT pg_try_advisory_lock($1) AS locked',[1300930])).rows[0].locked;
    if(!locked)throw new Error('Another M13 gate is using the isolated target');
    const existing=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount;
    if(existing)throw new Error('M13 test target already exists; inspect it before retrying. No automatic overwrite.');
    await admin.query('CREATE DATABASE mobiflow_m13_test');created=true;
    for(const [args,env] of [[['scripts/dev/prisma.mjs','migrate','deploy'],{MIGRATION_DATABASE_URL:ownerUrl.toString()}],[['scripts/verification/m13-seed.mjs'],{DATABASE_URL:databaseUrl.toString(),DEMO_MODE:'true'}]]){
      const result=spawnSync(process.execPath,args,{cwd:process.cwd(),env:{...process.env,...env},stdio:'inherit'});
      if(result.status!==0)throw new Error('M13 fixture setup failed');
    }
    return await work({databaseUrl:databaseUrl.toString(),ownerUrl:ownerUrl.toString(),database:name});
  }finally{
    if(created){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[name]);await admin.query('DROP DATABASE mobiflow_m13_test');}
    if(locked)await admin.query('SELECT pg_advisory_unlock($1)',[1300930]);
    await admin.end();
  }
}
