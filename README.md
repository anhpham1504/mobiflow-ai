# MobiFlow AI

AI-native enterprise workflow automation platform with local AI.

The repository contains the frozen M0 contract, M1 local infrastructure, M2 authentication/RBAC/database foundation and **M3 manual request workflow**. USER, STAFF and MANAGER can complete a request from creation through human triage, approval, assignment, resolution and owner confirmation without AI. M4 requires explicit approval.

Start with [AGENTS.md](AGENTS.md), the [project scope and assumption register](docs/specs/PROJECT_SPEC.md), [architecture](docs/architecture/ARCHITECTURE.md), and [M1–M10 implementation/dependency map](docs/IMPLEMENTATION_PLAN.md). The [canonical master plan](docs/reference/MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md) and [M0 execution request](docs/reference/M0_EXECUTION_PROMPT.txt) are preserved for provenance.

M0 evidence: [repository baseline](docs/verification/REPOSITORY_BASELINE.md), [cross-document review](docs/verification/M0_CONSISTENCY_REVIEW.md), and [milestone verification](docs/verification/MILESTONE_0_VERIFICATION.md).

M1 results, exact versions, runtime evidence and limitations: [M1 verification](docs/verification/MILESTONE_1_VERIFICATION.md).

Authentication and database baseline: [M2 verification](docs/verification/MILESTONE_2_VERIFICATION.md). Manual workflow, API/UI, SLA and test evidence: [M3 verification](docs/verification/MILESTONE_3_VERIFICATION.md).

Use Node 24.19.x, npm 11.17.x and Docker Desktop (Linux containers). Ollama runs on Windows. From this directory:

```powershell
npm ci
ollama list
npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M
docker compose up -d postgres
npm run db:validate
npm run db:migrate
npm run demo:seed
npm run dev
```

Environment setup verifies the supplied installed model through Ollama and generates local secrets into ignored `.env`; it refuses to overwrite an existing file. The Qwen tag above was verified on this machine and explicitly chosen by the user. A missing embedding model is represented by `unconfigured`, never falsely reported as available. No model is downloaded or inference performed by M1.

Open [the app](http://localhost:3000), [login](http://localhost:3000/login) and [Swagger](http://localhost:3001/api/docs). Native API uses `http://localhost:11434`; Compose API uses `http://host.docker.internal:11434`. The health screen reads actual API responses. The synthetic demo accounts are `user@mobiflow.local`, `staff.iot@mobiflow.local` and `manager@mobiflow.local`, with password `MobiFlowDemo!2026`. The seed requires the existing explicit demo-mode guard; these are local demo credentials, not production accounts.

Create a request as USER. As MANAGER, open it, save a manual plan, submit it and explicitly approve assignment. As the selected STAFF, start work, request information if needed, complete or waive required checklist items and record a resolution. The owning USER can reopen or confirm closure. Reassignment and priority changes are manager actions; all request changes require the current version. A conflict requires reloading and reviewing before retrying.

For a native production boot after `npm run build`, run `node --env-file=.env apps/api/dist/main.js` and, in a second terminal, `npm run start -w @mobiflow/web`. The web command starts the built standalone server with its static assets.

For the full containerized stack (stop native app processes first to free ports 3000/3001):

```powershell
docker compose config --quiet
docker compose up -d --build
```

Services are `postgres`, `api`, `web`, with localhost-only published ports 5432/3001/3000 and a persistent `postgres_data` volume. The API uses a restricted DB role; the migration owner credential is used only by the explicit migration command. Initial DB creation runs the same idempotent pgvector SQL tracked in Prisma migrations. Run `npm run db:migrate` to record migration history. Do not remove the volume to work around an error.

Health endpoints: `/api/v1/health/live` and `/api/v1/health/ready`, with `/health/live` and `/health/ready` infrastructure aliases. Readiness returns 200 when API/DB/vector are ready and 503 otherwise. Ollama or model failure yields truthful AI degradation while core readiness and liveness remain available. Model health checks installed tags and advertised capabilities; it does not claim generation quality or validated embedding dimensions.

Quality and real runtime verification:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
docker compose config --quiet
npm run test:integration
npm run test:e2e:m3
```

The integration command requires the running web/API/Postgres/host Ollama. It verifies actual DB/vector/LLM health, creates the dedicated `mobiflow_m2_test` database for clean migration/seed and real auth/workflow transaction tests, then removes that test database. Workflow integration runs with an unavailable Ollama address without stopping the shared host service. Sanitized runtime evidence is written to ignored `artifacts/m2/runtime.json`. Unit health tests use labeled HTTP fixtures; they are not live inference evaluation.

The M3 browser command uses installed Microsoft Edge and the running seeded Docker stack. It creates synthetic requests, runs the three-role lifecycle, checks wait/reopen/conflict/permission behavior and saves `artifacts/m3/workflow-closed.png` plus a JSON test report. It does not reset the main database.

The future `e2e`, `ai:evaluate`, `demo:reset`, `demo:preflight` and `demo:warmup` commands fail explicitly until their owning milestones; they never return a placeholder PASS. `demo:seed` and `test:e2e:m3` are implemented. The historical M0 checker is preserved unchanged and intentionally rejects post-M0 application scaffolding, so it is not a current application quality gate. Frozen M0 documents remain authoritative.
