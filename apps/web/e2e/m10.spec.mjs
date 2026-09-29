import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {signIn} from './m4-helpers.mjs';
/* global document,window */

function watch(page){const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});return errors;}
async function noOverflow(page,width){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}

test('M10 demonstrated manager surface is responsive, keyboard reachable, and axe clean',async({page})=>{
  const errors=watch(page);await signIn(page,'manager@mobiflow.local');await page.goto('/manager/analytics');
  await expect(page.getByRole('heading',{name:/Chất lượng AI/})).toBeVisible();await expect(page.getByText(/M10 · BẰNG CHỨNG PHÁT HÀNH CỤC BỘ/)).toBeVisible();
  await expect(page.getByText('Không áp dụng',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Chất lượng & analytics'})).toHaveAttribute('aria-current','page');
  for(const width of [360,768,1440])await noOverflow(page,width);
  await page.setViewportSize({width:1440,height:900});await page.keyboard.press('Home');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Đi tới nội dung'})).toBeFocused();await page.keyboard.press('Enter');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('main');
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(accessibility.violations).toEqual([]);
  await page.screenshot({path:'artifacts/m10/analytics-1440.png',fullPage:true});expect(errors).toEqual([]);
});

test('M10 analytics dependency error preserves a recoverable retry',async({page})=>{
  const errors=watch(page);await signIn(page,'manager@mobiflow.local');await page.route('**/api/v1/analytics?**',route=>route.abort());await page.goto('/manager/analytics');
  await expect(page.getByRole('heading',{name:'Chưa thể tải analytics'})).toBeVisible();await page.unroute('**/api/v1/analytics?**');await page.getByRole('button',{name:'Thử lại'}).click();
  await expect(page.getByRole('heading',{name:/Chất lượng AI/})).toBeVisible();expect(errors.filter(message=>!message.includes('ERR_FAILED'))).toEqual([]);
});

test('M10 truthful AI degraded state leaves the core UI usable',async({page})=>{
  const errors=watch(page);await page.route('**/health/ready',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{status:'DEGRADED',coreReady:true,aiReady:false,rag:{enabled:true,status:'NOT_READY',embedding:'DOWN',knowledge:'EMPTY',errorCode:'EMBEDDING_UNAVAILABLE',documents:0,chunks:0,checkedAt:null},checkedAt:new Date().toISOString(),components:{API:{status:'UP',code:'OK'},DATABASE:{status:'UP',code:'OK'},VECTOR_EXTENSION:{status:'UP',code:'OK'},OLLAMA_SERVER:{status:'DOWN',code:'UNAVAILABLE'},OLLAMA_LLM_MODEL:{status:'DOWN',code:'UNAVAILABLE'},OLLAMA_EMBEDDING_MODEL:{status:'DOWN',code:'UNAVAILABLE'}}},requestId:'00000000-0000-4000-8000-000000000001'})}));
  await page.goto('/');await expect(page.getByText('Hạ tầng cốt lõi đã sẵn sàng.')).toBeVisible();await expect(page.getByText('AI chưa sẵn sàng đầy đủ. Trạng thái này không làm dừng API hoặc giao diện.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Đăng nhập'})).toBeVisible();await noOverflow(page,360);expect(errors).toEqual([]);
});
