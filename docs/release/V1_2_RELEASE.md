# MobiFlow AI V1.2.0

Release date: **2026-10-01 Asia/Saigon**. Git release boundary: annotated **`v1.2.0`**. Exact release SHA is the immutable commit resolved by `git rev-parse 'v1.2.0^{}'` after tag creation and reported in the final release handoff. This document records the completed preparation/sanity snapshot; main/tag push results are checked after its containing commit exists. A committed document cannot embed that commit's own hash without changing it. Deployment: **NOT RUN**.

## Release theme and baseline

V1.2 improves operational dashboards, deterministic SLA reporting, manager analytics and grounded advisory recommendations, then evaluates and hardens the local release candidate. Roles remain USER, STAFF and MANAGER. PostgreSQL with pgvector and host Ollama remain the local architecture; no cloud service, new role or autonomous business execution is introduced.

Previous release: `v1.1.0`, commit `2604590a0ff07bee8b994cc337d8f7e42da61e70`. Authoritative M16 candidate: `8511a29529d82d4ed4adbcf5e4d49a6bacec73e4`, branch `feat/v1.2-release-hardening-demo-readiness`, verified equal to the remote checkpoint. The [milestone index](../v1.2/README.md) records authorization and historical evidence. [M17 authority](../v1.2/M17_FINAL_RELEASE_CLOSURE_SPEC.md) permits Git release closure only.

## M11–M16 summary

| Milestone | Completed change and accepted evidence |
|---|---|
| M11 Dashboard Aggregates | Backend role-scoped USER/STAFF/MANAGER aggregates and dashboard KPIs; [M11/M12 verification](../v1.2/M11_M12_VERIFICATION.md). |
| M12 SLA Engine V2 | Shared deterministic SLA clock and readable list/detail projections, preserving state transitions and pause/resume rules; same M11/M12 evidence. |
| M13 Analytics V2 | Vietnam-calendar periods, filters, trends, SLA and manager/Copilot outcomes calculated from persisted records; [M13 verification](../v1.2/M13_ANALYTICS_V2_VERIFICATION.md). |
| M14 Recommendation V2 | Sourced evidence, missing questions, advisory next steps/checklists and review provenance, with human business approval separate; [M14 verification](../v1.2/M14_RECOMMENDATION_V2_VERIFICATION.md). |
| M15 Evaluation & Reliability V2 | Versioned synthetic dataset and accepted local 100 baseline plus 30 consistency runs; [M15 verification](../v1.2/M15_AI_EVALUATION_RELIABILITY_V2_VERIFICATION.md). |
| M16 Release Hardening & Demo Readiness | Fresh isolated packaging/runtime/security/UI/recovery rehearsal and focused startup/dependency/seed/preflight fixes; [M16 verification](../v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_VERIFICATION.md) and [checkpoint closure](../v1.2/M16_CHECKPOINT_CLOSURE.md). |

## Database

The release repository contains **seven existing migrations**. M14 makes `AiRecommendation.confidence` nullable for advisory V2 while preserving V1 values. M16/M17 add no schema or migration. Historical migration SQL is unchanged. Runtime uses its restricted database account; migration-owner credentials remain private.

The initial M17 read-only check of normal `mobiflow-ai` found **six applied, one pending** (`20260930010000_m14_advisory_confidence`), confidence still NOT NULL and older application images. Publication stopped. The user explicitly approved updating this developer stack and continuing release. A private PostgreSQL archive was saved, then `npm run db:migrate` applied only the existing M14 migration; no new SQL/migration, reset or reseed was introduced. Final state: **seven applied, zero pending**, confidence nullable, pgvector `0.8.6`; Prisma reports the database current. The existing six migration checksums match repository SQL with LF/CRLF differences accounted for. The backup archive was readable; restore/DR was not rehearsed.

## AI/model identities and evaluation

Recommendation schema: `recommendation.v2`; prompt: `grounded-recommendation.v2.10`. The source identities verified unchanged at M17 are:

| File | SHA256 |
|---|---|
| `apps/api/src/ai/prompts/recommendation.ts` | `71d7bbd664a232f31c7ef637601bbb812695e27a9a3acf7b6c76586cc34661de` |
| `apps/api/src/ai/recommendation-output.ts` | `2489638d4fb0dcd653e099784fee41fb21e2a568249df03f52a414f8979a0698` |
| `packages/contracts/src/recommendation.ts` | `8b75065e212a92d790cc4c521a5e142b6e68b2af46b3362d99af78fc342481eb` |
| `datasets/ai-evaluation/m15-recommendation-v2.json` | `e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290` |

Dataset identity: `m15.recommendation.synthetic.v2`. Completion config: `qwen3:4b-instruct-2507-q4_K_M`; embedding: `bge-m3:latest`, 1024 dimensions, index revision `m5.v1`. Accepted M16 installed digests are respectively `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641` and `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`. These are measured historical identities; M17 does not claim the unavailable Ollama runtime was reverified. The rebuilt running API contains the current V2 prompt identity and preserves model tags, dimensions, revision, temperature 0 and max output tokens 1200.

[Final M15 live evidence](../v1.2/evidence/m15/2026-09-30T17-48-29-641Z-77c22012-bcf0-4666-85db-22cefb59072a/) remains authoritative: 100+30 synthetic live runs, first attempt, no repair. M17 does not rerun it or introduce model/prompt/parser/dataset changes.

## Security

Backend RBAC and ownership/IDOR predicates govern reads, writes, AI context and files. Mutations retain expectedVersion checks and transactional history/audit. AI outputs remain untrusted, schema-validated and bound to authorized available sources. Advisory review preserves original suggestions separately from human decisions; protected approval/assignment/status actions require explicit human business approval. AI cannot execute these actions directly. M16's targeted negatives passed; this is not a penetration test or a production-scale certification.

Compose retains loopback ports, restricted DB runtime credentials, non-root API/web users, read-only root filesystems, private knowledge storage, resource bounds and dropped capabilities. No secret, real customer data, model binary or private runtime state is part of the release documentation.

## Runtime and demo

M17 started Docker Desktop using `docker desktop start`; the existing normal stack resumed automatically. After the approved update, PostgreSQL, API and Web are healthy at database 5432, API 2501 and Web 2500. `/login`, liveness and readiness return HTTP 200. Readiness is truthfully **DEGRADED**, `coreReady=true`, `aiReady=false`: host Ollama refuses connection; RAG is NOT_READY with EMBEDDING_UNAVAILABLE. Provider degradation is allowed for core operation; no AI READY or full AI-demo readiness is claimed.

No isolated M16 stack was started. Normal developer API/Web were rebuilt from unchanged M16 product source. Temporary Compose environment overrides preserve Web/API ports and their paired public API URL/credentialed origin; `.env` and tracked configuration are unchanged. One USER and one MANAGER UI login passed, both dashboards rendered with HTTP 200 aggregates, one existing owned request detail rendered with HTTP 200 and MANAGER Analytics V2 loaded with HTTP 200. No request lifecycle or live AI evaluation/generation was created. This authorized local stack update is separate from production deployment.

For this existing stack's 2500/2501 mapping, set these non-secret values in the operator shell before a later Compose recreation:

```powershell
$env:API_PORT='2501'
$env:WEB_PORT='2500'
$env:WEB_ORIGIN='http://localhost:2500'
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:2501/api/v1'
docker compose up -d --build --wait api web
```

Root `.env` retains its 3000/3001 defaults; a bare Compose recreation uses those defaults. No further migration/reset/seed is needed while the database remains current.

Operator entry point: [demo runbook](../demo/DEMO_RUNBOOK.md); canonical instructions: [M16 demo runbook](../v1.2/M16_DEMO_RUNBOOK.md); [configuration](../v1.2/M16_CONFIGURATION_REFERENCE.md); [candidate inventory](../v1.2/M16_RELEASE_INVENTORY.md). Fresh setup commands are separate from this existing developer database; do not reset/reseed it to satisfy release checks.

## Verification

Accepted M16 evidence: lint/typecheck/build; 170/170 unit/release tests; database 8/8; runtime/http 17/17; browser 2/2; final security 13/13; browser state 1/1; recovery 9/9; packaging 8/8. Responsive checks cover 360/768/1440/1920 across 20 Axe scans with zero serious/critical findings. These are historical accepted local results, not a replay at M17.

[M17 verification](../verification/MILESTONE_17_VERIFICATION.md) records exact commands and current results: Git preflight, restored core runtime, seven-migration current database, authenticated UI smoke and source identities PASS. The initial database/image blocker and the approved repair remain disclosed. No full M0–M16, M15 evaluation or live generation was run. Git publication is performed and verified after the single release-preparation commit; the final handoff records exact local/remote SHA values.

## Known limitations

- Synthetic/local evidence does not establish production AI accuracy or production-scale readiness.
- Ollama latency and availability depend on the host; provider failure must remain visible.
- Accepted M15 free-text temporal/causal/relevance limitations in cases 055/060/075/099, clipped text and occasional foreign-language fragments remain. Structured validity/source membership does not prove every free-text statement. Case 099 is a direct-context robustness fixture, not a valid creation case.
- Targeted Axe/keyboard/responsive checks do not constitute full WCAG certification.
- Security checks are targeted negatives, not penetration testing.
- No production deployment, external TLS verification, backup/restore DR rehearsal or fully disconnected fresh-install rehearsal was performed.

## Git release boundary

Intended boundary: safely fast-forward `main` to the final documentation-preparation commit, create annotated `v1.2.0` with message `MobiFlow AI v1.2.0`, push main/tag without force and verify local/remote main and peeled tag all equal that commit. Preserve `v1.0.0` and `v1.1.0` unchanged.

Preparation snapshot: main/origin-main were `2604590a0ff07bee8b994cc337d8f7e42da61e70`, M16 feature HEAD was `8511a29529d82d4ed4adbcf5e4d49a6bacec73e4`, and `v1.2.0` was absent locally/remotely. Main was an ancestor of the candidate. Only M17 release documents enter the preparation commit. Final release completion requires local main, remote main, local peeled `v1.2.0` and remote peeled `v1.2.0` all equal the release commit; both old tag objects and peeled commits must remain unchanged. These post-commit results belong to the final handoff, not a fabricated pre-commit SHA. Deployment: **NOT RUN**.
