# V1.2 canonical local demo runbook

Authority: [M16](M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md). Product and model quality limitations remain those disclosed in M15; this rehearsal is release readiness. M17 release/tag/merge/deployment is NOT STARTED.

## Prerequisites

Windows, Node 24.19.x/npm 11.x, Docker Desktop Linux containers, pgvector PostgreSQL from the pinned Compose image, and host Ollama. Use `ollama.exe`, since an ambiguous `ollama` command may resolve to the desktop application. Verify actual installed `qwen3:4b-instruct-2507-q4_K_M` completion and `bge-m3:latest` embedding capabilities; the current embedding column is 1024 dimensions. Microsoft Edge is used for the repository's Playwright gate. Download packages/images/models beforehand if runtime will be disconnected; a fresh Internet-disconnection rehearsal is separate from provider-outage verification.

```powershell
node --version
npm --version
docker desktop start
docker version
docker compose version
ollama.exe list
```

If Ollama is unavailable, start the installed Ollama service/application. No model is downloaded by M16 verification. Missing models must be prepared explicitly before the AI demo; `unconfigured` is permitted only for a truthful degraded/manual demonstration.

## Fresh checkout startup

Use a dedicated synthetic database/project. Never run reset on an existing developer database to prepare this demo. Commands below use the repository's normal default local ports; the isolated rehearsal commands in the next section use separate ports and generated secrets automatically.

```powershell
npm ci
npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M
```

Privately review `.env` according to [the configuration reference](M16_CONFIGURATION_REFERENCE.md): explicit demo mode; RAG true; exact installed tags; `EMBEDDING_DIMENSION=1024`; generated distinct owner/runtime/auth credentials; loopback DB; matching public web/API origins. Set `DEMO_EVIDENCE_ROOT=artifacts/m16/operator` to preserve historical reports. Keep provider runtime defaults unchanged. Compose translates the native provider origin to `host.docker.internal`; changing the browser API URL requires a web rebuild.

```powershell
npm run build:foundation
npm run prisma:generate
docker compose config --quiet
docker compose up -d --wait postgres
npm run db:validate
npm run db:migrate
npm run demo:seed
docker compose up -d --build --wait api web
npm run demo:ready
docker compose ps
npm run demo:preflight
```

Migration count is seven. Seed is idempotent; it retains existing synthetic business history. Real document ingestion uses owning validation/indexing APIs. Normal background request indexing excludes CANCELED requests; current eligible vectors must be available before preflight. `demo:ready` ingests/warmups/checks and performs no reset. If the bounded index is still finishing, wait for it and rerun preflight rather than fabricate vectors or reset data.

## Recorded isolated M16 rehearsal

The runner's `--prepare` and packaging audit intentionally pin the M15 HEAD `310b6db40e8b42189baa665eb04958e999eec0dc` used by this implementation rehearsal. The commands below describe that measured pre-checkpoint run. After committing M16, use the normal fresh-checkout startup above; do not reset Git to replay this historical runner or interpret its baseline refusal as an application startup failure. Checkpoint closure does not rerun the accepted test matrix.

These commands create a new ignored source copy without node_modules, generated Prisma code or `.next`, an unchanged-lockfile install, private generated `.env`, a separate Docker project/volumes and loopback ports 54616 PostgreSQL, 31601 API, 31600 web. Ports must be free; setup refuses an existing target. The developer stack is preserved.

```powershell
npm run verify:release:m16 -- --prepare
npm run verify:release:m16 -- --runtime
npm run verify:release:m16 -- --checks
npm run verify:release:m16 -- --review
npm run verify:release:m16 -- --shutdown
```

If preparation identifies a code/test issue, fix the owning source first. `--prepare-resume` preserves the candidate and failed logs, refuses changed lockfile dependencies, copies current source and reruns the required preparation gates. Changing dependencies requires another `--prepare`. Run stages sequentially. `--shutdown` stops only the recorded isolated project and retains its volumes/reports for inspection. It does not delete the developer database or candidate files. The current ignored target is recorded in `artifacts/m16/current.json`; safe reports are under `docs/v1.2/evidence/m16/<run-id>/`.

For an affected follow-up after an already completed live/browser stage, use `--security`, `--browser-states` or `--recovery` instead of replaying every AI case. `--http` runs the three live HTTP cases; `--browser` runs the two canonical/state browser tests. `--review` checks final evidence, exact source/model identities, packaging, configuration-secret exclusion and final lint. Required M16 verification documents must exist before review. These modes copy current verification code only; application changes require `--prepare-resume` and `--runtime` first. Completed live output is retained and is never relabeled as a newly generated result.

`--runtime-checks` resumes ingestion/current-version embedding/warmup/preflight after the images are already built and started, such as a correction to verification-only indexing assertions. It is not a substitute for rebuilding changed application code. Historical embedding rows are retained; preflight counts current eligible Request versions.

## Accounts and presentation order

Use only [the six approved synthetic local accounts](../demo/LOCAL_DEMO_ACCOUNTS.md). USER: `user@mobiflow.local`; STAFF: `staff.iot@mobiflow.local`; MANAGER: `manager@mobiflow.local`. These roles are not cumulative. Open the configured web origin and API `/api/docs`; never display environment files, tokens or network credential payloads to a reviewer.

1. USER logs in, creates and views: “Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng; toàn bộ thiết bị ngừng gửi dữ liệu.” State/loading/missing information must reflect real results. USER has no manager evidence panel or peer-request access.
2. STAFF logs in and shows existing assigned synthetic work. Start an ASSIGNED item to show allowed staff controls/Copilot and the absence of manager review permissions. The newly submitted request is not assigned yet.
3. MANAGER logs in, opens the user's TRIAGED request, explicitly generates Recommendation V2 and inspects real source excerpts, missing questions, suggested checklist/next step and SLA warnings. Record actual provider outcomes, including failed runs; no canned output is presented as live.
4. MANAGER explicitly accepts or modifies the advisory artifact. The confirmation states that review does not execute the proposal or assign work. Show that status/version, assignment, SLA and operational checklist remain unchanged, and that the original suggestion and review provenance are preserved.
5. MANAGER independently prepares the manual business draft: NETWORK/IOT_CONNECTIVITY, HIGH, Network Operations/IoT Specialist, source-reviewed human-authored steps and a reason. Acknowledge actual missing fields, save draft, send for approval, then explicitly “Duyệt và phân công”. Assignment, 120-minute HIGH policy and checklist become active only at this business approval.
6. STAFF opens the newly assigned request, starts work, uses “Tìm quy trình”, reviews actual sources, completes the approved required checklist, and submits separate root cause/resolution/verification facts for the synthetic demonstration.
7. USER explicitly confirms the resolved request and submits one immutable synthetic feedback rating. Show final CLOSED progress and retained history.
8. MANAGER opens Analytics V2. Use 30 days/all filters for seeded history plus the live demo, then NETWORK/HIGH/team for the canonical subset. The period uses Vietnam calendar days, custom end is exclusive. Demonstrate an empty historical interval such as 2001-01-01 to 2001-01-02. Operational counts derive from PostgreSQL; development evaluation is separate and does not establish production accuracy.

The boundary is visible throughout: **AI suggestion → human review → explicit business decision**. Accepting an advisory artifact does not satisfy the business approval step.

## Failure and recovery

| Symptom | Diagnosis and action |
|---|---|
| Ollama offline | `/health/live` stays 200; `/health/ready` core can stay 200/DEGRADED with `aiReady=false`. Requests remain saved; AI fails with a safe code. Restore host Ollama/models, restart only API if bounded vector backfill paused, then explicitly retry the failed request through the UI. No direct state/SQL edits. |
| PostgreSQL offline | Readiness is 503/NOT_READY while liveness remains 200. Recognized synchronous database failures, including login/session lookup, return sanitized 503 `DATABASE_UNAVAILABLE` with a bounded pool-acquisition wait. Restore the configured PostgreSQL service and verify readiness before continuing. Session validation still requires the real DB; no authentication bypass. Do not reset or remove its volume. |
| Invalid env | Startup prints only invalid key names. Privately correct configuration; regenerate secrets only through a deliberate operator change. `env:setup` will not overwrite existing configuration. |
| Port occupied | Inspect `docker compose ps` and `Get-NetTCPConnection -LocalPort <port>`; choose matching optional host-port/origin overrides for a separate project. Do not stop an unknown process. Rebuild web when its public API URL changes. |
| Stale/expired/revoked session | Log in again, reload current data, then deliberately repeat the intended action. Never reuse old tokens or bypass session predicates. |
| Stale version or changed assignment | Reload/review the current record. No automatic protected-write retry. |
| Recommendation failure | Inspect safe error code, keep the failed run, restore the dependency and explicitly generate again. Manual triage remains available. Do not show raw model output or label an unchecked response valid. |
| Migration failure | `db:migrate` must exit nonzero. Inspect migration history privately and fix the actual migration/setup problem; do not start a demo with failed history or edit frozen SQL to hide it. No production migrations or reset are part of this runbook. |
| Seed/index incomplete | Verify synthetic target/marker, seven completed migrations, installed embedding identity, corpus statuses and current request vector versions. Ingest/index through owning services; no fabricated READY rows or guessed embeddings. |

## Shutdown and retained data

```powershell
# Normal operator-selected project only:
docker compose stop api web
# Stop its PostgreSQL only when no operator is using it:
docker compose stop postgres
# Isolated rehearsal only:
npm run verify:release:m16 -- --shutdown
```

Volumes and private storage are retained. A later explicit cleanup must verify the recorded project/volume identity before deletion. Never run `down -v` or recursive deletion against a computed/unknown target. Guarded reset remains an optional deliberate destructive demo operation, not startup/recovery; it requires explicit demo mode, matching allowlisted owner/runtime targets, exact synthetic marker, stopped writers and exact successful repository migration names. Backup/restore disaster recovery and external deployment are outside M16's restart/dependency-recovery evidence.
