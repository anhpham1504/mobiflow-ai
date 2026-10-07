# Developer DB preservation — ngoại lệ cho checkpoint Copilot

Ghi nhận 2026-10-07 08:48:09 +07:00 từ quyết định trực tiếp của người dùng: **ACCEPTED EXCEPTION — USER AUTHORIZED FOR THIS CHECKPOINT.**

**DEVELOPER PRESERVATION = INHERITED FAIL — ACCEPTED EXCEPTION.** Failure lịch sử được giữ nguyên, không đổi thành PASS. Đây không phải bằng chứng dữ liệu chưa từng thay đổi hoặc chứng minh bitwise/logical equality với baseline ban đầu.

Quyết định chỉ áp dụng cho checkpoint `fix/v1.3-copilot-checklist-truncation`, baseline `b3f39f6b858ef32b2aafef07ea99b1ab254ba583`, product dirty identity `bd52ba83aa7f392ca652623d402ee39e6e6bbb3804712ed0252d6bf146531730`. Source candidate và bộ human review vẫn khớp bản đã nghiệm thu. Không mở rộng ngoại lệ sang task hoặc milestone khác.

Các điều kiện được người dùng xác nhận:

- Sự cố tồn tại trước remediation Copilot.
- Remediation này không khởi động, kết nối, mount, migrate, reset hoặc reseed DB developer.
- Không có tuyên bố bitwise hoặc logical equality với baseline ban đầu.
- Trạng thái lịch sử vẫn phải ghi: DEVELOPER PRESERVATION = INHERITED FAIL — ACCEPTED EXCEPTION.
- Không được đổi trạng thái lịch sử thành PASS.
- Không được dùng quyết định này làm bằng chứng dữ liệu chưa từng thay đổi.
- Main, tag v1.3.0 và migrations phải tiếp tục được bảo toàn.

Điều kiện riêng về DB developer tại EXECUTE §12/16 đã được đáp ứng. Independent human review PASS được ghi ở [biên bản review](COPILOT_CHECKLIST_HUMAN_REVIEW_2026_10_07.md). Checkpoint **AUTHORIZED — PUBLICATION PENDING** cho đến khi các kiểm tra source/diff/security/readiness và commit/push/exact refs hoàn tất. Không truy cập DB developer để chứng minh equality; main/tag/migrations tiếp tục phải khớp refs/hashes được bảo toàn.

[Evidence quyết định](evidence/DEVELOPER_DB_PRESERVATION_EXCEPTION_2026_10_07.json).
