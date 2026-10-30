import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {checkActiveMarkdown,checkCredentialArtifactPaths,checkGitHubActionsRuntimeManifest,checkRelativeLinks,scanMarkdownQuality,validateCurrentReleaseDocs} from './Verify-Current-ReleaseDocs.mjs';

const runtimeManifestWorkflow=({jobEnv=[],initialization=[],create=[],cleanup=[],extraSteps=[]}={})=>[
  'jobs:',
  '  postgresql-critical-integration:',
  '    runs-on: ubuntu-latest',
  '    env:',
  '      DEMO_MODE: "true"',
  ...jobEnv,
  '    steps:',
  '      - run: npm ci',
  '      - name: Initialize private runtime manifest path',
  '        shell: bash',
  '        run: |',
  ...(['          manifest_path="$RUNNER_TEMP/mobiflow-m24-runtime-private.json"','          printf \'M24_RUNTIME_MANIFEST=%s\\n\' "$manifest_path" >> "$GITHUB_ENV"',...initialization]),
  '      - name: Create least-privilege runtime role',
  '        shell: bash',
  '        run: |',
  ...(['          umask 077','          writeFileSync(path, data, {encoding:\'utf8\',mode:0o600})','          chmod 600 "$M24_RUNTIME_MANIFEST"',...create]),
  ...extraSteps,
  '      - name: Remove private runtime manifest',
  '        if: always()',
  '        shell: bash',
  '        run: |',
  ...(['          rm -f -- "${M24_RUNTIME_MANIFEST:-$RUNNER_TEMP/mobiflow-m24-runtime-private.json}"',...cleanup]),
].join('\n');

test('current release documentation gate passes the candidate tree',()=>{
  assert.deepEqual(validateCurrentReleaseDocs(fileURLToPath(new URL('../..',import.meta.url))),[]);
});

test('documentation fixtures report broken links, malformed encoding, malformed tables, placeholders and both Windows path forms with lines',()=>{
  const root=mkdtempSync(join(tmpdir(),'mobiflow-current-docs-'));
  try{
    mkdirSync(join(root,'docs'));const file='docs/fixture.md';
    const text=['# Fixture','[missing](missing.md)','','| A | B |','| -- |','TODO C:\\private\\file','C:/Users/private/file','[encoded](bad%ZZ.md)'].join('\n');
    writeFileSync(join(root,file),text);
    const issues=[...checkRelativeLinks(root,file,text),...scanMarkdownQuality(file,text)];
    assert.ok(issues.some(item=>item.line===2&&item.message.includes('broken relative link')));
    assert.ok(issues.some(item=>item.line===5&&item.message.includes('separator')));
    assert.ok(issues.some(item=>item.line===6&&item.message.includes('placeholder')));
    assert.ok(issues.some(item=>item.line===6&&item.message.includes('absolute local path')));
    assert.ok(issues.some(item=>item.line===7&&item.message.includes('absolute local path')));
    assert.ok(issues.some(item=>item.line===8&&item.message.includes('malformed percent-encoded')));
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('README scanning does not stop at a historical marker',()=>{
  const text=['# Current','## Historical product narrative','C:/Users/private/file'].join('\n');
  const issues=checkActiveMarkdown(process.cwd(),'README.md',text);
  assert.ok(issues.some(item=>item.line===3&&item.message.includes('absolute local path')));
});

test('invalid runner context in job-level env is rejected with file and line',()=>{
  const text=runtimeManifestWorkflow({jobEnv:['      M24_RUNTIME_MANIFEST: ${{ runner.temp }}/private.json']});
  const issues=checkGitHubActionsRuntimeManifest('.github/workflows/ci.yml',text);
  assert.ok(issues.some(item=>item.line===6&&item.message.includes('runner context')&&item.message.includes('job-level env')));
});

test('valid RUNNER_TEMP initialization, GITHUB_ENV propagation, permissions and cleanup pass',()=>{
  assert.deepEqual(checkGitHubActionsRuntimeManifest('.github/workflows/ci.yml',runtimeManifestWorkflow()),[]);
});

test('missing GITHUB_ENV propagation is rejected',()=>{
  const text=runtimeManifestWorkflow().replace(' >> "$GITHUB_ENV"','');
  assert.ok(checkGitHubActionsRuntimeManifest('.github/workflows/ci.yml',text).some(item=>item.message.includes('$GITHUB_ENV')));
});

test('cleanup without the RUNNER_TEMP fallback is rejected',()=>{
  const text=runtimeManifestWorkflow().replace('${M24_RUNTIME_MANIFEST:-$RUNNER_TEMP/mobiflow-m24-runtime-private.json}','$M24_RUNTIME_MANIFEST');
  assert.ok(checkGitHubActionsRuntimeManifest('.github/workflows/ci.yml',text).some(item=>item.message.includes('fallback')));
});

test('missing restrictive mode or chmod is rejected',()=>{
  for(const removed of ["mode:0o600",'chmod 600 "$M24_RUNTIME_MANIFEST"']){
    const issues=checkGitHubActionsRuntimeManifest('.github/workflows/ci.yml',runtimeManifestWorkflow().replace(removed,''));
    assert.ok(issues.some(item=>item.message.includes('mode 0o600')||item.message.includes('chmod 600')));
  }
});

test('credential-bearing runtime files under artifacts are rejected with file and line',()=>{
  const text=['steps:','  - run: writeFileSync(\'artifacts/m24/runtime-private.json\', JSON.stringify({DATABASE_URL}))'].join('\n');
  assert.deepEqual(checkCredentialArtifactPaths('.github/workflows/ci.yml',text),[{file:'.github/workflows/ci.yml',line:2,message:'credential-bearing runtime files must not be written under artifacts/'}]);
});

test('step-level runner context is not falsely rejected as job-level env',()=>{
  const text=runtimeManifestWorkflow({extraSteps:['      - name: Valid step context','        env:','          STEP_TEMP: ${{ runner.temp }}/step.json','        run: echo "$STEP_TEMP"']});
  assert.deepEqual(checkGitHubActionsRuntimeManifest('.github/workflows/ci.yml',text),[]);
});
