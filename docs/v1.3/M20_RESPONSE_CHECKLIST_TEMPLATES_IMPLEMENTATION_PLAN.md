# M20 — Response & Checklist Templates implementation plan

Authority: the explicit user request dated 2 October 2026 authorizes **M20 only**, from closed M19 checkpoint `35e4b1c41165fa04348871dee31bd20c28386b47`. Local HEAD and `git ls-remote origin refs/heads/feat/v1.3-mentions-watchers` both matched that SHA; working tree was clean. Work branch: `feat/v1.3-response-checklist-templates`. V1.2 remains `v1.2.0` / `31b445caf07dad606601a1e38e8ed39836d9f825`. No commit, push, tag, merge, deployment or M21. V1.3 remains IN DEVELOPMENT. This plan is written before product edits.

## Architecture audit and integration boundaries

`packages/contracts/src/workflow.ts`, `apps/web/src/components/request-detail.tsx`, `RequestsController`, `RequestStateMachineService` and `RequestQueryService` own the existing communication and checklist flows.

- Response: the existing **Gửi tin nhắn** form calls POST `/requests/:id/messages`; assigned STAFF also has **Yêu cầu bổ sung thông tin**, POST `/requests/:id/request-info`. Both persist RequestMessage through the state machine. Integrate active RESPONSE selectors in these existing STAFF/MANAGER message forms only. USER continues manual communication without the library. Existing body bound is 1–4,000 Unicode code points; use that exact compatible bound.
- Checklist draft: MANAGER's **Chuẩn bị phân loại thủ công** form in NEW/TRIAGED prepares `FinalDecision.actions` locally. POST `/manager/requests/:id/triage` saves a non-active `triageDraftJson` and increments manualDraftRevision and Request.version. SUBMIT_FOR_APPROVAL submits that exact draft; APPROVE_AND_ASSIGN separately creates Checklist/ChecklistItem, Assignment and SlaInstance. Checklist templates belong only in the local manager action editor before triage save. STAFF's existing checklist add/edit endpoints mutate already active work, so no template integration there and no STAFF checklist-template access.
- Protected commands lock/revalidate live actor/session, current Request scope and expectedVersion before any event/write. Every existing business action, role predicate, state transition, eligibility check, SLA clock and notification remains authoritative. Template reads/apply change local draft only; they never refresh or substitute Request.version.
- Existing checklist semantics: ordered text, required boolean, at most 30 actions, 1–500 Unicode code points each, HUMAN with empty sourceIds for human draft steps. Reuse these compatible limits rather than inventing a second checklist format. Provide explicit required/add/remove/order editing in that same draft form.

## Template domain and migration

Migration 10: `20261002030000_m20_response_checklist_templates`, additive only. Keep migrations 1–9 byte-identical.

`OperationalTemplate`: UUID, constrained RESPONSE/CHECKLIST type, ACTIVE/ARCHIVED status, current name/description, createdById/createdAt/updatedAt, archivedAt, positive currentRevision. Names are not unique identities. Name: trimmed 1–120 Unicode code points; optional description: trimmed 1–500 code points.

`OperationalTemplateRevision`: UUID, templateId, positive revision, immutable name/description snapshot, response body nullable, creator/time. Unique(templateId,revision). `OperationalTemplateChecklistItemRevision`: immutable (revisionId,position) ordered text/required rows. RESPONSE has a body and no items; CHECKLIST has 1–30 items and no body. Shared strict contracts validate shape; DB checks/FKs, deferred integrity checks and append-only guards preserve snapshots and the current revision pointer. Revision 1 at create; revise creates N+1, never modifies old content. Archive is one-way; no delete/unarchive API.

Use RESTRICT historical FKs. Runtime gets SELECT/INSERT on immutable revision/item tables, no UPDATE/DELETE/TRUNCATE. Template UPDATE is restricted to current metadata/pointer/status columns; no DELETE/TRUNCATE or DDL. Real privilege/constraint tests must establish the result.

## Provenance and race policy

Use narrow optional `sourceTemplateRevisionId` FKs on RequestMessage and Checklist, and `manualDraftSourceTemplateRevisionId` on the existing Request draft. No new usage/analytics subsystem. Resource-only TEMPLATE_USED audits record type/template/revision/actor/request/resulting resource identifiers without bodies and without AuditLog.requestId, keeping internal activity outside customer history and AI history.

Message and triage commands accept optional sourceTemplateRevisionId. They validate current permissions, required type, ACTIVE status and exact current revision under a shared template lock within the existing expectedVersion transaction. They always persist **the submitted human text/actions**, never replacement content. Unknown/wrong-type references fail safely; stale/archived references return 409 TEMPLATE_UNAVAILABLE atomically. UI preserves text and clears stale provenance with an explicit manual retry notice; it does not silently retry or refresh expectedVersion. Ordinary unreferenced manual commands remain usable.

A reference validated at successful triage save is an established historical starting point. Submit/approval may use that saved draft after the template is revised/archived: the protected command adopts the exact human draft and copies its validated immutable reference to Checklist. No new library selection occurs at approval. Revising/archiving a template never rewrites saved draft/checklist/message history. Editing after application retains starting-point provenance; clearing/removing template association permits a manual submission.

Provenance is manager-only in draft/checklist DTOs. Message DTOs/history continue their explicit existing projection with no template fields. USER never receives template IDs, names, revision numbers/history or usage metadata. Templates do not enter RAG, recommendation, Copilot or embeddings.

## Authorization, APIs and concurrency

Central backend policy: USER denies all template routes; STAFF list/read only ACTIVE RESPONSE, no history or management; MANAGER manages and reads both types/history in existing single synthetic organization A01. Recheck live account/session inside transactions. Out-of-scope detail IDs return 404; prohibited role/filter/history/management returns 403. Never introduce organization overrides or new roles.

REST `/api/v1/templates`: GET list, GET `/:id`, POST create, GET/POST `/:id/revisions`, POST `/:id/archive`. Shared strict Zod inputs/outputs; generated Nest OpenAPI. Input server-owned fields/unknown keys rejected. Revision/archive require positive expectedRevision and locked currentRevision; stale/competing commands return 409 with no partial revision/audit. Archive also requires ACTIVE, so repeating it conflicts rather than silently consuming another operation.

List: strict type/status/q/limit/cursor, trimmed bounded name/description search, default20/max50. PostgreSQL scope/filter/keyset pagination, order createdAt DESC/id DESC using existing opaque cursor convention (stable creation order avoids revision-induced cursor duplication). Summary excludes full content. Current detail uses one revision plus ordered items; history paginates immutable revisions with the same ordering. Batched relation reads, no per-row fetching. Authenticated no-store, existing Access/Roles/Workflow guards, origin/media/payload/rate bounds and safe errors. Management creates TEMPLATE_CREATED/REVISED/ARCHIVED resource-only audits with IDs/revision/type, no bodies or notifications.

## UI, privacy and degraded behavior

Browser verification refinement: apply-time revalidation is asynchronous. Temporarily disable the owning response/checklist form during that bounded read; re-enable it before restoring trigger focus or accepting new edits. This prevents a successful template read from replacing typing performed while the application was pending. Confirmation cancel/return focus runs after React commits the enabled control. These repairs preserve local-only selection and existing protected commands.

MANAGER `/manager/templates` with existing V1.1 shell/cards/forms/buttons: bounded search/filter/pagination, create, detail/current preview, revise, history, archive confirmation. No redesign/dark mode/dependencies.

Shared selector: load ACTIVE appropriate type, preview plain escaped text, explicit **Áp dụng vào bản nháp**, clear selection. Applying replaces one draft source, never stacks templates. Nonempty text/items require explicit replacement confirmation; preserve draft on failed fetch. Request permission/stale state disables action. Loading/empty/error/retry remain independent of manual composer/checklist editing. Accessible labels, native selects/buttons, visible focus and semantic ordered checklist; confirmations have deliberate cancel path. Render all fields as React text, never HTML/Markdown.

## Verification and evidence

- Baseline `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. No dependency additions; Node24.19.0/npm11.17.0 already present. Normal Docker stack remains running unchanged.
- Isolated loopback `mobiflow_m20_test` only with DEMO_MODE=true, separate established owner/runtime accounts, advisory lock, refuse existing target, cleanup only DB created by the harness. No developer migrate/reset/reseed. Read-only migration metadata before/after confirms its accepted seven migrations.
- DB: fresh1→10, M19 9→10, M18 8→9→10, V1.2 7→8→9→10; include real synthetic M18 notes/M19 mentions/watchers/notifications plus prior AI evidence, snapshot old rows/checksums (additive nullable provenance defaults accounted for), and verify real grants, FKs, unique revisions, immutable content/order/shape, pointer/archived history. Seed templates only in isolated fixtures, leave existing demo seed unchanged.
- Unit/real PostgreSQL HTTP: all role/filter/IDOR/history negatives, unknown fields/bounds, management concurrent revise/archive, exact provenance/history, stale Request expectedVersion rollback, archive-after-fetch, manual fallback, no selection effects, human edited response/checklist protected flow, USER leakage/cache/safe errors/payload/origin/rate controls. Target affected workflow, M18 privacy and M19 final-event notification regression; do not replay historical gates.
- Playwright production Next/real isolated API: manager create/revise/archive/history; staff response preview/apply/edit/explicit send; manager checklist draft/edit/save/submit/approve; nonempty draft confirmation; archive/revision selection; USER final content isolation; loading/empty/error/retry and manual fallback; literal XSS name/description/body/item. Widths360/768/1440/1920 on three changed surfaces; keyboard/focus/labels; targeted Axe 0 serious/critical. No full WCAG certification claim.
- Performance: 50 synthetic templates/multiple revisions/30-item compatible checklist, measured SQL counts/detail/history/list and API latency samples; no SLO claim.
- Source/diff/security review, credential/log/bundle scan, migration historical hashes, final Git/no-stage/cleanup/developer metadata check. AI code and library context stay unchanged; no Ollama start/download or live evaluation.

Create `M20_RESPONSE_CHECKLIST_TEMPLATES_VERIFICATION.md`, section34 `docs/verification/MILESTONE_20_VERIFICATION.md`, compact sanitized M20 evidence, and update PROJECT/API/AUTHORIZATION/DATABASE/BUSINESS_WORKFLOW/IMPLEMENTATION_PLAN/V1.3 current authority. Preserve historical verification/evidence. PASS only when actual required gates pass; otherwise record exact blocker. Handoff M20 PASS — READY FOR HUMAN REVIEW, M21–M24 NOT STARTED.

## Non-goals

No automatic send/approval/checklist activation/assignment/status/priority/close/routing; no notifications or SLA changes from template operations; no notes/mentions/watch integration, analytics, AI generation/suggestions/evaluation, placeholders/macros, HTML/rich text/attachments, realtime/email, library sharing, unarchive, new dependency, normal DB migration or M21–M24.

Implementation clarification: an actual probe of the installed Zod/shared message validator accepted 4,000 emoji (8,000 UTF-16 units) and rejected 4,001. These canonical bounds count Unicode code points. M20 UI allows surrogate pairs up to the shared limit; no server limit was changed.
