# MobiFlow AI V1.3 — Authoritative Master Plan

Authority: explicit user request dated 2 October 2026, “MOBIFLOW AI V1.3 — AUTHORITATIVE ROADMAP + M18 INTERNAL NOTES”. This document owns the M18–M24 sequence. Earlier V1/V1.2 plans remain historical authorities for their releases; archived permissions do not authorize later implementation.

Theme: **Operational Collaboration & Workflow Productivity**. V1.3 improves private collaboration and deterministic operations. It is not primarily an AI release. Preserve advisory AI, explicit human business approval and the existing six Copilot actions.

## Baseline and execution boundary

Start from `v1.2.0`, SHA `31b445caf07dad606601a1e38e8ed39836d9f825`. V1, V1.1 and V1.2 are completed releases. M11 dashboard, M12 SLA V2, M13 analytics, M14 recommendation, M15 evaluation, M16 hardening and M17 release closure are complete; do not redesign or replay them.

The initial authority covers the roadmap and M18 implementation on `feat/v1.3-internal-notes`, with a stop for human review before M19. The subsequent explicit [M18 checkpoint closure request](M18_CHECKPOINT_CLOSURE.md) authorizes auditing the accepted implementation, excluding unsuitable artifacts, creating exactly one checkpoint commit and pushing only that branch without force. No main merge, tag, release, deployment or developer DB migration is authorized. A passing or closed M18 checkpoint does not authorize M19.

The later explicit [M19 Mentions + Watchers request](M19_MENTIONS_WATCHERS_SPEC.md) authorized implementation from published M18 checkpoint `1f54dce3c8427976763b19ef33f181b4ef9a3337` on `feat/v1.3-mentions-watchers`, then stop uncommitted for human review. Accepted M19 verification is PASS — READY FOR HUMAN REVIEW. Its isolated synthetic migration/API/browser evidence remains the implementation snapshot; historical M0–M18 gate replay was outside scope.

Current execution authority: the subsequent [M19 checkpoint closure request](M19_CHECKPOINT_CLOSURE.md) authorizes final file/evidence review, exactly one checkpoint commit, ordinary push of the M19 branch, local/remote SHA and clean-tree verification, then STOP. The closure record is prepared before its containing commit; the final handoff records actual publication/SHA. It authorizes no M20/product development, routine test replay, main merge, tag, deployment, normal-stack rebuild/restart, developer DB access/migration/reset/reseed or Ollama/model action. M20–M24 remain NOT STARTED and V1.3 IN DEVELOPMENT.

## Preserved contracts

- Exactly USER, STAFF and MANAGER; roles are not cumulative. Backend authorization and existing request scope remain authoritative.
- npm workspaces, Next.js App Router, NestJS, Prisma, PostgreSQL + pgvector, Ollama, shared strict Zod contracts, REST `/api/v1`, generated OpenAPI and Playwright.
- Protected workflow mutations continue to require expectedVersion and the state machine. Child-resource notes/mentions/manual watches do not change workflow version, assignment, SLA, approval, resolution or checklist.
- Truthful transactional audit/history; synthetic data only; least-privilege runtime DB access; migrations preserve existing data.
- Authorized real RAG sources and bounded allowlisted tools. No autonomous AI, new roles, cloud dependency or arbitrary tools. Dependency/AI failure preserves manual work.

## Milestones and gates

| Milestone | Goal and scope | Dependencies / acceptance boundary |
|---|---|---|
| M18 — Internal Notes | Authorized STAFF/MANAGER privately read and append plain-text notes inside existing request scope. USER never receives note content, count or activity. Persistent child entity, migration, strict API contracts, role-specific UI, safe audit, pagination and targeted verification. | Released V1.2. Require migration from fresh and seven-migration databases, RBAC/IDOR, USER and AI isolation, XSS, UI states, responsive/Axe, lint/typecheck/unit/build. Stop for review. |
| M19 — Mentions + Watchers | Internal collaborators mention authorized coworkers and explicitly watch request activity. Structured UUIDs, immutable note mentions, manual own-watch, body-free internal notification union/dedup and current-scope delivery. | Explicit M19 authority now applies from closed M18 checkpoint. [Plan](M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md) owns the frozen allowlist/bounds; require fresh/upgrade DB, targeted HTTP/security/context/performance and UI/Axe gates; stop uncommitted for human review. |
| M20 — Response & Checklist Templates | Reusable deterministic templates for common responses and operational checklists; explicit human selection/adoption. | M19 gate plus later authorization. No AI-generated template system unless separately authorized. Preserve checklist provenance and versioned commands. |
| M21 — Rule-based Routing | Deterministic rules based on real request fields, with explainable matching and existing protected business approval. | M20 gate plus later authorization. Not AI routing; no autonomous reassignment. Later plan must define conflict/order/fallback semantics before implementation. |
| M22 — Reminder + SLA Escalation | Operational reminders/escalation based on the canonical M12 SLA state. | M21 gate plus later authorization. Reuse existing clock math, scope and deduplication; never recalculate SLA independently or auto-close work. |
| M23 — Saved Views & Filters | Per-user saved operational filters/views within current role/resource scope. | M22 gate plus later authorization. Validate saved filter contracts; no global authorization override or shared-scope expansion. |
| M24 — V1.3 Release Hardening & Release Closure | Integrated verification, security, accessibility/responsive, database upgrade, demo readiness and release closure toward `v1.3.0`. | M18–M23 gates and explicit release authorization. No new features. Release operations require the later user-approved scope; no v1.3.0 tag now. |

Sequence: M18 → M19 → M20 → M21 → M22 → M23 → M24 → v1.3.0. Never advance past a failing gate or without the applicable execution authority.

## M18 privacy and non-goals

Notes are INTERNAL, append-only and private to authorized operational users. They never enter requester DTOs/history, dashboards, analytics, exports, logs returned to clients, intake/RAG/recommendation/Copilot contexts or evaluation datasets. M18 had no note notifications; M19 separately authorizes safe ID/action/reason-only internal notifications, never note body/excerpt. Access to the request does not grant USER note access.

M18 excludes mentions, watchers, note notifications/email, reactions, replies/threads, edit/delete/soft-delete, attachments, rich text/Markdown/HTML rendering, AI suggestions/summaries, note metrics, templates, routing, reminders/escalation, saved views and real-time WebSocket/SSE/presence.

## Verification and documentation protocol

Write a milestone implementation plan before product edits. Update affected owning specifications together: PROJECT_SPEC owns scope/assumptions, AUTHORIZATION_SPEC permissions, DATABASE_SPEC persistence and API_SPEC transport. Preserve state-machine, SLA and AI contracts.

Each milestone records actual commands/results, changed files, migrations, risks and limitations in `docs/verification/MILESTONE_X_VERIFICATION.md` using historical master-plan §34. Required M18 baseline commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; add M18 PostgreSQL/API/security/browser/Axe/responsive gates. Run older integration/browser suites only for an affected owning subsystem. Do not replay historical M0–M17 gates or live AI evaluations for M18. Missing services/checks are NOT RUN/blocked, never PASS. M18 does not depend on Ollama availability and must not start/download models.

M19 retains the four baseline commands and adds actual `test:database:m19`, `test:integration:m19`, `test:e2e:m19`, `verify:security:m19` plus targeted M18 note/authorization and legacy notification regression. No full historical milestone replay or live model evaluation. Production browser uses isolated loopback33100/33101 and guarded synthetic DB; developer stack remains seven migrations. Keep compact sanitized JSON evidence and failed iterations; raw logs/screenshots/traces stay local/ignored. No M20 execution follows a passing M19 gate without later authorization.
