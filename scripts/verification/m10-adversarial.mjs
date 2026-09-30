import {createHash} from 'node:crypto';
import {mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';

const root=process.cwd(),files=[];
function walk(path){for(const name of readdirSync(path)){if(['node_modules','.git','.next','dist','artifacts','storage'].includes(name))continue;const full=join(path,name);if(statSync(full).isDirectory())walk(full);else files.push(full);}}
walk(root);
const findings=[],patterns=[['PRIVATE_KEY',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['GITHUB_TOKEN',/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/],['OPENAI_KEY',/\bsk-[A-Za-z0-9_-]{20,}\b/],['AWS_KEY',/\bAKIA[0-9A-Z]{16}\b/]];
for(const file of files){let text;try{text=readFileSync(file,'utf8');}catch{continue;}for(const [kind,pattern] of patterns)if(pattern.test(text))findings.push({path:relative(root,file),kind});}
const read=path=>readFileSync(join(root,path),'utf8'),compose=read('docker-compose.yml'),next=read('apps/web/next.config.ts'),app=read('apps/api/src/app.ts'),reset=read('scripts/demo/reset.mjs'),registry=read('apps/api/src/ai/tools/registry.ts'),tsx=files.filter(file=>file.endsWith('.tsx')).map(file=>readFileSync(file,'utf8')).join('\n');
const migrations=readdirSync(join(root,'apps/api/prisma/migrations')).filter(name=>statSync(join(root,'apps/api/prisma/migrations',name)).isDirectory()).sort();
const invariants={
  exactlySixMigrations:migrations.length===6,
  noWildcardCors:app.includes('origin: env.WEB_ORIGIN')&&!app.includes("origin: '*'"),
  browserHeaders:['Content-Security-Policy','X-Content-Type-Options','X-Frame-Options','Permissions-Policy'].every(value=>next.includes(value)),
  noDangerousHtml:!tsx.includes('dangerouslySetInnerHTML'),
  resetRequiresMarker:reset.includes('assertResetAuthorization')&&reset.includes('DEMO_MARKER_ID'),
  resetPreservesMigrations:!reset.includes('TRUNCATE TABLE "_prisma_migrations"')&&!reset.includes('DROP DATABASE'),
  resetUsesBoundVectorInsert:reset.includes('$9::vector'),
  closedToolRegistry:!/(runShell|executeSql|evalCode|arbitrary)/i.test(registry),
  hardenedContainers:(compose.match(/read_only: true/g)?.length??0)>=2&&(compose.match(/cap_drop: \["ALL"\]/g)?.length??0)>=2,
  exactImages:!/^\s*image:\s*.*:latest\s*$/m.test(compose),
  nonRootImages:(read('docker/Dockerfile').match(/USER node/g)?.length??0)===2,
};
const evidence={schemaVersion:'m10.adversarial.v1',generatedAt:new Date().toISOString(),filesScanned:files.length,findings,invariants,migrationHashes:Object.fromEntries(migrations.map(name=>[name,createHash('sha256').update(read(`apps/api/prisma/migrations/${name}/migration.sql`)).digest('hex')]))};
mkdirSync(join(root,'docs/verification/evidence'),{recursive:true});writeFileSync(join(root,process.argv.includes('--v1')?'docs/verification/evidence/V1_SECURITY_M10.json':'docs/verification/evidence/M10_ADVERSARIAL.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
if(findings.length||Object.values(invariants).some(value=>!value))process.exitCode=1;
