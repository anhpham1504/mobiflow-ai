# Git diff and file classification review

## Worktree integrity

`git worktree list --porcelain` confirms that `codex/competition-hardening` is checked out only at the authorized competition-hardening worktree. The primary checkout and all other worktrees were left untouched. Current branch and HEAD match the owner-provided values.

After a read-only `git fetch origin --tags`, `origin/main` is `b815db06269d27e6f463e54f24299d95151219f5`. It is the merge base and direct parent of the current HEAD. `git rev-list --left-right --count origin/main...HEAD` returned `0 1`. No merge conflict is currently expected.

## Changed-file classification

The following rules exhaustively classify the 21 tracked working-tree changes and 152 untracked files observed before these seven freeze reports were created. The freeze reports themselves are **Required documentation**.

### Required source change

- `apps/api/src/ai/fact-retention.ts`: backend-owned bounded literal extraction, redaction, provenance, source hash and exact validation.
- `apps/api/src/ai/analysis-execution.ts`: creates and validates the projection independently of model prose.
- `apps/api/src/ai/analysis-query.service.ts`: MANAGER/current STAFF projection; USER remains excluded.
- `apps/api/src/ai/prompts/request-analysis.ts`: prompt v5 asks the provider to preserve facts without making the model authoritative.
- `apps/api/src/requests/request-state-machine.service.ts`: reconstructs the locked message snapshot, revalidates before publication, and atomically persists safe JSON.
- `apps/api/src/knowledge/lexical.repository.ts`: relative `0.99 * top_score` tail suppression after deduplication.
- `apps/api/src/knowledge/retriever.ts`: retrieval identity revision v2.
- `packages/contracts/src/analysis.ts`: strict `fact-retention.v1` schema and role-projected DTO contract.
- `apps/web/src/components/analysis-panel.tsx`: labels retained facts as user-reported, not verified causes.
- `package.json`, `package-lock.json`, `eslint.config.mjs`: current security gate, dependency override and generated-evidence lint isolation.
- `scripts/verification/competition-hardening-security.mjs`: deterministic current-profile security gate.

### Required regression test

- `apps/api/test/analysis.integration.test.mjs`
- `apps/api/test/analysis.test.mjs`
- `apps/api/test/knowledge.test.mjs`
- `apps/web/test/analysis-fact-retention.test.mjs`

These cover exact identifiers, troubleshooting outcomes, contradictions, tampered projection rejection, role projection, relative lexical cutoff and UI provenance wording.

### Required documentation

- `docs/specs/AI_BEHAVIOR_SPEC.md`
- `docs/specs/API_SPEC.md`
- `docs/specs/DATABASE_SPEC.md`
- `docs/specs/RAG_SPEC.md`
- `docs/audits/final-ai-fact-retention-remediation-2026/**`
- The selected reports/evidence in `docs/audits/final-live-reverification-2026/` listed in `RELEASE_CANDIDATE_MANIFEST.md`.
- `docs/audits/competition-release-freeze-2026/**`

### Sanitized audit evidence

- `docs/audits/final-authorized-deepseek-live-2026/**`
- `docs/audits/final-competition-hardening-2026/**`
- `docs/audits/final-live-competition-gate-2026/**`
- `docs/audits/final-live-reverification-2026/**`
- `docs/audits/seven-scenario-final-e2e-2026/**`

The secret scan found no credential signature in these trees. They use synthetic scenario data. Only the latest remediation and reverification subset is recommended for this focused commit; the other trees are preserved but excluded as historical or intermediate evidence.

### Generated artifact or local harness to exclude

- `docs/audits/seven-scenario-final-e2e-2026/attempts/aborted-harness-20261102T0307/**`
- All `mock-provider.jsonl` files under audit trees.
- Runtime `.js`, `.mjs` and `.ps1` helpers under `docs/audits/final-live-reverification-2026/evidence/`.
- `scripts/verification/Start-FinalAuthorizedLiveApi.ps1`
- `scripts/verification/Start-FinalAuthorizedLiveWeb.ps1`
- `scripts/verification/fact-retention-ui-fixture.mjs`
- `scripts/verification/final-authorized-live-api-runtime.mjs`
- `scripts/verification/final-authorized-live-guard-preflight.mjs`
- `scripts/verification/final-authorized-live-report.mjs`
- `scripts/verification/final-live-competition-api-runtime.mjs`
- `scripts/verification/final-live-competition-browser.js`
- `scripts/verification/final-live-competition-database-audit.mjs`
- `scripts/verification/final-rc-api-runtime.mjs`
- `scripts/verification/final-rc-browser-flow.js`
- `scripts/verification/final-rc-database-audit.mjs`
- `scripts/verification/final-rc-deepseek-fixture.mjs`
- `scripts/verification/seven-scenario-browser.js`
- `scripts/verification/seven-scenario-database-audit.mjs`
- `scripts/verification/seven-scenario-deepseek-fixture.mjs`
- `scripts/verification/seven-scenario-report.mjs`
- Ignored `.next/**`, `artifacts/**`, `.playwright-*`, local logs and Docker volumes.

These files are not automatically deleted. They remain available for owner review and reproduction.

### Secret or sensitive file to exclude

- `.env` exists locally, is ignored by `**/.env`, is not tracked, and is not staged.
- Any future `.env.*`, credential manifest, bearer-token trace or raw provider request/response must remain excluded.

No real credential was discovered in tracked or untracked commit candidates. The selected provider ledger contains hashes, usage, status and request metadata only; it has no raw body, prompt or response field.

### Unrelated owner change to preserve

- The five-line uncommitted sidebar scrolling hunk in `apps/web/src/app/globals.css`.
- `apps/web/test/sidebar-layout.test.mjs`.
- `scripts/verification/deepseek-canary-fetch-guard.mjs` (live maximum changed from 20 to 12).
- `scripts/verification/v13-lexical-integration.mjs` (additional local audit project/port allowlist).

These changes are valid-looking and tests pass, but they are not necessary to close the three P1 fact-retention scenarios. They should be reviewed and committed separately or explicitly added by the owner. They were not reverted or overwritten.

## Exact P1 implementation map

| Capability | Owning files |
|---|---|
| Fact retention and exact identifier preservation | `fact-retention.ts`, `analysis-execution.ts`, `analysis.ts` |
| Pre-publication validation and immutable source snapshot | `request-state-machine.service.ts` |
| Troubleshooting outcome and contradiction preservation | `fact-retention.ts`, `analysis-panel.tsx` |
| Role-safe projection | `analysis-query.service.ts`, `analysis.ts`, `analysis-panel.tsx` |
| Lexical relevance filtering | `lexical.repository.ts`, `retriever.ts` |
| Human-control/state-machine invariants | `request-state-machine.service.ts`, existing `authorization-policy.service.ts`, `recommendation.service.ts`, `auto-routing.service.ts` |
| Regression coverage | API analysis/knowledge tests, web retained-fact test, existing authorization/routing/recommendation/state-machine tests |

## Diff checks

- `git diff --check`: PASS
- `git diff --cached --check`: PASS
- `git ls-files -u`: empty
- `git diff --name-only --diff-filter=U`: empty
- Read-only `git merge-tree`: no conflict marker
