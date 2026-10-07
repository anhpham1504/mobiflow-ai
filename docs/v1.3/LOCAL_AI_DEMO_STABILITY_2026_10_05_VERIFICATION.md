# MobiFlow AI v1.3 — local AI demo stability verification

Thực thi ngày 05–06/10/2026, Asia/Saigon; evidence giữ timestamp UTC. [Báo cáo gốc](LOCAL_DEMO_2026_10_05_VERIFICATION.md), JSON và đủ 69 artifacts gốc được bảo toàn. [Evidence mới](evidence/LOCAL_AI_DEMO_STABILITY_2026_10_05.json) ghi từng lượt, attempts, failure/retry, cấu hình, commands và SHA-256 artifacts.

| Gate | Kết quả có bằng chứng |
|---|---|
| Runtime API/Web/AI/RAG | READY tại 2026-10-06T02:43:10.195Z (UTC); 44/44 current request vectors |
| Functional | PASS: năm workflow cuối hoàn chỉnh, 25 AI runs thành công lần đầu, không retry |
| AI quality theo protocol synthetic hiện có | FAIL: M8 Summary/Copilot và M15 đầy đủ; không chứng nhận độ chính xác tổng quát |
| Bảo toàn DB developer so với baseline ban đầu | FAIL: volume khác baseline; logical equality/initiator chưa chứng minh được |
| Independent human review | NOT_RUN; fixture MANAGER không được coi là review con người |
| Gate tổng thể | **FAIL**: bảo toàn DB developer chưa chứng minh được và full M15 quality gate FAIL |

## Scope implemented

Đã đọc M24 runbook/config đã chấp nhận, báo cáo/bằng chứng gốc, master plan/M0 execution request/PROJECT_SPEC và owner AI_BEHAVIOR_SPEC, RAG_SPEC, AUTHORIZATION_SPEC, TOOL_CALLING_SPEC, REQUEST_STATE_MACHINE, SLA_SPEC, DATABASE_SPEC, API_SPEC trước sửa. Chỉ ổn định demo V1.3; V1.4 NOT_STARTED và production NOT_RUN.

Trong gián đoạn, nhánh fix đã có checkpoint `b3f39f6b858ef32b2aafef07ea99b1ab254ba583` từ task khác. Đã đọc owner/source/tests/diagnosis của checkpoint và giữ Recommendation source-set binding v2.11, Summary m8.v5 cùng backfill fairness/lifecycle của nó. Source cuối nằm ở `C:/Users/AnhPhamPC/.codex/worktrees/v130-stability-followup/MobiFlow AI`, đúng nhánh `fix/v1.3-local-ai-demo-stability`, HEAD b3f39f6. Không reset/stash/clean checkout gốc hoặc commit/push/merge/tag mới.

Checkout `C:/Code/MobiFlow AI` vẫn detached tại release `56e97f1e522f2bef2340fd9986e0507f6c2bc172`, giữ source/index đang dở. `main`, `origin/main` và peeled tag vẫn cùng release commit; annotated `v1.3.0` giữ object `b1e2c3364ce205493871f84331cd6061c70f5918`. Source gốc 26 file được kiểm tra nguyên vẹn. Handoff kiểm tra refs local/remote và source thật của builder/API/evaluator.

## Files/modules changed

| Owner/module | Thay đổi được giữ hoặc bổ sung |
|---|---|
| Recommendation prompt/native schema | Giữ v2.11: chọn SOP set, required KNOWLEDGE evidence và checklist source IDs cùng một branch |
| Recommendation output/service + AI_BEHAVIOR_SPEC | v2.12: nhãn provenance trung tính; question/impact trọn nghĩa cho đúng missing fields; generation guard độc lập trước publication, parser lịch sử giữ nguyên |
| Recommendation fixture/PG integration + M15 prompt regressions/evaluator | Regression câu sai thực tế, hai attempts bị chặn không đổi nghiệp vụ; legacy read/review vẫn hoạt động; evaluator dùng đúng generation guard |
| Summary facts/service/tests | Giữ m8.v5: attribution STAFF, whole facts, public event/text/actor/chronology binding |
| RequestVectors/AnalysisWorker/RAG health và recovery tests | Giữ fair cursor, READY/RETRY_WAIT/BLOCKED/STOPPED, backoff/cancellation/dedup và readiness index hiện hành |
| Copilot prompt/service/tests/M8 evaluator | m8.v3 ràng buộc similar-case IDs theo STAFF-authorized retrieved set ở cả first/repair; đủ sáu actions |
| Web analysis panel/helper/test | Khi STAFF bị redacted job=null, dùng public status đã validate; giữ các trạng thái và aria-live |
| Verification/evidence/M24 links | Ghi kết quả mới; giữ nguyên báo cáo/bằng chứng cũ và prefix tài liệu |

Không thêm dependency, migration, schema công khai, role hoặc tool có quyền ghi. Harness/private env/raw artifacts ở ignored paths; sửa source chưa commit để review.

## Database changes

Chỉ dùng project `mobiflow-v130-demo-20261005`: PostgreSQL `127.0.0.1:55426`, DB `mobiflow`, API 33701/Web 33700 và knowledge volume riêng. DB test `mobiflow_m2_test`/`mobiflow_m14_test` cùng instance, dữ liệu synthetic riêng. Phục hồi đúng container demo cũ sau reboot; không reset/reseed/migrate DB đang có dữ liệu, không khởi động hay kết nối SQL vào developer DB.

Đủ 13 migration, tên/checksum/finished timestamps trong DB nguyên vẹn. Raw bytes của 13 file đã áp dụng từ checkout gốc khớp checksum DB. Bốn file checkout mới khác raw EOL; normalize cả hai checkout đều khớp exact release Git blob. Hai collector assumptions về EOL từng FAIL được giữ; không sửa migration/checksum để làm PASS.

Chín request gốc và hash/count của 10 bảng liên quan giữ nguyên: Request, AiRun, AiAnalysis, Assignment, RequestResolution, Checklist, RequestInternalNote, RequestWatcher, RequestStatusHistory, AuditLog. Request workflow cũ vẫn CLOSED v14; AiRun lỗi/retry/Summary cũ không bị viết lại. Bảy SlaInstance giữ số dòng nhưng full-row hash khác. Quan sát read-only 35 giây kiểm chứng chính xác canonical monitor writes vào assessedAt/status/breachedAt/dueAt/version và chín Request không đổi; không suy ra toàn bộ thay đổi SLA từ baseline hash-only ban đầu.

Sáu tài khoản giả lập, đúng USER/STAFF/MANAGER; chín READY knowledge documents và 12 vector chunks. Current request index 44/44, dimension 1024, một accepted embedding identity, không nhóm vector trùng; không xóa vector lịch sử để đạt tỷ lệ.

Developer container/image/volume giữ cùng identity và hiện dừng. Volume 1453 file: baseline `752f0e551986ec86d68789e05462b751f0623c6ea5ca2d1383679a9ed26a3805`, hiện `f9df7d943ff4b409bc47e143d1faf09b18aef34269ae003008cded7a609ac220`. Hash hiện ổn định qua các lần đọc và reboot mới, nhưng không bằng baseline.

## API changes

Giữ REST `/api/v1`, DTO/public structured schema, expectedVersion, backend ownership/RBAC và state-machine authority. Generation v2.12 có guard bổ sung cho presentation; public V2 parser/read/review lịch sử không áp dụng constraint mới ngược về dữ liệu cũ. Không nới validation, tăng token/deadline, đổi retry policy hoặc sửa stored suggestions. Core HTTP 200 không được dùng thay cho readiness RAG hay quality evaluation.

## UI changes

Lỗi STAFF trước sửa: UI báo “Chưa có phân tích AI.” dù public status SUCCEEDED; job=null là redaction có chủ đích. Sửa owner trình bày status, giữ privacy của job/error fields. Current MF-2026-000037 browser evidence: USER sees attributed Summary, no exact internal-note canary/notes; USER manager route denied. MANAGER sees “Chưa review”, no review action executed. STAFF sees “Phân tích AI hoàn tất.”, no false unanalyzed label, aria-live polite and zero overflow at1440×900/360×800. Three operator helper errors (unsupported import/restored session/localized status matcher) retained separately, not reported as product failures.

## AI changes

Recommendation gốc `c69427be-7f75-402f-9c14-5e73d6a1027f` FAILED 38.320 giây, hai attempts cùng `INVALID_REFERENCE / ACTION_SOURCE_NOT_IN_PROCEDURE`, sáu read-only tool calls thành công. Đây là publication validation failure; source retrieve hợp lệ không thuộc procedure đã chọn. Raw response/HTTP gốc không có; evidence không hỗ trợ kết luận provider, timeout, parser hay schema là nguyên nhân. Controlled release-code regression chứng minh native format cũ cho phép tổ hợp sai; không gọi đó là replay raw provider. Retry `95e70de8-2ab2-44dd-b1f2-d095d5e6ca8d` SUCCEEDED 18.037 giây không thay thế failure đầu.

Lượt M15 v2.11 giữ được 87/100 evaluation rows, chưa chạy 30 consistency calls, không có complete summary; sau gián đoạn native session mất và host đã reboot lúc 08:32:41 ngày 06/10. Ghi **INTERRUPTED**, không PASS. Dù các oracle đã nhận 87 rows, đọc output thấy M15-075 relevance viết “Dữ kiện mô tả hiện tượng mất kết nối do HTML có event, nhưng”, trong khi nguồn chỉ chứa untrusted HTML và chưa xác nhận nguyên nhân. M15-001 có “kiểm증”; M15-016/031 có câu hỏi/impact dang dở. Không quy nguyên nhân các lỗi này từ latency.

Owner gap xác định được: reference/excerpt được validate nhưng relevance và missing prose tự do không được ràng buộc; giới hạn độ dài không bảo đảm câu hoàn chỉnh. v2.12 dùng nhãn nguồn trung tính và câu hỏi/impact trọn nghĩa cho mỗi missing field đã validate; guard độc lập chặn output khác trước publication. Cùng guard áp dụng trong live evaluator. Regression giữ nguyên câu sai thực tế và kiểm tra backend chặn cả hai attempts, không tạo recommendation hoặc đổi business snapshot; regression legacy read/review bảo đảm suggestions lịch sử còn nguyên. Public contract, frozen dataset và semantic oracle v5 không đổi. Actions/checklist vẫn là đề xuất có nguồn; đây là constrained generation, không chẩn đoán AI tự do.

| Read-only cùng snapshot synthetic năm sources | Cold | Warm 1 | Warm 2 | Failures/retry |
|---|---:|---:|---:|---|
| Lượt đầu, backend từng call chưa đo |20.414s|19.853s|19.794s|0/0; không suy backend từ startup log |
| Explicit CPU trước gián đoạn |241.054s FAIL|241.063s FAIL|241.049s FAIL|3 failed runs, 6 timeout attempts 120s |
| Selected Vulkan, v2.11 trước reboot |95.137s|86.206s|86.292s|3 first-attempt success, 0 retry |
| Selected Vulkan, v2.12 sau reboot |40.774s|23.764s|22.192s|3 first-attempt success, 0 retry |

Cold xác nhận model không resident sau unload; warm đọc `/api/ps`. CUDA-requested sample và normal-discovery warm sample bị ngắt, runtime thực tế CPU; normal-discovery cold còn một run FAIL hai timeout. Giữ tất cả attempts; không ghi CUDA inference/PASS. Các phiên khác nhau về thời điểm/source và môi trường sau reboot, không suy hiệu quả tối ưu hay SLO từ chênh lệch latency. Normal-discovery/CUDA fallback root cause vẫn UNKNOWN.

Summary gốc `f73aba6c-bc3c-4948-95fa-9a84ccfe9964` technically SUCCEEDED 9.890s nhưng câu “AI hoàn thành phân tích, xác định nguyên nhân giả lập.” gắn với event 02:08:16Z; STAFF gửi nguyên nhân/khắc phục/kiểm chứng tới 02:23:30Z mới có. Giữ m8.v5 exact attribution “Theo bản ghi xử lý do nhân viên gửi”, whole STAFF fields, event/action/actor pairing, chronology và public audit allowlist. COMPLETE_AI_ANALYSIS không xác minh root cause. Live M8 Summary cuối: SUCCEEDED, 1 attempt(s), 9178ms; 11 public input events/8 selected items, exact attribution/facts/event provenance.. Không viết lại Summary lịch sử hoặc tạo thêm sự kiện/kết quả.

Embedding release đặt process-local backgroundPaused sau mọi exception, các call tiếp theo bỏ qua backfill tới khi instance mới được tạo. Controlled regression tái hiện permanent pause sau transient failure. Exception gốc của 7/8 trước đây đã bị swallow, loại fault vẫn NOT_RECORDED. Giữ cơ chế fair cursor/backoff/phân loại/lifecycle của checkpoint; stale không pause toàn queue, transient có retry, permanent identity/config mismatch BLOCKED, cancellation STOPPED.

Probe mới dùng actual AnalysisWorker/RequestVectors, real isolated PostgreSQL và accepted live BGE; proxy inject đúng hai 503, hai adapter attempts/một background failure, tự phục hồi 2192ms. Stale race phục hồi 336ms, zero stale inserts; bảo toàn 280 preexisting vector IDs và exact business row, concurrent same-version còn một dòng, zero duplicate groups. Product và wrapper cùng exit 0. Probe drive ticks có chủ đích, không phải production outage test. Wrapper EEXIST sau probe PASS ở lượt cũ vẫn được giữ; không xóa hoặc thay bằng probe mới. API phục vụ thật trước reboot đã tự phục hồi stale context 25.019s không restart trong interval cũ. Sau reboot, cùng API ghi hai deferred→recovered intervals 11.060s và 11.945s, restartCount=0. Helper observation đầu dùng nhầm field `at` thay cho `time` nên timing null; artifact đầu được giữ, artifact derivation mới đối chiếu exact request/error và timestamps gốc. Không kéo interval trước qua reboot hoặc gọi các event intervals là pure embedding latency.

Copilot có hai failed runs thực tế 2.973s/8.387s, hai attempts CASE_MEMBERSHIP mỗi run. Native m8.v3 ràng buộc retrieved STAFF-authorized case IDs, tập rỗng chỉ cho mảng rỗng, repair dùng cùng format; giữ public UUID schema/permission/membership guards và sáu actions. Live M8 cuối: 8/8 first-attempt successes, p50=1584ms/p95=9506ms nearest-rank, no repair..

| Runtime/config | Identity đã đo |
|---|---|
| Ollama |0.35.0; selected owned PID 38620, installed Vulkan |
| Qwen |`qwen3:4b-instruct-2507-q4_K_M`, digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641` |
| BGE |`bge-m3:latest`, digest `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`; dimension 1024/revision m5.v1 |
| Embedding identity key |`a6cd9ebb83b4c9c07a14cb63e4cbef8789a7dabd3257d35cbed412ead4b621d9` |
| Generation |temperature 0/seed 42/ctx 16384/output 1200; attempt 120000ms/run 300000ms/two attempts; native JSON/stream=false/think=false |
| Host |Windows 11 Pro 26200; i7-13650HX 14c/20LP, RAM khoảng 23.8GiB; RTX 4060 Laptop 8GiB/driver 616.92 |
| Actual residency/backend |Qwen 37/37, BGE 25/25 GPU layers; VRAM bytes 5098103111/664000265 tại snapshot; runtime logs + `/api/ps` + nvidia-smi |

Profile chỉ áp dụng process: OLLAMA_VULKAN=1, OLLAMA_LLM_LIBRARY=vulkan, GGML_VK_VISIBLE_DEVICES=0; prepend installed lib/ollama và lib/ollama/vulkan vào PATH, working directory installed lib/ollama. Không model pull/tag/digest/dimension/app deadline/driver/global-env/security-policy change. [Ollama GPU docs](https://docs.ollama.com/gpu) và [troubleshooting](https://docs.ollama.com/troubleshooting) đối chiếu backend selection, không chứng minh nguyên nhân fallback.

## Security considerations

Demo chỉ host loopback; API/Web nonroot/read-only rootfs/capDrop ALL/no-new-privileges. Giữ permissions trên request, context, source, files; USER manager403, unassigned STAFF404, anonymous401, USER notes403, STAFF approval403, stale409 và incomplete checklist422 đã thực thi. AI tools READ_ONLY, không sửa request/status/version/assignment/checklist/SLA. Source quote/IDs/availability đối chiếu endpoints thật. Không raw private prompts, credentials/JWT, real customer data hoặc hidden reasoning trong tracked evidence; raw artifacts/private env ignored. Current browser session captured 1 console errors: auth-refresh401=1, forbidden403=0, external CSP=0, other=0. Earlier browser session retained8 errors (7auth-refresh401/1external CSP). Neither scope is called error-free or a full WCAG/frontend audit.

Handoff BGE probe thật trả finite/nonzero 1024 chiều, latency 209ms/end-to-end 212ms, cùng accepted identity/key. Hai lỗi helper được giữ riêng: assertion so baseline năm fields với identity có thêm key; sau đó metadata helper hash cả key trong khi owner `identityKey` nhận `Omit<EmbeddingIdentity,'key'>`. Đã kiểm tra exact năm components và key tính độc lập, giữ artifact metadata sai và tạo derivation đúng từ probe đã ghi; không chạy thêm inference để sửa metadata, không đổi embedding identity/product.

## Tests executed

Commands tại managed worktree fix, dưới `artifacts/v130-stability-20261006-recheck/`, có guard project/HEAD/branch. Evidence giữ exact argv, exit code, latency và hash logs.

| Command | Actual result |
|---|---|
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs build`|PASS: compose config, API/Web/builder; giữ cả các build attempts |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs gates`|Final PASS lint/typecheck/232 units:7 config+154 API+3 Web+68 release, 0 fail/skip. Lượt test đầu FAIL hai assertions whitespace được giữ; không đổi validator |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs integration`|PASS 40 real-PG checks:2 scoped M2+28 M14+10 recovery, 0 fail/skip |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs start`|PASS, chỉ owned API/Web `up -d --no-deps --wait` |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs cold-warm`|PASS ba snapshot generations, cold/warm/attempt details ở trên |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs backfill`|PASS actual BGE fault recovery, child/wrapper exit0 |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs smoke`|PASS năm current-source workflows, 25 first-attempt successes |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs operational-evals`|PASS Summary SUCCEEDED and Copilot 8/8, both CLI exits0; first attempts,0retry. |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs quality`|FAIL: 100 cases + 30 consistency calls, actual exit 1, 1999s; evaluation first-attempt execution/validation failures 0, retry cases 0, terminal execution failures 0; semantic violations 1 |
|`node artifacts/v130-stability-20261006-recheck/tasks.mjs preflight`|PASS 49 checks, exit0 |
|Read-only source/compiled/privacy/handoff audits|PASS 33exact raw builder files and405compiled API files (tested builder=serving API=native evaluators), original26source files/69artifacts/env/tag unchanged. Health core/AI/RAG READY, index44/44,0duplicate groups. Developer hash unchanged since recovery but original preservation FAIL. Handoff 2026-10-06T02:43:10.195Z |

Các audit chạy bằng `node artifacts/v130-stability-20261006-recheck/provenance.mjs handoff`, `node artifacts/v130-stability-20261006-recheck/builder-source.mjs handoff`, `node artifacts/v130-stability-20261006-recheck/profile-proof.mjs handoff`; collector và SLA observation chạy `node --env-file=artifacts/v130-stability-20261006-recheck/demo.env artifacts/v130-stability-20261006-recheck/collect-final.mjs handoff` và `node --env-file=artifacts/v130-stability-20261006-recheck/demo.env artifacts/v130-stability-20261006-recheck/sla-observation.mjs`. Collector exit 0 ghi MIXED: demo readiness/preservation checks đã xác nhận, developer baseline drift vẫn FAIL. Handoff probe command `node --env-file=artifacts/v130-stability-20261006-recheck/demo.env artifacts/v130-stability-20261006-recheck/embedding-handoff.mjs` giữ first helper exit 1 và corrected exit 0; metadata correction command `node artifacts/v130-stability-20261006-recheck/correct-embedding-metadata.mjs` exit 0. `node artifacts/v130-stability-20261006-recheck/privacy.mjs final` và `node artifacts/v130-stability-20261006-recheck/final-audit.mjs` kiểm tra credentials/JWT, exact preserved prefixes, refs local/remote và `git diff --check`; kết quả nằm trong ignored audit artifacts.

Actual M15 FAIL. Evaluation 100 cases: first-attempt execution/validation failures 0, retry cases 0, terminal execution failures 0; 130 calls total / 130 provider attempts. Semantic quality violations 1: evaluation/M15-061-triaged-no-candidate-missing/repeat 1: EXPECTED_EVIDENCE_STATUS_MISMATCH. Consistency 30 calls / 30 valid invariant runs; allInvariantsHold=true. End-to-end nearest-rank p50=15523ms / p95=18211ms, min=8199ms / max=21245ms; latency gate NONE. Dataset SHA256 `d011105c106711cf7848e20d757099aa62c4152336fc2672a5e09719c01ba6e9`. Source/model/dataset immutability verified by evaluator. Full run dùng committed 100-case dataset và 30 consistency calls, không filter/skip; model/embedding probe, settings, eight watched source hashes, dataset hash và mỗi attempt được giữ. Source/dataset không đổi trong evaluation. Existing static oracles không exhaustive semantic review/ranking benchmark; consistency kiểm tra invariants, không buộc prose giống nhau. Unit/provider fixtures, real PG tests, live BGE faults, frozen model snapshots và live app workflows được phân biệt.

## Manual verification

Agent-operated API/browser trên synthetic accounts; independent human review **NOT_RUN**. MANAGER command fixtures reviewKind MANUAL, plan HUMAN/sourceIds rỗng và expectedVersion, không lấy AI suggestions làm kế hoạch. Năm V2 recommendations cuối vẫn reviewedAt/reviewedBy=null. Không giả reviewer/acceptance con người.

Mỗi lượt: USER create/intake → MANAGER Recommendation/RAG/source/tool reads và predefined triage/submit/approve → STAFF start/internal-note/Copilot/request-info → USER provide-info → negatives stale/checklist/RBAC → STAFF synthetic resolution → Summary thật → USER confirm CLOSED → MANAGER final request/analytics. Lượt đầu đủ sáu Copilot actions, các lượt sau FIND_SOP. Kiểm tra version/status, source quotes/event IDs, canary và SLA pause/resume.

Đọc định tính cố định ca đầu của mỗi nhóm trong dataset: 12 nhóm, chọn độc lập với kết quả. Đối chiếu source request, summary/action/reason/checklist/warnings và missingInformation; chưa xác lập thêm lỗi nhân quả hay câu hỏi dang dở trong mẫu này. M15-061 không thuộc mẫu cố định và vẫn là failure riêng trong full evaluation. Đây là agent inspection, không human review hoặc gate PASS bổ sung. Projection read-only đầu lỗi SyntaxError do thừa một dấu ngoặc; chỉnh helper đọc, không chạy lại model hay đổi output; cả exit 1/0 được ghi.

| Lượt/public code | Intake | Recommendation | Summary | Toàn workflow | Functional / AI smoke |
|---|---:|---:|---:|---:|---|
|1 / MF-2026-000033|8.674s|24.777s|8.216s|102.355s|PASS / PASS; 9runs|
|2 / MF-2026-000034|7.040s|24.008s|10.159s|52.742s|PASS / PASS; 4runs|
|3 / MF-2026-000035|7.346s|25.396s|9.991s|55.771s|PASS / PASS; 4runs|
|4 / MF-2026-000036|7.737s|26.742s|9.850s|55.811s|PASS / PASS; 4runs|
|5 / MF-2026-000037|7.459s|23.818s|10.227s|54.395s|PASS / PASS; 4runs|

Tất cả CLOSED v12/SLA MET;25/25 first-attempt success,0manual AI retry/terminal failure. Workflow thực tế 52.742–102.355s. Các thời gian persisted AiRun/workflow không phải pure-model benchmark hoặc latency SLO. Năm smokes không thay quality evaluation.

Giữ toàn bộ batches trước: harness query/DTO/provenance errors, Copilot membership failures, Recommendation first timeout rồi bounded retry 221.707s, auth expiry 401, CPU timeouts và interrupted runs; các batches 5/5 trước sửa thêm không thay current gate. Source trước v2.12 có năm integrated workflows PASS nhưng M15 partial 87 rows chứa lỗi semantic đã nêu. Token renew của harness là thao tác operator, không đổi auth TTL hoặc che AI failure. Evidence có từng batch/attempt; không xóa các collector/browser/wrapper/test failures.

## Known limitations

Lượt v2.12 thực tế có M15-061 `EXPECTED_EVIDENCE_STATUS_MISMATCH`: source đã cung cấp SOP MOBILE_NETWORK phù hợp, kỳ vọng SUFFICIENT, output lại INSUFFICIENT_EVIDENCE. Output vẫn strict-schema/reference-valid, chọn REQUEST_USER_INFO và không tạo ứng viên/ghi nghiệp vụ; đó không làm quality PASS. Không có provider/timeout/parser/schema/reference error cho ca này. Lý do model chọn branch chưa được ghi nhận; không suy hidden rationale từ missing location/candidates hoặc latency. Giữ frozen dataset/oracle và failure, không ép sufficient hoặc rerun để che lỗi. Danh sách đầy đủ oracle violations của cả100+30 calls ở evidence.

Historical Recommendation raw/HTTP và embedding exception gốc không có; không suy provider/parser/timeout/cause từ latency. Normal-discovery/CUDA root cause UNKNOWN. Explicit installed Vulkan đã đo trước/sau reboot; không chứng nhận mọi driver/update hoặc default-start behavior. Kết quả M15/M8 chỉ theo bounded synthetic protocol; narrative/labels có constraint không chứng minh AI chẩn đoán tự do. Live source/permission grounding đã kiểm tra, retrieval ranking benchmark và independent human quality review chưa chạy. Tick-driven fault probe không thay production DR. Original SLA full-row equality không thể phục dựng từ hash-only baseline.

## Deferred items

V1.4 NOT_STARTED; production NOT_RUN; independent human AI review NOT_RUN. Không release patch/tag/model update/merge/publication mới. Các thay đổi giữ uncommitted trên fix branch. Không tự sửa driver/security hoặc khởi động developer DB để bù evidence thiếu.

## Release blockers

**AI quality FAIL.** 1 semantic oracle violation(s) trong full M15: evaluation/M15-061-triaged-no-candidate-missing/repeat 1: EXPECTED_EVIDENCE_STATUS_MISMATCH. M8 PASS và các structured successes không thay các semantic oracle violations trong full M15. Giữ source/model/validation/dataset; nguyên nhân quyết định grounding ở M15-061 UNKNOWN, cần thêm bằng chứng để sửa đúng owner, không nới hoặc bỏ gate.

**Developer preservation chưa đóng.** PostgreSQL logs xác nhận start 07:04:44Z (14:04:44 local) rồi 08:49:50Z (15:49:50 local) ngày05/10, checkpoint tới10:04:51Z. Docker Desktop rotated logs corroborate exact container/port5432 và ContainerStartOthersLinux lần sau, không xác định người/task initiator. Mười ba paths có mtime sau baseline (metadata/WAL/transactions/hai base relations); mtime không chứng minh byte-diff/row changes.

Accepted exception có sẵn lúc08:14:06.407Z chỉ ghi observed hash `8375a84c8e36392a52f1b59d5beeb333fdb1e8cb82302138c432d3cdb642f71a`. Hash mới f9df và start08:49:50Z xảy ra sau đó; không tự mở rộng exception hoặc lấy publication của task khác làm quyền commit/push. User trả lời không biết và yêu cầu tự kiểm tra: đã đọc logs, mount volume offline/read-only, đối chiếu task context và kiểm tra lại sau reboot; initiator vẫn UNKNOWN. Không có original per-file content map/logical dump/SQL trace để chứng minh logical developer data unchanged. Hash hiện ổn định không thay baseline ban đầu. Developer API/Web ban đầu chạy, hiện cùng IDs/images nhưng dừng sau daemon/host interruption; không tự start lại stack đó.

## Gate

**FAIL tổng thể.** Runtime READY/functional PASS có actual execution; AI quality FAIL chỉ trong protocol đã nêu. Developer baseline preservation FAIL/initiator UNKNOWN vẫn là blocker. Handoff giữ [Web demo](http://localhost:33700/login), API33701/PG55426 và selected owned Ollama process đang chạy, cùng dữ liệu/vector/evidence/private env. Chỉ quản lý exact demo project bằng env riêng; không cleanup/rollback/delete volume, không human review giả, V1.4 hoặc production.

