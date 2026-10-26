# MobiFlow AI — Kịch bản chung kết 7 phút

Đội: **PentaPrime**

Sản phẩm: **MobiFlow AI**

Thông điệp: **AI đề xuất — con người quyết định.**

## Chuẩn bị trước khi bấm giờ

- Candidate URL: `http://127.0.0.1:35410`.
- Readiness: API `http://127.0.0.1:35411/health/ready` phải là `READY`, DeepSeek UP, lexical RAG READY.
- Mở sẵn ba cửa sổ/profile trình duyệt hoặc chuẩn bị đăng nhập nhanh theo vai trò.
- Tài khoản, không ghi mật khẩu trong tài liệu này:

| Vai trò | Tài khoản |
|---|---|
| USER | `user@mobiflow.local` |
| MANAGER | `manager@mobiflow.local` |
| STAFF | `staff.iot@mobiflow.local` |

- Kiểm tra mạng, nguồn điện, Docker và độ phân giải 1440×900 hoặc 1920×1080.
- Không mở `.env`, DevTools chứa header, ledger chi tiết hoặc bất kỳ màn hình secret nào trước Hội đồng.
- Không bấm thử chức năng AI trước giờ nếu chưa được cấp thêm lượt live; 4 lượt còn lại không phải ngân sách mặc định cho buổi thi.

## Synthetic scenario

Tiêu đề: `17 thiết bị IoT mất kết nối tại Khu Thử Nghiệm Zeta`.

Mô tả: `Dữ liệu synthetic phục vụ vòng chung kết: 17 thiết bị IoT tại Khu Thử Nghiệm Zeta mất kết nối từ 08:00 và không truyền dữ liệu. Chưa xác minh nguyên nhân; không có dữ liệu khách hàng thật.`

Nguồn kỳ vọng: SOP IoT hiện hành trong kho tri thức. Không tự khẳng định nguyên nhân trước khi STAFF ghi nhận kết quả xác minh.

## Timeline và lời thoại

### 0:00–0:30 — Giới thiệu

Trang: màn hình USER tạo yêu cầu.

Lời thoại: “Chúng em là PentaPrime. MobiFlow AI giúp doanh nghiệp tiếp nhận, phân tích và xử lý yêu cầu hỗ trợ từ đầu đến cuối. AI rút ngắn thời gian hiểu yêu cầu và tìm bằng chứng; mọi quyết định quan trọng vẫn do con người.”

Điểm chứng minh: nói đúng ba tiêu chí — bài toán thực, AI tham gia sâu, hệ thống hoàn chỉnh.

Nếu chậm: bỏ mô tả công nghệ; không nói framework.

### 0:30–1:40 — USER tạo yêu cầu

Vai trò: USER. Trang: `Tạo yêu cầu`.

Checklist click:

1. Điền tiêu đề synthetic.
2. Điền mô tả synthetic.
3. Bấm `Gửi yêu cầu`.
4. Mở chi tiết yêu cầu mới.
5. Quan sát trạng thái phân tích và **Phân tích AI hỗ trợ**.

Lời thoại: “Người dùng chỉ cần mô tả sự cố tự nhiên. DeepSeek chuyển nội dung thành intent, danh mục, mức ưu tiên gợi ý, thực thể và thông tin còn thiếu theo schema chặt chẽ. Kết quả chỉ hỗ trợ tiếp nhận, chưa tự phân công hay phê duyệt.”

Kết quả mong đợi: request được lưu; Analysis hiển thị; không lộ internal note.

Nếu AI chậm: chỉ ra trạng thái loading/error trung thực, nói “quy trình thủ công vẫn hoạt động”; chuyển sang request M3 đã lưu và nói rõ đây là **bằng chứng live đã xác minh trước**, không phải kết quả vừa sinh.

### 1:40–3:00 — MANAGER kiểm soát quyết định

Vai trò: MANAGER. Trang: `Chờ phê duyệt` → request vừa tạo.

Checklist click:

1. Mở Analysis.
2. Bấm tạo/xem **Grounded Recommendation** nếu live budget đã được phê duyệt.
3. Mở citation SOP và quay lại.
4. Chỉ ra missing facts/warnings.
5. Chọn ưu tiên phù hợp.
6. Chọn `IoT Specialist`.
7. Bấm phê duyệt/phân công.

Lời thoại: “DeepSeek kết hợp dữ liệu yêu cầu với PostgreSQL lexical retrieval để đề xuất phương án có nguồn. Manager kiểm tra nguồn, sửa hoặc từ chối. AI không thể tự phê duyệt, phân công hay thay đổi trạng thái bảo vệ.”

Kết quả mong đợi: quyết định của manager được lưu riêng với đề xuất gốc; assignment/SLA/history được tạo transactionally.

Nếu chậm: dùng recommendation đã lưu, nêu rõ thời điểm và nguồn; không giả là inference mới.

### 3:00–5:10 — STAFF làm việc cùng AI

Vai trò: STAFF. Trang: `Hàng đợi công việc` → request.

Checklist click:

1. Bấm `Bắt đầu xử lý`.
2. Chọn `Tìm SOP`.
3. Mở nguồn/citation.
4. Chọn `Tạo checklist`.
5. Nhấn mạnh checklist AI là bản nháp.
6. Áp dụng/kiểm tra checklist theo quyền con người.
7. Cập nhật kết quả synthetic: nguyên nhân đã xác minh, cách xử lý, cách kiểm chứng.
8. Bấm `Giải quyết`.

Lời thoại: “AI không chỉ chatbot. Nó tham gia ngay trong công việc STAFF: tìm SOP, đề xuất bước tiếp theo, tạo checklist, tìm ca tương tự và giải thích phân loại. Mỗi ID nguồn được backend kiểm tra lại; output không hợp lệ hoặc nguồn cũ sẽ bị từ chối.”

Kết quả mong đợi: workflow sang RESOLVED; checklist và facts của nhân viên được lưu; AI không tự hoàn tất bước nghiệp vụ.

Nếu một tác vụ AI chậm: trình bày tác vụ khác đã lưu hoặc thao tác thủ công; bỏ `FIND_SIMILAR_REQUESTS` trước để giữ thời gian.

### 5:10–6:10 — USER xác nhận

Vai trò: USER. Trang: chi tiết request.

Checklist click:

1. Mở kết quả xử lý.
2. Xem **Resolution Summary**.
3. Chỉ ra không có vùng `Ghi chú nội bộ`.
4. Bấm xác nhận hoàn tất.
5. Chọn điểm hài lòng và gửi.

Lời thoại: “AI tóm tắt từ cause/fix/verification do STAFF cung cấp và các event công khai; nó không được tự suy diễn nguyên nhân. USER thấy kết quả cần thiết nhưng không thấy ghi chú nội bộ.”

Kết quả mong đợi: CLOSED, feedback lưu thành công, internal note vẫn riêng tư.

Nếu chậm: bỏ gửi feedback; ưu tiên chứng minh summary, privacy và trạng thái đóng.

### 6:10–7:00 — MANAGER và kết luận

Vai trò: MANAGER. Trang: Analytics.

Checklist click:

1. Mở Analytics.
2. Chỉ SLA, trạng thái đóng và hoạt động AI/Copilot.
3. Chỉ nhãn `Đánh giá phát triển lịch sử` để phân biệt Ollama rollback với DeepSeek active.

Lời thoại: “MobiFlow AI giải quyết trọn bài toán từ tiếp nhận đến đo hiệu quả. AI tham gia ở chín năng lực quan sát được, nhưng quyết định vẫn thuộc USER, STAFF và MANAGER. Hệ thống có RBAC, audit, SLA, nguồn trích dẫn, rollback và giới hạn chi phí.”

Kết: “Bài toán thật — AI tham gia sâu — hệ thống hoàn thiện và có kiểm soát.”

## Danh sách màn hình cần mở

1. USER `/user/requests/new`.
2. USER request detail.
3. MANAGER `/manager/approvals` và request detail.
4. Citation/source preview.
5. STAFF `/staff/work-queue` và request detail.
6. USER resolved request detail.
7. MANAGER `/manager/analytics`.
8. Chỉ khi được hỏi: health/readiness; không mở secret/config.

## Kế hoạch fallback trung thực

| Sự cố | Cách xử lý |
|---|---|
| DeepSeek timeout/rate/network | Hiển thị lỗi thật, tiếp tục manual path; dùng stored artifact chỉ khi nói rõ là evidence trước đó |
| Citation không mở | Đọc source ID/title đang hiển thị, bỏ bước mở trang; không tự bịa nội dung |
| Đăng nhập chậm | Dùng ba profile/cửa sổ đã đăng nhập sẵn; không chia sẻ token |
| Docker service down | Dừng demo live, chạy readiness; không tự thay official demo hoặc tắt TLS/security |
| Thời gian thiếu | Bỏ similar cases và feedback; giữ Analysis → Recommendation/citation → human approval → checklist → closure/analytics |
| Candidate không an toàn | Không gọi DeepSeek; giải thích gate bảo mật đã chặn và chuyển sang evidence kỹ thuật |

## Câu hỏi Hội đồng và câu trả lời ngắn

**AI thực sự làm gì?**

DeepSeek phân tích yêu cầu, tạo đề xuất có grounding, hỗ trợ sáu tác vụ STAFF và tóm tắt kết quả; tất cả output được validate và hiển thị trong workflow.

**RAG hoạt động thế nào?**

PostgreSQL lexical tìm nguồn hiện hành; backend kiểm tra source ID, generation, trạng thái và quote trước khi công bố. Ollama/vector là rollback riêng.

**AI có tự quyết định không?**

Không. AI không được approve, assign, close, đổi role, xóa dữ liệu hoặc chạy shell/SQL tùy ý. Manager/Staff/User thực hiện các transition được phép.

**Nếu AI sai hoặc mất mạng?**

Output sai schema/nguồn bị từ chối; timeout/retry có giới hạn; workflow thủ công vẫn hoạt động và lỗi được hiển thị trung thực.

**Bảo vệ dữ liệu thế nào?**

Key chỉ ở backend; private notes bị loại khỏi USER và model context; RBAC/ownership kiểm tra lại tại read, write và lúc AI publish.

**Chi phí được kiểm soát ra sao?**

Ledger bền vững đếm trước mỗi HTTP attempt, có giới hạn attempt/ngân sách/concurrency. M3 dùng 16/20, USD 0.027758760 actual/reserved; M4 không gọi thêm.

**Có dùng dữ liệu khách hàng thật không?**

Không. Scenario và test data là synthetic; tài liệu đánh giá không tuyên bố độ chính xác tổng quát trên dữ liệu thật.

**Tại sao Analytics còn Ollama?**

Đó là đánh giá phát triển lịch sử của profile rollback, đã được gắn nhãn rõ. Candidate active là DeepSeek + PostgreSQL lexical.

## Checklist nghiệm thu con người

- [ ] Người trình bày tự thao tác đủ ba vai trò mà không cần agent hỗ trợ.
- [ ] Tổng thời gian không quá 7 phút trong hai lượt liên tiếp.
- [ ] Phân biệt đúng live output, stored evidence và historical Ollama evaluation.
- [ ] Không đọc mật khẩu/key/token trên màn hình.
- [ ] USER không thấy internal note.
- [ ] Manager nói rõ “AI đề xuất — con người quyết định”.
- [ ] Có thể xử lý timeout mà không gọi output cũ là output live.
- [ ] Readiness, mạng, nguồn điện và browser profiles được kiểm tra ngay trước thi.
