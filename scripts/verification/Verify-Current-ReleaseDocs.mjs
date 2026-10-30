import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const normalize=value=>value.replaceAll('\\','/');
const lineOf=(text,index)=>text.slice(0,index).split(/\r?\n/).length;
const issue=(file,line,message)=>({file:normalize(file),line,message});

export function scanMarkdownQuality(file,text){
  const issues=[];
  const absolute=/(?:^|[ \t(`])(?:[A-Za-z]:\\|[A-Za-z]:\/|\/(?:Users|home)\/)/gm;
  for(const match of text.matchAll(absolute))issues.push(issue(file,lineOf(text,match.index),'absolute local path is not publishable'));
  const placeholder=/\b(?:TBD|TODO|FIXME|XXX)\b/g;
  for(const match of text.matchAll(placeholder))issues.push(issue(file,lineOf(text,match.index),`unresolved placeholder: ${match[0]}`));

  const lines=text.split(/\r?\n/);
  for(let start=0;start<lines.length;start++){
    if(!/^\s*\|/.test(lines[start]))continue;
    const table=[];while(start<lines.length&&/^\s*\|/.test(lines[start])){table.push({line:start+1,text:lines[start]});start++;}
    start--;
    if(table.length<2)continue;
    const cells=row=>row.trim().replace(/^\||\|$/g,'').split('|').length;
    const expected=cells(table[0].text);
    if(!/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(table[1].text))issues.push(issue(file,table[1].line,'Markdown table is missing a valid separator row'));
    for(const row of table.slice(1))if(cells(row.text)!==expected)issues.push(issue(file,row.line,`Markdown table has ${cells(row.text)} cells; expected ${expected}`));
  }
  return issues;
}

export function checkRelativeLinks(root,file,text){
  const issues=[];
  const links=/\[[^\]]*\]\(([^)]+)\)/g;
  for(const match of text.matchAll(links)){
    const raw=match[1].trim().replace(/^<|>$/g,'');
    if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|codex:)/i.test(raw))continue;
    let target;
    try{target=decodeURIComponent(raw.split('#')[0].split('?')[0]);}
    catch{issues.push(issue(file,lineOf(text,match.index),`malformed percent-encoded Markdown link: ${raw}`));continue;}
    if(!existsSync(resolve(root,dirname(file),target)))issues.push(issue(file,lineOf(text,match.index),`broken relative link: ${raw}`));
  }
  return issues;
}

export function checkCredentialArtifactPaths(file,text){
  const issues=[];
  const lines=text.split(/\r?\n/);
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    if(/artifacts[\\/][^\s"'`]*(?:runtime-private|credential|secret)[^\s"'`]*/i.test(line)||(/(?:writeFileSync|writeFile)\s*\(/.test(line)&&/artifacts[\\/]/i.test(line)&&/(?:DATABASE_URL|MIGRATION_DATABASE_URL)/.test(line)))issues.push(issue(file,index+1,'credential-bearing runtime files must not be written under artifacts/'));
  }
  return issues;
}

export function checkGitHubActionsRuntimeManifest(file,text){
  const issues=[],lines=text.split(/\r?\n/),indent=line=>(line.match(/^\s*/)?.[0].length??0);
  const jobStart=lines.findIndex(line=>/^\s*postgresql-critical-integration:\s*(?:#.*)?$/.test(line));
  if(jobStart<0){issues.push(issue(file,1,'postgresql-critical-integration job is missing'));return issues;}
  const jobIndent=indent(lines[jobStart]);let jobEnd=lines.length;
  for(let index=jobStart+1;index<lines.length;index++)if(lines[index].trim()&&!lines[index].trimStart().startsWith('#')&&indent(lines[index])<=jobIndent){jobEnd=index;break;}
  const jobLines=lines.slice(jobStart,jobEnd);

  const envStart=jobLines.findIndex((line,index)=>index>0&&indent(line)===jobIndent+2&&/^\s*env:\s*(?:#.*)?$/.test(line));
  if(envStart>=0){
    const envIndent=indent(jobLines[envStart]);
    for(let index=envStart+1;index<jobLines.length;index++){
      const line=jobLines[index];if(line.trim()&&indent(line)<=envIndent)break;
      if(/\$\{\{\s*runner\./.test(line))issues.push(issue(file,jobStart+index+1,'runner context must not be used in job-level env'));
    }
  }

  const stepBlock=(name)=>{
    const start=jobLines.findIndex(line=>new RegExp(`^\\s*- name:\\s*${name}\\s*$`).test(line));
    if(start<0)return {start:-1,lines:[]};
    const stepIndent=indent(jobLines[start]);let end=jobLines.length;
    for(let index=start+1;index<jobLines.length;index++)if(jobLines[index].trim()&&indent(jobLines[index])===stepIndent&&/^\s*-\s+/.test(jobLines[index])){end=index;break;}
    return {start,lines:jobLines.slice(start,end)};
  };
  const initialization=stepBlock('Initialize private runtime manifest path');
  const initializationLine=initialization.start<0?jobStart+1:jobStart+initialization.start+1;
  const initializationText=initialization.lines.join('\n');
  if(!initializationText.includes('$RUNNER_TEMP/mobiflow-m24-runtime-private.json'))issues.push(issue(file,initializationLine,'CI runtime manifest path must be initialized from $RUNNER_TEMP'));
  if(!/>>\s*"\$GITHUB_ENV"/.test(initializationText))issues.push(issue(file,initializationLine,'CI runtime manifest path must be propagated through $GITHUB_ENV'));

  const jobText=jobLines.join('\n');
  if(!/mode\s*:\s*0o600/.test(jobText))issues.push(issue(file,jobStart+1,'CI runtime manifest must be created with mode 0o600'));
  if(!/chmod\s+600\s+"\$M24_RUNTIME_MANIFEST"/.test(jobText))issues.push(issue(file,jobStart+1,'CI runtime manifest permissions must be enforced with chmod 600'));

  const cleanup=stepBlock('Remove private runtime manifest');
  const cleanupLine=cleanup.start<0?jobStart+1:jobStart+cleanup.start+1;
  const cleanupText=cleanup.lines.join('\n');
  if(!/^\s*if:\s*always\(\)\s*$/m.test(cleanupText))issues.push(issue(file,cleanupLine,'CI runtime manifest cleanup must use if: always()'));
  if(!cleanupText.includes('${M24_RUNTIME_MANIFEST:-$RUNNER_TEMP/mobiflow-m24-runtime-private.json}'))issues.push(issue(file,cleanupLine,'CI runtime manifest cleanup must include the RUNNER_TEMP fallback'));
  return issues;
}

export function checkActiveMarkdown(root,file,text){
  const issues=[...scanMarkdownQuality(file,text),...checkRelativeLinks(root,file,text)];
  for(const [pattern,label] of [[/V1\.3[^\n]{0,40}candidate/i,'stale V1.3 candidate identity'],[/qwen2\.5:7b-instruct/i,'stale rollback model'],[/Ollama[^\n]{0,50}(?:primary|active path)/i,'Ollama described as the active/primary path'],[/manager approval before (?:the )?initial assignment/i,'historical manager-first assignment flow']]){
    const match=text.match(pattern);if(match)issues.push(issue(file,lineOf(text,match.index),label));
  }
  return issues;
}

function read(root,file,issues){
  const path=resolve(root,file);
  if(!existsSync(path)){issues.push(issue(file,1,'required file is missing'));return null;}
  return readFileSync(path,'utf8');
}
function parseJson(root,file,issues){
  const text=read(root,file,issues);if(text===null)return null;
  try{return JSON.parse(text);}catch(error){issues.push(issue(file,1,`invalid JSON: ${error.message}`));return null;}
}
function expectContains(issues,file,text,expected,message){if(text!==null&&!text.includes(expected))issues.push(issue(file,1,message));}

export function validateCurrentReleaseDocs(root=process.cwd()){
  const issues=[];
  const metadataFile='packages/config/src/release-metadata.json';
  const metadata=parseJson(root,metadataFile,issues);
  const expected={version:'1.4.2',commit:'d225f0ebacbaf0521ac64349fb4ce9ba6600c092',tree:'5b3de63f2eee6441a5845ac0fcb29dc5bb861794',tag:'v1.4.1',llm:'qwen3:4b-instruct-2507-q4_K_M',embedding:'bge-m3:latest'};
  if(metadata){
    for(const [actual,value,label] of [[metadata.releaseVersion,expected.version,'releaseVersion'],[metadata.baseCommit,expected.commit,'baseCommit'],[metadata.baseTree,expected.tree,'baseTree'],[metadata.baseTag,expected.tag,'baseTag'],[metadata.rollbackProfile?.generationModel,expected.llm,'rollback generation model'],[metadata.rollbackProfile?.embeddingModel,expected.embedding,'rollback embedding model']])if(actual!==value)issues.push(issue(metadataFile,1,`${label} must be ${value}`));
    if(metadata.activeProfile?.generationProvider!=='deepseek'||metadata.activeProfile?.retrievalMode!=='lexical'||metadata.activeProfile?.liveCallsDefault!==false)issues.push(issue(metadataFile,1,'active profile must be DeepSeek + lexical with live calls disabled by default'));
  }

  const activeFiles=['README.md','docs/release/V1_4_2_RELEASE.md','docs/release/V1_4_2_RUNBOOK.md','docs/release/V1_4_2_MACHINE_CHECKLIST.md'];
  const historicalFiles=['docs/demo/AI_MODEL_DISCLOSURE.md','docs/demo/BEFORE_AFTER_EVIDENCE.md','docs/demo/COMPETITION_SUBMISSION.md','docs/demo/DEMO_RUNBOOK.md','docs/demo/DEMO_SCRIPT_10_MIN.md','docs/demo/DEMO_SCRIPT_5_MIN.md','docs/demo/JUDGE_QA.md','docs/demo/PRODUCT_DESCRIPTION.md'];
  for(const file of historicalFiles){
    const text=read(root,file,issues);if(text===null)continue;
    for(const field of ['status: historical','appliesTo: v1.4.0','notForCompetitionDemo: true','supersededBy:'])if(!text.slice(0,300).includes(field))issues.push(issue(file,1,`missing historical metadata: ${field}`));
  }
  const archivedFiles=[
    {file:'docs/demo/VIDEO_SHOT_LIST.md',fields:['status: archived','appliesTo: v1.4.0','notForCompetitionDemo: true','supersededBy:']},
    {file:'docs/archive/README_V1_0_TO_V1_3.md',fields:['status: archived','appliesTo: v1.0-v1.3','notForCompetitionDemo: true','supersededBy: ../../README.md']},
  ];
  for(const {file,fields} of archivedFiles){
    const text=read(root,file,issues);if(text===null)continue;
    for(const field of fields)if(!text.slice(0,300).includes(field))issues.push(issue(file,1,`missing archived metadata: ${field}`));
    issues.push(...checkRelativeLinks(root,file,text));
  }

  for(const file of activeFiles){
    const text=read(root,file,issues);if(text===null)continue;
    issues.push(...checkActiveMarkdown(root,file,text));
  }

  const releaseFile='docs/release/V1_4_2_RELEASE.md',release=read(root,releaseFile,issues);
  if(release!==null){const lower=release.toLowerCase();for(const phrase of ['deepseek','postgresql lexical','schema, source membership','application rules map','deterministic routing','protected initial-assignment transaction','manager review','llm does not select'])if(!lower.includes(phrase))issues.push(issue(releaseFile,1,`canonical narrative is missing: ${phrase}`));}

  const manifestFile=metadata?.evidenceManifest??'docs/release/V1_4_2_EVIDENCE_MANIFEST.json';
  const manifest=parseJson(root,manifestFile,issues);
  if(manifest){
    if(manifest.release?.version!==expected.version||manifest.release?.baseCommit!==expected.commit||manifest.release?.baseTree!==expected.tree||manifest.release?.baseTag!==expected.tag)issues.push(issue(manifestFile,1,'evidence manifest release identity differs from canonical metadata'));
    if(manifest.providerExecution?.liveDeepSeekAuthorized!==false||manifest.providerExecution?.liveDeepSeekRun!==false)issues.push(issue(manifestFile,1,'evidence manifest must record no authorized or executed live DeepSeek call'));
    const attestation=manifest.identityLayers?.finalReleaseAttestation;
    const attestationFields=['release commit','release tree','signed tag name','annotated tag object','signer and verification status','GitHub Actions run ID','required check results','artifact SHA-256 values'];
    if(attestation?.status!=='not-recorded-in-repository'||!attestationFields.every(field=>attestation.requiredFields?.includes(field)))issues.push(issue(manifestFile,1,'final release identity must be deferred to the complete external post-tag attestation'));
    for(const field of ['releaseCommit','releaseTree','finalTag','signedTag','annotatedTagObject'])if(Object.hasOwn(manifest.release??{},field))issues.push(issue(manifestFile,1,`candidate manifest must not claim final release field: ${field}`));
    const artifacts=manifest.externalArtifactSets?.flatMap(set=>set.artifacts??[])??[];
    if(artifacts.length<6)issues.push(issue(manifestFile,1,'evidence manifest must index the six frozen evidence artifacts'));
    for(const artifact of artifacts)if(!/^[A-F0-9]{64}$/.test(artifact.sha256??''))issues.push(issue(manifestFile,1,`invalid SHA-256 for ${artifact.path??'unknown artifact'}`));
  }

  const sources={
    '.env.example':read(root,'.env.example',issues),
    'docker-compose.yml':read(root,'docker-compose.yml',issues),
    'packages/config/src/index.ts':read(root,'packages/config/src/index.ts',issues),
    'scripts/demo/release-core.mjs':read(root,'scripts/demo/release-core.mjs',issues),
    'scripts/demo/preflight.mjs':read(root,'scripts/demo/preflight.mjs',issues),
    'docs/release/V1_4_2_RUNBOOK.md':read(root,'docs/release/V1_4_2_RUNBOOK.md',issues),
    'docs/release/V1_4_2_MACHINE_CHECKLIST.md':read(root,'docs/release/V1_4_2_MACHINE_CHECKLIST.md',issues),
    'apps/api/src/app.ts':read(root,'apps/api/src/app.ts',issues),
  };
  expectContains(issues,'.env.example',sources['.env.example'],`OLLAMA_MODEL=${expected.llm}`,'environment example has a different rollback model');
  expectContains(issues,'docker-compose.yml',sources['docker-compose.yml'],`OLLAMA_MODEL:-${expected.llm}`,'Compose has a different rollback model');
  expectContains(issues,'packages/config/src/index.ts',sources['packages/config/src/index.ts'],'RELEASE_METADATA.rollbackProfile.generationModel','runtime config must consume canonical rollback metadata');
  expectContains(issues,'scripts/demo/release-core.mjs',sources['scripts/demo/release-core.mjs'],'releaseMetadata.rollbackProfile.generationModel','preflight core must consume canonical rollback metadata');
  expectContains(issues,'scripts/demo/preflight.mjs',sources['scripts/demo/preflight.mjs'],'REQUIRED_LLM','preflight must validate the canonical rollback model');
  expectContains(issues,'docs/release/V1_4_2_RUNBOOK.md',sources['docs/release/V1_4_2_RUNBOOK.md'],expected.llm,'rollback runbook has a different model');
  expectContains(issues,'docs/release/V1_4_2_MACHINE_CHECKLIST.md',sources['docs/release/V1_4_2_MACHINE_CHECKLIST.md'],expected.llm,'machine checklist has a different rollback model');
  expectContains(issues,'apps/api/src/app.ts',sources['apps/api/src/app.ts'],'setTitle(RELEASE_METADATA.apiTitle)','Swagger title must consume canonical release metadata');
  expectContains(issues,'apps/api/src/app.ts',sources['apps/api/src/app.ts'],'setVersion(RELEASE_METADATA.releaseVersion)','Swagger version must consume canonical release metadata');
  for(const [file,text] of Object.entries(sources)){const match=text?.match(/qwen2\.5:7b-instruct/);if(match)issues.push(issue(file,lineOf(text,match.index),'stale rollback model remains in a current source'));}

  const ciFile='.github/workflows/ci.yml',ci=read(root,ciFile,issues);
  if(ci!==null){
    issues.push(...checkCredentialArtifactPaths(ciFile,ci));
    issues.push(...checkGitHubActionsRuntimeManifest(ciFile,ci));
  }

  const packageFile='package.json',pkg=parseJson(root,packageFile,issues);
  if(pkg?.scripts?.['verify:docs:current']!=='node scripts/verification/Verify-Current-ReleaseDocs.mjs')issues.push(issue(packageFile,1,'missing or incorrect verify:docs:current command'));
  if(pkg?.scripts?.['verify:docs:current']?.includes('Verify-M0'))issues.push(issue(packageFile,1,'historical M0 checker must not be part of the current release gate'));
  return issues;
}

export function printCurrentReleaseDocsResult(root=process.cwd()){
  const issues=validateCurrentReleaseDocs(root);
  if(issues.length){for(const item of issues)console.error(`${item.file}:${item.line}: error: ${item.message}`);console.error(`Current release documentation gate: FAIL (${issues.length} error(s))`);return 1;}
  console.log('Current release documentation gate: PASS (links, metadata, classifications, tables, evidence, rollback configuration)');return 0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=printCurrentReleaseDocsResult(fileURLToPath(new URL('../..',import.meta.url)));
