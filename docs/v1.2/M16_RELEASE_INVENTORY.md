# V1.2 release candidate inventory

M16 is local release hardening and demo readiness. This inventory does not create a release or authorize M17. Starting checkpoint: `310b6db40e8b42189baa665eb04958e999eec0dc`; comparison baseline is existing `v1.1.0`, commit `2604590a0ff07bee8b994cc337d8f7e42da61e70`. M0–M15 evidence remains historical.

## Database

Seven existing migrations: enable vector, M2 domain/auth, M2 public-code sequence, M5 knowledge vectors, M6 request vectors, M6 cosine index, M14 nullable advisory confidence. M16 adds no migration/schema. V1 confidence survives upgrade; V2 confidence is null. Runtime uses its restricted DB account; owner migration credentials stay private.

## API delta since V1.1

| Method/path under `/api/v1` | V1.2 change |
|---|---|
| `GET /dashboard/user` | New M11 full owned aggregates; strict USER role, no scope override. |
| `GET /dashboard/staff` | New M11 assigned aggregates; strict STAFF role. |
| `GET /dashboard/manager` | New M11 organization aggregates; strict MANAGER role. |
| `GET /requests/:id`, request lists/staff queues/manager lists | M12 canonical deterministic SLA fields and role-safe operational projections. |
| `GET /analytics` | M13 Analytics V2 Vietnam calendar presets/custom half-open range, priority/status/category/team filters, distributions/trends, completion SLA, reopen/feedback, persisted manager/Copilot outcomes; empty averages/rates remain null. |
| `POST /manager/requests/:id/ai/recommend` | M14 selects bounded Recommendation V2 server-side; expectedVersion and MANAGER predicates; advisory publication causes no protected writes. |
| `GET /manager/requests/:id/ai/recommendation` | Versioned V1/V2 response, real source excerpts, missing information, request/SLA/checklist snapshot, optional request-scoped historical `aiRunId`, separate review provenance/staleness. |
| `POST /manager/approvals/:id/accept`, `/modify`, `/reject` | Version dispatch: V2 records advisory human review only; existing V1/manual path executes explicit business approval with expectedVersion. |

M16 adds no public business route or recommendation schema. It implements the already documented dependency-error contract for recognized database failures: sanitized 503 `DATABASE_UNAVAILABLE`, including a valid JWT whose session store is unavailable. Invalid/expired/revoked identity remains 401; backend role/ownership/session predicates remain mandatory. Liveness/readiness distinguish process, required DB/vector and optional provider. Pool acquisition is bounded at 5000 ms; occupied-port startup closes resources and emits a safe `PORT_OCCUPIED` diagnostic.

## UI delta since V1.1

Role-scoped dashboard KPIs; normalized readable SLA state/deadline/elapsed/paused values; Analytics V2 period/filter/trend/outcome panels; Recommendation V2 sourced evidence, missing questions, advisory checklist/next step, review provenance and explicit handoff to the separate manual business draft/approval. M16 performs targeted canonical-flow/responsive/accessibility checks; no major UI redesign or additional dark-theme feature.

## AI and evidence identity

Primary local runtime: Ollama. LLM baseline `qwen3:4b-instruct-2507-q4_K_M`; embedding `bge-m3:latest`, verified 1024-dimensional model identity, revision `m5.v1`. Installed availability/capabilities/digests are verified by each local rehearsal; tag strings alone are not proof.

Recommendation schema: `recommendation.v2`; prompt: `grounded-recommendation.v2.10`. M15 source prompt SHA256 `71d7bbd664a232f31c7ef637601bbb812695e27a9a3acf7b6c76586cc34661de`; strict owning parser/public schema remain unchanged in M16. No generation behavior retuning. Staff Copilot remains the existing six actions with no business execution permission.

Observed host Ollama: `0.34.4`. Installed completion digest: `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`; embedding digest: `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`. These are measured local identities, not portable tag guarantees. M16 leaves prompt/model/public parser/schema/token/temperature/orchestration bounds unchanged; database-disconnection diagnostics are verified separately.

M15 dataset: `datasets/ai-evaluation/m15-recommendation-v2.json`, `m15.recommendation.synthetic.v2`, SHA256 `e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290`.

M15 final live evidence: `docs/v1.2/evidence/m15/2026-09-30T17-48-29-641Z-77c22012-bcf0-4666-85db-22cefb59072a/` with 100 baseline plus 30 consistency runs, all first attempt, no repair. This is prior synthetic evidence, not an M16 rerun or production accuracy claim. M16's small production-provider smoke is separate and records actual request/source/version/latency outcomes.

## Services and packaging

| Classification | Service |
|---|---|
| Required core | Next.js web, NestJS API, one PostgreSQL with pgvector per environment. |
| Optional for core / required for full AI demo | Host Ollama, exact installed completion/embedding models and current real RAG corpus/index. |
| Development/setup | Node/npm, Docker Desktop Linux containers, unchanged package lock, Prisma generation/migration owner account, Edge/Playwright for verification. |

Compose retains loopback published ports, non-root API/web users, read-only root filesystems, private knowledge volume, bounded tmpfs, dropped capabilities/no-new-privileges and CPU/memory bounds. A separate project/volume/ports are used for M16 verification. No new orchestrator, cloud/paid dependency, binary/model asset, secret or real customer data is packaged.

Demo/runbook: [M16 canonical instructions](M16_DEMO_RUNBOOK.md); [current operator entry point](../demo/DEMO_RUNBOOK.md); [configuration classification](M16_CONFIGURATION_REFERENCE.md). Raw runtime/secret/config/cache directories remain ignored; only sanitized new M16 evidence is reviewable in Git.

## Known limitations and gates

Synthetic evaluation does not prove production accuracy. M15 accepted limitations in 055/060/075/099 and representative clipped/foreign-character/free-text relevance remain disclosed; canonical values, permissions and source membership remain protected. Local latency and host resources vary. Structured contract/source membership does not by itself prove every free-text causal phrase. Case 099 remains a direct-context robustness fixture, not a valid request-creation case.

M16 gate requires actual fresh setup/migrations/seed, root lint/typecheck/unit/build, production startup/restart, real PostgreSQL security/ownership/stale/session negatives, a small live Ollama smoke, four-width browser/Axe/keyboard checks, failure/recovery, preserved source hashes and safe evidence. Results are owned by [M16 verification](M16_RELEASE_HARDENING_DEMO_READINESS_VERIFICATION.md), never assumed from this inventory. HTTPS/external deployment, production data migrations, full network-disconnection rehearsal, backup/restore disaster recovery and M17 finalization are outside this local gate.
