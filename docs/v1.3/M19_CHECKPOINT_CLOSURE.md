# M19 Checkpoint Closure

Date: **2026-10-02 Asia/Saigon**. Previous checkpoint: **M18 — Internal Notes**, `1f54dce3c8427976763b19ef33f181b4ef9a3337`. Branch: **feat/v1.3-mentions-watchers**. Accepted [M19 implementation gate](M19_MENTIONS_WATCHERS_VERIFICATION.md): **PASS — READY FOR HUMAN REVIEW**. V1.3 remains **IN DEVELOPMENT**; **M20–M24 NOT STARTED**.

This is the immutable closure preparation/review snapshot included in the checkpoint commit, following the [M18 convention](M18_CHECKPOINT_CLOSURE.md). It does not claim a future commit/push has happened or embed its own future SHA. Full **M19 PASS — CHECKPOINT CLOSED** requires the post-commit checks below; their actual outcome and exact SHA are reported in the final closure handoff.

## Authorization and review

The subsequent direct user request, “MOBIFLOW AI V1.3 — M19 CHECKPOINT CLOSURE”, authorizes audit of all M19 changes and evidence, exclusion of private/transient artifacts, staging reviewed files, **exactly one** commit with message `feat(v1.3): complete M19 mentions and watchers`, ordinary push of **feat/v1.3-mentions-watchers**, verification of local/remote SHA and clean working tree, then STOP. It supersedes only the implementation phase's uncommitted/no-push boundary. M20, new product work/migration/redesign, main merge, tags, deployment, developer DB access/migration/reset/reseed, normal-stack restart/rebuild and Ollama/model actions are outside this closure.

Human closure authorization: **received directly from the user**. Internal review: source, migration, owning contracts/docs, all evidence and retained failed iterations reviewed. Independent external review: **NOT RUN**. Internal review does not imply independent human product review. No unresolved product defect, scope violation, unrelated change or live secret was found. Product code and tests are unchanged during closure; only current documentation authority and this closure record/audit are added or updated.

## Baseline and Git safeguards

Preflight confirmed this branch and starting HEAD at the published M18 SHA, **zero staged files**, and only M19 changes. `git fetch origin` and `git ls-remote` confirmed M18's remote branch unchanged and no remote M19 branch. Local/remote main and peeled v1.2.0 remain `31b445caf07dad606601a1e38e8ed39836d9f825`. All existing local/remote tag objects and peeled commits were captured for post-push comparison; v1.3.0 is absent. Origin is the existing mobiflow-ai repository. No reset, restore, stash, clean, rebase, history rewrite or force push.

`git diff --check` passed in review. [The closure audit](evidence/M19_CHECKPOINT_AUDIT.json) records every file's category, disposition and content hash, preserved owners/migrations and the targeted secret-scan outcome. Final staged review must match this exact audited set and pass `git diff --cached --check` before commit. Historical evidence describes its original execution time; it is preserved unchanged rather than rewritten to claim post-commit publication.

## Inventory and disposition

Initial inventory: **75 changed/new files = 23 modified + 52 new**. All **75 KEEP**; no initial candidate requires IGNORE/EXCLUDE/REMOVE FROM STAGING. Two closure files are added: this record and the sanitized audit manifest. Intended checkpoint: **77 = 23 modified + 54 new**.

| Category | Initial | Intended checkpoint |
|---|---:|---:|
| A. Database/schema/migration | 2 | 2 |
| B. Backend | 10 | 10 |
| C. Shared contracts | 1 | 1 |
| D. Frontend | 6 | 6 |
| E. Tests | 6 | 6 |
| F. Verification scripts/config/package commands | 10 | 10 |
| G. Specifications/documentation | 11 | 12 |
| H. Sanitized JSON evidence | 29 | 30 |
| I. Runtime/private candidates | 0 | 0 |
| J. Unrelated | 0 | 0 |
| **Total** | **75** | **77** |

Runtime/private artifacts remain local and ignored by the existing rules: artifacts/m19 raw console/runtime logs, screenshots, Playwright traces/results/browser profiles, synthetic fixtures/storage and temporary migration views; .env, node_modules, .next, generated Prisma and storage. No private artifact is staged. The local closure utility and its snapshots are also ignored. No user file is deleted and no historical failure evidence is excluded to reduce counts.

## Evidence and privacy audit

All **29/29 original M19 JSON evidence files** were read: **23 PASS and six FAIL**, comprising five main summaries, ten latest gate summaries and fourteen retained iterations. Latest required gates are PASS. The six FAIL records preserve the initial build/unit runs and two failed browser runs at both gate and browser-summary level; their failures and repairs are explained in [M19 verification](M19_MENTIONS_WATCHERS_VERIFICATION.md). Initial lint and temporary Windows process-start failures are also documented; neither is represented as PASS. Old iteration counts/timestamps and M19_FINAL's 70-file pre-metadata snapshot are historical observations, not the final closure inventory.

JSON contains safe commands, exit codes, synthetic counts, timings, hashes, scope/access outcomes and local-only artifact pointers. It contains no raw console output, actual access/refresh token, cookie/auth state, database URL/password, real customer/staff note, raw private prompt or hidden reasoning. Evidence log/artifactDirectory pointers refer to ignored local artifacts and are not portable files promised by this checkpoint.

Targeted read-only scan of every candidate checks configured live-secret values, decoded DB passwords and high-confidence JWT/provider/GitHub/AWS/private-key shapes. **Live secrets: zero.** One URL-shape match was manually resolved: a fixed synthetic M15 fixture URL identical to the published M18 baseline; M19 changes only its empty watcher mock table. Authorization/Bearer/token/env words in source/specs are implementation references. Demo login fixtures and XSS/private canaries are explicitly synthetic. No default/production source or config uses isolated ports33100/33101; those remain test-harness/process-only values.

## Preserved M19 behavior

Mentions use immutable **RequestInternalNoteMention(noteId,mentionedUserId)** records and structured UUIDs. Literal @displayName text has no mention effect. Optional body-only M18 input remains valid; IDs normalize/deduplicate with maximum10 unique/raw100. All targets must be active STAFF/MANAGER already permitted under the existing Request scope; self mention is rejected. Any invalid target rejects the entire note/mention/safe-audit/notification transaction. Server-owned author/time, plain-text Unicode body bounds, append-only/lifecycle rules and Request version/business invariants remain.

Watch uses manual, own, idempotent **RequestWatcher(requestId,userId)** subscriptions, including readable terminal requests. No auto-watch, watcher directory/count, other-user subscription operation or Request write. Existing live actor/session and scoped parent locks serialize changes and cap100 stored rows. Mention and watch never grant authorization. After assignment/account/role loss, historical collaboration rows may remain but fan-out, visibility/unread data and navigation use current permissions; stale reads/mutations deny access.

Internal notifications reuse the existing Notification store and owning persisted AuditLog event in the same transaction. Exact watcher actions: INTERNAL_NOTE_CREATED, SUBMIT_FOR_APPROVAL, APPROVE_AND_ASSIGN, REJECT_APPROVAL, REASSIGN, START_WORK, REQUEST_USER_INFO, USER_PROVIDE_INFO, RESOLVE, USER_REOPEN, USER_CONFIRM, CANCEL. AI/advisory/provider/RAG/embedding, SLA/background ticks, reads, subscription changes and other nonallowlisted actions emit no collaboration notifications. The single state-machine hook follows successful existing writes; it adds no transition or expectedVersion bypass and preserves advisory review behavior.

Mention type **INTERNAL_NOTE_MENTION** takes precedence over **REQUEST_WATCH_ACTIVITY** for one recipient/source event. Recipient union, self suppression, batched live eligibility and conflict-safe insertion work with the partial unique(recipientId,eventId) key across both internal types. Existing legacy/SLA keys remain unchanged. Safe metadata is reason/sourceAction/noteId where applicable, with existing ID columns; **no note body/excerpt** is stored in Notification or audit.

Internal notification list applies live recipient role/account and current Request scope before pagination/unreadOnly. Read/unread rechecks scoped parent and returns404 for stale/foreign/unknown rows without changing readAt. No separate count/detail endpoint was introduced. Legacy recipient-owned assignment notices keep their established behavior; opening the Request still checks current scope. Private APIs/fetches are no-store. USER receives no private UI/API activity, note/mention/watch metadata, internal type/count/history. AI context builders, analytics, dashboard, SLA math, evaluation and public projections remain isolated. React renders body/names as escaped text; selector/watch keep verified keyboard, focus, retry, draft-retention and responsive behavior.

## Migration and developer stack

Repository migration count: **nine**. New migration: **20261002020000_m19_mentions_watchers**; two child tables, RESTRICT FKs, composite keys/user indexes, narrow runtime grants and Notification's internal-type partial unique index. No destructive alteration, old-data backfill or seed change. Migrations1–8 match their baseline Git blobs. Note/Mention runtime SELECT+INSERT only; Watcher SELECT+INSERT+DELETE, without UPDATE/TRUNCATE.

Accepted real PostgreSQL evidence verifies fresh1→9, V1.2 7→8→9 and M18 8→9, preserving27 old tables/153 rows including an M18 note, historical checksums, seed idempotency, FKs/uniqueness and actual privileges. **Developer DB count remains seven per accepted evidence**; closure performs no DB query or write and applies neither migration8 nor9. The normal stack and Ollama remain untouched. Previously owned test DB/ports were removed/released in the accepted M19 final-sanity record.

## Accepted gates; no replay

| Accepted gate | Retained actual result |
|---|---|
| lint / strict typecheck / production build | PASS |
| baseline npm test | 184 PASS, zero failures/skips |
| targeted M19/M18/authorization units | 16/16 PASS |
| real fresh/upgrade PostgreSQL | Three paths PASS |
| real M19 PostgreSQL/API integration | 15/15 PASS, zero skipped |
| production browser | 5/5 PASS, zero skipped/flaky/unexpected |
| STAFF/MANAGER notes + notification responsive/Axe | 16 scans at360/768/1440/1920; zero violations |
| focused source/credentials/security and frontend bundles | PASS; zero findings,22 bundle files |
| implementation final Git/owned-runtime cleanup | PASS, historical pre-closure snapshot |

Evidence: [API](evidence/M19_API.json), [database](evidence/M19_DATABASE.json), [browser](evidence/M19_BROWSER.json), [security](evidence/M19_SECURITY.json), [latest gates](evidence/gates/M19_UNIT.json), [final implementation snapshot](evidence/M19_FINAL.json), [section34 milestone record](../verification/MILESTONE_19_VERIFICATION.md).

Closure runs only Git/file/diff/evidence/secret/staged/publication checks. **Additional tests rerun: NONE** — no product defect or product/test edit was found. No historical gate replay, M19 harness, developer DB probe or live AI evaluation was run.

## Commit/push outcome and post-publication requirements

At this immutable preparation snapshot, commit/push are **not yet performed**. The authorized next actions are exactly one commit, message **feat(v1.3): complete M19 mentions and watchers**, and `git push -u origin feat/v1.3-mentions-watchers` without force. Actual outcome/SHA is in the final closure handoff, avoiding self-reference and a second documentation commit.

After commit/push, closure PASS requires HEAD's sole parent to equal M18; exactly one descendant commit and77 committed files; ordinary push success; `git rev-parse HEAD` equal `git ls-remote origin refs/heads/feat/v1.3-mentions-watchers`; tracking branch match and clean working tree; all captured local/remote old tags/main/M18 refs unchanged and no new tag. No main merge, tag, deployment or M20 branch/work follows publication.

## Known limitations and stop

- Stale watcher rows remain stored and count toward cap100; no cleanup behavior is added.
- A fetched notification can become stale before refresh; Request-detail authorization still denies access. No real-time invalidation is added.
- Ollama unavailable per accepted read-only evidence — no M19 impact. Closure does not probe/start it or run generation.
- SQL/cardinality/latency, browser/Axe and security checks use local synthetic data; no enterprise SLO, WCAG certification, penetration-test or production-release claim.
- Ignored native Web output was built for isolated33101; normal production/default config is unchanged.
- Independent external review remains NOT RUN.

**M20 — Response & Checklist Templates: NOT STARTED. M21–M24: NOT STARTED. V1.3: IN DEVELOPMENT.** Stop after the authorized checkpoint publication and verification.
