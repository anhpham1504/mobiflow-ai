# Full Regression Results

Executed in the existing `codex/competition-hardening` worktree. No commit, push, merge, deploy, reset or branch switch was performed.

| Gate | Result |
|---|---|
| `npm test` | PASS — config 8/8, API 224/224, web 27/27, release/evaluation 111/111 |
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run verify:security:current` | PASS — high 0, critical 0, moderate 0 |
| `npm run verify:docs:current` | PASS |
| `npm audit --json` | PASS — 0 vulnerabilities |
| `npm run test:integration:v13-lexical` | PASS — 14/14 migrations, real PostgreSQL |
| `git diff --check` | PASS |
| Playwright UI fixture audit | PASS — manager/staff/user visibility and retained facts |

The first integration invocation without the required explicit isolation acknowledgement was a harness precondition failure; the correctly acknowledged rerun passed. Legacy M6–M9 profile tests that assume Ollama/vector are not used as evidence against this DeepSeek/lexical remediation profile.
