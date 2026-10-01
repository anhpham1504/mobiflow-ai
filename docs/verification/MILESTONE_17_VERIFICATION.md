# M17 Final Release Closure verification

Authority: [M17 user request and subsequent runtime-remediation approval](../v1.2/M17_FINAL_RELEASE_CLOSURE_SPEC.md), 2026-10-01 Asia/Saigon. Baseline: M16 `8511a29529d82d4ed4adbcf5e4d49a6bacec73e4` on `feat/v1.2-release-hardening-demo-readiness`, clean and equal to the remote checkpoint. **Release preparation/sanity PASS; initial DB/image blocker resolved.** This is the pre-commit verification snapshot. Main/tag publication and exact SHA verification are performed after the containing commit exists and recorded in the final release handoff; deployment NOT RUN.

## Scope implemented

Git safety preflight, restoration of Docker Desktop, minimal normal-stack health, migration/model/source identity checks, authenticated UI smoke and release documentation. Initial migration state failed and the user's section-32 STOP policy halted publication. The user then approved updating `mobiflow-ai` with the existing M14 migration and rebuilding API/Web to M16 before continuing. That repair and focused checks passed. Accepted M16 evidence is retained without replay.

## Files/modules changed

Six documentation files only: root README, implementation plan, V1.2 index, this verification, [V1.2 release record](../release/V1_2_RELEASE.md) and retained M17 authority/approval. No product source, tests, configuration, dependency, historical migration SQL or historical evidence changed. Private backup/browser/operator artifacts remain ignored and outside the preparation commit.

## Database changes

No repository schema or migration added/edited. Initially, read-only SQL returned six completed migration records and confidence NOT NULL. Six checksums matched SQL after LF/CRLF normalization; the two M6 apparent byte differences were only line endings. After the user's explicit approval, API/Web writers were stopped, a private PostgreSQL custom archive was saved, and `npm run db:migrate` applied only `20260930010000_m14_advisory_confidence`. This existing M14 DDL drops NOT NULL and preserves V1 values. Final read-only count is **seven**, confidence `is_nullable=YES`; `node scripts/dev/prisma.mjs migrate status` reports current, zero pending. PostgreSQL/vector `0.8.6` healthy. No reset or reseed. Backup metadata was readable; restore/DR NOT RUN.

## API changes

No source changes. The initial developer image predated M16 and lacked `grounded-recommendation.v2.10`. API/Web were rebuilt from unchanged M16 product source using the existing Dockerfile. The final API contains that prompt identity, and current liveness/readiness are HTTP 200/UP and HTTP 200/DEGRADED with coreReady true. No configuration file or dependency upgrade.

## UI changes

No source changes. Web `/login` HTTP 200; Edge/Playwright login page opened successfully. Exactly one USER and one MANAGER login returned HTTP 200. Both scoped dashboards rendered; their aggregate requests returned HTTP 200. One existing USER-owned request detail rendered (detail/history/explanation HTTP 200), and MANAGER Analytics V2 rendered with aggregate HTTP 200. No new request, lifecycle mutation or live AI generation/evaluation was requested. Browser harness errors were corrected by inspecting the current DOM and continuing the same sessions, without repeating logins.

## AI changes

None. Source prompt/parser/schema/dataset SHA256 values remain the accepted M15/M16 identities recorded in the release record. Current rebuilt API config remains `qwen3:4b-instruct-2507-q4_K_M` / `bge-m3:latest`, dimension 1024, revision m5.v1, RAG enabled, temperature 0, max output tokens 1200. Ollama `http://localhost:11434/api/version` failed ECONNREFUSED. Final health reported `coreReady=true`, `aiReady=false`, RAG NOT_READY/EMBEDDING_UNAVAILABLE. This optional provider degradation is allowed by M17; no false READY claim, live generation or full M15 rerun.

## Security considerations

Only selected status/config fields and safe hashes enter evidence. Diagnostic PostgreSQL queries set `default_transaction_read_only=on`; the later single existing migration was explicitly approved. Runtime/owner targets were verified to match localhost:5432/mobiflow without exposing passwords. No credentials, cookies, tokens, DB backup or private prompts enter release documents. No DB volumes, user work, old tags or source were deleted/rewritten. Core ports remain loopback-only. Browser logged a CSP rejection of the host Kaspersky injected external script and an expected refresh 401 between logout and the next login; successful authenticated requests followed. Neither was hidden or changed into an application-zero-errors claim.

## Tests executed

Measured 2026-10-01: initial runtime **11:30:17**, repaired current runtime **11:45:49**, final UI smoke **11:48:42 Asia/Saigon**. Commands below are focused operator checks, not historical test-suite replay.

| Exact command/check | Actual result |
|---|---|
| `git status`; `git branch --show-current`; `git rev-parse HEAD`; `git log -8 --oneline --decorate`; `git tag --list`; `git remote -v` | PASS: clean starting tree, exact authorized M16 branch/HEAD. |
| `git fetch origin`; `git ls-remote origin refs/heads/feat/v1.2-release-hardening-demo-readiness`; `git rev-parse main`; `git rev-parse origin/main`; `git merge-base --is-ancestor origin/main HEAD` | PASS: checkpoint matches remote; main/origin-main `2604590a0ff07bee8b994cc337d8f7e42da61e70`; ancestry exit 0. |
| `git tag --list v1.2.0`; `git ls-remote --tags origin v1.2.0` | PASS: absent locally/remotely. |
| `docker desktop start`; `docker version --format '{{.Server.Version}}'`; `docker compose ps --all`; `docker compose config --quiet` | PASS: Docker 29.6.2; normal project `mobiflow-ai` resumed automatically; all three services healthy; Compose configuration valid. No isolated project started. |
| Node `fetch` with 15-second bounds to `http://localhost:2500/login`, `http://localhost:2501/health/live`, `http://localhost:2501/health/ready` | PASS core: HTTP 200 each; live UP, readiness DEGRADED/coreReady true/aiReady false. |
| Same bounded `fetch` to `http://localhost:11434/api/version` | UNAVAILABLE: ECONNREFUSED; optional provider degradation disclosed. |
| Read-only SQL piped to `docker compose exec -T postgres psql -U mobiflow_owner -d mobiflow -X -v ON_ERROR_STOP=1 --csv` | Initial BLOCKER: six applied, missing M14, confidence NOT NULL. Repeated after approved migration: PASS, seven applied, confidence nullable; vector 0.8.6. |
| `Get-ChildItem apps/api/prisma/migrations -Directory`; `Get-FileHash` migration SQL; Node SHA256 of disk/LF/CRLF variants | Seven repository migrations; six applied checksums match content after line-ending normalization. No SQL drift inferred. |
| `git diff 8511a29529d82d4ed4adbcf5e4d49a6bacec73e4 -- apps/api/prisma packages/contracts/src/recommendation.ts apps/api/src/ai/prompts/recommendation.ts apps/api/src/ai/recommendation-output.ts datasets/ai-evaluation/m15-recommendation-v2.json packages/config/src docker-compose.yml package.json package-lock.json` | PASS: no changes to schema/migrations/AI/config/dependencies at sanity. |
| `Get-FileHash` prompt/parser/public schema/dataset with SHA256 | PASS: all four equal accepted inventory identities. |
| `docker inspect mobiflow-ai-api-1 mobiflow-ai-web-1` with selected image/creation/state/health fields; read-only API compiled-prompt/config inspection | Initial images older and V2 identity absent; final rebuilt API identity present, model config unchanged. |
| `docker compose stop api web` | PASS: stopped only the normal stack writers before approved migration; PostgreSQL volume retained. |
| `docker compose exec -T postgres pg_dump -U mobiflow_owner -d mobiflow -F c -f /tmp/mobiflow-before-m14-20261001.dump`; `docker cp mobiflow-ai-postgres-1:/tmp/mobiflow-before-m14-20261001.dump artifacts/m17/private/mobiflow-before-m14-20261001.dump`; `docker compose exec -T postgres pg_restore --list /tmp/mobiflow-before-m14-20261001.dump`; `git check-ignore artifacts/m17/private/mobiflow-before-m14-20261001.dump` | PASS: private 685924-byte archive saved, metadata readable (268 lines), ignored. No restore claim. |
| `npm run db:migrate`; `node scripts/dev/prisma.mjs migrate status` | PASS: only existing M14 applied; seven found, database current, no pending. |
| `docker compose up -d --build` | Build/start PASS, but root env defaults moved host ports to 3000/3001; planned 2500/2501 probes refused. Corrected with the next established command, without editing configuration. |
| `$env:API_PORT='2501'; $env:WEB_PORT='2500'; $env:WEB_ORIGIN='http://localhost:2500'; $env:NEXT_PUBLIC_API_BASE_URL='http://localhost:2501/api/v1'; docker compose up -d --build --wait api web` | PASS: paired current API/Web build/start, healthy on original 2500/2501; PostgreSQL retained. |
| Repeated bounded Node `fetch` `/login`, `/health/live`, `/health/ready`; `docker compose ps` | PASS: current images, HTTP 200 each, three healthy containers, truthful DEGRADED with coreReady true. |
| `playwright-cli -s=m17-release open http://localhost:2500/login --browser=msedge`; subsequent `goto` after port restoration | Initial login-page open PASS; one port-refused navigation during rebuild, then current login page PASS. |
| `playwright-cli -s=m17-release run-code --filename=artifacts/m17/user-login.js` | USER login succeeded once, HTTP 200/dashboard 200. Harness predicate failed because its sandbox lacks URL; continued the same session using actual DOM/network evidence. |
| `playwright-cli -s=m17-release run-code --filename=artifacts/m17/final-smoke.js`; `snapshot main`; `requests` | USER dashboard/detail PASS; MANAGER login once and dashboard aggregate 200. Harness awaited the wrong manager heading and timed out; inspected the actual heading `Tổng quan vận hành` rather than changing application code. |
| `playwright-cli -s=m17-release run-code --filename=artifacts/m17/manager-analytics.js` | PASS: actual manager dashboard heading/KPIs and analytics heading/HTTP 200. Combined final UI requirements all PASS, no repeated login or new request/AI cases. |
| `node artifacts/m17/final-document-audit.mjs`; `git diff --check`; `git diff --stat`; `git diff` | Initial document audit PASS: six files, 80 relative links, 13 required headings, four unchanged AI identities, configured-secret scan clear. Repeated final review/staging checks precede commit; private helper is not product test code or part of the release. |

No full M0–M10, M11–M16, M15 100+30, root test/lint matrix, M16 recovery suite or AI generation was run at M17. Dockerfile production builds were necessary for the explicitly approved current-stack update. Accepted M16 lint/typecheck/build, 170 tests and database/runtime/browser/security/recovery/packaging evidence remain historical. Cached diff and final publication checks occur after this preparation snapshot; they are not asserted as already run here.

## Manual verification

Read the authoritative M17 request, master-plan section 34 and current docs/source/config. Confirmed the normal stack's old image/DB state, stopped publication and obtained explicit user approval before repair. Applied the existing migration while preserving data, restored paired origins/ports and verified the current compiled prompt. Reviewed actual USER dashboard/owned detail, MANAGER dashboard and Analytics V2; all required routes/data loaded. Preserved the initial blocker, transient port correction and browser harness failures in this record. No source fix, isolated-stack restart or historical replay.

## Known limitations

Synthetic/local AI evidence is not production accuracy. Accepted M15 free-text/language limitations and host-dependent latency remain; targeted Axe is not WCAG certification and security negatives are not penetration testing. No production deployment, backup/restore DR or fully disconnected fresh installation rehearsal. Current optional provider unavailable: the core works, but full AI/RAG demonstration requires truthful runtime recovery and model readiness checks.

## Deferred items

After the single preparation commit: fast-forward main, create annotated tag and push main/tag normally, verifying all four local/remote commit references plus both old tag objects/commits and final clean status in the final handoff. No additional feature milestone or production deployment. Optional Ollama recovery is separate from this allowed degraded-core release gate; no M15/M16 replay unless a new defect requires targeted tests.

## Release blockers

**None remaining within pre-publication scope.** Initial six-migration/old-image blocker was resolved under explicit user authorization; final DB is current with seven, running API has the V2 prompt and core/UI checks pass. Optional provider degradation is disclosed and permitted by the user contract. Any later Git divergence, existing tag, secret, source mutation or local/remote mismatch still stops publication; no force/rewrite is allowed.

## Gate

**Release preparation gate PASS.** Accepted M11–M16 results remain intact, required current-stack sanity passes and known limitations remain. Final **M17 PASS / v1.2.0 RELEASED** requires the authorized post-commit main/tag pushes and actual local/remote verification; exact results are reported in the final release handoff. This document does not invent its own future commit SHA or claim post-commit commands ran before this snapshot. Deployment: **NOT RUN**.
