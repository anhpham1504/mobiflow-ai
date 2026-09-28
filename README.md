# MobiFlow AI

AI-native enterprise workflow automation platform with local AI.

The repository contains the frozen M0 contract and the **M1 local infrastructure foundation**. M1 includes a Next.js shell, NestJS health API, PostgreSQL/pgvector, Prisma migration foundation and host-Ollama health checks. Authentication and business/AI workflows are not implemented. M2 requires separate approval.

Start with [AGENTS.md](AGENTS.md), the [project scope and assumption register](docs/specs/PROJECT_SPEC.md), [architecture](docs/architecture/ARCHITECTURE.md), and [M1–M10 implementation/dependency map](docs/IMPLEMENTATION_PLAN.md). The [canonical master plan](docs/reference/MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md) and [M0 execution request](docs/reference/M0_EXECUTION_PROMPT.txt) are preserved for provenance.

M0 evidence: [repository baseline](docs/verification/REPOSITORY_BASELINE.md), [cross-document review](docs/verification/M0_CONSISTENCY_REVIEW.md), and [milestone verification](docs/verification/MILESTONE_0_VERIFICATION.md).

M1 results, exact versions, runtime evidence and limitations: [M1 verification](docs/verification/MILESTONE_1_VERIFICATION.md).

Use Node 24.19.x, npm 11.17.x and Docker Desktop (Linux containers). Ollama runs on Windows. From this directory:

```powershell
npm ci
ollama list
npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M
docker compose up -d postgres
npm run db:validate
npm run db:migrate
npm run dev
```

Environment setup verifies the supplied installed model through Ollama and generates local secrets into ignored `.env`; it refuses to overwrite an existing file. The Qwen tag above was verified on this machine and explicitly chosen by the user. A missing embedding model is represented by `unconfigured`, never falsely reported as available. No model is downloaded or inference performed by M1.

Open [the app](http://localhost:3000) and [Swagger](http://localhost:3001/api/docs). Native API uses `http://localhost:11434`; Compose API uses `http://host.docker.internal:11434`. The web health screen reads actual API responses. `/login` is a clear placeholder without a form or credentials.

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
```

The integration command requires the running web/API/Postgres/host Ollama and built API packages. It verifies real DB/vector/LLM health and a separate API instance using an unavailable Ollama address, without stopping the shared host service. Sanitized evidence is written to ignored `artifacts/m1/runtime.json`. Unit tests use labeled local HTTP fixtures for deterministic online/missing-model/failure cases; they are not live model evaluation.

The future `e2e`, `ai:evaluate` and `demo:*` commands fail explicitly until their owning milestones; they never return a placeholder PASS. The historical M0 checker is preserved unchanged and intentionally rejects post-M0 application scaffolding, so it is not a current M1 quality gate. Frozen M0 documents remain authoritative.
