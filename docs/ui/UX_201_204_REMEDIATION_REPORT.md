# MOBIFLOW AI V1.3 — UX-201–204 REMEDIATION

Ngày kiểm chứng: **2026-10-08, Asia/Ho_Chi_Minh**. Verdict: **READY FOR HUMAN REVIEW**.

UX-201, UX-202, UX-203, UX-204: **PASS**. Known P0/P1/P2/P3 trong phạm vi bốn finding: **0/0/0/0**. Advisory analytics có sẵn được giữ riêng tại J/O; không tuyên bố toàn app không còn vấn đề accessibility.

## A. Baseline

- Branch đầu phiên và checkpoint: `fix/v1.3-ui-ux-remediation`.
- Starting SHA: `c473ef830de0aa4630739e1c29f8fff0c3087e38`.
- Worktree có **20 tracked modifications**, **6 untracked entries**; index rỗng. Snapshot gồm **2.082 file hashes** và **356 dirty-file backups** trước source edit.
- Đã ghi nguyên output của `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git log -5 --oneline`, `git diff --stat`, `git diff`, `git diff --cached`.
- Authority: FULL_PLAYWRIGHT_UI_UX_AUDIT.md của vòng audit trước; đã đọc actual source/specs, không dùng line number cũ để sửa mù.

Evidence ngoài repo: [BASELINE.json](<C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/ux-201-204-remediation/BASELINE.json>).

## B. Scope

Chỉ remediation routing validation, analytics date-range validation, mobile dialog container và explanatory request action notices. Không redesign, thêm dependency hay thay backend, contracts, schema, migrations, RBAC, workflow, routing/analytics semantics, AI decisions hoặc SLA.

## C. Root causes

| Finding | Observed root cause / owner | Fix và lý do không cần backend |
| --- | --- | --- |
| UX-201, P2 | RuleEditor đã chặn bằng shared schema nhưng chỉ có generic alert, thiếu field links/focus | Map schema issue paths tới field errors, liên kết helper/error và focus theo DOM order sau render. Schema đã đúng; payload và API giữ nguyên. |
| UX-202, P2 | Analytics apply đã chặn range sai nhưng date inputs thiếu invalid semantics/focus, applied data dễ bị hiểu nhầm | Map missing/relational date issues, giữ hint, focus relevant field và thông báo draft chưa apply. Return trước query/loading update; shared range validator không đổi. |
| UX-203, P3 | `aside` mang `role=dialog` là pairing không hợp lệ | Đổi riêng mobile container thành `div`, ref thành HTMLDivElement. Giữ nguyên dialog attributes, CSS và interaction effect. |
| UX-204, P3 | STAFF WAITING_USER và STAFF/MANAGER RESOLVED không có command nhưng action region chỉ còn heading | Reuse kiểu paragraph notice của USER, thêm copy giải thích ai đang được chờ/bước tiếp theo. Không sửa bất kỳ command predicate hoặc mutation handler. |

## D. Source changes

| File | UX ID | Change | Behavior preserved |
| --- | --- | --- | --- |
| apps/web/src/components/routing-management.tsx | 201 | Field errors, ARIA, deterministic post-render focus; schema owns invalid submission | Name limit 120, payload, target eligibility, EQ/IN, drafts, lifecycle, Escape/Close |
| apps/web/src/components/analytics-dashboard.tsx | 202 | Linked date error, invalid fields/focus, draft/applied notice | Query params, timezone, inclusive/exclusive dates, 365-day maximum, filters/reset/results |
| apps/web/src/components/session-shell.tsx | 203 | Mobile `aside` → `div`, matching ref type | Modal name, styling, trap, closes, scroll, role navigation |
| apps/web/src/components/request-detail.tsx | 204 | Replace existing USER notice expression with notice helper | All commands, permissions, stale guard, jump, composers, checklist/notes/history, AI/SLA |
| apps/web/src/lib/form-errors.ts | 201/202 | Two schema-issue presentation mappings | Existing `fieldErrors` and `focusFirstInvalid` implementations unchanged |
| apps/web/src/lib/request-action-notice.ts | 204 | Pure role/status copy selection | USER wording exact; actionable/terminal states return null |
| apps/web/test/ux-201-204.test.mjs | 201/202/204 | 13 focused schema/helper/notice tests | Existing tests retained |
| apps/web/e2e/ui-ux-201-204.spec.mjs | 201–204 | 8 real-runtime behavior tests, no mock API | Existing authentication/test infrastructure |
| docs/ui/UX_201_204_REMEDIATION_REPORT.md | 201–204 | This review checkpoint | Evidence/temp files excluded from commit |

## E. UX-201 verification — PASS

Real MANAGER create editor: valid team/priority, description draft, EQ MEDIUM and IN HIGH/URGENT; name 121 characters. At 375×667, 390×844, 430×932, 1440×900, plus the other six matrix sizes:

- Visible adjacent error states **1–120 characters**; `aria-invalid=true`; accessible description includes hint and alert.
- Name receives focus and becomes visible after invalid Save.
- Name, description, priority, target and both condition drafts retained.
- **Zero routing POST**.
- Empty name, accepted exact-120 boundary, priority 0, missing target, empty IN values, add/remove, retained EQ, Escape from inside form and Close focus return verified. Unicode boundary covered by shared-schema unit test.

No successful rule persistence/lifecycle write was attempted; existing library is empty. This limitation does not substitute for the invalid-submit network assertion.

## F. UX-202 verification — PASS

Real MANAGER analytics: draft `2026-10-09` / `2026-10-01` at the four required interaction sizes and six additional sizes:

- Both dates link hint and visible range alert; both invalid, focus from.
- Draft dates, prior applied period/timestamp and KPI text retained.
- Visible notice states results still use the previous applied filters.
- **Zero additional analytics GET** on invalid submit.

Missing from/to focus the missing date; equal dates and >365-day range focus from, retain draft and make no GET. Real API returned 200 for 8-day custom and exact 365-day custom with HIGH priority. Confirmed from-inclusive/to-exclusive dates and `Asia/Ho_Chi_Minh`. Optional disclosure opens/closes by Enter/Space, retains priority; Reset restores 30d and clears filters. Future 2040-01-01–08 returns seven days with zero created requests and meaningful empty state.

## G. UX-203 verification — PASS

USER, STAFF, MANAGER independently at 390×844: DIV dialog, `aria-modal=true`, exact accessible name “Menu điều hướng”; **zero aria-allowed-role violations**, no disabled rule/exclusion.

First control receives initial focus. Shift+Tab wraps first→last; Tab last→first. Body locks; Escape closes/unlocks, restores trigger focus and previous scroll position. Outside click closes/returns focus. Selecting Notifications closes/unlocks and navigates to the real route. Topbar icons remain 44×44; navigation text links preserve baseline 42px height. CSS SHA256 unchanged, so no claim every shell link is 44×44.

## H. UX-204 verification — PASS

Exact audit records remain available; **no test-data substitution**:

| Role/account | Record | State/version | Verified explanation |
| --- | --- | --- | --- |
| STAFF Support | MF-DEMO-1004 / …000004 | WAITING_USER / 6 | Waiting for requester information; continue after it arrives |
| STAFF Billing | MF-DEMO-1002 / …000002 | RESOLVED / 6 | Waiting for requester confirmation or reopen |
| MANAGER | MF-DEMO-1002 / …000002 | RESOLVED / 6 | Same confirmation wait; no state command for current role |

At all ten widths, jump focuses `#request-actions` below sticky header; H2 “Thao tác” preserved, **controls=0**, meaningful status-specific text present. Real reload confirms unchanged status/version. **Zero business mutations caused by viewing notices**; no unauthorized control added.

## I. Responsive results — PASS

| Size | Routing invalid editor | Analytics invalid filters | Shared shell, all roles | Three affected action states |
| --- | --- | --- | --- | --- |
| 320×760 | PASS | PASS | PASS | PASS |
| 375×667 | PASS | PASS | PASS | PASS |
| 390×844 | PASS | PASS | PASS | PASS |
| 430×932 | PASS | PASS | PASS | PASS |
| 768×1024 | PASS | PASS | PASS | PASS |
| 1024×768 | PASS | PASS | PASS | PASS |
| 1280×720 | PASS | PASS | PASS | PASS |
| 1366×768 | PASS | PASS | PASS | PASS |
| 1440×900 | PASS | PASS | PASS | PASS |
| 1920×1080 | PASS | PASS | PASS | PASS |

**98/98 document-overflow observations pass**, including additional regression states/repeated measurements. No CSS hiding overflow added. Inspected original 390/1440 screenshots for errors/notices and mobile drawer; widths without screenshots are layout smoke, not screenshot reviews.

## J. Accessibility results

Targeted remediation gate: **PASS**. Eleven core Axe scans: routing/analytics invalid at 390/1440, role drawers and three no-command details; **0 violations**. Real keyboard/focus behavior verified separately. Rules enabled, no exclusions; tags wcag2a/wcag2aa/wcag21aa/best-practice.

Axe `color-contrast` incomplete results remain raw **UNVERIFIED**, including native multi-select, chart text and partly obscured dialog/background elements. They are not counted as passed contrast checks or a WCAG certificate.

One separate inherited daily-table scan still reports **serious scrollable-region-focusable** at `.analytics-day-table`. Real Chromium Tab enters that DIV; ArrowDown changes scrollTop **0→40** (scrollHeight 1275, clientHeight 360). No tabindex attribute. Table implementation is byte-identical outside date-filter edits. Per the requested policy, this remains **UNVERIFIED CROSS-BROWSER PORTABILITY**, not a newly introduced blocker or a Safari PASS. Raw violation is retained, not suppressed.

## K. Console/network results — PASS

Final MCP session: **169 API responses, all HTTP 200**; unexpected pageerror, application 5xx, auth failure, 429, console error/warning and failed app request: **0**. Business mutations excluding authentication: **0**.

Fifteen console errors and fifteen failed requests identify the same external `gc.kis.v2.scr.kaspersky-labs.com` script blocked by CSP. Classified ENVIRONMENT/ANTIVIRUS using hostname and `csp` failure evidence; app CSP unchanged. No general console-error whitelist used.

## L. Regression results

**UX-001–013: NO REGRESSION OBSERVED IN TESTED SCOPE.**

**UX-101–109: NO REGRESSION OBSERVED IN TESTED SCOPE.**

Targeted current-owner coverage: all-role navigation/focus/touch icons, routing EQ/IN/drafts/close, analytics disclosure/apply/reset/empty/real table keyboard, USER ASSIGNED (MF-DEMO-1005) and IN_PROGRESS (1003) exact prior notices, USER waiting/confirm/reopen controls, CLOSED stored feedback (1001), CANCELED terminal notice (1007), STAFF assigned start (1005), STAFF active request-info/resolve and retained composer/resolution drafts (1003), MANAGER TRIAGED manual plan/cancel (1008), MANAGER active reassignment/priority/cancel (1003), action jumps and history Enter/Space.

Stale 409 handling, disabled guard and warning text are source-verified unchanged. Live conflict/approval/AI writes were not triggered. Source-integrity comparison proves request-detail outside the notice/import substitution is exactly unchanged; no claim of full workflow revalidation.

## M. Engineering gates

| Exact command/scenario | Actual result |
| --- | --- |
| `npm run lint` — initial unqualified workspace run | FAIL: 14,534 errors; 14,533 from pre-existing generated `.playwright-mcp` files, 1 new test `structuredClone` no-undef; that test issue fixed |
| `npm run lint -- --ignore-pattern '.playwright-mcp/**'` | **PASS**, exit 0; final source gate excludes local browser evidence only; ESLint config unchanged |
| `npm run typecheck` | **PASS**, root foundation/Prisma/API/web checks |
| `npm run test -w @mobiflow/web` | **PASS**, 19/19 (13 new, six existing) |
| `$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:33701/api/v1'; npm run build` | **PASS**, root contracts/config/API + Next optimized production build |
| `npx playwright test --config artifacts/ux-201-204/playwright.config.mjs` | **PASS**, 8/8 against live API; supplementary CLI coverage |
| Playwright MCP `browser_run_code_unsafe` interactions | **PASS**; required browser authority, no API interception/mocking |
| `git diff --check` | **PASS**, exit 0 |
| `node <evidence>/audit-integrity.mjs` | **PASS**, hash/source/predicate audit |

Source lint PASS is the checkpoint lint gate. Unqualified workspace lint remains affected by preserved generated artifacts; it is not represented as a passing command. No user evidence deleted or tooling configuration changed to hide it.

Browser evidence contains **346 assertions: 344 passed, two TOOLING_ERROR observations** retained with corrections. One Escape was sent while BODY held focus after removal of the focused button; recheck inside editor passes. One overbroad 44px assumption included text links with unchanged 42px baseline; icon targets remain 44px. Also corrected an actual remove-button locator (“Xóa điều kiện 2”). No product failure converted into a pass. After interruption, restarted web/browser and reran required cases; this report uses the durable final session, not lost in-memory counts.

## N. Git integrity

Of 2,082 baseline files, **2,077 byte-identical**, exactly five existing task-owned files changed; no missing/unexpected changed files. All **20 pre-existing tracked modifications** preserved byte-for-byte; pre-existing untracked files/evidence included in the same hash comparison. **184 architecture/spec files checked, zero changed**. Existing request command/AI/SLA/stale code outside notice substitution unchanged.

Backend task diff **ZERO**; API contract **ZERO**; Prisma schema **ZERO**; migration delta **ZERO**; RBAC/workflow semantic delta **ZERO**. These are task-vs-session-baseline results; the user's existing backend changes remain present and unstaged.

Only the nine task-owned files in D enter `fix(ui): remediate UX-201 through UX-204`. Ordinary push to current branch is authorized after passing gates; final SHA/remote receipt is saved in publication.json after publication to avoid a self-referencing commit SHA inside this report. No force push, main merge, release tag or deployment. Worktree stays **DIRTY — PRE-EXISTING CHANGES PRESERVED**, plus unstaged local evidence; task-owned source/report diff must be clean after commit.

Evidence: [source-integrity.json](<C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/ux-201-204-remediation/source-integrity.json>), [mcp-evidence.json](<C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/ux-201-204-remediation/mcp-evidence.json>), [browser-summary.json](<C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/ux-201-204-remediation/browser-summary.json>), [CLI results](<C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/ux-201-204-remediation/cli-results.json>), [publication receipt](<C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/ux-201-204-remediation/publication.json>). Evidence paths are local to this workstation and are not committed.

## O. Remaining limitations

- Safari/Firefox, real devices, assistive-technology speech: **UNVERIFIED / NOT RUN**; no screen-reader certification.
- Inherited daily-table portability and Axe incomplete contrast: **UNVERIFIED**, retained above.
- No fresh complete 290-screenshot audit, successful routing persistence, new business transitions, live stale conflict, approval or Ollama evaluation. Tested preserved controls and source predicates; no full-app regression-free claim.
- Build covers the current workspace including preserved user work. Browser uses compiled production web at 33700 and the existing synthetic Docker API/DB at 33701/55426; no seed/reset/migrate/API image rebuild. This is review of the task UI diff, not release certification for every pre-existing backend change.
- Unqualified root lint still encounters local generated browser artifacts; use the exact source gate in M.

## P. Final verdict

**READY FOR HUMAN REVIEW** for UX-201–204 with the scoped engineering/browser gates above. Four findings remediated; no newly introduced P0/P1/P2/P3 in this scope. Human merge decision remains separate. **Merge NO · Tag NO · Deploy NO.**
