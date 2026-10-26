import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:20e6}).trim();
const paths=git('ls-files','-c','-o','--exclude-standard').split(/\r?\n/u).filter(Boolean).filter(path=>/^(?:apps\/|packages\/|scripts\/|docker\/|docker-compose\.yml$|package(?:-lock)?\.json$|\.env\.example$)/u.test(path)&&!path.startsWith('artifacts/'));
const files=paths.map(path=>({path,bytes:readFileSync(path).byteLength,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const identity=createHash('sha256').update(JSON.stringify(files)).digest('hex');
const output={capturedAt:new Date().toISOString(),branch:git('branch','--show-current'),head:git('rev-parse','HEAD'),sourceIdentity:identity,fileCount:files.length,dirtyStatus:git('status','--short').split(/\r?\n/u).filter(Boolean),files};
assert.ok(output.dirtyStatus.length>0,'M3 candidate is expected to include the reviewed dirty candidate');mkdirSync('artifacts/m3',{recursive:true});writeFileSync('artifacts/m3/source-identity.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({event:'m3.source-identity',result:'PASS',branch:output.branch,head:output.head,sourceIdentity:identity,fileCount:files.length,dirtyEntries:output.dirtyStatus.length}));
