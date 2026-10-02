# Milestone 18 Verification

Implementation authority: [V1.3 master plan](../v1.3/V1_3_MASTER_PLAN.md), initial explicit M18-only user request dated 2026-10-02, baseline released v1.2.0 / `31b445caf07dad606601a1e38e8ed39836d9f825`. [Detailed verification](../v1.3/M18_INTERNAL_NOTES_VERIFICATION.md) contains accepted evidence, limitations and corrected iterations. This record follows master-plan §34. Subsequent [checkpoint closure authorization](../v1.3/M18_CHECKPOINT_CLOSURE.md) permits one reviewed M18 branch commit/push; the accepted implementation results below are not replayed at closure.

## Scope implemented

Canonical M18–M24 roadmap and M18 private append-only Internal Notes only. Authorized STAFF current assignments and MANAGER existing A01 scope can list/append; USER receives no note content/count/activity. Persistent bounded API, shared strict contracts, safe transactional child-resource audit, role-specific UI, migration and targeted verification. V1.3 IN DEVELOPMENT; M19–M24 NOT STARTED.

## Files/modules changed

Prisma RequestInternalNote model/migration; dedicated InternalNoteService/controller; additive central scope method/application registration; shared note contracts/export; InternalNotes component/scoped CSS and authorized RequestDetail mount. New unit/real PostgreSQL/browser tests, guarded fresh/upgrade/security/evidence runners and package commands. Five V1.3 documents and focused PROJECT/API/AUTHORIZATION/DATABASE/implementation amendments. Detailed [file inventory](../v1.3/M18_INTERNAL_NOTES_VERIFICATION.md#files-and-modules-changed). No new dependencies or changes to old AI/workflow/SLA/projection/demo owners.

## Database changes

Migration 8 `20261002010000_m18_internal_notes`: UUID keys, Request/User RESTRICT FKs, varchar(4000)/nonempty bound, timestamptz and requestId/createdAt/id index. Runtime SELECT/INSERT only; UPDATE/DELETE/TRUNCATE denied. Fresh eight migrations and real seeded v1.2 seven→eight upgrade passed; all 26 prior tables/152 rows and old checksums preserved. Seed idempotent; no fake demo notes. Only the exact guarded synthetic target was created/removed; developer DB remains seven and was not migrated/reset/reseeded. [Evidence](../v1.3/evidence/M18_DATABASE.json).

## API changes

GET/POST `/api/v1/requests/:id/internal-notes`, STAFF/MANAGER guards plus existing request predicate and transactional live identity/parent lock. Strict body 1–4,000 Unicode code points, strict limit/cursor (20 default/100 max), newest-first keyset, safe author id/displayName. 401/403/indistinguishable404/input/media/size/origin/terminal negatives; no PATCH/DELETE or count. Generated OpenAPI operationIds/schema/security/refs verified. No existing breaking endpoint change or business expectedVersion bypass.

## UI changes

Shared STAFF/MANAGER detail section, author/time/plain escaped body, loading/empty/list error/retry, draft retention/create/success/duplicate-submit guard, Unicode count, older pages and terminal read-only. USER does not mount or call the note endpoint. All four widths on both roles, keyboard/focus/labels/44px note buttons, literal XSS and Axe zero serious/critical passed. [Browser evidence](../v1.3/evidence/M18_BROWSER.json).

## AI changes

None. Actual deterministic intake/RAG/embedding/recommendation/Copilot context builders exclude note content/IDs/audits/activity; captured prompts stay in memory. No live model generation, evaluation or model start/download. Ollama unavailable is optional and does not block M18.

## Security considerations

USER 403; STAFF current assignment only with foreign/unknown same404 and old-assignee denial; MANAGER A01 unchanged. Live account/session recheck, scoped parent locks and observed reassignment race. Note+body-free audit rollback atomic. Audit optional request FK is null so it stays outside Request history/AI reads. Workflow, notifications, analytics and requester projections unchanged/no leakage. Bound SQL, strict schemas, safe errors, no-store/plain React text and runtime append-only grants. Focused source/configured-secret scan clear; no penetration-testing claim. [Security evidence](../v1.3/evidence/M18_SECURITY.json).

## Tests executed

Measured 2026-10-02; [sanitized gate summaries](../v1.3/evidence/gates/M18_UNIT.json) retain commands/results and previous JSON iterations. Reviewed raw logs stay local and are excluded from the checkpoint; gate.log, artifactDirectory and screenshot links are local-only historical pointers. Wrappers and environment are detailed in [verification](../v1.3/M18_INTERNAL_NOTES_VERIFICATION.md#actual-commands-and-results).

| Command | Actual result |
|---|---|
| `npm run lint` | PASS, no warnings |
| `npm run typecheck` | PASS all workspaces/Next route types |
| `npm test` | PASS 176/176, zero skipped (7 config + 102 API + 2 web + 65 deterministic root units) |
| `npm run build` with NODE_ENV=production | PASS API and standalone Next production build |
| `npm run test:database:m18` | PASS fresh8/seeded v1.2 upgrade7→8/data preservation/idempotent seed |
| `npm run test:integration:m18` | PASS 11/11, zero skipped, real PostgreSQL/API/AI context isolation/restart |
| `npm run test:e2e:m18` | PASS 4/4, no skipped/retries, responsive/Axe/XSS/keyboard included |
| `npm run verify:security:m18` | PASS focused source/credential review + actual dynamic evidence |
| `node --test apps/api/test/authorization.test.mjs` | PASS 2/2 targeted existing policy regression |
| Read-only final runtime/operator check | Developer DB7/vector0.8.6, isolated target cleaned, core HTTP200; Ollama ECONNREFUSED |
| `git diff --check`; final source/document/link/Git review | PASS — [final review evidence](../v1.3/evidence/M18_FINAL_REVIEW.json), M18 scope/links/§34/gates/unchanged release refs |

Historical M0–M17 replay: **NOT RUN — intentionally outside M18 scope.** Required npm test includes existing deterministic unit files; no full historical integration/browser milestone or live evaluation replay.

## Manual verification

Reviewed current owning specs/source/config/tests, wrote the plan before implementation, checked role/request predicates, child transaction/audit isolation and explicit projections. Inspected actual STAFF1440/MANAGER768 screenshots and retained all eight width/role captures. Checked literal escaping, composer/author/time placement, privacy evidence, SQL statement/response samples and safe logs. Synthetic 50-note/two-author fixture: 10 SQL statements with one or 50 rows (no N+1), 13,001-byte 50-note response, ten localhost default-page samples 11.09–16.17ms. Earlier failures were corrected at their causes and retained; no test suppression.

## Known limitations

Synthetic/local PostgreSQL/Edge evidence only; no multi-tenant redesign, scale/SLO, penetration-test, WCAG certification or live AI accuracy claim. Ollama is unavailable; core works. M18 is not deployed/applied to the existing V1.2 developer stack. Ordinary fetch/refetch; corrections append notes; no edit/delete/attachments/M19 capabilities. Screenshots/traces are local ignored artifacts. [Runtime evidence](../v1.3/evidence/M18_RUNTIME.json).

## Deferred items

The subsequent human closure request authorizes the single branch-only checkpoint publication described in [closure](../v1.3/M18_CHECKPOINT_CLOSURE.md). M19 Mentions + Watchers and M20–M24 remain NOT STARTED and require explicit later authorization. Main merge, tags, deployment and developer DB migration remain excluded.

## Release blockers

None within M18 implementation/verification. V1.3 release closure remains M24; M18 PASS does not mean V1.3 released. The implementation handoff was intentionally uncommitted; subsequent checkpoint closure has its own authorization and audit record.

## Gate

**PASS — M18 implementation READY FOR HUMAN REVIEW at handoff.** Subsequent checkpoint publication follows the [closure record](../v1.3/M18_CHECKPOINT_CLOSURE.md). Stop before M19. V1.3 IN DEVELOPMENT; no main merge, tag, deployment or developer DB migration.
