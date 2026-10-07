/* global document */
import fs from 'node:fs';
import { expect, test as baseTest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const viewports = [[320,760],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080]];
const sessions = new Map(), accounts = new WeakMap();
const activity = new Map();
export const test = baseTest.extend({
  sessionEvidence: [async ({ page }, use, testInfo) => {
    const errors=[],consoleMessages=[],network=[],failed=[];
    page.on('request',request=>{
      const email=accounts.get(page),url=new URL(request.url());
      if(email&&url.pathname.startsWith('/api/v1/')&&request.method()==='GET'){
        const times=activity.get(email)??[];times.push(Date.now());activity.set(email,times);
      }
    });
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(['error','warning'].includes(message.type()))consoleMessages.push({type:message.type(),text:message.text(),location:message.location()});});
    page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/v1/'))network.push({method:response.request().method(),url:response.url(),status:response.status()});});
    page.on('requestfailed',request=>{if(new URL(request.url()).pathname.startsWith('/api/v1/'))failed.push({url:request.url(),error:request.failure()?.errorText});});
    await use();
    const email = accounts.get(page);
    if (email) {
      const cookies = await page.context().cookies();
      if (cookies.some(cookie => cookie.httpOnly)) sessions.set(email, cookies); else sessions.delete(email);
    }
    await testInfo.attach('runtime-network',{body:JSON.stringify({errors,consoleMessages,network,failed}),contentType:'application/json'});
    expect(errors).toEqual([]);
    const unexpected=consoleMessages.filter(message=>message.type==='error' && !(
      message.text.includes('unsafe-eval') && message.text.includes('script-src') ||
      message.text.startsWith('eval() is not supported in this environment.') && message.text.includes('React will never use eval() in production mode') && message.location.url.includes('/_next/static/chunks/') ||
      /Failed to load resource: the server responded with a status of (401|403|404)/.test(message.text)
    ));
    expect(unexpected,'Unexpected application console errors; baseline dev CSP and intended HTTP negatives are retained in evidence').toEqual([]);
    expect(failed.filter(request=>!request.error?.includes('ERR_ABORTED'))).toEqual([]);
    expect(network.filter(response=>response.status>=500)).toEqual([]);
    expect(network.filter(response=>response.status===429),'Validation must respect the live API rate limits').toEqual([]);
    expect(network.filter(response=>response.method!=='GET'&&!new URL(response.url).pathname.startsWith('/api/v1/auth/')),'UI remediation validation must not submit business mutations').toEqual([]);
  }, { auto: true }],
});
export async function login(page, role, email = role === 'STAFF' ? 'staff.iot@mobiflow.local' : role.toLowerCase() + '@mobiflow.local', force = false) {
  accounts.set(page, email);
  const recent=(activity.get(email)??[]).filter(time=>time>Date.now()-60000);
  if(recent.length>=70) await new Promise(resolve=>setTimeout(resolve,Math.max(1,recent[0]+60100-Date.now())));
  if (!force && sessions.has(email)) {
    // Reuse genuine browser cookies; the application still refreshes against the live API.
    await page.context().addCookies(sessions.get(email));
    await page.goto('/' + role.toLowerCase() + '/dashboard');
    await expect(page.locator('.page-header h1')).toBeVisible();
    await expect(page).toHaveURL('http://localhost:33700/' + role.toLowerCase() + '/dashboard');
    return;
  }
  const guide = fs.readFileSync(new URL('../../../docs/demo/LOCAL_DEMO_ACCOUNTS.md', import.meta.url), 'utf8');
  const password = guide.match(/password for every seeded account is `([^`]+)`/)[1];
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByRole('textbox', { name: /^Mật khẩu/ }).fill(password);
  const authentication = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/login');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await authentication).status(), 'Live demo authentication must succeed before UI validation').toBe(200);
  await page.waitForURL('**/' + role.toLowerCase() + '/dashboard');
}
export async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
export async function axe(page, testInfo, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']).analyze();
  await testInfo.attach(label, { body: JSON.stringify({ violations: result.violations, incomplete: result.incomplete }), contentType: 'application/json' });
  expect(result.violations.filter(v => ['critical', 'serious'].includes(v.impact))).toEqual([]);
}
