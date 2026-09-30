import {test,expect} from '@playwright/test';
/* global document, window -- Playwright page.evaluate executes in the browser. */

async function signIn(page,email){
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Mật khẩu',{exact:true}).fill('MobiFlowDemo!2026');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function saved(page){await expect(page.getByRole('status').filter({hasText:'Đã lưu thay đổi.'})).toBeVisible();}
async function refresh(page){await page.getByRole('button',{name:'Tải lại',exact:true}).click();await expect(page.getByText('Đang tải yêu cầu…')).toBeHidden();}
const errors=[];
test('M3 real browser: three-role manual workflow, waiting/reopen, stale protection, notification and responsive UI',async({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
  const [user,manager,staff]=await Promise.all(contexts.map(c=>c.newPage()));
  for(const page of [user,manager,staff])page.on('pageerror',e=>errors.push(e.message));
  try{
    await signIn(user,'user@mobiflow.local');
    await user.getByRole('link',{name:'Tạo yêu cầu',exact:true}).click();
    const title='Kiểm thử trình duyệt M3 '+Date.now();
    await user.getByLabel('Tiêu đề (không bắt buộc)').fill(title);
    await user.getByLabel('Mô tả yêu cầu',{exact:true}).fill('Thiết bị IoT tại văn phòng demo mất kết nối từ sáng nay.');
    await user.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();
    await expect(user.getByRole('heading',{name:title,exact:true})).toBeVisible();
    // M4 completes automatic intake first; all M3 manual workflow assertions remain.
    await expect(user.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible({timeout:300000});
    await refresh(user);
    const id=user.url().split('/').at(-1);
    await signIn(manager,'manager@mobiflow.local');
    await manager.goto('/manager/requests/'+id);
    await expect(manager.getByRole('heading',{name:title,exact:true})).toBeVisible();
    await manager.getByLabel('Ưu tiên đề xuất').selectOption('HIGH');
    await manager.getByLabel('Nhóm / Nhân sự xử lý').selectOption({label:'Network Operations / IoT Specialist'});
    await manager.getByLabel('Các bước xử lý (mỗi dòng một bước bắt buộc)').fill('Kiểm tra nguồn và tín hiệu thiết bị');
    await manager.getByLabel('Lý do phương án / lý do để trống checklist').fill('Phương án xử lý thủ công cho môi trường demo');
    await manager.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await saved(manager);
    await manager.getByRole('button',{name:'Gửi duyệt phương án',exact:true}).click();
    await expect(manager.getByRole('button',{name:'Duyệt và phân công',exact:true})).toBeVisible();
    await manager.getByLabel('Xác nhận tiếp tục dù thiếu địa điểm',{exact:true}).check();
    await manager.getByLabel('Xác nhận tiếp tục dù thiếu thời điểm bắt đầu',{exact:true}).check();
    await manager.getByRole('button',{name:'Duyệt và phân công',exact:true}).click();
    await expect(manager.getByText('Đã phân công · HIGH',{exact:true})).toBeVisible();
    // USER still holds the pre-approval version: stale message must not be silently retried.
    await user.getByLabel('Nội dung tin nhắn',{exact:true}).fill('Tin nhắn trên phiên bản cũ');
    await user.getByRole('button',{name:'Gửi tin nhắn',exact:true}).click();
    await expect(user.getByRole('main').getByRole('alert')).toContainText('Yêu cầu đã thay đổi');
    await expect(user.getByRole('button',{name:'Gửi tin nhắn',exact:true})).toBeDisabled();
    await user.getByRole('button',{name:'Tải lại dữ liệu'}).click();
    await expect(user.getByText('Đã phân công · HIGH',{exact:true})).toBeVisible();
    await signIn(staff,'staff.iot@mobiflow.local');
    await staff.getByRole('link').filter({hasText:title}).first().click();
    await staff.getByRole('button',{name:'Bắt đầu xử lý',exact:true}).click();
    await expect(staff.getByText('Đang xử lý · HIGH',{exact:true})).toBeVisible();
    await staff.getByLabel('Câu hỏi gửi người yêu cầu').fill('Vui lòng xác nhận vị trí cụ thể của thiết bị');
    await staff.getByRole('button',{name:'Yêu cầu bổ sung thông tin',exact:true}).click();
    await expect(staff.getByText('Chờ bổ sung · HIGH',{exact:true})).toBeVisible();
    await refresh(user);
    await user.getByLabel('Thông tin bổ sung',{exact:true}).fill('Thiết bị được đặt tại tầng 2 phòng họp');
    await user.getByRole('button',{name:'Cung cấp thông tin',exact:true}).click();
    await expect(user.getByText('Đang xử lý · HIGH',{exact:true})).toBeVisible();
    await refresh(staff);
    await staff.getByRole('button',{name:'Đánh dấu hoàn thành',exact:true}).click();await saved(staff);
    async function resolve(){
      await staff.getByLabel('Nguyên nhân',{exact:true}).fill('Nguồn cấp thiết bị bị gián đoạn');
      await staff.getByLabel('Cách khắc phục',{exact:true}).fill('Thay nguồn và khởi động lại thiết bị');
      await staff.getByLabel('Kết quả kiểm chứng',{exact:true}).fill('Kiểm tra kết nối hoạt động ổn định');
      await staff.getByRole('button',{name:'Hoàn tất xử lý',exact:true}).click();
      await expect(staff.getByText('Chờ xác nhận · HIGH',{exact:true})).toBeVisible();
    }
    await resolve();await refresh(user);
    await user.getByRole('group',{name:'Yêu cầu xử lý lại',exact:true}).getByLabel('Lý do',{exact:true}).fill('Kết nối vẫn chưa ổn định sau khi sử dụng');
    await user.getByRole('button',{name:'Yêu cầu xử lý lại',exact:true}).click();
    await expect(user.getByText('Đang xử lý · HIGH',{exact:true})).toBeVisible();
    await refresh(staff);await resolve();await refresh(user);
    await user.getByRole('button',{name:'Xác nhận đã giải quyết',exact:true}).click();
    await expect(user.getByText('Đã đóng · HIGH',{exact:true})).toBeVisible();
    await expect(user.getByRole('heading',{name:'Trao đổi và dòng thời gian'})).toBeVisible();
    for(const width of [360,768,1440]){
      await user.setViewportSize({width,height:900});
      expect(await user.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    }
    await user.screenshot({path:'artifacts/m3/workflow-closed.png',fullPage:true});
    await user.getByRole('link',{name:'Thông báo',exact:true}).click();
    await expect(user.getByRole('heading',{name:'Thông báo',exact:true})).toBeVisible();
    await user.getByRole('button',{name:'Đánh dấu đã đọc',exact:true}).first().click();
    await expect(user.getByText(/Đã đọc/).first()).toBeVisible();
    await user.goto('/manager/requests');
    await expect(user.getByRole('heading',{name:'403 · Không có quyền truy cập'})).toBeVisible();
    await staff.goto('/staff/requests/11111111-1111-4111-8111-111111111111');
    await expect(staff.getByRole('main').getByRole('alert')).toContainText('Không tìm thấy');
    expect(errors).toEqual([]);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

test('M3 login keyboard focus and API offline error are recoverable',async({page})=>{
  await page.goto('/login');
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Đi tới nội dung'})).toBeFocused();
  await page.getByLabel('Email',{exact:true}).fill('user@mobiflow.local');
  await page.getByLabel('Mật khẩu',{exact:true}).fill('MobiFlowDemo!2026');
  await page.route('**/api/v1/auth/login',route=>route.abort());
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Đăng nhập không thành công');
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('user@mobiflow.local');
  await page.unroute('**/api/v1/auth/login');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL('/user/dashboard');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Tổng quan',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();
  await expect(page).toHaveURL('/login');
});

