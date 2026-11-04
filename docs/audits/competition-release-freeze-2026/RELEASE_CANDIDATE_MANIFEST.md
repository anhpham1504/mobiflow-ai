# MobiFlow AI competition release candidate manifest

Date: 2026-11-03 (Asia/Saigon)

## Git identity

- Worktree: `C:\Users\AnhPhamPC\.codex\worktrees\competition-hardening\MobiFlow AI`
- Branch: `codex/competition-hardening`
- Current HEAD: `5ecb182ce6afce0b93227b0f5472185768f2c805`
- Remote default target: `origin/main`
- Fetched target HEAD: `b815db06269d27e6f463e54f24299d95151219f5`
- Merge base: `b815db06269d27e6f463e54f24299d95151219f5`
- Divergence before any new commit: target 0 / branch 1
- Existing branch commit: `5ecb182 feat(web): clarify decision and audit workflow`
- Staged files: none
- Publication actions performed: none

The remote target is the direct parent of the current branch HEAD. No unmerged index entry, conflict marker from `git merge-tree`, or `git diff --check` error was found.

## Proposed release content

### Required implementation

- `apps/api/src/ai/fact-retention.ts`
- `apps/api/src/ai/analysis-execution.ts`
- `apps/api/src/ai/analysis-query.service.ts`
- `apps/api/src/ai/prompts/request-analysis.ts`
- `apps/api/src/knowledge/lexical.repository.ts`
- `apps/api/src/knowledge/retriever.ts`
- `apps/api/src/requests/request-state-machine.service.ts`
- `packages/contracts/src/analysis.ts`
- `apps/web/src/components/analysis-panel.tsx`

### Required regression tests

- `apps/api/test/analysis.integration.test.mjs`
- `apps/api/test/analysis.test.mjs`
- `apps/api/test/knowledge.test.mjs`
- `apps/web/test/analysis-fact-retention.test.mjs`

### Required security and dependency hardening

- `scripts/verification/competition-hardening-security.mjs`
- `package.json`
- `package-lock.json`
- `eslint.config.mjs`

The lockfile change is tied to the explicit `minimatch` override and was verified by `npm audit --audit-level=moderate` with zero vulnerabilities.

### Required specifications

- `docs/specs/AI_BEHAVIOR_SPEC.md`
- `docs/specs/API_SPEC.md`
- `docs/specs/DATABASE_SPEC.md`
- `docs/specs/RAG_SPEC.md`

### Required audit documentation

- All seven Markdown files in `docs/audits/final-ai-fact-retention-remediation-2026/`.
- The nine top-level Markdown reports and `test-results.json` in `docs/audits/final-live-reverification-2026/`.
- These sanitized live evidence files:
  - `docs/audits/final-live-reverification-2026/evidence/database-api-audit.json`
  - `docs/audits/final-live-reverification-2026/evidence/provider-ledger.json`
  - `docs/audits/final-live-reverification-2026/evidence/session.json`
  - `docs/audits/final-live-reverification-2026/evidence/synthetic-knowledge.json`
- All seven PNG files in `docs/audits/final-live-reverification-2026/screenshots/`; they contain synthetic competition scenarios.
- All seven reports in `docs/audits/competition-release-freeze-2026/`.

These paths are the recommended staging set. They must be staged explicitly; do not use `git add .` or `git add -A`.

## Existing committed PR content

The branch already contains one reviewable commit relative to `origin/main` affecting:

- `apps/web/src/app/globals.css`
- `apps/web/src/components/analysis-panel.tsx`
- `apps/web/src/components/audit-timeline.tsx`
- `apps/web/src/components/recommendation-panel.tsx`
- `apps/web/src/components/request-detail.tsx`
- `apps/web/src/lib/audit-presentation.ts`
- `apps/web/test/audit-presentation.test.mjs`

This existing commit is part of the branch PR delta and was covered by the current deterministic suite.

## Deliberately excluded from the proposed commit

- Local `.env` and all `.env.*` files.
- The uncommitted sidebar-only hunk in `apps/web/src/app/globals.css` and `apps/web/test/sidebar-layout.test.mjs`; preserve for separate owner review.
- `scripts/verification/deepseek-canary-fetch-guard.mjs`; the 20-to-12 live cap change is outside the P1 fact-retention scope and requires owner confirmation.
- `scripts/verification/v13-lexical-integration.mjs`; its added local audit target is useful for reproduction but is not required by production or CI.
- All untracked live/start/browser/database/report harnesses under `scripts/verification/`, except `competition-hardening-security.mjs`.
- Runtime helper source files under `docs/audits/final-live-reverification-2026/evidence/`; the selected JSON evidence above is sufficient for review.
- Historical/intermediate audit trees `final-authorized-deepseek-live-2026/`, `final-competition-hardening-2026/`, `final-live-competition-gate-2026/`, and `seven-scenario-final-e2e-2026/`. They are preserved locally and were not deleted.
- Ignored `.next/`, `artifacts/`, Playwright working directories, local database volumes, and runtime logs.

## Release limitations

- Production readiness was not assessed.
- Raw DeepSeek model text was intentionally not retained; the latest audit classifies raw-model fact-retention as a limitation while system-level retention passed.
- No new paid DeepSeek request was made during this freeze.
- No commit, push, merge, tag, deploy, reset, clean, prune, or worktree operation was performed.
