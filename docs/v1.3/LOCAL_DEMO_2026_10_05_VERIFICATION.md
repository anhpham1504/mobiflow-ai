# Kiểm chứng demo local v1.3.0 — 05/10/2026

Môi trường demo đã khởi động, readiness thực tế là **READY**, và kịch bản nghiệp vụ đã kết thúc ở **CLOSED v14 / SLA MET**. Hạ tầng, bảo toàn dữ liệu và luồng nghiệp vụ **PASS**. Gate chất lượng AI tổng thể **FAIL**: có lỗi recommendation, diễn giải tóm tắt cần review và backfill embedding cần thao tác phục hồi. Không dùng kết quả retry để xóa bằng chứng lỗi ban đầu.

Đây là lần chạy operator mới theo yêu cầu hiện tại, không thay thế kết quả M24 ngày 04/10. [Bằng chứng JSON đã lọc dữ liệu nhạy cảm](evidence/LOCAL_DEMO_2026_10_05.json) ghi thời điểm UTC, ID, checksum, kết quả, latency và hash artifact. Giờ hiển thị trên Web là Asia/Saigon (UTC+7).

## Scope implemented

Đọc [M24 demo runbook](M24_DEMO_RUNBOOK.md), [cấu hình V1.3](M24_CONFIGURATION_REFERENCE.md), [cấu hình kế thừa](../v1.2/M16_CONFIGURATION_REFERENCE.md), master plan/M0 request, PROJECT_SPEC/IMPLEMENTATION_PLAN và các hợp đồng database, authorization, workflow, SLA, AI, tool, RAG, API, demo data liên quan. Chỉ dựng và kiểm chứng bản đã phát hành v1.3.0 với dữ liệu giả lập. Không thực thi lại các harness M24 vốn ràng buộc baseline lịch sử.

| Thành phần | Môi trường đã thực thi |
|---|---|
| Git HEAD / peeled tag | `56e97f1e522f2bef2340fd9986e0507f6c2bc172` |
| Annotated tag object v1.3.0 | `b1e2c3364ce205493871f84331cd6061c70f5918` |
| Compose project riêng | `mobiflow-v130-demo-20261005` |
| Web | [localhost:33700](http://localhost:33700) |
| API | [localhost:33701](http://localhost:33701/health/ready), REST `/api/v1` |
| PostgreSQL | `127.0.0.1:55426`, database `mobiflow` trong instance riêng |
| Volumes mới | `mobiflow-v130-demo-20261005_postgres_data`, `mobiflow-v130-demo-20261005_knowledge_data` |
| Toolchain thực tế | Node 24.19.0, npm 11.17.0, Docker 29.6.2, Compose 5.3.1 |
| PostgreSQL / vector | image `pgvector/pgvector:0.8.6-pg17`, extension 0.8.6 |

Compose dùng image build runtime hiện có (`NODE_ENV=production`) trên loopback cho demo local. Đây không phải triển khai production. Private env riêng dùng owner/runtime/JWT/refresh credentials được tạo ngẫu nhiên và khác nhau; `.env` developer không bị ghi đè. Chỉ API/Web/PostgreSQL của project demo được khởi động hoặc restart.

## Files/modules changed

Thêm báo cáo này và JSON bằng chứng mới; nối liên kết vào M24 runbook và milestone verification. Các script operator, private env, log, corpus giả lập và screenshot nằm trong thư mục Git-ignored `artifacts/local-demo-20261005/`. Không sửa application TypeScript, schema, dependency, lockfile, migration hoặc lịch sử/tag Git. Không commit/push.

## Database changes

Tạo instance/volume demo mới sau khi kiểm tra project, volume và cổng chưa tồn tại. Chạy migration deploy thực tế và hai lần seed idempotent trong transient Linux builder cùng network với PostgreSQL demo. Có đúng **13 migration hoàn tất**, không rollback; tên và checksum khớp toàn bộ migration trên đĩa.

Sau seed: 6 tài khoản, 8 yêu cầu synthetic; chạy seed lần hai không đổi số hàng request/history/audit/assignment/SLA/notification và các bảng V1.3. Sau kịch bản: **9 yêu cầu**, 49 status-history toàn DB, **9 tài liệu READY / 12 chunk có vector thật**, **8/8 yêu cầu không CANCELED có embedding đúng phiên bản**. Không reset/reseed sau khi chạy kịch bản.

DB developer được giữ **stopped đúng baseline**. Hash manifest của **1.453 file** trong volume `mobiflow-ai_postgres_data`, đọc qua mount read-only/network-none, giống trước và sau:

`752f0e551986ec86d68789e05462b751f0623c6ea5ca2d1383679a9ed26a3805`

ID/image/trạng thái running của cả ba container developer được bảo toàn; API/Web developer vẫn chạy như baseline. Hash `.env`, 13 file migration, HEAD, annotated tag object và peeled tag commit không đổi. Không mở DB developer để migrate hoặc đoán số migration hiện tại từ báo cáo lịch sử.

## API changes

Không đổi hợp đồng/API. Kiểm chứng qua REST thật và PostgreSQL thật. Health cuối: HTTP 200, `status=READY`, `coreReady=true`, `aiReady=true`, `rag.status=READY`; tất cả component UP. Trước khi ingest corpus, core/AI đã sẵn sàng nhưng RAG trả `NOT_READY / EMPTY`; bằng chứng ban đầu được giữ.

## UI changes

Không sửa UI. Browser thực tế tạo request, review advisory, soạn/duyệt phương án, xử lý, trao đổi, đóng yêu cầu và xem analytics/health. Screenshot và response status/correlation ID/version được lưu. USER không thấy internal-note canary; STAFF/MANAGER được cấp quyền thấy note, manager thấy mention notification.

Console ghi **6 lỗi HTTP 401 ở `/auth/refresh`** trong quá trình logout/đổi tài khoản. Không ghi nhận JavaScript exception trong các message thu được; không tuyên bố console sạch hoàn toàn. Một locator heading timeout và một locator có 6 kết quả là lỗi khám phá của operator, được điều chỉnh bằng label thực tế; không phải kết quả kiểm thử product PASS giả lập.

## AI changes

Không đổi provider, model, prompt hoặc bounds đã được chấp nhận. Runtime Docker kết nối host Ollama qua `http://host.docker.internal:11434`; probe native dùng `127.0.0.1:11434`.

| Kiểm tra thực tế | Kết quả |
|---|---|
| LLM tag | `qwen3:4b-instruct-2507-q4_K_M`, 4.0B, Q4_K_M, completion capability |
| LLM digest | `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641` |
| Embedding tag | `bge-m3:latest`, F16, embedding capability |
| Embedding digest | `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab` |
| Vector probe | 1024 giá trị finite, norm 0.9999999317, 4.389 giây |
| Structured LLM probe | JSON hợp lệ, 7.148 giây |
| Bounds thực tế | attempt 120000 ms, run 300000 ms, temperature 0, output 1200 tokens |
| RAG / embedding | true / 1024; corpus và request vectors chỉ có một identity đã kiểm chứng |

Digests khớp bằng chứng model đã chấp nhận trước đó. Không chạy model pull/đổi tag/dimension. Host Ollama ban đầu chưa hoạt động; khi khởi động, GUI updater sẵn có tự áp dụng bản cập nhật **0.34.4 → 0.35.0**. Operator không chạy lệnh update/pull; phiên bản binary không được tuyên bố là bảo toàn. Các phép inference hiện tại được thực thi với runtime **0.35.0**, bằng model local đã xác minh. Log lúc bắt đầu cho thấy CPU inference; không coi phép đo này là benchmark cô lập.

Corpus synthetic hiện có được tạo vào thư mục evidence mới rồi upload qua API, thực hiện extraction/chunk/embed thật. Upload thứ sáu gặp 429; chờ khoảng 48 giây rồi retry theo limiter. Không tắt limiter. Cả 9 tài liệu đã READY. Nguồn SOP-IOT-04 trang 1 thực tế:

`KD-db2b140b-8e01-4d60-842f-7c57038e1bb8-G1-C0`

Recommendation lấy 5 source, SOP-IOT-04 đứng đầu với cosine 0.683741 (distance 0.316259), 2 yêu cầu tương tự và 2 STAFF hợp lệ. Đã mở source trên Web và đối chiếu source ID/title/excerpt/quote qua endpoint nguồn; không dùng tài liệu hoặc trích dẫn giả để thay inference.

| AI run trực tiếp | ID | Kết quả | Latency lưu bởi API |
|---|---|---|---|
| Intake RAG | `0a10328b-a563-40fd-8ced-bf3ffba2edcc` | SUCCEEDED, NETWORK/IOT_CONNECTIVITY, đề xuất HIGH, nguồn SOP-IOT-04 | 10.233 s |
| Recommendation lần đầu | `c69427be-7f75-402f-9c14-5e73d6a1027f` | FAILED, INVALID_REFERENCE, cả 2 bounded attempts cùng ACTION_SOURCE_NOT_IN_PROCEDURE | 38.320 s |
| Một lần retry chủ động | `95e70de8-2ab2-44dd-b1f2-d095d5e6ca8d` | SUCCEEDED, recommendation.v2, không đổi cấu hình/prompt | 18.037 s |
| STAFF Copilot FIND_SOP | `cf3e0ee2-eb8b-4207-a375-fdda0a63d81c` | SUCCEEDED, quote thuộc source thật, context v7, không đổi request version | 4.299 s |
| Resolution summary | `f73aba6c-bc3c-4948-95fa-9a84ccfe9964` | SUCCEEDED về schema/event membership/order; 6 event, giữ nguyên dữ kiện STAFF; có hạn chế ngữ nghĩa bên dưới | 9.890 s |

Đây là các lần chạy riêng lẻ, không phải p95/SLO/accuracy chung. `latencyMs` đo tác vụ AI trong API, không phải thời gian bấm nút đến hiển thị. Confidence 0.98 của intake là model tự báo và chưa hiệu chuẩn. Analytics thực tế ghi **5 AI runs / 4 SUCCEEDED / 1 FAILED**; panel đánh giá 100 ca có sẵn do seed/lịch sử không được tính là đánh giá mới.

Warmup sau khi sửa private evidence-path PASS: LLM **10.403 s**, embedding **3.745 s**, bound pgvector retrieval trả SOP-IOT-04 (score 0.722754); business counts trước/sau không đổi. Lần warmup đầu không lưu được evidence vì path tuyệt đối và **không được tính PASS**.

## Security considerations

Runtime app role thực tế không có superuser/createdb/createrole; migration dùng owner riêng. API/Web chạy non-root, filesystem read-only, cap-drop ALL và no-new-privileges; cổng DB/API/Web đều publish `127.0.0.1`. Web có CSP, frame DENY và MIME nosniff. Private env không được đưa vào JSON/report. 13 tool call thực tế (6 + 6 recommendation, 1 Copilot) đều SUCCEEDED và `READ_ONLY`; không AI nào tự phê duyệt/phân công/đóng request.

Các negative thực thi trả đúng: unauthenticated read 401; USER manager-list/internal-note 403; STAFF không được phân công 404; STAFF approval 403; MANAGER owner-confirm 403; stale message 409 STALE_VERSION; resolve khi chưa hoàn thành checklist 422 INCOMPLETE_CHECKLIST. Hash request, số message/assignment/history/audit trước/sau giống nhau; protected writes NONE. USER history/DTO/UI và Copilot/summary không chứa canary note nội bộ.

## Tests executed

Đường dẫn script operator dưới đây là artifact của lần chạy này, không phải script release mới. Chúng ràng buộc project demo và không sửa target developer. Logs, exit code và duration của lệnh Docker nằm trong JSON manifest.

| Lệnh thực tế từ repository root | Kết quả |
|---|---|
| `node artifacts/local-demo-20261005/operator.mjs prepare` | PASS, baseline/target isolation/private env |
| `node artifacts/local-demo-20261005/operator.mjs build` | PASS, Compose config/build API+Web và Linux api-build builder |
| `node artifacts/local-demo-20261005/operator.mjs database` | PASS, DB validation, deploy 13 migrations và repeat seed |
| `node artifacts/local-demo-20261005/operator.mjs start` | PASS, API/Web khởi động trên project mới |
| `node artifacts/local-demo-20261005/operator.mjs checks` | PASS, `npm run lint`, `npm run typecheck`, `npm test` trong builder network-none; 7+143+2+65 = 217 tests, 0 fail/skip |
| `node artifacts/local-demo-20261005/probe.mjs` | PASS, inventory/identity/structured inference/vector thật, đọc config riêng từ artifact private |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/ingest.mjs` | PASS sau limiter wait, 9 READY docs/12 chunks |
| `node --env-file=artifacts/local-demo-20261005/demo.env scripts/demo/warmup.mjs` | Lần đầu lỗi ghi path; rerun PASS vào evidence mới |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/live.mjs analysis` | PASS, intake đã thực thi |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/live.mjs recommendation` | Lần đầu FAIL với evidence; sau một UI retry mới PASS |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/live.mjs copilot-poll cf3e0ee2-eb8b-4207-a375-fdda0a63d81c` | PASS, source quote/permissions/private canary |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/negative.mjs` | PASS, 8 API negative và public-history privacy |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/live.mjs summary-poll f73aba6c-bc3c-4948-95fa-9a84ccfe9964` | PASS kỹ thuật; ngữ nghĩa còn hạn chế |
| `node --env-file=artifacts/local-demo-20261005/demo.env scripts/demo/preflight.mjs` | BLOCKED khi current request index 7/8; sau recovery PASS, 49 checks |
| `node artifacts/local-demo-20261005/operator.mjs recover-index` | PASS, chỉ restart API demo |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/live.mjs snapshot` | PASS, SQL read-only/readiness thật, trước và sau recovery |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/live.mjs final-contract` | PASS sau sửa DTO field trong operator; CLOSED v14/MET, business state trước/sau restart giống nhau |
| `node --env-file=artifacts/local-demo-20261005/demo.env artifacts/local-demo-20261005/collect.mjs` | PASS, actual container config/identity/dimension/tool metadata |
| `node artifacts/local-demo-20261005/operator.mjs preservation` | PASS, developer volume/env/container/Git/migration bảo toàn |
| `node artifacts/local-demo-20261005/report.mjs` | Ghi report từ evidence thực tế; không đổi FAIL AI thành PASS |
| `node artifacts/local-demo-20261005/verify-report.mjs` | PASS, hash artifact/claim đối chiếu, historical M24 prefix bảo toàn, scan 12 secret values thực tế và JWT pattern |
| `node artifacts/local-demo-20261005/handoff.mjs` | PASS, API/Web 200, core/AI/RAG READY và 3 containers healthy tại thời điểm bàn giao |

Native preflight được cung cấp đường dẫn npm thực tế qua `$env:npm_execpath = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'` trước khi chạy; helper thực thi npm để kiểm chứng phiên bản. `DEMO_EVIDENCE_ROOT` riêng là `artifacts/local-demo-20261005/runtime-evidence`. Chưa chạy lại full M24 regression, browser matrix hoặc benchmark AI 100 ca.

## Manual verification

Browser tạo yêu cầu **MF-2026-000001**, ID `d6d20c10-66a6-4209-8dd0-a59a5298080d`, mô tả 17 SIM IoT tại Amata và ghi rõ giả lập. Workflow thực thi:

1. USER tạo NEW v1 → automatic AI_ANALYZING v2 → TRIAGED v3. AI đề xuất HIGH; ưu tiên thực tế vẫn MEDIUM, chưa assignment/SLA.
2. MANAGER tạo recommendation. Run đầu bị validator chặn; request vẫn TRIAGED v3/unassigned/no SLA. Retry mới thành công. Review V2 ACCEPTED được lưu riêng, vẫn không assignment/SLA.
3. MANAGER chọn NETWORK/IOT_CONNECTIVITY, HIGH, Network Operations/IoT Specialist, sửa ba bước checklist, lưu manual draft v4 → submit PENDING_APPROVAL v5 → explicitly approve ASSIGNED v6. Assignment/SLA/checklist chỉ xuất hiện tại nghiệp vụ approve.
4. STAFF mở work queue, START_WORK v7; tạo note có canary và mention manager, bật watch, chạy Copilot FIND_SOP. Các thao tác chỉ đọc AI và collaboration không tăng request version.
5. STAFF REQUEST_USER_INFO v8/WAITING_USER/SLA PAUSED. USER xác nhận dữ kiện synthetic → v9/IN_PROGRESS/SLA SAFE; persisted pause 1 giây. USER không thấy note nội bộ.
6. STAFF hoàn thành từng bước checklist v10/v11/v12 rồi RESOLVE v13. Root cause/repair/verification ghi rõ mô phỏng, không tuyên bố đã kiểm tra thiết bị thật. SLA MET, effective 447 giây, target 7200 giây; summary live được kiểm chứng.
7. USER CONFIRM → CLOSED v14 lúc **09:24:37**. MANAGER mở mention notification, xem request đã đóng, bản gốc recommendation v3/review và lịch sử còn nguyên, analytics ghi cả AI run lỗi. Sau restart API, request/history/AI runs/assignment/SLA/checklist/note/watch/resolution/audit không đổi.

Agent đã xem screenshot USER CLOSED, nguồn SOP-IOT-04 và màn hình health 6/6 thành phần READY. Đây là vận hành bằng tài khoản role giả lập theo yêu cầu demo; independent external human review **NOT RUN**.

## Known limitations

- **Recommendation reliability:** cả hai attempts của run đầu bị `ACTION_SOURCE_NOT_IN_PROCEDURE`; retry thành công không sửa nguyên nhân sinh output sai và không chứng minh các lần demo sau ổn định. Validator bảo vệ dữ liệu đúng; giới hạn sinh nội dung còn mở.
- **Summary fidelity:** câu “AI hoàn thành phân tích, xác định nguyên nhân giả lập” gắn với COMPLETE_AI_ANALYSIS diễn giải quá mức. Intake chỉ phân loại/đề xuất ưu tiên; nguyên nhân APN được STAFF nhập ở resolution sau đó. Event IDs/order và ba dữ kiện STAFF được giữ đúng, nhưng câu tóm tắt cần review. Không gán PASS về tính đúng ngữ nghĩa toàn bộ.
- **Embedding backfill:** sau các thay đổi version nhanh, log ghi `request.embedding.deferred / REQUEST_EMBEDDING_UNAVAILABLE` lúc 09:23:31 và background tạm dừng theo code. Index 7/8 cho đến restart API demo, sau đó 8/8. STALE_CONTEXT race phù hợp với source/timing nhưng exception gốc bị swallow nên chưa chứng minh root cause. Tái diễn chưa được kiểm chứng; không sửa code/migration hoặc chèn vector thủ công để ép PASS.
- **Host runtime:** Ollama tự cập nhật 0.34.4→0.35.0 khi khởi động; kết quả phụ thuộc CPU/RAM/model cache. Các số đo này không phải latency SLO hoặc accuracy tổng quát.

## Deferred items

Đánh giá AI mới với dataset đủ lớn, sửa các giới hạn generation/summary/backfill và kiểm chứng tính lặp lại cần scope riêng. Full historical regression/accessibility matrix, independent human review, backup/restore disaster recovery **NOT RUN**. Production deployment **NOT RUN**, V1.4 **NOT STARTED**. Không lấy bằng chứng M9/M15/M24 lịch sử làm inference mới.

## Release blockers

Không có blocker khởi động còn tồn tại: containers/core/LLM/embedding/RAG hiện READY. Có hai vấn đề chất lượng AI chưa được sửa và một rủi ro backfill đã phục hồi bằng operator action. Chúng chặn việc gọi toàn bộ demo AI là ổn định/PASS; không chặn việc mở môi trường hiện tại để demo có giám sát và review. Báo cáo này không mở lại hoặc tái phát hành tag v1.3.0.

## Gate

**FAIL cho kết luận chất lượng AI toàn bộ.** Các gate con có bằng chứng: environment/core/RAG dependency readiness **PASS**; complete synthetic business workflow **PASS**; developer/tag preservation **PASS**; live AI execution **MIXED**. Giữ nguyên các lỗi và giới hạn trong evidence. Dừng ở scope demo local hiện tại.

## Mở lại, dừng và kiểm tra demo này

Stack đang được giữ chạy, volumes/data/corpus được giữ nguyên. Đăng nhập bằng [tài khoản demo đã chấp nhận](../demo/LOCAL_DEMO_ACCOUNTS.md): `user@mobiflow.local`, `staff.iot@mobiflow.local`, `manager@mobiflow.local`; mật khẩu synthetic chung `MobiFlowDemo!2026`.

Các lệnh chỉ chọn đúng demo riêng, không dùng target developer:

```powershell
docker compose --env-file artifacts/local-demo-20261005/demo.env -p mobiflow-v130-demo-20261005 -f docker-compose.yml ps
docker compose --env-file artifacts/local-demo-20261005/demo.env -p mobiflow-v130-demo-20261005 -f docker-compose.yml up -d --wait
docker compose --env-file artifacts/local-demo-20261005/demo.env -p mobiflow-v130-demo-20261005 -f docker-compose.yml stop
```

Nếu preflight phát hiện request index thiếu sau thao tác version, đọc evidence trước, chờ tác vụ bounded đang chạy và dùng `operator.mjs recover-index` khi background đã tạm dừng. Kiểm tra lại preflight; không ghi đè bằng chứng thất bại, không reset DB. Lệnh `up` không khởi động Ollama trên host; runtime host phải có sẵn. Giữ private env tại máy này, không đưa lên Git. Không xóa volumes bằng lệnh generic.
