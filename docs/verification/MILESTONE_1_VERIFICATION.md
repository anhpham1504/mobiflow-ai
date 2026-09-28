# Milestone 1 Verification

Date: 2026-09-28, final runtime check 15:40 Asia/Saigon (08:40 UTC). M0 baseline: `929db9a705fbc3ae0055fe78cd1a721b40480f7c`. M1 explicitly authorized by the user. M0 remains frozen; M2 is not authorized. **M1 PASS**, limited to the foundation/local-infrastructure gate.

## Scope implemented

npm workspaces foundation, strict TypeScript, Next.js application shell, NestJS health API, typed configuration, shared runtime contracts, PostgreSQL/pgvector, Prisma migration foundation and host-Ollama health checks. No authentication, RBAC, business schema, request workflow, inference, RAG, tools or analytics.

## Files/modules changed

- Root manifests/lockfile, lint configuration, Compose, Dockerfile, `.env.example`, `.dockerignore`, Git artifact exclusions and README.
- `apps/web`: App Router shell, placeholder login, loading/error/not-found states, health client and panel, Tailwind tokens and shadcn-style Button foundation.
- `apps/api`: Nest bootstrap, validation, request IDs, safe exception/logging infrastructure, health controller/services/provider and tests; Prisma infrastructure migration.
- `packages/contracts`, `packages/config`, `packages/eslint-config`, `packages/tsconfig`.
- `scripts/dev`: local environment setup, development launcher, Prisma wrapper and explicit deferred commands. `scripts/verification/runtime.mjs`: real runtime assertions.
- This report. Frozen M0 documents and checker are unchanged.

## Database changes

One persistent local PostgreSQL service. `202609280001_enable_vector/migration.sql` enables pgvector idempotently; no domain tables or vector dimension are introduced. Initialization creates restricted `mobiflow_app` and keeps migration-owner credentials outside API configuration. Actual query confirmed PostgreSQL **17.11**, pgvector **0.8.6**. Prisma validation and migration deployment succeeded. Integration tests execute a real vector distance expression and verify the runtime role has no superuser/create-role/create-database privilege. Test literals do not establish an embedding dimension.

## API changes

Canonical GET `/api/v1/health/live` and `/api/v1/health/ready`; infrastructure aliases `/health/live` and `/health/ready`. Swagger at `/api/docs`, JSON at `/api/docs-json`. Readiness reports API, database, vector extension, Ollama server, LLM and embedding model separately. Core failure returns 503; AI-only degradation returns 200 with `coreReady=true`, `aiReady=false`. Liveness is independent of dependencies. Health calls have bounded timeouts.

Global validation rejects unknown properties; exceptions expose safe messages and request IDs. Structured logs exclude request bodies, query strings, credentials and dependency error text. No business endpoints exist.

## UI changes

Vietnamese application shell and actual service-health display with initial loading, refresh, typed 503 handling and API-unavailable recovery. Login is visibly a placeholder, without a form. Responsive CSS, skip link, semantic landmarks and visible focus. Native and Docker production browser verification completed. Next's automatic agent-file generation is disabled to keep repository instructions stable.

## AI changes

Health-only provider abstraction queries actual Ollama `/api/tags` and `/api/show`; exact installed tags and required capabilities are checked. No inference, embedding calls, model download or quality claim.

User-selected LLM: **`qwen3:4b-instruct-2507-q4_K_M`**, verified on the Windows host; digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`, advertised capabilities `tools`, `thinking`, `completion`. Initial Ollama inventory was **0.34.2**; after a later host restart, actual `/api/version` returned **0.34.4**. No embedding-capable model was installed; `OLLAMA_EMBEDDING_MODEL=unconfigured` reports `NOT_CONFIGURED` rather than inventing availability. Embedding dimensions and behavior belong to M5.

Native API uses `http://localhost:11434`; Docker API uses `http://host.docker.internal:11434`. A separate API instance with an unreachable Ollama origin tests offline behavior without stopping the shared host service.

## Security considerations

Published ports bind only to loopback; API/web container processes run as Node's unprivileged user with no-new-privileges. Database runtime role is separate from its owner. Local secrets are generated into ignored `.env`, omitted from Docker build context and never reported here. JWT/refresh settings are validated for the frozen environment contract but do not implement authentication. Docker volume is preserved; unrelated local stacks are untouched.

## Versions and dependencies

Host Node **24.19.0**, npm **11.17.0**, Docker **29.6.2**, Compose **5.3.1**. Docker Node image `node:24.19.0-bookworm-slim` was pulled and its bundled npm **11.17.0** verified. PostgreSQL image `pgvector/pgvector:0.8.6-pg17`.

Registry engines and peer requirements were checked before installation. TypeScript **6.0.3** satisfies Nest/Swagger and typescript-eslint; TypeScript 7 was not selected. Prisma **7.10.0** is stable; the 8.0.0 release candidate was not selected. ESLint **9.39.4** satisfies the React/import plugin peers; ESLint 10 produced peer warnings and was replaced. npm marks ESLint 9 deprecated; this is a documented toolchain limitation, not an overridden peer constraint.

Direct installed dependency inventory (workspace packages are local version 0.1.0; all external direct versions are exact, transitive versions/integrity in `package-lock.json`):

| Area / purpose | Dependencies and exact versions |
|---|---|
| Tooling | @eslint/js 9.39.4; eslint 9.39.4; eslint-config-next 16.3.6; typescript-eslint 8.70.1; typescript 6.0.3; @types/node 24.10.1 |
| Prisma schema/migrations only | prisma 7.10.0; no generated client, domain model or adapter yet |
| API server / OpenAPI | @nestjs/common 12.1.0; @nestjs/core 12.1.0; @nestjs/platform-express 12.1.0; @nestjs/swagger 12.0.2; express 5.2.1 |
| API validation / runtime | class-transformer 0.5.1; class-validator 0.15.1; reflect-metadata 0.2.2; rxjs 7.8.2; zod 4.6.5 |
| PostgreSQL health / API types | pg 8.23.0; @types/pg 8.23.1; @types/express 5.0.6 |
| Web framework | next 16.3.6; react 19.3.0; react-dom 19.3.0; @types/react 19.3.0; @types/react-dom 19.3.0 |
| Tailwind/shadcn foundation | tailwindcss 4.3.3; @tailwindcss/postcss 4.3.3; @radix-ui/react-slot 1.3.3; class-variance-authority 0.7.1; clsx 2.1.1; tailwind-merge 3.7.0; lucide-react 1.48.0 |
| Shared config/contracts | zod 4.6.5 |

Primary compatibility references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Nest migration guide](https://docs.nestjs.com/migration-guide), [shadcn manual installation](https://ui.shadcn.com/docs/installation/manual), [pgvector](https://github.com/pgvector/pgvector), [Ollama model listing](https://docs.ollama.com/api/tags). Node's built-in test runner avoids another test framework dependency. Form, auth, charts, query-cache and AI SDK packages are deferred until needed. Scarf install telemetry is explicitly denied in npm's package policy.

Pulled image digests: pgvector `sha256:cf134a767f474095eeba57e0117be8e568e011a63f33fbf252f14c9b760f8e6f`; Node `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`.

## Environment variables

| Variable | Purpose / local setting |
|---|---|
| NODE_ENV | development/test/production |
| API_HOST / API_PORT | native 127.0.0.1:3001; container 0.0.0.0:3001 |
| WEB_ORIGIN | http://localhost:3000, exact CORS origin |
| NEXT_PUBLIC_API_BASE_URL | browser-visible http://localhost:3001/api/v1; build-time setting |
| DATABASE_URL | restricted application PostgreSQL URL; native loopback / Docker postgres |
| MIGRATION_DATABASE_URL | owner URL for explicit Prisma commands only |
| POSTGRES_PASSWORD / POSTGRES_APP_PASSWORD | generated owner/runtime credentials; never committed |
| JWT_SECRET / REFRESH_TOKEN_SECRET | distinct generated values, at least 32 characters; authentication deferred |
| AI_PROVIDER | ollama |
| OLLAMA_BASE_URL | native localhost:11434 / container host.docker.internal:11434 |
| OLLAMA_MODEL | qwen3:4b-instruct-2507-q4_K_M |
| OLLAMA_EMBEDDING_MODEL | unconfigured (no installed embedding model) |
| HEALTH_TIMEOUT_MS | 2000 default, validated range 100–10000 |
| VERIFY_API_URL / VERIFY_WEB_URL | optional integration-test target origins |

## Docker services

`postgres` publishes 127.0.0.1:5432 with persistent `postgres_data`; `api` publishes 127.0.0.1:3001 and depends on healthy DB; `web` publishes 127.0.0.1:3000. All three containers are running and **healthy**. Ollama remains on Windows. API/web UID is 1000; the API has no `MIGRATION_DATABASE_URL`. Container inspection confirmed `OLLAMA_BASE_URL=http://host.docker.internal:11434` and the exact selected Qwen tag.

Docker uses a cached `npm ci --ignore-scripts` build step: platform binaries arrive as pinned optional packages; no Prisma client is generated or used in M1. Actual Linux API/web builds and boots passed. Prisma validation/migration commands run through the verified host CLI. This avoids running unrelated install telemetry/engine setup in the runtime-image build. Postgres memory/CPU bounds are 1 GiB/1 CPU; API and web each 512 MiB/1 CPU. No extra service was added.

## Tests executed

| Command | Actual result |
|---|---|
| Git status/source/test/specification inspection | Complete; existing M1 retained; no prior M1 report existed |
| npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M | PASS; actual installed model verified, ignored local environment generated |
| docker manifest inspect (both pinned image tags) | PASS; tags exist |
| docker compose config | PASS; configuration parsed, output suppressed to avoid printing secrets |
| docker compose up -d postgres | PASS; local container healthy |
| docker compose exec -T postgres psql -U mobiflow_owner -d mobiflow -c "SELECT version(); SELECT extversion FROM pg_extension WHERE extname='vector';" | PASS; PostgreSQL 17.11 and vector 0.8.6 |
| npm install --no-audit --no-fund | Resumed interrupted installation, exit 0; follow-up checks exposed incomplete lock metadata and bad Next hoisting, corrected below |
| npm install --package-lock-only --ignore-scripts --no-audit --no-fund --prefix "C:\Code\MobiFlow AI\artifacts\m1\lock-repair" | PASS; rebuilt lock from unchanged workspace manifests in an empty staging directory; copied repaired lock to root |
| npm ci --no-audit --no-fund | PASS; 601 packages installed from repaired lock, exit 0; no damaged-lock warning on final run |
| npm ls --depth=0 | PASS; direct versions resolved without invalid peers |
| npm run lint | PASS, exit 0, no lint errors/warnings |
| npm run typecheck | PASS, exit 0; shared packages/API/Next generated route types and strict checking |
| npm run test | PASS, exit 0; **14 tests: 3 config, 10 API, 1 web client; 0 skipped, 0 failures** |
| npm run build | PASS, exit 0; shared packages, Nest API and optimized Next production build; `/`, `/login`, `/_not-found` |
| npm run db:validate | PASS, exit 0; infrastructure-only Prisma schema valid |
| npm run db:migrate | PASS, exit 0; migration applied; rerun reported no pending migrations; owner query confirms finished history and no rollback |
| npm run dev | PASS boot/HTTP verification; web/API/watch processes started; stopped intentionally after native tests |
| node --env-file=.env apps/api/dist/main.js | PASS native compiled API boot; stopped intentionally before Compose |
| npm run start -w @mobiflow/web | PASS native standalone production web boot with static assets; stopped before Compose |
| npm run test:integration | PASS against native dev, native standalone production and final Compose; **8 real runtime checks** per successful run |
| docker run --rm node:24.19.0-bookworm-slim node -e (bounded fetch of host.docker.internal:11434/api/tags) | PASS; host Ollama reachable and selected model installed |
| docker compose --progress plain build | PASS, exit 0; both images built; final source rebuild used cached dependencies |
| docker compose up -d | PASS, exit 0; postgres/api/web started |
| docker compose up -d --wait --wait-timeout 90 | PASS, exit 0; all three healthy |
| docker compose ps | PASS; all three healthy, only loopback ports published |
| git diff --check | PASS, exit 0 |
| git diff --exit-code HEAD -- frozen M0 paths | PASS; no changes |

Final sanitized runtime output is retained in [M1_RUNTIME.json](evidence/M1_RUNTIME.json), with an overall PASS and timestamp. Local full gate logs and screenshots are under ignored `artifacts/m1/`: `lint.log`, `typecheck.log`, `test.log`, `build.log`, `db-validate.log`, `db-migrate.log`, `docker-build.log`, `docker-runtime.log`, `native-production-runtime.json`, `web-api-offline.png`, `web-production.png`, `web-compose.png`. `.env` and artifact exclusions were checked with `git check-ignore`.

Failures encountered and resolved (not retroactively counted as successful runs):

- Interrupted initial npm install left incomplete registry metadata in the lock and nested Next while root ESLint expected its parser. A clean manifest-only lock rebuild and `npm ci` repaired the install; `npm dedupe` alone had not fixed it.
- TypeScript 6 needed explicit Node types in the shared Node config. Swagger types now use its public package exports instead of an unexported deep path.
- React's effect lint identified synchronous state changes during initial health loading. Initial loading now uses initial state; network callbacks update results and refresh events set refresh state. No lint rule was disabled.
- An oversized JSON test initially received 500 instead of 413. The exception filter now recognizes Express's specific body-size error without exposing body/error details. Malformed JSON returns 400.
- Malformed environment URLs initially threw a generic URL parser error. Guarded URL parsing now consistently produces key-only configuration errors, covered by three URL cases.
- The first native integration run encountered a stopped host Ollama and correctly failed the online-model assertion while API/core health survived. `ollama list` restarted the host app; subsequent real online and isolated offline tests passed. No model was downloaded.
- Initial Docker dependency installation was stopped after prolonged inactivity; the final build uses cached npm downloads, explicit HTTP progress and no install scripts. The completed cold Linux install/build and final cached rebuild both succeeded. Initial `next start` warned about standalone output; the native start command now boots the actual standalone server with static assets and was verified again.

## Manual verification

Actual runtime evidence confirms:

| Check | Observed result |
|---|---|
| PostgreSQL / extension | PostgreSQL 17.11, pgvector 0.8.6; real vector operator returns zero distance for equal literals |
| Database scope / role | Only `_prisma_migrations` in public schema; runtime role is not superuser and cannot create roles/databases |
| Online health | HTTP 200, status DEGRADED, coreReady true; API/DB/vector/Ollama/LLM UP; embedding NOT_CONFIGURED, aiReady false |
| Offline health | Real unavailable Ollama TCP origin; HTTP 200 core readiness, Ollama DOWN, independent liveness HTTP 200; real PostgreSQL remains connected |
| OpenAPI | Exactly two canonical GET health paths; aliases work separately |
| Production web | HTTP 200 from native standalone and Docker, actual six-component health rendered |

Browser checks used the actual local app in the Codex in-app browser: initial loading, successful health, refresh, login navigation/placeholder, API stopped → visible recoverable error → API restarted → successful refresh. Checked 360 px and 768 px viewports: document widths 345/753 px respectively, matching usable viewport widths (no horizontal overflow). Healthy UI had no console errors/warnings; the deliberately stopped API generated the expected failed network request. Keyboard navigation and main landmark were checked. Viewport override was reset. Final Docker UI showed the same truthful degradation for missing embedding.

Reproduce required gates from the repository root after local setup:

```powershell
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:validate
npm run db:migrate
docker compose config --quiet
docker compose up -d --build
docker compose up -d --wait --wait-timeout 90
npm run test:integration
```

## Known limitations

No installed embedding model; truthful AI degradation is expected and is allowed by the M1 core-infrastructure gate. M1 health verifies model inventory/capabilities, not generation quality or GPU inference. No live AI evaluation, RAG or business workflow is claimed. Dependency installation requires network/cache; a cold Docker build was slow on this connection. ESLint 9 is deprecated but is retained for verified current React/import peer compatibility; no peer constraint is forced or bypassed. npm also reports unreviewed install-script policy notices for Prisma engines/CLI and unrs-resolver on host installation; actual host validation and gates passed.

Manual checks still required outside this M1 gate: model generation/Vietnamese behavior in M4, selection and dimensional verification of a real embedding model in M5, full auth/workflow/E2E/security/demo verification in their owning milestones. Route-level error-boundary code compiles; an artificial server-render crash and assistive-technology audit were not executed. No end-to-end business or AI test was substituted with a fixture. Deterministic HTTP model fixtures are explicitly separate from the real installed-model runtime checks.

## Deferred items

All M2–M10 features remain deferred. Root future command entrypoints fail explicitly with their owning milestone; they never return fake PASS. The historical M0 checker intentionally rejects application scaffolding and is preserved unchanged, not reused as an M1 runtime gate.

## Release blockers

M1: **none**. Web/API reachable, database ready, pgvector operational, health truthful and Ollama absence nonfatal. Competition V1 is not release-ready: M2–M10 remain unimplemented and unverified.

## Gate

**PASS — M1 foundation/local infrastructure only.** Required lint/typecheck/test/build/Compose gates and actual native/container runtime verification passed. M0's canonical V1 contract is unchanged. Stop here; M2 requires explicit user approval.
