# Secret and security scan results

## Verdict

PASS for the proposed release-candidate scope. No credential exposure was found. Production security readiness remains outside this competition freeze.

## Checks performed

- `git ls-files '.env*' '*env*'` confirms only the example/config source paths are tracked; `.env` is not tracked.
- `git check-ignore -v` confirms `.env` and `.env.*` are ignored.
- `git diff --cached --name-only` is empty; no DeepSeek key or other file is staged.
- All tracked and untracked commit candidates were scanned by file path without printing match values for:
  - private-key headers;
  - DeepSeek/OpenAI-shaped `sk-` or `ds-` credentials;
  - GitHub tokens;
  - AWS access key IDs;
  - JWT-shaped values;
  - bearer authorization values.
- Result for each credential pattern: zero candidate files.
- `DEEPSEEK_API_KEY` assignment scan: zero candidate files.
- The selected live ledger has four entries and no `body`, `prompt` or `response` field. It retains only hashes, bounded usage/cost and request metadata.
- `npm run verify:security:current`: PASS; profile defaults, provider bounds, redirect policy, parameterized lexical SQL, artifact lint isolation and tracked credential scan passed.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.

## Local sensitive material

A local `.env` file exists. Its contents were neither printed nor copied. It is ignored and unstaged and must remain outside every commit, artifact and PR discussion. Exact-path staging is required to avoid accidental inclusion of unrelated evidence or future credential files.

## CI review

`.github/workflows/ci.yml` uses:

- read-only repository contents permission;
- SHA-pinned checkout/setup-node/upload-artifact actions;
- Node 24.19.0 matching repository engines;
- synthetic PostgreSQL credentials scoped to the CI service;
- `AI_LIVE_CALLS_ENABLED: 'false'` and an empty DeepSeek key for the critical integration job;
- private runtime manifest creation in `RUNNER_TEMP` with restrictive mode and explicit cleanup;
- no production deployment or secret-bearing provider call.

No CI change is included in this worktree diff.

## Human-control and RBAC review

- USER does not receive the retained-fact projection.
- MANAGER and currently authorized STAFF receive only the validated backend projection.
- STAFF intake-run access remains denied where the existing contract requires it.
- AI classification/priority remains advisory.
- `RequestStateMachineService` remains the writer of request workflow state.
- Protected decisions still require backend role predicates, expected version and human approval.
- The stale/tampered projection regression confirms failed publication creates no analysis or business mutation.

## Residual risks

- Historical/intermediate harnesses contain synthetic demo login mechanics and local orchestration details; they are excluded from the focused commit.
- Screenshots are synthetic but should still receive a human visual check before staging.
- A clean-clone CI run remains the authoritative post-push confirmation after owner authorization.
