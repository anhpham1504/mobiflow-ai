/* global window */
import { expect } from '@playwright/test';
import { test, login, noOverflow, viewports } from './remediation-support.mjs';

// Existing synthetic records only: no API mocks, seeding or business submissions.
for (const [role, email, ids] of [
  ['USER', 'user@mobiflow.local', ['60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000005','25e78cde-aef9-4ff4-9bae-805d89e1b6ac','f6ed710c-7d6e-40bb-ae4b-b17625a60ff7']],
  ['STAFF', 'staff.iot@mobiflow.local', ['60000000-0000-4000-8000-000000000005','f6ed710c-7d6e-40bb-ae4b-b17625a60ff7']],
  ['STAFF', 'staff.support@mobiflow.local', ['60000000-0000-4000-8000-000000000004']],
  ['STAFF', 'staff.billing@mobiflow.local', ['60000000-0000-4000-8000-000000000002']],
  ['MANAGER', 'manager@mobiflow.local', ['25e78cde-aef9-4ff4-9bae-805d89e1b6ac','60000000-0000-4000-8000-000000000002','f6ed710c-7d6e-40bb-ae4b-b17625a60ff7']],
]) {
  test(`Phase A: reachable request actions for ${email}`, async ({ page }, testInfo) => {
    const errors = [], positions = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, role, email);
    for (const id of ids) {
      await page.goto(`/${role.toLowerCase()}/requests/${id}`);
      const jump = page.getByRole('link', { name: 'Đi tới thao tác', exact: true });
      await expect(jump).toBeVisible();
      for (const [width,height] of viewports) {
        await page.setViewportSize({width,height});
        await page.evaluate(() => window.scrollTo(0,0));
        const top = await jump.evaluate(el => el.getBoundingClientRect().top);
        expect(top).toBeLessThan(height * 1.5);
        await jump.focus(); await page.keyboard.press('Enter');
        await expect(page.locator('#request-actions')).toBeFocused();
        expect(await page.locator('#request-actions').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);
        await noOverflow(page);
        positions.push({id,width,height,jumpTop:top});
      }
    }
    await testInfo.attach('action-positions', {body:JSON.stringify(positions),contentType:'application/json'});
    expect(errors).toEqual([]);
  });
}
