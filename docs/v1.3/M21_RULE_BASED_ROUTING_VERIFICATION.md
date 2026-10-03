# M21 — Rule-based Routing verification

2 October 2026. Authority: the direct user M21 request and the [implementation plan frozen before product edits](M21_RULE_BASED_ROUTING_IMPLEMENTATION_PLAN.md). Scope is M21 only. M22–M24 NOT STARTED; V1.3 IN DEVELOPMENT. This is a local synthetic verification record, not a release or deployment.

**M21 PASS — READY FOR HUMAN REVIEW.** All required gates and final cleanup passed; changes remain uncommitted on the requested branch.

## Baseline and architecture review

Started clean on `feat/v1.3-response-checklist-templates`, HEAD and remote M20 checkpoint `b75d15acc2dbbb16d00ce47db8ed891af210a48d`. Actual preflight: `git status`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git log -10 --oneline --decorate`, `git fetch origin`, `git ls-remote origin refs/heads/feat/v1.3-response-checklist-templates`, checkout and `git pull --ff-only` (already up to date), then `git checkout -b feat/v1.3-rule-based-routing`. A PowerShell profile emitted incidental Import-Clixml errors; later execution used no profile. No existing work was reset or removed.

Reviewed RequestStateMachineService (assignment/approval/reassignment and expectedVersion/row lock), RequestQueryService (projections), authorization A01, shared Team/STAFF eligibility, canonical classification versus manual/AI artifacts, manager plan/reassignment fields, M18 privacy, M19 notification ownership, M20 immutable template provenance and generated OpenAPI. Protected commands and the entire backend requests/templates/AI/knowledge/analytics/dashboard modules remain unchanged. No new dependency or lockfile change. Node24.19.0/npm11.17.0; the existing PostgreSQL/pgvector stack was used only for isolated test databases and read-only developer migration metadata.

## Implemented semantics and human control

One strict field allowlist and narrow RoutingFactsBuilder read only canonical category/subcategory/priority. Null classification stays null; default MEDIUM before first approval is the actual Request priority. No manual-draft/AI fallback, free-text input, expression/path evaluation or client facts. EQ accepts one enum; IN accepts1–20 valid enum values, deduplicated/sorted on write. Flat AND combines1–10 conditions. Lower numeric priority1–10000 wins. Best-priority same-Team ties retain all winning revisions; different Teams return CONFLICT without a target. NO_MATCH preserves manual work. Ineligible winning Team returns NO_MATCH/INVALID_TARGET without a lower-priority redirect. Optional fallback is deliberately absent.

The pure evaluator depends on explicit facts/current rule revisions/current target eligibility, not a database, clock, random source, network or AI. UUID sorting only stabilizes presentation. Responses include requestVersion, all evaluated immutable revision identities and parent rule versions, winners and per-condition explanations. Canonical facts/evaluation are manager-only and no-store.

Apply re-evaluates the displayed snapshot and rejects changed Request/rules/targets. A successful Apply sets local Team only, clears staff selection and focuses the staff selector; it performs no protected command. Human staff selection and Team override remain available. Existing triage-save/submit/APPROVE_AND_ASSIGN or REASSIGN alone write business state using the displayed expectedVersion. Stale submission409 preserves business rows. Evaluation/Apply failure leaves manual workflow available, with15-second read bounds. Routing acceptance is not persisted: current protected commands have no routing-source field, so the immutable evaluation/history is the only routing provenance. Existing human assignment audit and selected values remain authoritative.

## Storage and migration evidence

Repository10→11; migration `20261002040000_m21_rule_based_routing` adds only RoutingRuleStatus, RoutingRule and RoutingRuleRevision. INACTIVE revision1/version1 on create. Definition edits append immutable revisions; lifecycle commands increment parent version, detecting deactivate/reactivate ABA. Archive is terminal. DB checks enforce enums/bounds/JSON shape/Team and creator FKs, unique contiguous revisions, deferred current pointer and immutable revisions. Runtime has SELECT/INSERT, narrow parent UPDATE columns, no DELETE/TRUNCATE/DDL or revision update. Full-table UPDATE=false in evidence is intentional; authorized parent-column UPDATE is tested separately.

[Database evidence](evidence/M21_DATABASE.json) records four real isolated paths:

| Path | Result / preservation |
|---|---|
| Fresh1→11 | PASS; constraints and runtime privilege negatives |
| M20 10→11 | PASS;32 preexisting tables /160 seeded rows compared |
| M19 9→10→11 | PASS;29 tables /157 rows at9→10,32 /160 at10→11 |
| V1.2 7→8→9→10→11 | PASS;26 /152,27 /153,29 /157,32 /160 across upgrades |

Comparison retains original values for all preexisting rows, allowing only intended nullable additive legacy fields. Synthetic fixtures add notes/mentions/watchers/internal notifications/templates/checklist and message provenance at their applicable baselines; existing domain and AI rows come from the guarded demo seed. Counts do not imply that every table has a row. No old migration was edited. Developer migration metadata/checksums were read before/after and remain7; developer DB was not migrated/reset/reseeded. The harness refuses an existing test database, uses a dedicated advisory lock, creates only `mobiflow_m21_test` and drops only its own target in cleanup.

## HTTP, security and regression evidence

[API evidence](evidence/M21_API.json):11/11 real PostgreSQL/HTTP tests, no skips and no AI calls.

- All10 routing operations deny USER/STAFF, including guessed IDs; live identity/account/session checks, no-store, existing origin/media/size guards and strict body/query/enum/operator validation pass. Unknown fields, nested paths, expressions, client fact overrides and invalid references are rejected.
- A01 intentionally gives MANAGER all requests in the single synthetic organization. An explicitly constrained requestScope test verifies that evaluation applies the existing predicate before projection and returns the same404 as an unknown request. This is a policy-boundary test, not a claim of a nonexistent second tenant.
- Create/revise/activate/deactivate/archive, immutable paginated history, SQL search/filter/list/targets and resource-only audit pass. Two-writer revision, activate/archive, revise/archive and lifecycle ABA races yield one success/one409 without partial rows. A real audit-failure trigger proves atomic rule/revision rollback.
- Deterministic MATCH/NO_MATCH/CONFLICT, AND, priority, same-target ties and missing/inactive/no-eligible-member target behavior pass. Read-only comparisons cover Request/version, Assignment, SLA, Checklist/items, history, messages, notifications and audit. No evaluation or management fan-out.
- Human override selects a different Team and explicitly approves, then reassigns through existing commands. Final assignment alone produces one ordinary assignment notification plus one M19 watcher event. M20 edited checklist/source revision survives; M18 note remains absent from USER request/history/notifications and note endpoint is403. Reassignment leaves the existing SLA row unchanged.
- Generated OpenAPI has8 routing paths /10 operations, unique operation IDs, resolved references and bearer security. No new delete/action endpoint or change to legacy command contracts. Safe log checks and captured provider calls=0 pass.

Focused security review and credential scan: PASS,0 findings,24 production JavaScript bundle files. [Security evidence](evidence/M21_SECURITY.json) records the actual changed-file count and preserved owners. Review covers auth/RBAC/IDOR, strict injection boundaries, current target eligibility, atomic versions/audit, no automatic assignment, USER projections, escaped text, no-store, unchanged sensitive owners and configured-secret/token/private-key patterns. No penetration-test claim. Existing infra/dependencies/uploads are unchanged; no deployment is performed.

## Determinism and measured performance

An owner-only test index followed by PostgreSQL CLUSTER reverses physical rule tuple order without changing any logical field; complete evaluation data remains identical. Repeated and permuted pure-input units also agree, including all tied revision identities. HTTP request-correlation IDs are transport metadata and are excluded from evaluation-data equality.

Actual fixture:50 rules,33 ACTIVE /17 INACTIVE,10 conditions each. Active rule-load SQL=2, evaluation SQL=9, rule-list SQL=7; total counts include transaction/identity work. Target eligibility is batched with one query, never one per rule/condition/target. Five final service latency samples:12.04,17.79,13.21,11.88,11.89ms. These are local synthetic measurements, not an enterprise SLO. Active rules and target enumeration are bounded500; overflow fails closed with503 while manual assignment remains available.

## Browser, accessibility and responsive evidence

[Browser evidence](evidence/M21_BROWSER.json) records the latest production Next / real API / real PostgreSQL run in Microsoft Edge via Playwright, isolated33300/33301. Four cases cover rule lifecycle/editor/history/search, local prefill versus full persisted Request equality and final human override/approval/reassignment, stale rule/Request and failure states, and responsive/accessibility/XSS. Final source adds an announced status for the evaluation result and accurate Request-priority wording.

Twelve scans cover management editor, reassignment and manual draft at360/768/1440/1920; all recorded Axe violations and horizontal overflow are zero. Keyboard checks include editor focus, typed field/operator/value order, archive confirm/Escape/focus return, and focus on unselected staff after Apply. XSS names/descriptions/target labels stay literal; no injected image/script or console page error. USER produces no routing fetch, metadata or navigation and direct manager route is403. Simulated503/delay are explicitly labeled transport fixtures; successful persistence and stale409 tests use the real server/database. No full WCAG certification or assistive-technology compatibility claim.

## Commands and actual results

| Command | Result |
|---|---|
| `npm run lint` | PASS,0 warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS198/198: config7, API124, web2, release/evaluation harness units65;0 skipped |
| `$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:33301/api/v1'` then `npm run build` | PASS, production Next build plus API/contracts/config; process-only API URL override |
| `npm run test:database:m21` | PASS four isolated migration paths |
| `npm run test:integration:m21` | PASS11/11 after final strict evaluation/query/live-identity/rollback tests |
| `npm run test:e2e:m21` | PASS4/4,0 unexpected/skipped/flaky; final run402ca1b0-3ba2-4227-a9e9-130fcdfbffb6 |
| `npm run verify:security:m21` | PASS,0 findings,24 production JS bundles |
| `git diff --check` | PASS; final cleanup gate repeats it |
| `node --env-file=.env scripts/verification/m21-final-sanity.mjs` | PASS; baseline/remote/release/history preserved,0 staged, developer7, test DB and ports cleaned, normal loopback containers unchanged |

Final baseline commands and browser/security/cleanup commands use `node [--env-file=.env] scripts/verification/m21-capture.mjs M21_<NAME> <command>` to retain actual exit code/timestamps and ignored local logs. Compact gate metadata is under `evidence/gates/`. Initial database/API commands were executed directly; their dedicated reports and local logs retain actual results. Raw logs/screenshots/traces/fixture tokens stay ignored under artifacts, never committed evidence.

Targeted workflow/auth/M18/M19/M20 regression is included in current198 units plus the real11-case M21 HTTP suite and browser human-approval/template/reassignment tests. Older full milestone integration/browser suites were not replayed. The baseline `npm test` executes existing deterministic harness units (including historical release/evaluation test code), which is not a live historical gate replay.

Historical M0–M20 replay: **NOT RUN — intentionally outside M21 scope.** Ollama probe/start/download/generation: **NOT RUN**. AI routing: none. Live AI evaluation: **NOT RUN — not required**. Source-owner preservation and zero-provider-call evidence establish this change's AI isolation, not live model quality.

## Retained iterations and corrections

Earlier failed attempts remain visible; no test was disabled or marked skipped:

1. `artifacts/m21-lint.log`: test used unqualified structuredClone, rejected by the existing ESLint environment. Changed to globalThis.structuredClone.
2. `artifacts/m21-lint-rerun.log`: a reassigned E2E temporary variable was unused. Removed the unnecessary assignment; later lint passed.
3. First API run9/10: a fixture expected200 for the existing message-create endpoint, which correctly returns201. Corrected that assertion. [Retained FAIL](evidence/iterations/M21_API-2362bc04fa44.json); later10/10 and final11/11 PASS after extra security tests.
4. First browser run1/4: exact getByLabel on wrapping select labels also included option text in that locator's text matching. Replaced ambiguous locators with exact accessible combobox names; product behavior was unchanged. [Retained FAIL](evidence/iterations/M21_BROWSER-2df270b71019.json); subsequent production runs passed4/4. All previous successful reports are retained by content hash when the latest pointer changes.
5. Final review added explicit15-second cancellation bounds, latest-rendered Request-version comparison, an accessible routing result status and clearer Request-priority wording. Production build/browser checks were rerun against these changes.
6. First captured security gate stopped before source scanning because the current branch was M20. Reflog showed M21 created at16:03:24, then later checkouts to M20/main/back to M20 at16:07 (Asia/Saigon); no harness switches branches. Both feature refs and HEAD remained the exact M20 baseline. Restored the already-authorized M21 branch using ordinary `git switch` after verifying equal SHAs, and compared tracked diff/untracked inventory before/after: unchanged. The failed security capture is retained under gates/iterations; subsequent full security review passed. No reset, stash, commit or test-result substitution.

## Known limitations and stop

Fixed enums, flat AND, Team targets only; no optional fallback, staff selection, skill targets, OR tree, regex/free text, load balancing, background router or AI. Canonical category/subcategory are often null before approval. Existing A01 is single organization. Rule cap500 is deliberate and fails closed; no load/WCAG/penetration certification. Evaluation provenance is not a persisted assignment-acceptance record. The normal developer stack remains at migration7 and does not serve this migration11 feature. No production migration/deployment or new M22 behavior.

Final Git/history/owned-resource cleanup: PASS. [Final inventory](evidence/M21_FINAL.json) records63 changed/new files, including compact evidence and retained iterations;0 staged files. HEAD and remote M20 remain `b75d15acc2dbbb16d00ce47db8ed891af210a48d`; main and v1.2.0 remain `31b445caf07dad606601a1e38e8ed39836d9f825`. Historical migrations/evidence are unchanged. `mobiflow_m21_test` was removed;33021/33300/33301 are released. Original web/API/PostgreSQL container start timestamps are unchanged from the M20 snapshot and all bindings remain loopback. Developer migration count remains7. No commit, push, merge, tag or deployment.

Final gate: **M21 PASS — READY FOR HUMAN REVIEW**. No unresolved M21 blocker. Stop uncommitted; M22–M24 NOT STARTED, V1.3 IN DEVELOPMENT.
