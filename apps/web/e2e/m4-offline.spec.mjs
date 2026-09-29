import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {signIn,create} from './m4-helpers.mjs';
const evidencePath=process.env.M6_REGRESSION==='true'
  ?'docs/verification/evidence/M6_REGRESSION_M4_BROWSER_OFFLINE.json'
  :'docs/verification/evidence/M4_BROWSER_OFFLINE.json';
test('M4 actual unreachable Ollama: controlled failure, bounded progress, keyboard retry and persisted failure',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await signIn(page,'user@mobiflow.local');
  const id=await create(page,'M4 offline browser '+Date.now(),'17 SIM IoT tại KCN Amata mất kết nối từ 8 giờ sáng.');
  const panel=page.getByRole('region',{name:'Phân tích AI hỗ trợ'});
  await expect(panel.getByRole('status')).toContainText('AI local hiện không khả dụng.',{timeout:30000});
  await expect(page.getByLabel('Nội dung tin nhắn',{exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Thử phân tích lại'}).focus();await page.keyboard.press('Enter');
  await expect(panel.getByRole('status')).toContainText(/AI đang chờ xử lý|AI đang phân tích/);
  await expect(panel.getByRole('status')).toContainText('AI local hiện không khả dụng.',{timeout:30000});
  await page.reload();await expect(panel.getByRole('status')).toContainText('AI local hiện không khả dụng.');
  await page.screenshot({path:'artifacts/m4/offline.png',fullPage:true});expect(errors).toEqual([]);
  writeFileSync(evidencePath,JSON.stringify({checkedAt:new Date().toISOString(),result:'PASS',requestId:id,provider:'Actual unreachable Docker Ollama origin',retry:'FAILED, no synthetic analysis',pageErrors:errors},null,2)+'\n');
});
