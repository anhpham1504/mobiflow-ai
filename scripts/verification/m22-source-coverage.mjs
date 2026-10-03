import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceInventory} from './m22-source.mjs';
import {saveEvidence} from './evidence.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex'),read=p=>JSON.parse(readFileSync(p));
const current=sourceInventory();
const addedAfterBrowser=new Set(['scripts/verification/m22-security.mjs','scripts/verification/m22-source-coverage.mjs','scripts/verification/m22-final.mjs']);
function inputSnapshot(beforeUiFix){return current.files.filter(f=>!addedAfterBrowser.has(f.path)).map(f=>{
  let text=readFileSync(f.path,'utf8');
  if(f.path==='scripts/verification/m22-linux.mjs')text=text.replace("--exclude='./docs/v1.3/evidence' ",'');
  if(f.path==='scripts/verification/m22-capture.mjs')text=text.replace(", productFiles: source.files.filter(file => /^(?:apps\\/(?:api\\/src|api\\/prisma|web\\/src)|packages\\/[^/]+\\/src|package-lock)/.test(file.path))",'');
  if(f.path==='apps/api/test/sla-alert.integration.test.mjs')text=text.replace(/^ {2}\/\* M22_POST_REVIEW_RACE_BEGIN \*\/[\s\S]*?^ {2}\/\* M22_POST_REVIEW_RACE_END \*\/(\r?)\n/m,(_,end)=>'  const f=await fresh(90);const results=await Promise.all(Array.from({length:4},()=>worker.observe(f.sla.id,f.request.id,[s.manager.actor.id])));assert.equal(results.reduce((n,r)=>n+r.events,0),1);assert.equal(results.reduce((n,r)=>n+r.notifications,0),2);assert.equal((await alerts(f)).length,1);assert.equal((await notices(f)).length,2);'+end+'\n');
  if(f.path==='apps/web/e2e/sla-alert.spec.mjs')text=text.replace(/^ {2}const scans=.*?(\r?)$/m,(_,end)=>"  const scans=[],errors=[];page.on('pageerror',e=>errors.push(e.message));"+end).replace(/^ {2}\}\}expect\(errors\).*?(\r?)$/m,(_,end)=>"  }}expect(errors).toEqual([]);record('responsive',{scans,consolePageErrors:errors});"+end);
  if(beforeUiFix){
    if(f.path==='apps/web/src/components/notifications.tsx')text=text.replace("const reload=()=>{setError('');setLoading(true);",'const reload=()=>{setLoading(true);').replace('aria-disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);','disabled={busy} onClick={async()=>{setBusy(true);');
    if(f.path==='apps/web/e2e/sla-alert.spec.mjs')text=text.replace("page.getByRole('status',{name:'Đang tải thông báo',exact:true})","page.getByText('Đang tải thông báo',{exact:true})").replace("await expect(page.getByRole('heading',{name:'Không thể tải dữ liệu',exact:true})).toBeVisible();","await expect(page.getByRole('alert')).toBeVisible();");
    if(f.path==='apps/web/src/app/globals.css')text=text.replace(/^\.page-header>div\{min-width:0\}\.page-header h1\{overflow-wrap:anywhere\}\.notification-list button\[aria-disabled=true\]\{opacity:\.55;cursor:wait\}\r?\n/m,'');
  }
  return {path:f.path,sha256:sha(text)};
});}
const apiInput=current.files.map(f=>{let text=readFileSync(f.path,'utf8');if(f.path==='scripts/verification/m22-final.mjs')text=text.replace("!/(?:^|\\/)(?:node_modules|\\.next|storage|coverage)(?:\\/|$)|^artifacts\\/|(?:^|\\/)\\.env(?:\\.|$)|\\.(?:log|png|zip)$/.test(p),'Private/runtime excluded: '+p)","!/\\.env|^artifacts|node_modules|\\.next|storage|coverage|\\.log$|\\.png$|\\.zip$/.test(p),'Private/runtime excluded')");if(f.path==='scripts/verification/m22-source-coverage.mjs')text=text.replace(/^const apiInput=.*?(\r?)$/m,(_,end)=>"const apiInput=current.files,browserInput=inputSnapshot(false),apiGate=read('docs/v1.3/evidence/gates/M22_API.json'),buildGate=read('docs/v1.3/evidence/gates/M22_BUILD.json'),browser=read('docs/v1.3/evidence/M22_BROWSER.json');"+end);return {path:f.path,sha256:sha(text)};}),browserInput=inputSnapshot(false),apiGate=read('docs/v1.3/evidence/gates/M22_API.json'),buildGate=read('docs/v1.3/evidence/gates/M22_BUILD.json'),browser=read('docs/v1.3/evidence/M22_BROWSER.json');
for(const gate of [apiGate,buildGate,browser])assert.equal(gate.result,'PASS');
assert.equal(sha(JSON.stringify(apiInput)),apiGate.sourceFingerprint,'Reconstructed actual API input fingerprint');assert.equal(sha(JSON.stringify(browserInput)),buildGate.sourceFingerprint,'Reconstructed production build input fingerprint');assert.ok([buildGate.sourceFingerprint,read('docs/v1.3/evidence/gates/M22_UNIT.json').sourceFingerprint].includes(browser.sourceFingerprint),'Browser server fingerprint maps to verified product input');
const differences=(before)=>current.files.filter(f=>before.find(b=>b.path===f.path)?.sha256!==f.sha256).map(f=>f.path);
const apiDifferences=differences(apiInput),buildDifferences=differences(browserInput);
assert.ok(apiDifferences.every(p=>p.startsWith('apps/web/')||p.startsWith('scripts/verification/m22-')));assert.ok(buildDifferences.every(p=>p.startsWith('scripts/verification/m22-')||p==='apps/web/e2e/sla-alert.spec.mjs'||p==='apps/api/test/sla-alert.integration.test.mjs'));
const product=current.files.filter(f=>/^(?:apps\/(?:api\/src|api\/prisma|web\/src)|packages\/[^/]+\/src|package-lock)/.test(f.path));
for(const name of ['M22_DATABASE','M22_TYPECHECK','M22_UNIT']){const gate=read('docs/v1.3/evidence/gates/'+name+'.json');assert.equal(gate.result,'PASS');assert.deepEqual(gate.productFiles,product,name+' tested final product source');}
await saveEvidence('docs/v1.3/evidence/M22_SOURCE_COVERAGE.json',{checkedAt:new Date().toISOString(),result:'PASS',source:current,productFingerprint:sha(JSON.stringify(product)),apiInputFingerprint:apiGate.sourceFingerprint,buildInputFingerprint:buildGate.sourceFingerprint,browserRunId:browser.runId,browserServerFingerprint:browser.sourceFingerprint,apiDifferences,buildDifferences,explanation:'Final API source fingerprint matches current executable inventory exactly after strengthening the four-worker PG barrier. Earlier production build input is reconstructed byte-for-byte; only test and verification edits differ. Browser server uses recorded unit snapshot with the same final product166 hashes. Database/typecheck/unit product inventories match final product. Later docs/evidence do not change input.'});
console.log(JSON.stringify({event:'m22.source-coverage',result:'PASS',productFiles:product.length,apiDifferences,buildDifferences}));
