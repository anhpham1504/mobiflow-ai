# Deterministic and integration gates

All commands ran from `C:\Code\MobiFlow-AI-DeepSeek-Lexical-20261023`. Task-local database credentials came from ignored `.env` and are not reproduced.

| Gate / command | Observed result |
|---|---|
| `npm ci` | PASS; 615 packages installed from lockfile |
| `npm test` | PASS, 320/320: config 8, API 202, web 19, release/evaluation 91 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:35401/api/v1'; npm run build` | PASS; production API and Next.js builds completed |
| `node scripts/dev/prisma.mjs validate` | PASS; Prisma schema valid |
| `npm audit --omit=dev` | PASS; 0 total vulnerabilities |
| `npm audit` | 5 high, all in lint-only development chain; 0 critical; residual documented, no unsafe force fix |
| `$env:V13_ISOLATED_DATABASE_ACK='mobiflow-deepseek-lexical-20261023'; npm run test:integration:v13-lexical` | PASS; dedicated database, 14 migrations, 0 embedding calls, 0 failed assertions |
| Rollback env (`AI_GENERATION_PROVIDER=ollama`, `AI_PROVIDER=ollama`, `RAG_RETRIEVAL_MODE=vector`, live calls false), then build foundation/generate/build API and `node scripts/verification/m2-integration.mjs` | PASS; 47 executed/47 passed/0 failed, plus 1 live-Ollama skip |
| Browser smoke at ports 35400/35401 | PASS for tested role/workflow/degraded/mobile paths; 0 DeepSeek and 0 Ollama requests |
| `git diff --check` | PASS; only line-ending warnings on two historical evidence files whose content diff versus baseline is empty |

The rollback PostgreSQL breakdown was: auth 1, workflow 3, knowledge 5, analysis 5, recommendation/approval/Copilot/analytics 32 and dashboard/SLA 1. The dedicated lexical verifier is an assertion script rather than Node's test reporter, so it is reported as one PASS gate instead of fabricating a test-case count.

## Superseded failures retained in the audit trail

1. An experimental long-token chunker caused one rollback integration failure by collapsing a synthetic oversized token into one chunk. The experiment was reverted; the final complete rollback run passed 47/47 with the live item skipped.
2. The first lexical verifier reused a seeded demo corpus and failed its clean-count expectation. It was refactored to an exact dedicated database with unconditional teardown; the final isolated run passed.

These were engineering/test-isolation failures encountered and corrected during implementation, not passing results.

A direct `npx prisma validate --schema apps/api/prisma/schema.prisma` invocation was unavailable in this repository's Windows wrapper layout (`prisma` was not recognized). The repository-supported `node scripts/dev/prisma.mjs validate` command was then run and passed; only that successful wrapper command is the Prisma gate above.

## Not-run accounting

- Paid DeepSeek live canary: NOT RUN.
- Expanded live quality/UAT: NOT RUN.
- Historical exact “361 tests” snapshot: NOT claimed; the current repository's exact observed suite is reported above.
- Push/PR/merge/deploy/protected DB migration: NOT RUN.
