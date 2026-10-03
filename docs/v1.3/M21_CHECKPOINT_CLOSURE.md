# M21 Checkpoint Closure

Date: **2026-10-03 Asia/Saigon**. Previous checkpoint: **M20 — Response & Checklist Templates**, `b75d15acc2dbbb16d00ce47db8ed891af210a48d`. Branch: **feat/v1.3-rule-based-routing**. Accepted [implementation gate](M21_RULE_BASED_ROUTING_VERIFICATION.md): **M21 PASS — READY FOR HUMAN REVIEW**. V1.3 remains **IN DEVELOPMENT**; **M22–M24 NOT STARTED**.

This is the immutable preparation/review snapshot included in the single checkpoint commit, following the [M20 convention](M20_CHECKPOINT_CLOSURE.md). It does not embed its own future SHA or claim that publication has already happened. **M21 PASS — CHECKPOINT CLOSED** requires the post-publication checks below; the actual SHA and results belong to the final closure handoff.

## Authorization and review

The direct user request **MOBIFLOW AI V1.3 — M21 CHECKPOINT CLOSURE** authorizes closure only: review every changed/new file, preserve accepted implementation/evidence, exclude private/runtime artifacts, update current documentation, stage only reviewed M21 files, create exactly one commit `feat(v1.3): complete M21 rule-based routing`, run ordinary `git push -u origin feat/v1.3-rule-based-routing`, verify local/remote SHA, preserved checkpoints/releases and clean tree, then **STOP**. It supersedes only the earlier uncommitted/no-push implementation boundary.

Closure authorization: **received directly from the user**. Independent external review: **NOT PERFORMED**. This agent's closure audit is not an independent human or external product review. No blocking product defect, unauthorized scope change, live secret, private real data or unrelated file was found. Closure edits only this record, the audit manifest and four current-authority/index documents. Product source, contracts, migration, tests, verification utilities and accepted execution evidence stay unchanged.

## Baseline and complete file audit

Git preflight confirmed the exact M20 HEAD and requested M21 branch, **zero staged files**, and **63 changed/new files = 18 modified + 45 new**. Fetch/remote inspection confirmed the M20 feature branch at its required SHA and no pre-existing remote M21 branch. Local/remote main and peeled v1.2.0 remain `31b445caf07dad606601a1e38e8ed39836d9f825`; historical release tag objects were captured for comparison after push.

All63 original files are **INCLUDE**. Adding this record and [the sanitized audit manifest](evidence/M21_CHECKPOINT_AUDIT.json) produces **65 files = 18 modified + 47 new**. The manifest enumerates every path, category, disposition and Git content hash; its own hash is omitted to avoid recursive content.

| Category | Before closure | Intended checkpoint |
|---|---:|---:|
| A — Database/schema/migration | 2 | 2 |
| B — Backend | 6 | 6 |
| C — Contracts | 2 | 2 |
| D — Frontend | 6 | 6 |
| E — Tests and browser test config | 5 | 5 |
| F — Verification scripts/package commands | 9 | 9 |
| G — Documentation | 12 | 13 |
| H — Sanitized JSON evidence | 21 | 22 |
| I — Runtime/private candidates | 0 | 0 |
| J — Unrelated | 0 | 0 |
| **Total** | **63** | **65** |

The initial audit compared all63 accepted files with the retained GitHub Desktop backup tree `712376dd33bc1b9499d5d0c90cd792c2c94daccb`; every Git blob matched and that tree's baseline parent is the exact M20 checkpoint. This confirms the earlier restoration did not lose accepted code. Closure leaves the backup unchanged. The final audit permits differences only in PROJECT_SPEC, IMPLEMENTATION_PLAN, V1_3_MASTER_PLAN and the V1.3 index, plus the two new closure records. All other accepted files, including the implementation plan, verification, milestone record and M21_FINAL inventory, retain their historical pre-closure contents and flags.

All21 original sanitized evidence JSON parse successfully; every latest required gate is PASS. Previous failed and successful iterations remain retained, including the initial lint environment, API status assertion, browser locator and Git branch precondition corrections documented in accepted verification. No historical M18/M19/M20 evidence or migration is rewritten.

## Secrets, private data and evidence policy

Candidate review covers Bearer/Authorization/JWT/access-token/refresh-token/cookie/password/DATABASE_URL/POSTGRES_PASSWORD/JWT_SECRET/API_KEY/private-key terms, configured live values, credential URLs, JWTs and provider/GitHub token shapes. **Live secrets:0; private real data:0; machine-specific absolute paths:0; unrelated:0; M22 product code:0.** Keyword occurrences are environment names, public synthetic demo credentials, dynamically obtained isolated test tokens or negative/redaction assertions. No raw credential value is copied into the committed evidence.

Only sanitized commands, exit codes, synthetic IDs/counts, timings, content hashes and repository-relative artifact pointers are committed. Raw stdout/stderr, screenshots, traces, fixture credentials, auth state, cookies, database dumps, uploads, .env, node_modules, .next and coverage remain ignored. No forced additions, user-work deletion or history-discard operation occurs. Production config, dependency lockfile, demo defaults and normal service ports stay unchanged; isolated M21 ports/database names exist only in explicit test/verification code.

Intentional log-related hits are the existing safe structured API log sink, one synthetic fixture rate-wait summary, verification JSON result output and a source-scan expression. There is no new product debugging, focused test or accidental skip. Existing Request-detail AI job-status polling is an unchanged M20 baseline line; it is not a routing scheduler or M22 implementation. Preliminary local audit tooling was repaired for a Windows argument-length limit and that existing-line classification; these are ignored local audit attempts, not product test reruns or replaced gate results.

## Routing semantics and human control

**RULE != ASSIGNMENT. EVALUATION = READ-ONLY. MATCH = SUGGESTION. NO_MATCH = MANUAL WORKFLOW. CONFLICT = HUMAN DECISION. APPLY = LOCAL PREFILL ONLY.**

RoutingFactsBuilder projects only canonical Request.category, Request.subcategory and Request.priority. Category/subcategory may be null before human approval and null never matches; default MEDIUM is the actual canonical priority. No manual draft, AI artifact, free text, Internal Note, mention, watch, template or client-provided fact enters evaluation.

The shared fixed-enum allowlist supports **EQ** with one exact value and **IN** with1–20 valid values, deduplicated/sorted on write. Flat **AND** combines1–10 conditions. Priority is integer1–10000; lower number wins. At the best priority, same-Team ties return MATCH retaining every winning immutable revision. Different-Team ties return CONFLICT with no selected target. UUID sorting stabilizes display only. NO_MATCH preserves manual workflow; an invalid winning target yields NO_MATCH/INVALID_TARGET without redirecting to a lower-priority rule. **Fallback and AI routing: absent.**

Evaluation uses a pure deterministic evaluator and a bounded, read-only RepeatableRead service snapshot. It writes no Request, version, Assignment, SLA, Checklist, message, history, audit or notification. Targets are active Teams with at least one active membership to an active/available STAFF account, checked with shared eligibility and batched queries. No automatic staff selection, skill target, background route or hidden assignment exists. The maximum500 active rules/targets is enforced; overflow fails closed with503 while manual work remains available.

Apply explicitly re-evaluates and compares the displayed evaluation, Request version, rule versions/revisions and target eligibility. On success it changes only local Team form state, clears staff selection and focuses the staff selector. It does not persist an assignment or trigger a protected command. The human chooses staff and can override Team. Existing manual draft/save/submit plus **APPROVE_AND_ASSIGN**, or **REASSIGN**, remain the actual mutation path; RequestStateMachineService alone owns assignment/status and existing **expectedVersion** checks. Stale Request writes return409 without business changes. Stale rule management uses expectedRevision plus expectedRuleVersion and transactional row locking; stale Apply requires fresh evaluation/review. No acceptance provenance is added to Assignment.

## Authorization, privacy and notification isolation

Routing rule management, history, fields/targets and request evaluation are **MANAGER-only**. USER and STAFF receive403 on direct routing calls, including guessed identities. Live session/account/role and AuthorizationPolicyService predicates are enforced in the backend; UI hiding is not the boundary. Evaluation applies the existing Request scope before projection and returns the same404 for an inaccessible or unknown Request. Existing A01 is one organization, with MANAGER scope across its requests; the accepted constrained-scope test verifies the predicate, without claiming a second tenant. Target IDs cannot bypass current Team/member/staff validation. USER receives no routing metadata, fetch, navigation or rule-management UI.

M18 Internal Notes and M19 mentions/watchers remain private and excluded from facts, USER views and AI context. M20 response/checklist templates and immutable source provenance remain independent. Existing SLA clock math/monitor, Request transitions, analytics/dashboard, AI behavior/provider, knowledge/RAG, recommendation and Copilot owners are unchanged. No routing data is appended to those contexts or metrics.

Routing evaluation, local Apply and rule management create **no workflow notification or watcher fan-out**. Rule management has its own transactional resource-only audit. Only the final existing human business command produces the established assignment notification and allowlisted M19 watcher event, with existing scope and deduplication. Accepted HTTP/browser regression verifies human override, template provenance, Internal Note isolation and unchanged SLA during reassignment.

## Database integrity and accepted verification

Accepted M21 changes Prisma schema and adds only **20261002040000_m21_rule_based_routing**, repository migration11: RoutingRuleStatus, RoutingRule and RoutingRuleRevision. Create starts INACTIVE revision1/version1; definition edits append immutable contiguous revisions; lifecycle changes bump parent version, detecting deactivate/reactivate ABA; archive is terminal. Database constraints enforce bounded typed JSONB conditions, allowed enums, unique/contiguous revisions, current-pointer integrity and RESTRICT references. Runtime has SELECT/INSERT and narrow parent-column UPDATE, with no revision UPDATE/DELETE, parent DELETE, TRUNCATE or DDL. Real privilege/rollback/race tests passed.

Migrations **1–10 are unchanged by Git blob comparison**. Existing M18/M19/M20 data and all old seeded values are preserved on the four isolated upgrade paths. Developer DB migration count: **7 per accepted metadata**. Closure performs **no DB connection, migration, reset, reseed or service action**; repository11 does not mean the normal developer stack has been upgraded.

| Accepted command/gate | Retained actual result |
|---|---|
| `npm run lint` | PASS,0 warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS198/198,0 skipped |
| `npm run build` with process-only isolated API URL | PASS, production API/web/contracts/config |
| `npm run test:database:m21` | PASS fresh1→11,10→11,9→10→11,7→8→9→10→11 |
| `npm run test:integration:m21` | PASS11/11 real HTTP/PostgreSQL,0 AI calls |
| `npm run test:e2e:m21` | PASS4/4 production Next/real API/PG,0 skipped/unexpected/flaky |
| Responsive/Axe on three changed surfaces at360/768/1440/1920 | PASS12 scans,0 violations/overflow; keyboard/focus/XSS verified |
| `npm run verify:security:m21` | PASS,0 findings,24 production JS bundles |
| `node --env-file=.env scripts/verification/m21-final-sanity.mjs` | PASS accepted history, developer7 and owned test DB/port cleanup |

Exact implementation commands, retained failures and limitations remain in [verification](M21_RULE_BASED_ROUTING_VERIFICATION.md), [section34 milestone record](../verification/MILESTONE_21_VERIFICATION.md), [database](evidence/M21_DATABASE.json), [API](evidence/M21_API.json), [browser](evidence/M21_BROWSER.json), [security](evidence/M21_SECURITY.json) and [implementation final inventory](evidence/M21_FINAL.json). Browser503/delay cases are explicitly transport fixtures; successful persistence and stale409 use the real server/database. The accepted50-rule fixture measured batched rule-load SQL2, evaluation SQL9 and list SQL7; five local latency samples12.04/17.79/13.21/11.88/11.89ms do not establish a production SLO.

**Additional product tests rerun: NONE.** Closure changes documentation/audit only, with no product repair. Only Git/file/hash/diff/evidence/secret/staging/publication checks run. Initial audit: `node --env-file=.env artifacts/m21/closure-audit.mjs initial`; final manifest: the same local audit command with `final`. The ignored local helper reads files/Git only and does not connect to the database. Historical M0–M20 gates and Ollama/model probes/downloads/generation are NOT RUN.

## Git preparation and required publication result

At this immutable snapshot commit/push are **not yet performed**. Reviewed final scope is65 files. `git diff --check` passed during audit; before publication run `git diff --stat`, `git diff --name-status`, stage only audited paths, inspect `git status`, `git diff --cached --stat`, `git diff --cached --name-status`, the full `git diff --cached`, and `git diff --cached --check`. Both diff checks and exact staged-file/hash validation must pass before the one commit.

After the authorized commit and ordinary branch push, closure PASS requires the sole parent to be the exact M20 baseline, exactly one commit after M20, all65 audited files committed, matching local/remote M21 SHA, correct upstream and a clean tree. Verify `git rev-parse HEAD`, `git log -6 --oneline --decorate`, `git status` and `git ls-remote origin refs/heads/feat/v1.3-rule-based-routing`. Verify the M20 remote branch is still `b75d15acc2dbbb16d00ce47db8ed891af210a48d`, main is unchanged, and local/remote v1.0.0/v1.1.0/v1.2.0 tag objects/peeled SHAs match their preflight snapshots. The final handoff records actual SHA/publication/clean-tree results without a second documentation commit.

Main merge: **NO**. v1.3.0 tag: **NOT CREATED**. Deployment: **NOT RUN**. Previous checkpoints/releases remain unchanged. Stop after verified publication; passing closure does not authorize M22.

## Known limitations and stop

- Canonical category/subcategory may be null before approval; draft classification is excluded.
- Fixed enum conditions, flat AND and Team targets only; no automatic staff, skill target, OR tree, regex/free text or load balancing.
- Maximum500 active rules/targets; overflow requires manual work or explicit future scope.
- No fallback, background router or AI routing.
- Routing acceptance is not persisted on Assignment; original human command audit/selected values remain authoritative.
- Single A01 organization; local synthetic verification only, with no production SLO, penetration-test or WCAG certification claim.
- No production migration/deployment; normal developer DB remains migration7.
- Independent external review remains NOT PERFORMED.

**M22 — Reminder + SLA Escalation: NOT STARTED. M23–M24: NOT STARTED. V1.3: IN DEVELOPMENT.** Stop after matching local/remote SHA and clean-tree verification.
