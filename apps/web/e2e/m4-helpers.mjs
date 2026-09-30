import {expect} from '@playwright/test';
export async function signIn(page,email){
  await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill('MobiFlowDemo!2026');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);
}
export async function create(page,title,description){
  await page.getByRole('link',{name:'Tạo yêu cầu',exact:true}).click();await page.getByLabel('Tiêu đề Không bắt buộc',{exact:true}).fill(title);await page.getByRole('textbox',{name:/^Mô tả yêu cầu/}).fill(description);
  await page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();return page.url().split('/').at(-1);
}
