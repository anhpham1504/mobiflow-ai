import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {saveEvidence} from './evidence.mjs';
const baseline='7fe687ae4517c37f9fbe3fcf01668980ebe85a23';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const migrations=git('ls-tree','-r','--name-only',baseline,'apps/api/prisma/migrations').split('\n').filter(p=>p.endsWith('migration.sql'));
const freeze=migrations.map(path=>({path,baseline:git('rev-parse',`${baseline}:${path}`),current:git('hash-object','--path='+path,path)}));
assert.equal(freeze.length,4);assert.ok(freeze.every(r=>r.baseline===r.current));
const paths=[...new Set([...git('ls-files').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')])].filter(Boolean),findings=[];
for(const path of paths){
  if(!/\.(?:[cm]?js|tsx?|json|md|ya?ml|txt|sql|example)$/.test(path))continue;
  const content=await readFile(path,'utf8');
  const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['github-token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],['openai-token',/\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/],['database-credential',/postgres(?:ql)?:\/\/[^\s:@]+:[^\s$<{]+@/]];
  for(const [kind,pattern]of patterns)if(pattern.test(content)){
    const urls=kind==='database-credential'?[...content.matchAll(/postgres(?:ql)?:\/\/[^\s'"`]+/g)].map(m=>m[0]):[];
    const fixture=urls.length>0&&urls.every(raw=>{try{const url=new URL(raw);return ['localhost','127.0.0.1'].includes(url.hostname)&&['CHANGE_ME','test','unused','b','local'].includes(url.password);}catch{return false;}});
    findings.push({path,kind,classification:fixture?'REVIEWED_DEMO_OR_TEST_PLACEHOLDER':'REQUIRES_REVIEW'});
  }
}
// Report paths only, never matching secret bytes. Template/demo matches require review.
await saveEvidence('docs/verification/evidence/M6_SECURITY_SCAN.json',{at:new Date().toISOString(),filesScanned:paths.length,migrationFreeze:freeze,findings,limitations:'Conservative high-confidence pattern scan, not proof that all secrets or vulnerabilities are absent.'});
console.log(JSON.stringify({migrationFreeze:'PASS',filesScanned:paths.length,findings}));
if(findings.some(f=>f.classification==='REQUIRES_REVIEW'))process.exitCode=1;
