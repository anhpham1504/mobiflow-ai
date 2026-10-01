import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {recommendationPromptV2Version} from '../../apps/api/dist/ai/prompts/recommendation.js';
import {saveEvidence} from './evidence.mjs';

const args=process.argv.slice(2);
assert.ok(args.length===1&&['--database','--browser'].includes(args[0]),'Choose exactly --database or --browser; run sequentially against the guarded isolated fixture.');
const mode=args[0].slice(2),startedAt=new Date().toISOString();
const destinations={database:'docs/v1.2/evidence/M15_DATABASE_REGRESSION.json',browser:'docs/v1.2/evidence/M15_BROWSER_REGRESSION.json'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const historicalPaths=['docs/v1.2/evidence/M14_DATABASE.json','docs/v1.2/evidence/M14_BROWSER.json'];
const sourcePaths=['apps/api/src/ai/prompts/recommendation.ts','apps/api/dist/ai/prompts/recommendation.js','apps/api/src/ai/recommendation-output.ts','apps/api/src/ai/recommendation.service.ts','packages/contracts/src/recommendation.ts',...(mode==='database'?['apps/api/test/recommendation-v2.integration.test.mjs']:['scripts/verification/m14-browser.mjs','apps/web/e2e/recommendation-v2.spec.mjs'])];
const hashes=async paths=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path))])));
const historicalHashes=await hashes(historicalPaths),sourceHashes=await hashes(sourcePaths);

// Retain an earlier M15 report before the existing browser writer replaces it.
// All historical M14 evidence remains byte-identical and is checked below.
try{await saveEvidence(destinations[mode],JSON.parse(await readFile(destinations[mode],'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
const child=spawnSync(process.execPath,[`scripts/verification/m14-${mode==='database'?'integration':'browser'}.mjs`],{cwd:process.cwd(),env:{...process.env,M14_DATABASE_EVIDENCE_PATH:destinations.database,M14_BROWSER_EVIDENCE_PATH:destinations.browser},stdio:'inherit',windowsHide:true});
assert.deepEqual(await hashes(historicalPaths),historicalHashes,'M15 regression must preserve historical M14 evidence exactly.');
assert.deepEqual(await hashes(sourcePaths),sourceHashes,'Product/test source changed during the regression.');
let report;
try{report=JSON.parse(await readFile(destinations[mode],'utf8'));}catch(error){if(error.code==='ENOENT')throw new Error(`M15 ${mode} regression produced no report; inspect fixture setup output.`,{cause:child.error??error});throw error;}
assert.ok(Date.parse(report.checkedAt)>=Date.parse(startedAt),'Regression did not write a fresh report.');
await saveEvidence(destinations[mode],{...report,m15Regression:{startedAt,finishedAt:new Date().toISOString(),kind:'development/synthetic evidence',purpose:'Affected Recommendation V2 prompt/native-format regression after the M15 documented contract defect fix.',reusesEstablishedGate:mode==='database'?'26 isolated PostgreSQL assertions':'4 production-build browser scenarios',promptVersion:recommendationPromptV2Version,sourceHashes,historicalEvidencePreserved:true,fixtureDatabase:'mobiflow_m14_test',limitations:'Reuses the guarded deterministic M14 fixtures only. No live model effectiveness measurement; no broader historical milestone gates are represented.'}});
console.log(JSON.stringify({milestone:'M15',mode,result:report.result,exitCode:child.status,promptVersion:recommendationPromptV2Version,evidence:destinations[mode],historicalEvidencePreserved:true}));
if(child.error)throw child.error;
if(child.status!==0||report.result!=='PASS')process.exitCode=1;
