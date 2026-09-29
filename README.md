# MobiFlow AI

AI-native enterprise workflow automation platform with local AI.

The repository contains the frozen M0 contract and the completed M1–M8 implementation: local infrastructure, authentication/RBAC/database, manual request workflow, structured intake, local knowledge/RAG, bounded AI tools and recommendations, manager approval, and the staff Copilot/SLA/resolution-summary workflow. USER, STAFF and MANAGER can complete the human workflow when AI or embeddings are unavailable. M9 requires explicit approval.

Start with [AGENTS.md](AGENTS.md), the [project scope and assumption register](docs/specs/PROJECT_SPEC.md), [architecture](docs/architecture/ARCHITECTURE.md), and [M1–M10 implementation/dependency map](docs/IMPLEMENTATION_PLAN.md). The [canonical master plan](docs/reference/MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md) and [M0 execution request](docs/reference/M0_EXECUTION_PROMPT.txt) are preserved for provenance.

M0 evidence: [repository baseline](docs/verification/REPOSITORY_BASELINE.md), [cross-document review](docs/verification/M0_CONSISTENCY_REVIEW.md), and [milestone verification](docs/verification/MILESTONE_0_VERIFICATION.md).

M1 results, exact versions, runtime evidence and limitations: [M1 verification](docs/verification/MILESTONE_1_VERIFICATION.md).

Authentication and database baseline: [M2 verification](docs/verification/MILESTONE_2_VERIFICATION.md). Manual workflow, API/UI, SLA and test evidence: [M3 verification](docs/verification/MILESTONE_3_VERIFICATION.md).

Local intake, live model evaluation, offline recovery and browser evidence: [M4 verification](docs/verification/MILESTONE_4_VERIFICATION.md).

Synthetic document ingestion, embeddings, pgvector retrieval, validated citations and measured RAG evidence: [M5 verification](docs/verification/MILESTONE_5_VERIFICATION.md).

M6 adds six read-only tools, real request embeddings/similar cases, deterministic candidate/workload queries and manager-only grounded recommendations. M7 binds a current recommendation to the existing human approval transaction. A MANAGER can explicitly **Chấp nhận đề xuất**, **Sửa và phê duyệt**, or **Từ chối đề xuất AI**. The backend reloads and validates the request version, recommendation identity/status, current actor, evidence, sources, policy and staff eligibility before applying a decision. Accept/modify atomically records the immutable AI original and human final decision, assignment, checklist, SLA, audit/history and notification; reject preserves the recommendation and returns the request to TRIAGED without canceling it. The manual M3 path remains available when AI is offline or unavailable.

M6 commands: `npm run test:integration:m6`, `npm run test:e2e:m6`, and `npm run verify:runtime:m6`. Full integration also includes M6. Live M6 labels are fixed in `datasets/ai-evaluation/m6-cases.json`; generated evidence preserves previous iterations. Set `M6_REGRESSION=true` for M4/M5 evaluation reruns to write separate M6-prefixed evidence without overwriting baseline reports. Never run live inference evaluations concurrently.

M7 commands: `npm run test:integration:m7` and `npm run test:e2e:m7`. M7 reuses the M6 live recommendation pipeline and the M3 state machine; it adds no schema migration and no autonomous AI action.

M8 adds a current-assignee STAFF Copilot with six fixed actions and read-only bounded context, explicit human adoption of AI checklist drafts, deterministic SLA risk/breach notifications, asynchronous factual resolution summaries and immutable owner feedback after closure. Copilot and summary output use action-specific JSON Schemas, at most one repair attempt, and exact source/event/case membership checks. AI never performs a protected business mutation, and provider or embedding outages do not block the manual workflow.

M8 commands: `npm run test:integration:m8`, `npm run test:e2e:m8`, `npm run eval:copilot:m8`, `npm run eval:summary:m8`, `npm run verify:runtime:m8`, and `npm run verify:security:m8`. Results, failure diagnoses and retained sanitized evidence are recorded in [M8 verification](docs/verification/MILESTONE_8_VERIFICATION.md). M8 adds no migration and does not start M9 analytics.

Request vector input is NFC-normalized title/newline/description, first 2,000 code points, with hash/revision/truncation metadata, exact current request version and actual embedding identity. Messages are separate bounded recommendation history. Background backfill processes one request per idle worker tick; on failure it pauses until the API is restarted, avoiding an outage retry loop. Restore the provider then restart the local API to resume historical backfill; explicit recommendation retry reattempts its own embedding. Similarity skips missing/stale/incompatible vectors and never substitutes fake counts. The 0.70 mapped-vector cutoff is an engineering default, not calibrated correctness.

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

Environment setup verifies the supplied installed language model through Ollama and generates local secrets into ignored `.env`; it refuses to overwrite an existing file. M5 additionally requires an explicitly installed `OLLAMA_EMBEDDING_MODEL`; the verified local configuration uses `bge-m3:latest` with dimension 1024. Model tag, resolved digest and probed dimension are recorded with each index generation. A missing model is represented by `unconfigured`, never falsely reported as available.

Open [the app](http://localhost:3000), [login](http://localhost:3000/login) and [Swagger](http://localhost:3001/api/docs). Native API uses `http://localhost:11434`; Compose API uses `http://host.docker.internal:11434`. The health screen reads actual API responses. The synthetic demo accounts are `user@mobiflow.local`, `staff.iot@mobiflow.local` and `manager@mobiflow.local`, with password `MobiFlowDemo!2026`. The seed requires the existing explicit demo-mode guard; these are local demo credentials, not production accounts.

Create a request as USER. As MANAGER, open it, save a manual plan, submit it and explicitly approve assignment. As the selected STAFF, start work, request information if needed, complete or waive required checklist items and record a resolution. The owning USER can reopen or confirm closure. Reassignment and priority changes are manager actions; all request changes require the current version. A conflict requires reloading and reviewing before retrying.

M4 automatically queues an intake run on creation. Processing moves NEW → AI_ANALYZING → TRIAGED; controlled failure returns NEW with manual work available. Wait for intake to finish before saving a manual plan, or save while still queued to supersede AI. Owner sees progress/missing facts, assigned staff sees extracted facts, manager sees the advisory analysis. Model confidence is uncalibrated and extracted facts can be wrong; compare them with the original request. AI never applies category, priority, assignment or SLA. Review and acknowledge missing location/time before approving a manual plan. Failed analysis can be explicitly retried from the request page after restoring Ollama.

With `AI_RAG_ENABLED=true`, intake embeds the bounded request description, searches only current READY chunks with the exact configured embedding identity, supplies at most 6,000 characters of untrusted reference text, and validates each returned source ID and exact quote before publication. USER never receives internal sources; STAFF and MANAGER can open authorized current source excerpts. MANAGER manages synthetic PDF/TXT files under **Kho tài liệu**. Reindex creates an immutable generation and temporarily excludes the document; disable immediately removes it from live retrieval. Empty/no-match retrieval publishes an explicit insufficient-evidence result with no citation. Retrieval failure fails the dependent AI run while the manual workflow remains available.

AI environment defaults: `AI_AUTO_ANALYZE=true`, `AI_ATTEMPT_TIMEOUT_MS=120000`, `AI_RUN_TIMEOUT_MS=300000`, `AI_TEMPERATURE=0`, `AI_MAX_OUTPUT_TOKENS=1200`. One generation per local API worker, at most two attempts per run; 24,000-character context and 32 KiB structured output. Disabling automatic intake is intended for the isolated AI-independent regression; explicit intake routes remain available. Production configuration cannot select a fake provider.

For a native production boot after `npm run build`, run `node --env-file=.env apps/api/dist/main.js` and, in a second terminal, `npm run start -w @mobiflow/web`. The web command starts the built standalone server with its static assets.

For the full containerized stack (stop native app processes first to free ports 3000/3001):

```powershell
docker compose config --quiet
docker compose up -d --build
```

Services are `postgres`, `api`, `web`, with localhost-only published ports 5432/3001/3000 plus persistent `postgres_data` and private `knowledge_data` volumes. The API uses a restricted DB role; the migration owner credential is used only by the explicit migration command. Initial DB creation runs the same idempotent pgvector SQL tracked in Prisma migrations. Run `npm run db:migrate` to record migration history. Do not remove a volume to work around an error.

Health endpoints: `/api/v1/health/live` and `/api/v1/health/ready`, with `/health/live` and `/health/ready` infrastructure aliases. Readiness returns 200 when API/DB/vector are ready and 503 otherwise. Ollama, language-model, embedding-model or RAG-index failure yields truthful degradation while core readiness and liveness remain available. RAG readiness performs a real embedding probe and verifies the stored model identity/dimension; it does not claim semantic quality.

Quality and real runtime verification:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
docker compose config --quiet
npm run test:integration
npm run test:e2e:m3
npm run eval:ai:m4
npm run verify:runtime:m4
npm run test:e2e:m4
npm run knowledge:ingest
npm run verify:embedding:m5
npm run eval:retrieval:m5
npm run eval:rag:m5
npm run verify:runtime:m5
npm run test:e2e:m5
npm run test:integration:m8
npm run eval:copilot:m8
npm run eval:summary:m8
npm run verify:runtime:m8
npm run verify:security:m8
npm run test:e2e:m8
```

The integration command requires the running web/API/Postgres/host Ollama. It verifies actual DB/vector/LLM health, creates the dedicated `mobiflow_m2_test` database for clean migration/seed and real auth/workflow transaction tests, then removes that test database. Workflow integration runs with an unavailable Ollama address without stopping the shared host service. Sanitized runtime evidence is written to ignored `artifacts/m2/runtime.json`. Unit health tests use labeled HTTP fixtures; they are not live inference evaluation.

The M3 browser command uses installed Microsoft Edge and the running seeded Docker stack. It creates synthetic requests, runs the three-role lifecycle, checks wait/reopen/conflict/permission behavior and saves `artifacts/m3/workflow-closed.png` plus a JSON test report. It does not reset the main database.

M4 evaluation invokes real Ollama on all 50 fixed synthetic cases and writes `docs/verification/evidence/M4_AI_EVAL.json`. Runtime verification requires the seeded running stack and records real persisted inference. To exercise Docker offline without stopping shared Ollama, use a temporary Compose override with `services.api.environment.OLLAMA_BASE_URL: http://127.0.0.1:1`. Run `$env:M4_RUNTIME_MODE='offline'; npm run verify:runtime:m4` and `$env:M4_E2E_MODE='offline'; npm run test:e2e:m4`, then restore normal `docker compose up -d api web`. Remove the two temporary shell variables before online tests. The offline browser test records a failed request used by the online recovery test, so run it first. These tests create synthetic demo records and preserve them. Avoid overlapping live evaluations and intake tests on the same Ollama; each API actor is limited to five AI triggers per minute.

M5 corpus ingestion uses the fixed synthetic files under `datasets/knowledge/`; it is idempotent by SHA-256 and writes sanitized metadata evidence. Retrieval evaluation uses 25 fixed queries and RAG evaluation compares 12 cases in non-RAG/RAG modes. The reported scores are development-set observations, not calibrated confidence or production accuracy. Runtime verification creates and removes a dedicated loopback test database for non-RAG/offline checks. Browser and runtime tests create synthetic records in the main demo database.

The future `e2e`, `ai:evaluate`, `demo:reset`, `demo:preflight` and `demo:warmup` commands fail explicitly until their owning milestones; they never return a placeholder PASS. The historical M0 checker is preserved unchanged and intentionally rejects post-M0 application scaffolding, so it is not a current application quality gate. Frozen M0 documents remain authoritative.
