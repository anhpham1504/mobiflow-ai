M14 chưa tồn tại trong master plan hiện tại. Nội dung dưới đây là **authoritative user authorization mới cho MobiFlow AI V1.2 M14**.

Hãy coi nội dung này là source of truth cho M14 và ghi nó vào repository trước khi implementation.

Tạo:

`docs/v1.2/M14_RECOMMENDATION_V2_SPEC.md`

sau đó amend V1.2 master plan/index phù hợp để reference spec này.

Không sửa lịch sử M0–M13 để giả vờ rằng M14 đã tồn tại trước đây.

---

# MOBIFLOW AI V1.2 — M14 RECOMMENDATION V2

## 1. GOAL

M14 nâng cấp Recommendation V1 thành **Recommendation V2: grounded, structured, explainable operational recommendation**.

Mục tiêu là giúp STAFF xử lý request tốt hơn bằng AI nhưng vẫn giữ:

- human-in-the-loop;
- không autonomous mutation;
- không thêm role;
- không thêm Copilot action;
- không tự động thay đổi trạng thái request;
- không tự assign;
- không tự resolve/close;
- không tự gửi nội dung cho khách hàng.

Recommendation V2 chỉ **đề xuất**.

Con người vẫn quyết định.

---

# 2. V1 → V2 DELTA

Recommendation V1 hiện tại tiếp tục là baseline.

M14 không được rewrite toàn AI architecture.

Recommendation V2 phải bổ sung các capability sau.

## V2.1 Structured recommendation

Recommendation phải trả về structured contract đã validate, không chỉ free-form text.

Canonical output:

- `summary`
- `classification`
- `recommendedAction`
- `reasoningSummary`
- `evidence`
- `warnings`
- `missingInformation`
- `suggestedChecklist`

Tên field có thể điều chỉnh cho phù hợp naming convention hiện tại nhưng semantics phải giữ.

Không lưu hoặc expose hidden chain-of-thought.

`reasoningSummary` chỉ là explanation ngắn dành cho người dùng.

---

## V2.2 Grounded evidence

Mỗi recommendation phải chỉ rõ căn cứ của đề xuất.

Evidence chỉ được lấy từ source thực sự tồn tại, ví dụ:

- request hiện tại;
- approved request metadata;
- SOP/knowledge source được retrieve;
- historical request nếu existing architecture cho phép và có source reference hợp lệ.

Mỗi evidence item tối thiểu phải có:

- source type;
- source reference/id;
- short excerpt hoặc summary an toàn;
- relevance.

Không được hallucinate source.

Nếu không có evidence đủ mạnh:

Recommendation vẫn có thể trả về nhưng phải thể hiện:

`insufficientEvidence = true`

hoặc equivalent canonical field.

Không được biến dữ liệu thiếu thành fact.

---

## V2.3 Missing-information awareness

Recommendation V2 phải nhận biết khi request chưa đủ thông tin.

Output phải có khả năng biểu diễn:

- dữ liệu còn thiếu;
- câu hỏi nên hỏi thêm;
- lý do vì sao thiếu dữ liệu đó ảnh hưởng recommendation.

Không được tự bịa giá trị còn thiếu.

---

## V2.4 Actionable next step

Recommendation phải đưa ra **một next step chính** phù hợp workflow hiện tại.

Next step phải nằm trong domain/business vocabulary đã được repository cho phép.

Không được phát minh action ngoài existing bounded workflow.

Recommendation không được tự execute next step.

---

## V2.5 Checklist

Recommendation V2 có thể đưa ra checklist ngắn để STAFF thực hiện.

Checklist:

- bounded;
- ordered;
- không duplicate Copilot action mới;
- không tự trigger tool;
- không tự mutation business state.

---

## V2.6 Warning / risk flags

Recommendation có thể cảnh báo các vấn đề có căn cứ như:

- thiếu dữ liệu;
- SLA risk từ canonical data hiện tại;
- conflicting request information;
- recommendation có evidence yếu;
- stale request state.

Không tạo composite risk score.

Không tạo fake probability.

Không tạo AI confidence percentage.

---

# 3. HUMAN REVIEW CONTRACT

Giữ ba quyết định review hiện tại nếu Recommendation V1 đang dùng:

- ACCEPTED
- MODIFIED
- REJECTED

Semantics:

### ACCEPTED

Người dùng đồng ý với recommendation tại thời điểm review.

Không đồng nghĩa recommendation đã được execute.

### MODIFIED

Người dùng chỉnh sửa recommendation trước khi sử dụng.

Phải giữ được provenance:

- original AI recommendation;
- human-modified result;
- reviewer;
- reviewedAt.

Không ghi modified text thành original AI output.

### REJECTED

Người dùng không sử dụng recommendation.

Không xóa recommendation gốc.

---

# 4. STALE RECOMMENDATION

Recommendation phải gắn với version/state của request tại thời điểm generate.

Nếu request thay đổi sau generation theo expected-version/version protocol hiện tại:

UI/API phải nhận biết recommendation cũ là stale.

Stale recommendation:

- vẫn có thể xem để audit;
- không được review như recommendation hiện hành nếu existing protocol không cho phép;
- UI phải hiển thị rõ "Đề xuất đã cũ" hoặc equivalent.

Ưu tiên generate recommendation mới thay vì âm thầm dùng bản cũ.

---

# 5. RECOMMENDATION VERSION

Recommendation V2 phải được phân biệt với V1.

Dùng version identifier rõ ràng, ví dụ:

`recommendation.v2`

hoặc convention phù hợp repository.

Không overwrite Recommendation V1 history.

Historical V1 recommendation vẫn phải đọc/audit được.

Không migration nếu existing schema đã có field/version metadata đủ dùng.

Chỉ thêm migration nếu có evidence rõ ràng schema hiện tại không biểu diễn được V2.

---

# 6. MODEL

Không đổi model chỉ vì M14.

Tiếp tục sử dụng model Ollama/runtime đang cấu hình thực tế.

Không thêm paid API.

Không thêm OpenAI/Anthropic/Gemini dependency.

Model outage không được làm core request workflow chết.

AI failure phải fail gracefully.

---

# 7. PROMPT / OUTPUT RULES

Prompt V2 phải:

- yêu cầu structured output;
- chỉ sử dụng context được cung cấp;
- không được invent source;
- phân biệt fact với recommendation;
- liệt kê missing information;
- không output tool command;
- không yêu cầu autonomous action;
- không output hidden reasoning.

Tất cả model output phải qua Zod/shared schema validation.

Invalid response:

- không persist như recommendation hợp lệ;
- phải tạo safe failure state;
- có thể retry hữu hạn;
- không retry loop.

---

# 8. RAG / KNOWLEDGE

Nếu Recommendation V1 đã có RAG:

M14 tái sử dụng architecture hiện tại.

Không xây vector/RAG platform mới nếu không cần.

Nếu source được retrieve:

source reference phải tồn tại thật.

Nếu retrieval trả 0 nguồn:

model phải được biết là không có grounded knowledge source.

Không fake citation.

Nếu Recommendation V1 chưa có usable RAG:

M14 không bắt buộc xây full RAG subsystem mới.

V2 vẫn có thể ground bằng request + approved metadata hiện có.

---

# 9. API

Ưu tiên mở rộng API recommendation hiện tại thay vì tạo endpoint song song.

API phải support tối thiểu:

- generate Recommendation V2;
- read Recommendation V2;
- review;
- modified review;
- reject;
- stale state.

Không expose:

- system prompt;
- hidden reasoning;
- raw chain-of-thought;
- credentials;
- arbitrary model response;
- unnecessary PII.

OpenAPI và shared contract phải được cập nhật đồng bộ.

---

# 10. RBAC

Giữ authorization model hiện tại.

Role nào generate/view/review recommendation phải lấy từ owning authorization spec/code hiện tại.

Không hard-code assumption nếu existing rules khác.

Direct HTTP tests bắt buộc cho:

- authorized role;
- unauthorized USER;
- unauthorized role khác nếu applicable;
- stale/inactive session;
- resource outside scope nếu ownership applies.

Client role không được coi là authority.

---

# 11. UI

Không redesign toàn MobiFlow.

Recommendation V2 UI nằm trong request detail hiện tại.

UI phải phân biệt trực quan:

**Đề xuất AI**

và

**Quyết định của nhân viên**

Hiển thị tối thiểu:

- recommendation summary;
- recommended next step;
- evidence;
- missing information;
- checklist;
- warnings;
- generated time;
- stale state;
- review state.

Actions:

- Chấp nhận
- Chỉnh sửa
- Từ chối

nếu đúng với current authorization.

Không dùng wording khiến người dùng nghĩ AI đã thực hiện business action.

---

# 12. SECURITY

M14 phải kiểm tra:

- prompt injection;
- output schema bypass;
- hallucinated source reference;
- XSS từ AI-generated content;
- unauthorized recommendation review;
- IDOR;
- stale review;
- duplicate/replayed review;
- oversized generated fields;
- Ollama timeout;
- Ollama unavailable;
- malformed structured output.

Request/user text là untrusted data.

Không render AI HTML bằng unsafe raw HTML.

---

# 13. NON-GOALS

M14 không bao gồm:

- autonomous agent;
- autonomous mutation;
- new Copilot actions;
- staff ranking;
- staff productivity scoring;
- AI composite score;
- AI