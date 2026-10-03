# UI Specification

Authority: master-plan §8, M1/M5/M7/M8/M9/M10 and §32. Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, React Hook Form/Zod, TanStack Query, Lucide and only necessary Recharts. This document defines required behavior; no UI is implemented in M0.

## Shared shell and interaction rules

Vietnamese primary UI copy; enum/code contracts remain English. Format times in Asia/Ho_Chi_Minh and label SLA pauses/confirmation holds. Header shows product name, signed-in role, notifications and profile/logout. Role navigation shows only relevant routes; backend still authorizes all data/actions and direct links. Auth refresh is serialized; access token stays in memory. On 401 after refresh failure return to login without retaining protected data in persistent browser storage.

Each data view includes loading/skeleton, meaningful empty state, error with retry, and populated state. Disable duplicate submissions, preserve form input on recoverable failure, show inline validation and focus the first invalid field. Request mutation forms carry the last fetched version; a 409 stops submission and asks the user to reload/review changes, never silently reapplies a decision. No optimistic approval/assignment/closure or invented AI completion.

Use semantic headings/forms/buttons/tables, explicit labels, keyboard navigation, visible focus, dialog focus trap/return and announcements for async state changes. Status uses text/icons as well as color. Target WCAG 2.2 AA interaction/contrast in implementation; test at 360, 768 and 1440 CSS px, 200% zoom and keyboard-only. Reflow detail panels and table controls; isolate necessary table horizontal scroll, no page overflow. User meaning takes priority over charts/dark mode, which remain optional polish.

Render model and user content as escaped text or a restricted Markdown renderer with raw HTML disabled. Source links resolve authorized backend source IDs. Never display reasoning traces, passwords/tokens, raw prompts, server paths or tool internals to ordinary users.

## Routes and required panels

| Route | Audience | Required UI / behavior |
|---|---|---|
| /login | Public | Email/password, generic auth error, busy state and demo-only account guidance without secrets in bundled config |
| /notifications | Any signed-in role | Own read/unread items, mark/unmark read, safe resource link, unavailable-resource handling after lost access |
| /profile | Any signed-in role | Read-only identity/role and logout; no role editor |
| /user/dashboard | USER | Own recent/open requests and create CTA; real counts only |
| /user/requests/new | USER | Description required, optional title; CTA “Gửi yêu cầu”; no request attachments in required V1 |
| /user/requests | USER | Own paginated requests, status/priority/category filters; reset filters empty state |
| /user/requests/[id] | Owning USER | Public code/status, original text, visible AI progress/missing facts, allowed timeline/conversation, simplified SLA, info reply, confirmation/reopen, eligible cancel and CLOSED feedback |
| /staff/dashboard | STAFF | Own assigned workload and SLA alerts; no organization metrics |
| /staff/work-queue | STAFF | Code/title/approved priority/category/status/assignedAt/SLA remaining; actionable open assigned work |
| /staff/requests/[id] | Current STAFF | Original request, extracted facts, safe AI summary, permitted SOP sources/similar cases, approved plan, checklist, SLA, timeline, conversation and six Copilot controls |
| /manager/dashboard | MANAGER | Pending approvals, request counts and SLA risks from backend |
| /manager/approvals | MANAGER | AI and MANUAL reviews labeled separately, missing evidence/candidates highlighted |
| /manager/approvals/[id] | MANAGER | Side-by-side “AI đề xuất” or manual draft and “Quyết định của quản lý”; original text, missing fields, sources/workload/reason, accept/modify/reject |
| /manager/requests | MANAGER | Filtered requests, detail drawer/page within this route, manual triage/submit, recommendation retry, reassign/priority/cancel according to state |
| /manager/knowledge | MANAGER | PDF/TXT upload, real indexing status, metadata/source preview, safe failure details, reindex and disable controls |
| /manager/analytics | MANAGER | Operational/AI/SLA aggregates, denominator/date window/asOf; latest live evaluation metadata or unavailable |
| /manager/audit | MANAGER | Paginated event audit filters, actor type and action labels, safe business diffs/provenance |

M13 analytics amendment: preserve V1.1 shell/design; apply calendar 7/30/90-day/custom filters and current approved priority/status/team/category on the server. Four top KPIs: newly created requests, distinct historically resolved requests, canonical completion SLA compliance and SLA-effective resolution duration. Include daily trend with solid/dashed labels, SVG description and exact keyboard-accessible daily table; creation-cohort distributions; completion SLA/reopen definitions; real explicit decision counts/rates; immutable feedback and unchanged six Copilot actions. Null means “Chưa có mẫu”; skeletons show no invented zero values, empty period uses “Không có dữ liệu trong khoảng thời gian đã chọn”, failures use safe error/retry, invalid responses are rejected and superseded reads cannot replace the latest selection. Synthetic evaluation remains visibly separate and independent of operational filters. Responsive/Axe smoke at 360/768/1440/1920 is the M13 gate; no chart dependency or shell redesign.

## Request lifecycle affordances

M21 adds MANAGER `/manager/routing-rules` inside the existing shell: SQL-paginated search/status list, create INACTIVE, typed flat AND editor (category/subcategory/priority, EQ/IN and enum values), numeric rule priority, eligible Team selector, append revision, activate/deactivate, permanent archive confirmation and paginated immutable history. USER/STAFF receive no routing navigation or fetches. Literal names/descriptions/target labels/explanations are escaped React text; no HTML or expression editor.

The existing manager plan/reassignment form has an explicit routing card. MATCH shows all best-priority revisions, explanations and Team; NO_MATCH and CONFLICT keep manual choices; loading/error/retry preserve manual assignment. Reads have a15-second timeout. Apply re-evaluates and rejects changed Request/rules/target snapshots, then fills only Team, clears staff and focuses that selector. It is local state, never a protected command. The final human submission retains expectedVersion. Buttons/fields have labels, errors use alerts, result/notice uses status text, archive is a native keyboard/focus-managed dialog. Existing manual draft/template fields remain editable and independent. Verify360/768/1440/1920, keyboard order/focus, XSS, stale versions and Axe on manager editor, request manual draft and reassignment.

M20 adds MANAGER `/manager/templates` within the existing shell for create, append-revision, one-way archive, current preview and paginated immutable history. USER has no library route/navigation/control or template request activity; STAFF sees only ACTIVE RESPONSE selectors in currently authorized message/request-info forms. CHECKLIST selection belongs only in MANAGER's existing manual NEW/TRIAGED plan. Preview/selection uses reads; explicit Apply copies plain text into the local draft. Confirm before replacing non-empty work, focus the confirmation and restore focus after cancel/re-enabling the trigger. Briefly lock the draft during the apply-time current-revision read so a pending application cannot overwrite concurrent typing. Response and checklist text, required flags and ordering remain editable after application. Existing human send or save/submit/protected approval commands remain separate. Template-unavailable errors preserve the draft, clear invalid source association and require explicit manual retry; request-version conflicts retain the existing reload/review boundary. Loading/empty/library failure/retry do not disable ordinary manual entry. Render all template content as escaped text; no macros, HTML/Markdown rendering, AI generation or automatic business action. M20 browser verification covers these surfaces at360/768/1440/1920 with keyboard/focus and Axe.

After create, show public code immediately and actual queued/running/completed/failed AI status by polling. “AI đang phân tích” is a processing label, not an approved classification. Suggested priority never looks like actual approved priority; `MEDIUM` remains actual until approval. USER sees safe progress/missing info and cannot inspect manager candidate/peer evidence or internal SOPs.

STAFF action visibility follows exact state matrix: Start on ASSIGNED; request-info/edit checklist/resolve only IN_PROGRESS. WAITING_USER shows paused SLA and waiting question. Owner provides-info through a distinct reply CTA; ordinary message submission does not resume status. RESOLVED shows owner Confirm/Still issue actions; no auto-close countdown. CLOSED displays one feedback form or existing rating; CANCELED is read-only. Cancel is a reason dialog only for eligible actors/states. Manager reassignment preserves progress and displays new worker; previous worker loses access on refetch.

Resolve form requires root cause, resolution, verification and required checklist completion/waiver; errors identify incomplete items. AI summary displays “Đang tạo tóm tắt” or failed/retry without blocking human facts or confirmation. Reopened prior resolution is visibly historical; new work does not appear already resolved.

## AI, evidence and approval UI

Model-reported confidence is labeled “Độ tin cậy do mô hình tự báo cáo (chưa hiệu chuẩn)”; never display it as measured accuracy or use it to auto-approve. Source cards show stored title, excerpt, page/section only if real, and open an authorized preview. Missing/disabled/reindexed evidence is unavailable; no invented source badge. Related cases say “Có dấu hiệu nhiều yêu cầu liên quan” and show only returned authorized cases, not a claimed major incident/global total.

Approval has an immutable suggestion side, editable final decision side, missing-fact acknowledgment and explicit Accept/Modify/Reject buttons. Required reason on modify/reject/manual draft. Show human edits as a diff; confirm submit with final staff/team/priority/policy/checklist. No arbitrary SLA-minute input. Disable Accept for insufficient evidence, no eligible staff, missing policy or stale data; Modify can supply a human plan under documented rules. After 409 refetch, preserve a local unsent draft only as a review aid and require an explicit new decision.

Copilot exposes only SUMMARIZE_REQUEST, FIND_SOP, SUGGEST_NEXT_STEP, GENERATE_CHECKLIST, FIND_SIMILAR_REQUESTS, EXPLAIN_CLASSIFICATION with Vietnamese labels. Each returns an attributed result/draft. “Lưu vào checklist” is a separate explicit staff command; AI never completes checklist items. No unrestricted chat/tool console.

## Required actionable errors

- Ollama unavailable: “AI local hiện không khả dụng. Yêu cầu của bạn đã được lưu an toàn. Vui lòng thử phân tích lại sau.” Show retry for owner/manager in NEW and manual review for manager.
- Invalid AI output: “AI chưa tạo được kết quả hợp lệ. Không có thay đổi nghiệp vụ nào được thực hiện.” Preserve last valid human state.
- Knowledge indexing failure: “Tài liệu chưa được lập chỉ mục. Xem chi tiết lỗi hoặc thử lập chỉ mục lại.” No READY badge.
- Approval conflict: “Yêu cầu đã thay đổi kể từ khi bạn mở trang. Vui lòng tải lại trước khi phê duyệt.” Do not auto-resubmit.
- Insufficient evidence: explain no supported procedure is available; show empty sources/actions, never a plausible invented SOP.
- Permission lost: generic inaccessible resource, clear protected local query cache; no stale confidential content left onscreen.

## Acceptance and dependencies

M14 uses the existing manager request-detail recommendation panel and shell. V2 shows immutable original summary/classification, conditional future next step, short reason, real source links/excerpts/relevance, missing questions/impact, ordered sourced checklist, warnings, generation version/time and separately labeled review provenance/human plan. No V2 confidence or ranking score UI. Acceptance explicitly records agreement without execution; manual-plan anchor points to the existing business approval flow. All missing fields must be acknowledged on V2 accept/modify. Preserve V1 read/review presentation. Request/version changes remount/clear protected data; generation/review/read signals are canceled and superseded polling results ignored. Permission/invalid-response failures clear protected artifact content. React renders AI/user text escaped, including excerpts; no trusted AI HTML.

M1 shared shell/error/loading; M2 authentication; M3 manual request work; M4 intake progress/failure; M5 sources/knowledge; M6 evidence; M7 review and staff UI; M8 Copilot/SLA/feedback; M9 measured analytics; M10 accessibility/responsive/error polish. Browser tests cover role navigation/direct access, no preapproval execution, keyboard dialogs/forms, source previews, all async states, stale approval, paused/reopened clocks, real counts and offline AI behavior.
