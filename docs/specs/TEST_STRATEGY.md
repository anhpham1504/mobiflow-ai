# Test Strategy

Authority: master-plan §§22, 30–31, 34, 36, 39–40 and milestone-specific gates. No application tests, builds or live evaluations have run in M0. [MILESTONE_0_VERIFICATION](../verification/MILESTONE_0_VERIFICATION.md) records actual documentation checks separately.

## Layers and isolation

| Layer | Scope | Evidence / owning milestone |
|---|---|---|
| M0 documentation | Required files, links, canonical vocabulary, source hashes, no feature scaffold; manual contradiction review | PowerShell checker and consistency review; M0 |
| Unit | Exhaustive state guards/denied combinations, RBAC helpers, clock math, score ties/filters, schema parsers, chunker, source validation, tool limits | Deterministic test runner selected in M1; M2–M8 |
| Integration | Real PostgreSQL migrations/constraints/transactions/vector search/session rotation/request lifecycle/approval atomicity | Isolated test DB and pgvector; M2–M8 |
| API contract | Auth, roles/ownership, DTO limits, error codes/projections/pagination, important route negative paths | Generated OpenAPI/shared contracts reconciled with actual endpoints; M2 onward |
| Browser E2E | Role journeys, state feedback, approval, work, sources, notifications, errors/keyboard/mobile | Playwright; deterministic test-only provider fixtures allowed and labeled; M3/M7/M8/M10 |
| Live AI/RAG | Actual configured Ollama generation/embeddings, labeled request/retrieval datasets, failure recovery | Separate live runner and model metadata; M4/M5/M9/M10 |
| Security/demo | IDOR, CSRF/CORS/session handling, upload/XSS/SQL, prompt/tool injection, preflight/offline and hardware behavior | M10 audits and final evidence |

Fixtures may test orchestration/UI repeatably; they never stand in for actual Ollama availability, model quality, retrieval results or benchmark measurements. Test provider must require explicit test environment and cannot silently activate in the demo runtime. Inject a clock for deterministic SLA and a controlled provider for schema failures. Use real PostgreSQL, not SQLite, for database semantics.

## Critical negative and concurrency matrix

Every important API endpoint has unauthenticated, wrong-role, wrong-owner/current-assignee, malformed payload, valid success and applicable stale-version tests. Validate projected fields and count leakage as well as HTTP status. Required scenarios:

1. All allowed state edges and denied complement, terminal immutability, owner-only close/reopen, staff unable to approve and manager unable to impersonate owner/staff.
2. Happy path with AI disabled through explicit manual submit/approval; waiting-user pause/reply; resolve/confirm; reopen retaining budget; seven cancel state edges and owner restrictions.
3. Concurrent accept/accept, accept/modify, reject/accept, cancel/AI completion, source-disable/accept, reassign/staff-resolve and replayed worker events. Assert one valid commit, no duplicate assignment/SLA and no partial audit/notification.
4. Login failure/inactive account, access expiry, revoked-session access, refresh rotation/replay/concurrent refresh, logout, forged role and CSRF/Origin restrictions.
5. Invalid JSON/unknown fields/out-of-range enums, missing facts, timeout/provider offline/known model missing, bounded retries/deadline, crash recovery and no lost request.
6. Unknown/unauthorized tool, oversized tool result, stale scope, fabricated source/staff/policy/history/count, source generation mismatch, no-evidence behavior and no preapproval protected mutation.
7. PDF/TXT validation, traversal, MIME/signature mismatch, empty/scanned PDF, chunk boundaries/page IDs, duplicate upload, reindex/disable race and wrong embedding dimension/model despite equal vector length.
8. Checklist save only by staff, AI cannot tick, required item waiver reason, cross-request item ID, summary event provenance, summary failure independent of resolution, single owner feedback after CLOSED.
9. SLA exact deadline, 20% risk boundary, multiple waits/reopens, delayed tick, priority-reduction immediate breach, sticky historical breach, cancel exclusion and warning dedupe after reassignment.
10. Escaped HTML/model content, no secrets/reasoning in browser/logs, source/notification access loss and synthetic reset refusing a non-demo target.

## Dataset and live-run protocol

M4 minimum 50 manually labeled cases: 30 normal, 10 incomplete, 5 ambiguous, 5 noisy/colloquial Vietnamese. M5 20–30 retrieval questions with expected real synthetic document ID/page where known. M9 minimum 100 valid request cases, target 150–300 if feasible, covering all six categories, missing facts, ambiguity, informal language and duplicates. Dataset truth is independently defined and documented before comparing model outputs; never use prediction as its own label. Schema-invalid dataset rows fail preflight and are reported, not silently dropped to improve scores.

`npm run ai:evaluate` is a future M9 command: verify local provider/model/index identity; record commit/environment/config/dataset hash/prompt versions; execute real cases; retain timestamped machine-readable safe results; compute report. Save `docs/evaluation/results/<timestamp>.json` and `docs/evaluation/AI_EVALUATION_REPORT.md`. Retain failures/timeouts in denominators; no cached or fixture success substituted for missing live service. Deterministic seeds are labeled and separated from current measured results.

## Metric definitions

| Metric | Exact computation |
|---|---|
| Structured validity | Cases with final schema-valid output / all attempted valid dataset cases; report first-attempt validity separately and count timeout/unavailable as failures |
| Category / priority / routing accuracy | Exact predicted approved-taxonomy category / suggested priority / suggested team against independently labeled expectation divided by all cases carrying that label; invalid/failed output is incorrect |
| Entity match | Per-field exact match after NFC/trim/whitespace normalization and lowercase for customer/location; integer equality for count; reported-time text normalized without guessing date. Missing/null expectations scored explicitly; disclose per-field denominators |
| RAG Hit@k | Labeled queries whose expected document occurs in top k real retrieved results / all labeled queries; errors/misses count as misses; k=1,3,5 |
| Latency | Monotonic end-to-end elapsed milliseconds including retries; mean, median and p95 nearest-rank ceil(0.95*n). Report all attempts and successful-case latency separately, warm/cold state and timeout policy |
| Recommendation outcomes | ACCEPTED/MODIFIED/REJECTED counts divided by their sum; count reviewed recommendations, not requests. Exclude manual reviews, invalidated and unreviewed PENDING records; display pending separately |
| Average resolution | Mean wall-clock seconds from createdAt to latest effective resolvedAt for RESOLVED/CLOSED requests in the selected resolvedAt window; excludes canceled/open/unresolved. SLA active seconds reported separately |
| SLA fulfillment | MET closed/resolved instances / (MET + BREACHED closed/resolved instances) in selected resolution window; canceled excluded; running risks reported separately |

Model confidence is uncalibrated self-report, never a measured quality metric. A workflow acceptance rate is not proof of universal correctness. Operational “open” includes every state except CLOSED/CANCELED; “today” uses local demo time zone boundaries converted to UTC; dashboard high/urgent uses approved priority, not suggestion. Every aggregate includes window/asOf/denominator; empty denominator returns null/unavailable, never fabricated zero-quality success.

## Manual triage benchmark

M9 uses a documented fixed synthetic set (initial 20 requests), manually labeled truth and comparable tasks: categorize, choose priority/team/staff and locate SOP. Record participant, task order, warmup/provider state, start/stop criteria and raw timings for manual versus AI-assisted manager decision. Counterbalance order where feasible and disclose learning/hardware bias. Report mean/median/min/max and sample size. Label it a demo benchmark if methodology is weak; do not infer scientific/generalized productivity claims. No target reduction is prefilled as a result.

## Milestone gate command policy

M13 targeted gate: `npm run test:unit:m13`, `npm run test:integration:m13` (real isolated PostgreSQL), `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run test:e2e:m13` (production build, isolated real API/DB on free localhost 3000/3001). DEMO_MODE=true and existing runtime/migration credentials are prerequisites; no live demo data is reset. Existing M9 analytics unit tests and only the M9 analytics integration case are directly affected. Shared M11/M12 clock/dashboard implementations are unchanged, so their regression suites and M0–M10 historical browser/live-model gates are intentionally NOT RUN. `npm test` runs the existing fast deterministic units/release-tool tests as explicitly requested; it does not invoke historical DB/browser/model runs. Metric computations are verified against real SQL fixtures instead of testing duplicate JavaScript aggregators. Record failures/repairs, actual commands, row/query/latency/plan measurements, OpenAPI/HTTP RBAC, keyboard, invalid/empty/loading/error/stale states and serious/critical Axe zero. Never write PASS evidence when a subtest failed.

From M1, root lint/typecheck/unit/build commands must execute real checks. Integration/E2E/live-evaluation/demo commands become fully implemented in their owning milestones; early entrypoints must fail explicitly as unavailable rather than return a fake pass. M1's own gate does not require a completed M9 evaluator. This resolves master-plan M1 script inventory versus later implementation ownership without dropping any final command requirement.

Each gate records exact command, exit result, environment and relevant artifact; unavailable prerequisites are NOT RUN/blockers for the milestone that requires them. Do not repeatedly broaden testing after appropriate checks pass without a new change/concern. Never disable validation, delete tests, mock away production boundaries or fake a report to meet schedule.

Final M10 evidence includes lint/typecheck/unit/integration/E2E/build, Docker/local startup, actual model/embedding configuration, live AI/RAG evaluation, security and AI safety audits, offline demo/preflight/warmup. Critical business/security invariants have zero tolerated known violations; model accuracy has no invented numeric pass threshold in the master plan, so report actual results and ensure required scenarios honestly work rather than inventing a target or claiming perfection.
