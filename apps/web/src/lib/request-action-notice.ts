import type { RequestStatus } from '@mobiflow/contracts';

export function requestActionNotice(role: 'USER' | 'STAFF' | 'MANAGER', status: RequestStatus): string | null {
  if (role === 'USER' && (status === 'ASSIGNED' || status === 'IN_PROGRESS')) {
    return 'Hiện chưa có thao tác nào cần bạn thực hiện.';
  }
  if (role === 'STAFF' && status === 'WAITING_USER') {
    return 'Yêu cầu đang chờ người yêu cầu bổ sung thông tin. Sau khi họ cung cấp thông tin, bạn có thể tiếp tục xử lý. Hiện chưa có thao tác trạng thái nào cần thực hiện.';
  }
  if ((role === 'STAFF' || role === 'MANAGER') && status === 'RESOLVED') {
    return 'Yêu cầu đã được giải quyết và đang chờ người yêu cầu xác nhận kết quả hoặc yêu cầu xử lý lại. Hiện chưa có thao tác trạng thái nào dành cho vai trò của bạn.';
  }
  return null;
}
