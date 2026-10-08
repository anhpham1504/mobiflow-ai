export function pageContext(path: string) {
  if (/^\/(user|staff|manager)\/requests\/[^/]+$/.test(path) && !path.endsWith('/new')) return 'Chi tiết yêu cầu';
  if (/^\/manager\/approvals\/[^/]+$/.test(path)) return 'Phê duyệt yêu cầu';
  if (/^\/knowledge\/sources\/[^/]+$/.test(path)) return 'Nguồn tham chiếu';
  const names: Record<string, string> = {
    '/':'Trạng thái hệ thống', '/login':'Đăng nhập', '/profile':'Hồ sơ cá nhân', '/notifications':'Thông báo',
    '/user/dashboard':'Tổng quan', '/user/requests':'Yêu cầu của tôi', '/user/requests/new':'Tạo yêu cầu mới',
    '/staff/dashboard':'Tổng quan công việc', '/staff/work-queue':'Công việc của tôi',
    '/manager/dashboard':'Tổng quan vận hành', '/manager/requests':'Quản lý yêu cầu', '/manager/approvals':'Phê duyệt yêu cầu',
    '/manager/templates':'Mẫu phản hồi & checklist', '/manager/routing-rules':'Quy tắc định tuyến',
    '/manager/analytics':'Chất lượng & analytics', '/manager/knowledge':'Kho tri thức',
  };
  return names[path] ?? 'Trang không tồn tại';
}
