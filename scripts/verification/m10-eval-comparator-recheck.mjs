import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {hash} from './m10-eval-observer.mjs';

// Run the unchanged CLI against existing results. Its fixed M9 output path is
// confined to a fresh ignored scratch directory, never the repository evidence.
const root=process.cwd(),audit=JSON.parse(readFileSync('docs/verification/evidence/M10_EVAL_CONTRACT_DIFF.json','utf8'));
for(const row of audit.protectedEvidence)assert.equal(hash(readFileSync(row.path)),row.sha256);
mkdirSync('artifacts',{recursive:true});
const scratch=mkdtempSync(resolve('artifacts/m10-eval-comparator-'));
mkdirSync(join(scratch,'docs/verification/evidence'),{recursive:true});
const script=resolve('scripts/evaluation/m9-compare.mjs');
const args=[script,resolve('docs/evaluation/results/m9-2026-09-29T14-17-47-313Z.json'),resolve('docs/evaluation/results/m9-2026-09-29T16-42-23-764Z.json')];
const result=spawnSync(process.execPath,args,{cwd:scratch,encoding:'utf8',windowsHide:true,timeout:10000});
if(result.error)throw Error('Comparator execution failed before completion');
const comparison=JSON.parse(readFileSync(join(scratch,'docs/verification/evidence/M9_EVAL_REGRESSION.json'),'utf8'));
for(const row of audit.protectedEvidence)assert.equal(hash(readFileSync(resolve(root,row.path))),row.sha256);
const report={at:new Date().toISOString(),command:'node scripts/evaluation/m9-compare.mjs <approved-M9-absolute-path> <isolated-M10-absolute-path>',cwd:scratch.replaceAll('\\','/'),reason:'Fresh scratch output protects every original M9 and M10 evaluation artifact.',scriptSha256:hash(readFileSync(script)),exitCode:result.status,comparison,protectedEvidenceUnchanged:true};
writeFileSync('docs/verification/evidence/M10_EVAL_COMPARATOR_RECHECK.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({exitCode:result.status,passed:comparison.passed,comparedCases:comparison.comparedCases,regressionCount:comparison.regressions.length,counts:comparison.regressions.reduce((out,r)=>({...out,[r.kind]:(out[r.kind]??0)+1}),{}),protectedEvidenceUnchanged:true}));
process.exitCode=result.status??1;
