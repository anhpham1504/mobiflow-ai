import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const read=path=>readFileSync(resolve(root,path),'utf8');
const issues=[];
const check=(condition,message)=>{if(!condition)issues.push(message);};
const env=read('.env.example'),compose=read('docker-compose.yml'),config=read('packages/config/src/index.ts'),provider=read('apps/api/src/ai/deepseek-provider.ts'),lexical=read('apps/api/src/knowledge/lexical.repository.ts'),eslint=read('eslint.config.mjs');

check(/AI_GENERATION_PROVIDER=deepseek/.test(env),'example profile must use DeepSeek generation');
check(/RAG_RETRIEVAL_MODE=lexical/.test(env),'example profile must use PostgreSQL lexical retrieval');
check(/AI_LIVE_CALLS_ENABLED=false/.test(env),'live calls must be disabled by default');
check(/AI_GENERATION_PROVIDER:\s*\$\{AI_GENERATION_PROVIDER:-deepseek\}/.test(compose),'Compose default generation profile drifted');
check(/RAG_RETRIEVAL_MODE:\s*\$\{RAG_RETRIEVAL_MODE:-lexical\}/.test(compose),'Compose default retrieval profile drifted');
check(/AI_LIVE_CALLS_ENABLED:\s*\$\{AI_LIVE_CALLS_ENABLED:-false\}/.test(compose),'Compose live-call default drifted');
check(config.includes("AI_GENERATION_PROVIDER==='deepseek'")&&config.includes("RAG_RETRIEVAL_MODE!=='lexical'"),'configuration must enforce the DeepSeek/lexical pairing');
check(provider.includes("thinking:{type:'disabled'}")&&provider.includes("response_format:{type:'json_object'}")&&provider.includes("redirect:'error'"),'DeepSeek adapter must bound request format and redirects');
check(provider.includes('AI_LOCAL_CONCURRENCY_LIMIT')&&provider.includes('AI_LOCAL_RATE_LIMIT')&&provider.includes('AI_BUDGET_EXHAUSTED'),'DeepSeek adapter must enforce local call guards');
check(lexical.includes('Prisma.sql')&&!lexical.includes('Prisma.raw'),'lexical SQL must remain parameterized');
for(const pattern of ['**/.playwright-cli/**','**/docs/audits/**','**/artifacts/**'])check(eslint.includes(pattern),`ESLint must ignore generated ${pattern}`);

const tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const credentialPattern=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|gh[pousr])_[A-Za-z0-9_-]{24,}\b|\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/;
const credentialFiles=[];
for(const path of tracked){if(/(?:^|\/)(?:docs\/verification\/evidence|docs\/v1\.3\/evidence|node_modules|\.next)\//.test(path)||!/\.(?:c?js|mjs|ts|tsx|json|md|txt|sql|ya?ml)$/.test(path))continue;const text=read(path);if(credentialPattern.test(text))credentialFiles.push(path);}
check(credentialFiles.length===0,`credential pattern found in tracked files: ${credentialFiles.join(', ')}`);

let audit={metadata:{vulnerabilities:{high:null,critical:null,moderate:null}}};
try{
  const command=process.platform==='win32'?'cmd.exe':'npm';
  const args=process.platform==='win32'?['/d','/s','/c','npm audit --json']:['audit','--json'];
  audit=JSON.parse(execFileSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
}catch(error){try{audit=JSON.parse(String(error.stdout??''));}catch{/* report below */}}
const vulnerabilities=audit.metadata?.vulnerabilities??{};
check((vulnerabilities.high??0)===0&& (vulnerabilities.critical??0)===0,`npm audit reports high=${vulnerabilities.high??'unknown'} critical=${vulnerabilities.critical??'unknown'}`);

const result={checkedAt:new Date().toISOString(),result:issues.length?'FAIL':'PASS',checks:{profile:issues.filter(i=>/profile|default|pairing/.test(i)).length===0,providerGuards:issues.filter(i=>/adapter|guards|redirects/.test(i)).length===0,parameterizedLexicalSql:issues.every(i=>!i.includes('lexical SQL')),lintArtifactSafety:issues.every(i=>!i.includes('ESLint')),credentialScan:credentialFiles.length===0,audit:{high:vulnerabilities.high??null,critical:vulnerabilities.critical??null,moderate:vulnerabilities.moderate??null}},issues,scope:'Current competition hardening invariants; historical M24 no-diff evidence remains historical.'};
const output=process.env.COMPETITION_SECURITY_EVIDENCE??'artifacts/competition-hardening/security.json';mkdirSync(dirname(resolve(root,output)),{recursive:true});writeFileSync(resolve(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
assert.equal(issues.length,0,issues.join('; '));
