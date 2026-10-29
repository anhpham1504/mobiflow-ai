// Presentation only: controls must continue submitting their original enum values.
export const priorityLabels: Record<string, string> = { LOW:'Thấp', MEDIUM:'Trung bình', HIGH:'Cao', URGENT:'Khẩn cấp' };
export const categoryLabels: Record<string, string> = { NETWORK:'Mạng', IOT:'IoT', BILLING:'Cước phí', ACCOUNT:'Tài khoản', SERVICE:'Dịch vụ', OTHER:'Khác' };
export const subcategoryLabels: Record<string, string> = {
  IOT_CONNECTIVITY:'Kết nối IoT', MOBILE_NETWORK:'Mạng di động', DEVICE_CONFIGURATION:'Cấu hình thiết bị',
  BILLING_DISCREPANCY:'Sai lệch cước phí', ACCESS_ISSUE:'Sự cố truy cập', ACTIVATION:'Kích hoạt dịch vụ',
  INTERNAL_SUPPORT:'Hỗ trợ nội bộ', UNSPECIFIED:'Chưa xác định',
};
export const statusLabels: Record<string, string> = { NEW:'Mới tiếp nhận', AI_ANALYZING:'Đang phân tích', TRIAGED:'Đã phân loại', PENDING_APPROVAL:'Chờ duyệt', ASSIGNED:'Đã phân công', IN_PROGRESS:'Đang xử lý', WAITING_USER:'Chờ bổ sung', RESOLVED:'Chờ xác nhận', CLOSED:'Đã đóng', CANCELED:'Đã hủy' };
export const actorLabels: Record<string, string> = { USER:'Người yêu cầu', STAFF:'Nhân viên xử lý', MANAGER:'Quản lý', AI:'AI hỗ trợ', SYSTEM:'Hệ thống' };
export const eventLabels: Record<string, string> = {
  CREATE:'Tiếp nhận yêu cầu', MANUAL_TRIAGE:'Phân loại thủ công', MANUAL_DRAFT_SAVED:'Lưu bản nháp thủ công',
  SUBMIT_FOR_APPROVAL:'Gửi phương án để duyệt', APPROVE_AND_ASSIGN:'Duyệt và phân công', REJECT_APPROVAL:'Từ chối phương án',
  APPROVE:'Duyệt phương án', ASSIGN:'Phân công xử lý', START:'Bắt đầu xử lý', START_WORK:'Bắt đầu xử lý',
  REQUEST_INFO:'Yêu cầu bổ sung thông tin', REQUEST_USER_INFO:'Yêu cầu bổ sung thông tin',
  PROVIDE_INFO:'Người gửi đã bổ sung thông tin', USER_PROVIDE_INFO:'Người gửi đã bổ sung thông tin',
  RESOLVE:'Hoàn tất xử lý', REOPEN:'Yêu cầu xử lý lại', USER_REOPEN:'Yêu cầu xử lý lại', CONFIRM:'Xác nhận và đóng', USER_CONFIRM:'Xác nhận và đóng',
  CANCEL:'Hủy yêu cầu', REASSIGN:'Phân công lại', PRIORITY:'Đổi ưu tiên', CHANGE_PRIORITY:'Đổi ưu tiên',
  MESSAGE:'Tin nhắn', FEEDBACK:'Đánh giá dịch vụ', CHECKLIST_ADD:'Thêm bước xử lý', CHECKLIST_EDIT:'Cập nhật checklist', CHECKLIST_CHANGED:'Cập nhật checklist',
  COMPLETE_CHECKLIST_ITEM:'Hoàn thành bước xử lý', UNCOMPLETE_CHECKLIST_ITEM:'Bỏ hoàn thành bước xử lý', WAIVE_CHECKLIST_ITEM:'Miễn bước xử lý',
  SLA_POLICY_CHANGED:'Cập nhật chính sách thời hạn', TEMPLATE_USED:'Sử dụng mẫu vào bản nháp', INTERNAL_NOTE_CREATED:'Ghi nhận nội bộ',
  START_AI_ANALYSIS:'Bắt đầu phân tích AI', COMPLETE_AI_ANALYSIS:'Hoàn tất phân tích AI', FAIL_AI_ANALYSIS:'Phân tích AI không thành công',
  AI_ANALYSIS_QUEUED:'Đã xếp hàng phân tích AI', AI_RETRY_QUEUED:'Đã yêu cầu thử lại AI', AI_ANALYSIS_FAILED:'Phân tích AI không thành công',
  KNOWLEDGE_RETRIEVED:'Tra cứu nguồn tri thức', COPILOT_ACTION_QUEUED:'Đã xếp hàng hỗ trợ Copilot',
  RECOMMENDATION_QUEUED:'Đã xếp hàng đề xuất phương án', RECOMMENDATION_STALE:'Đề xuất dựa trên dữ liệu cũ', RECOMMENDATION_FAILED:'Không tạo được đề xuất', RECOMMENDATION_ATTEMPT_FAILED:'Lần tạo đề xuất không thành công',
  AI_RECOMMENDATION_V2_CREATED:'AI đã tạo đề xuất để quản lý xem xét', AI_RECOMMENDATION_V2_ACCEPTED:'Quản lý đã chấp nhận đề xuất', AI_RECOMMENDATION_V2_MODIFIED:'Quản lý đã chỉnh sửa đề xuất', AI_RECOMMENDATION_V2_REJECTED:'Quản lý đã từ chối đề xuất',
  REQUEST_AUTO_ASSIGNED:'Hệ thống tự động điều phối', AUTO_ASSIGN:'Hệ thống tự động điều phối', AUTO_ROUTING_REVIEW_REQUIRED:'Chuyển quản lý xử lý ngoại lệ điều phối',
  RESOLUTION_SUMMARY_QUEUED:'Đã xếp hàng tóm tắt xử lý', COPILOT_SUCCEEDED:'Hoàn tất hỗ trợ Copilot', COPILOT_FAILED:'Hỗ trợ Copilot không thành công',
};
export function classificationLabel(category: string | null, subcategory: string | null) {
  return [category ? categoryLabels[category] ?? category : 'Chưa duyệt', subcategory ? subcategoryLabels[subcategory] ?? subcategory : ''].filter(Boolean).join(' / ');
}
