# Milestone 3 Verification

Verified 2026-09-28 (Asia/Saigon). The current user execution request explicitly authorized **M3 only**. The repository was inspected before implementation and existing M0/M1/M2 work was preserved. **M3 PASS** for the local, synthetic, non-AI workflow. M4 has not started.

## Scope implemented

The complete human workflow runs with Ollama unavailable: USER creates a request; MANAGER saves a manual triage draft, submits it and explicitly approves assignment; assigned STAFF starts work, requests information, completes required work and records resolution; the owning USER responds, reopens or confirms closure. Cancellation, reassignment, priority changes, messages, persisted timeline, notifications and the initial SLA lifecycle are implemented.

`RequestStateMachineService` is the only application writer of `Request.status`, including creation. Controllers parse strict shared Zod contracts and delegate. Each existing-request mutation locks the request, rechecks live identity/session, ownership, state and expectedVersion, then atomically commits the version, domain writes, audit, status history where status changes, and applicable notifications. An invalid or stale operation rolls back all business effects. Test-only fixtures create a foreign request and set the reserved AI_ANALYZING state to verify cancellation; these are not application status writers or AI functionality.

### Transition matrix

| Action | From → To | Actor |
|---|---|---|
| CREATE | absent → NEW, version 1 | USER |
| MANUAL_TRIAGE | NEW → TRIAGED; TRIAGED → TRIAGED for draft edit | MANAGER |
| SUBMIT_FOR_APPROVAL | TRIAGED → PENDING_APPROVAL | MANAGER |
| APPROVE_AND_ASSIGN | PENDING_APPROVAL → ASSIGNED | MANAGER |
| REJECT_APPROVAL | PENDING_APPROVAL → TRIAGED; a new draft is then required | MANAGER |
| START_WORK | ASSIGNED → IN_PROGRESS | current STAFF |
| REQUEST_USER_INFO | IN_PROGRESS → WAITING_USER | current STAFF |
| USER_PROVIDE_INFO | WAITING_USER → IN_PROGRESS | owning USER |
| RESOLVE | IN_PROGRESS → RESOLVED | current STAFF |
| USER_CONFIRM | RESOLVED → CLOSED | owning USER |
| USER_REOPEN | RESOLVED → IN_PROGRESS | owning USER |
| CANCEL | NEW, AI_ANALYZING, TRIAGED, PENDING_APPROVAL → CANCELED | owning USER or MANAGER |
| CANCEL | ASSIGNED, IN_PROGRESS, WAITING_USER → CANCELED | MANAGER |
| MESSAGE | any nonterminal state → same state | scoped reader |
| REASSIGN / PRIORITY | ASSIGNED, IN_PROGRESS, WAITING_USER → same state | MANAGER |
| CHECKLIST_ADD / CHECKLIST_EDIT | IN_PROGRESS → same state | current STAFF |

Every request edit increments version, including same-state edits. Terminal requests reject mutations. Future AI start/complete/fail actions are not exposed or executable in M3.

### Manual review and assignment

Manual drafts retain a revision and policy ID/version/target snapshot; approved category and priority remain unchanged until approval. Draft revisions are retained in immutable manager-only audit records. Submit and approval revalidate staff/team/policy. Accept requires the pending draft revision and unchanged policy snapshot; modify supplies an explicit final decision. Reject clears the rejected draft. No fake AiRun, AiAnalysis or AiRecommendation is created.

Assigned staff must be active, available, STAFF, and an active member of an active selected team. Approval creates one assignment, checklist and SLA together. The existing unique constraints and locked expectedVersion prevent double assignment. Reassignment ends the old assignment, records the new one and immediately removes the old staff member's read/write scope. It preserves every stored SLA clock field. The final currentAssignee remains available for authorized terminal detail; terminal work leaves the active queue.

### SLA behavior

The first approval selects the active exact category/priority policy or the active priority fallback, snapshots its target and starts the clock using PostgreSQL time. There is no arbitrary-minute override. Boundaries are floored to integer seconds. WAITING_USER pauses; an explicit information response resumes; a generic message does not. RESOLVED freezes the assessment; confirmation preserves it; reopen resumes the original remaining budget. Priority change selects a new policy without resetting start/exclusions and cannot erase a prior breach. Cancellation closes any open pause, stops assessment and preserves breach history for future reporting exclusions.

Deadline equality remains on time; breach starts at dueAt + 1 second. Tests prove the canonical 09:00 assignment, 09:30–10:00 pause, 11:00 resolution, 12:00 reopen and 12:30 deadline, repeated exclusion cycles and sticky breach. The UI explicitly labels pause/hold/closed/canceled states and displays the budget at the last fetch. Scheduled warning monitoring belongs to M8.

### Notifications and timeline

Transactional notifications cover APPROVAL_REQUIRED, REQUEST_ASSIGNED, USER_INFO_REQUIRED, USER_REPLIED, REQUEST_RESOLVED and REQUEST_REOPENED. The existing recipient/event/type key prevents duplicates. Only the recipient lists or toggles a notification; marking read is idempotent. Safe references do not grant access to a request after reassignment.

Timeline pages come from persisted successful audit events, safe status-history joins, messages and immutable resolution cycles. Selected pages are chronological. Actor type is explicit; M3 creates human events only. Internal before/after JSON, draft snapshots and auth data are excluded; duplicate internal checklist/policy audit snapshots are not separate public timeline entries. History queries also apply current ownership predicates.

## Files/modules changed

| Area | Files/modules |
|---|---|
| Backend workflow | `apps/api/src/requests/{request-state-machine.service,transition-rules,sla-clock,request-query.service,requests.controller,workflow.guard,validation}.ts`; provider/controller registration in `apps/api/src/app.ts` |
| Shared contracts | `packages/contracts/src/workflow.ts` and index export |
| Backend verification | `apps/api/test/workflow.test.mjs`, `workflow.integration.test.mjs`; additive OpenAPI assertions in `health.test.mjs`; API test script and integration runner |
| Frontend | Role route trees under `apps/web/src/app/{user,staff,manager}`, login/profile/notifications; `components/{login-form,session-shell,request-list,request-detail,notifications}.tsx`; `lib/session.ts`; layout/home/styles |
| Browser verification | `apps/web/e2e/m3.spec.mjs`, `playwright.m3.config.mjs`, root `test:e2e:m3` script |
| Tooling/docs | Root package/lock, Prisma generation before native dev boot, README, this report and sanitized M3 evidence |

## Database changes

**No schema or migration changes.** All M3 behavior uses the frozen M2 models and constraints. All three existing migrations were applied again to an empty dedicated `mobiflow_m2_test` database, with seed executed twice to verify idempotence. The runner removes only that named test database after execution. The main demo database and Docker volume remain intact.

The main database migration command reported three migrations and no pending migrations. Explicit `npm run demo:seed` returned 6 users, 4 teams, 5 skills, 5 memberships, 7 staff-skill links and 4 SLA policies. Integration verified PostgreSQL 17.11, pgvector 0.8.6, zero embedding columns, runtime sequence usage and audit INSERT but no UPDATE permission.

## API changes

All application paths use `/api/v1`; frozen M1 health aliases and M2 routes remain available.

- Requests: `POST /requests`; `GET /requests/mine`, `/requests/:id`, `/requests/:id/history`.
- Commands: `POST /requests/:id/{messages,provide-info,confirm,reopen,cancel,start,request-info,resolve}`. Messages return 201 with the created message and updated request/version.
- Staff: `GET /staff/work-queue`.
- Managers: `GET /manager/requests`, `/manager/approvals`, `/manager/approvals/:id`; `POST /manager/requests/:id/{triage,submit-approval,reassign,priority}`; `POST /manager/approvals/:id/{accept,modify,reject}`.
- Manual work checklist: `POST /requests/:id/checklist`, `PATCH /requests/:id/checklist/:itemId`.
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`.

OpenAPI at `/api/docs` and `/api/docs-json` contains shared request/response schemas, bearer authentication, action names, expectedVersion and 403/404/409 mutation behavior. Role and transition constraints are enforced by the backend, not inferred from documentation. Lists use validated bounded keyset pagination; status/priority/category/assignee/date filters cannot enlarge ownership scope. Invalid query/cursor returns 400. Wrong role returns 403; unknown/out-of-scope resource returns 404; stale or invalid-state commands return 409; invalid staff/policy/checklist invariants return 422.

## UI changes

Implemented routes:

- `/login`, `/profile`, `/notifications`.
- `/user/dashboard`, `/user/requests`, `/user/requests/new`, `/user/requests/[id]`.
- `/staff/dashboard`, `/staff/work-queue`, `/staff/requests/[id]`.
- `/manager/dashboard`, `/manager/requests`, `/manager/requests/[id]`, `/manager/approvals`, `/manager/approvals/[id]`.

Typed API responses, native labeled forms and shared validation cover loading, empty, service errors, 403/404, pending operations, stale versions and successful changes. A 409 locks actions until explicit reload/review; it does not silently retry a stale command. USER/STAFF/MANAGER each have a complete minimum workflow. Manager API modify is implemented; the minimum UI supports reviewing/accepting or rejecting and preparing a revised draft. No AI panels or fabricated AI results are displayed.

Access tokens live only in memory. Refresh uses the existing HttpOnly cookie and serializes attempts within the page and via Web Locks across supporting tabs. Reload and logout use the M2 session endpoints. No database credentials, signing keys or refresh hashes are sent to the browser. Forms use native React/HTML controls and existing Zod; no new runtime form or data-cache dependency was needed.

## AI changes

None. No inference, embeddings, RAG, AI tools or AI approvals. The actual installed host tag remains `qwen3:4b-instruct-2507-q4_K_M`, digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`. The live runtime check verified its installed name. Native API still uses localhost Ollama; Docker uses host.docker.internal. Embedding remains NOT_CONFIGURED, so AI readiness is truthfully degraded. With Ollama unreachable, API/DB/vector readiness remains available and all workflow integration scenarios complete.

## Security considerations

M2 authentication, authorization predicates, session rotation/replay detection, logout, CSRF and audit restrictions were reused and regression-tested. Writes also lock/recheck the live identity and session inside the business transaction. Ownership predicates apply before list pagination and to detail/history queries; no broad fetch is filtered only in the UI. Manager drafts and audit metadata do not appear in USER/STAFF payloads. Raw SQL uses Prisma bound parameters; no external input reaches a raw SQL string or shell. React renders text without trusted HTML.

Workflow requests require bearer authentication; writes require JSON and reject an unapproved supplied Origin. Per-user limits are 120 reads and 60 writes per minute in the local single API process. ExpectedVersion, request row locks and database uniqueness enforce concurrency independently of UI controls. Production dependency audit found zero vulnerabilities. Docker configuration, localhost-only ports, restricted runtime DB role and M1/M2 secrets/config remain unchanged. No project-specific `security/references/VIBE_CODING_SECURITY_CHECKLIST.md` was present.

## Versions and dependencies

Only new direct dependency: **devDependency `@playwright/test` 1.63.0**, for actual M3 browser verification; its matching Playwright packages are locked transitively. Registry version/engines were checked before installation (Node >=20), with [official supported environment documentation](https://playwright.dev/docs/intro) and [browser documentation](https://playwright.dev/docs/browsers). Installed Microsoft Edge was used, with no browser/model download.

Existing versions retained: Node 24.19.0, npm 11.17.0, TypeScript 6.0.3, Next 16.3.6, React/React DOM 19.3.0, Tailwind 4.3.3, Nest common/core/platform-express 12.1.0, Swagger 12.0.2, Prisma/client/adapter-pg 7.10.0, pg 8.23.0, Zod 4.6.5, Argon2 0.45.1, jose 6.2.12, ESLint 9.39.4. `npm ls --depth=0` completed without missing/invalid dependencies. No new production dependency or environment variable was added.

## Tests executed

All commands below were actually executed from the repository root, with exit code 0 on the final run.

| Command | Actual result |
|---|---|
| `npm run lint` | PASS; zero ESLint warnings/errors |
| `npm run typecheck` | PASS; contracts/config, generated Prisma, API and Next route/TypeScript checks |
| `npm run test` | PASS; config 4/4, API 17/17, web 1/1; 22 tests total, none skipped |
| `npm run build` | PASS; foundation, Prisma, Nest and Next production build including all M3 routes |
| `npm run db:validate` | PASS; Prisma schema valid |
| `npm run db:migrate` | PASS; 3 existing migrations, no pending migrations |
| `npm run demo:seed` | PASS; expected synthetic counts recorded above |
| `npm run test:integration` | PASS; 7 runtime checks; clean migration and double seed; M2 auth suite 1/1; M3 workflow suites 3/3 |
| `npm run test:e2e:m3` | PASS; 2/2 Edge browser scenarios, 8.1 seconds on final run |
| `docker compose config --quiet` | PASS |
| `docker compose build api web` | PASS; both production images built |
| `docker compose up -d` | PASS; final images running |
| `docker compose ps` | PASS; postgres/api/web all healthy, ports bound to 127.0.0.1 |
| `npm audit --omit=dev --audit-level=high` | PASS; 0 vulnerabilities |
| `npm ls --depth=0` | PASS; installed dependency tree valid |
| `git diff --check` | PASS; only configured LF/CRLF conversion notices, no whitespace errors |
| `git diff --exit-code HEAD -- AGENTS.md docs/reference docs/specs docs/IMPLEMENTATION_PLAN.md docs/verification/MILESTONE_1_VERIFICATION.md docs/verification/MILESTONE_2_VERIFICATION.md apps/api/prisma` | PASS; frozen contracts/reports/schema unchanged |

### Behavioral coverage

- Independent unit transition expectations exercise 570 state/action/role combinations, including the denied complement, terminal protection and disabled future AI actions.
- Deterministic SLA tests inject timestamps; no sleeps establish clock results.
- Real HTTP/PostgreSQL suites verify full create/triage/submit/assign/start/resolve/confirm, wait/respond, reopen/re-resolve, rejection/revision, owner and manager cancellation, current-policy revalidation, priority changes, invalid staff/team/activity/availability, scoped lists/details/history and notification ownership.
- Concurrent approval produces one 200 and one 409, one assignment and one SLA. Stale snapshots and an invalid modify after audit insertion prove transaction rollback. Repeated information response changes no counts. Reassign/request-info races produce one winner; the old staff member loses access.
- Required checklist completion blocks premature resolution. Both historical resolution cycles persist in the safe timeline. Manual workflow creates zero AI runs/recommendations. Runtime AuditLog modification remains denied.
- M2 auth integration covers login, role/ownership, refresh rotation/concurrent replay, logout, CSRF/rate restrictions, inactive identities, seed and audit behavior. M1 runtime verifies DB/pgvector, actual host Qwen, production web/API, and separate offline Ollama health.
- Browser E2E uses three isolated authenticated contexts and real Docker API/PostgreSQL. It covers manual approval, information exchange, checklist completion, resolution/reopen/second resolution/confirmation, stale-version lock/reload, notifications, 403/404 and responsive widths 360/768/1440 without horizontal overflow. No browser page errors occurred. The second scenario verifies keyboard skip focus, controlled login network failure with preserved input, retry, refresh after reload and logout.

Initial implementation iterations exposed TypeScript/OpenAPI import issues and integration fixture constraints; they were fixed at their source. Initial browser failures were strict alert locators also matching Next's route announcer; locators now target the main content alert. Final runs above have no failed or skipped tests. A PowerShell profile XML warning appeared on one wrapper invocation; subsequent commands ran with the profile disabled, and actual command exit codes/logs were checked.

Sanitized durable evidence: [runtime snapshot](evidence/M3_RUNTIME.json), [browser results](evidence/M3_BROWSER_RESULTS.json), [unit test output](evidence/M3_TEST.txt), [integration output](evidence/M3_INTEGRATION.txt), [browser output](evidence/M3_E2E.txt). Local build/DB/seed logs remain under ignored `artifacts/m3-*.log`.

## Manual verification

Reviewed the rendered final browser screenshot at `artifacts/m3/workflow-closed.png`: CLOSED with MET SLA, explicit confirmed label, both resolution cycles, human actor timeline and terminal actions disabled. Browser automation verified mobile/tablet/desktop overflow and keyboard focus. Reviewed safe DTOs, parameterized queries, status writers and frozen-document/schema diff. No manual gate remains for the requested local M3 scope.

The native `npm run dev` watch session was not restarted during final verification because the final Docker stack owns ports 3000/3001; production Docker and host-built integration APIs were actually booted. Dev startup now generates Prisma before API compilation. Extended cross-browser/screen-reader testing and public production deployment were not performed and are not claimed.

## Known limitations

- Local synthetic V1 only; in-memory request rate limits target one API process. Shared distributed limits and production deployment are outside this milestone.
- Dashboard pages provide scoped request overviews, not analytics. Notifications retain canonical event codes; no email or push delivery.
- SLA is assessed at actions/reads; no scheduled warning worker or continuous UI countdown yet. UI explicitly says values are from the last load.
- Browser E2E currently requires installed Microsoft Edge and creates synthetic records in the main demo database. It does not erase them. PostgreSQL integration uses a separate disposable database.
- Embedding model is unconfigured; no AI readiness, generation quality or embedding dimensions are claimed. This does not block the AI-independent M3 gate.
- Feedback, AI checklist adoption and scheduled SLA warnings remain at their owning milestones. The M3 checklist only supports human approved work needed to enforce resolution invariants.

## Deferred items

M4 provider/inference, structured analysis and evaluations; M5 ingestion/embeddings/RAG; M6 tools/recommendations; M7 AI-bound review; M8 Copilot, AI-assisted checklist, SLA warning monitor and feedback; M9 analytics/evaluation; M10 full release/demo gates. No later-milestone implementation was started. Existing deferred commands continue to fail explicitly until implemented.

## Release blockers

No M3 blocker remains. This PASS does not mark the full V1 product release-ready: M4–M10 remain required under the master plan. M0/M1/M2 frozen files and behavior remain preserved by diff and regression evidence.

## Gate

**PASS — M3 complete.** The manual business workflow works without AI; centralized state integrity, backend ownership, expectedVersion, transactional audit/history/notifications, assignment and SLA behavior are verified by real PostgreSQL and browser runs. All required M3 commands passed. The repository is ready for an explicitly authorized M4 task; execution stops here pending that authorization.
