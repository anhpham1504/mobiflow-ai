# Local M10 demo runbook

Release gate: **BLOCKED** by [the live-evaluation comparison](../evaluation/M10_EVALUATION_INVESTIGATION.md). Runtime readiness is a separate operational check and does not override that decision.

## Prerequisites and first setup

Use this repository on Windows, Node 24.19.x/npm 11.x, Docker Desktop with Linux containers, Microsoft Edge for browser verification, and the host Ollama service. Current verified model tags are `qwen3:4b-instruct-2507-q4_K_M` and `bge-m3:latest` (1024 dimensions). Preload model assets and npm/container dependencies while connected; no cloud inference is required for subsequent local operation. A fresh full Internet-disconnection rehearsal was not performed in M10; provider outages were tested separately.

Use `ollama.exe` explicitly on this Windows host: the ambiguous `ollama` command may resolve to `ollama app.exe`.

```powershell
Set-Location 'C:\Code\MobiFlow AI'
ollama.exe list
# Only if a required model is missing, while connected:
ollama.exe pull qwen3:4b-instruct-2507-q4_K_M
ollama.exe pull bge-m3:latest
npm ci
# New checkout only; refuses to overwrite an existing .env:
npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M
```

Privately review the ignored `.env`: explicit `DEMO_MODE=true`, `AI_RAG_ENABLED=true`, exact model tags, `EMBEDDING_DIMENSION=1024`, loopback database target `mobiflow`, native `OLLAMA_BASE_URL=http://localhost:11434`, and distinct generated auth secrets. Setup does not automatically enable RAG. Never paste `.env`, tokens or cookies into evidence. The production-like Compose API translates the provider origin to `host.docker.internal` and uses a separate restricted DB account.

```powershell
docker compose up -d postgres
npm run db:validate
npm run db:migrate
npm run demo:seed
docker compose config --quiet
docker compose up -d --build
npm run demo:ready
```

`demo:ready` is non-destructive: idempotent real knowledge ingestion, warmup, then preflight. A newly seeded DB needs `demo:reset` once, with writers stopped, to synchronously populate the eight real request embeddings; otherwise background indexing may still be incomplete. Follow the reset sequence below. Build normally with `npm run build`; do not force `NODE_ENV=development` into a production build.

## Reset and presentation preparation

Use only the disposable, synthetic demo database. Reset previews and truncates the explicitly enumerated application tables, preserves six migration records and does **not** delete storage. It requires loopback/allowlisted matching runtime-owner targets, explicit demo mode, the exact seed marker, six completed migrations, a stopped API port and a successful real embedding probe. It refuses an unknown/production target. The marker design assumes this dedicated database contains only synthetic data; do not load real or unrelated data into it.

Stop native API processes too if using native mode. For Compose:

```powershell
docker compose stop api web
npm run demo:reset
docker compose up -d
npm run demo:ready
docker compose ps
npm run demo:preflight
```

Reset creates six accounts, four teams, five skills, four SLA policies, eight historical requests/39 history entries, six assignments, three resolutions, two feedback rows, eight initial notifications and eight real request embeddings. Two IoT cases start 20/15 minutes before seed reference time, so run preparation shortly before showing the 30-minute similarity window. Do not fabricate a similar-case count once that window expires. `DEMO_SEED_REFERENCE_TIME` can pin the ISO timestamp for reproducible fixture reproduction; leave it unset for a current presentation. The audit marker records the chosen reference time. Repeating `demo:seed` preserves existing history rather than moving its timestamps.

If reset is interrupted after truncation, do not present the partial state. Restore Ollama, keep writers stopped, rerun guarded reset, then ready. Reset intentionally removes previous synthetic requests/sessions; those rows are recoverable only from a prior database backup. Storage files remain and may be reused by later ingestion. Do not remove volumes to fix readiness.

## Preflight and warmup

```powershell
npm run demo:warmup
npm run demo:preflight
```

Preflight checks configured keys without values, tool versions, Docker health, database/pgvector, exact migration names, synthetic marker/accounts/history, request vectors, ready corpus, ports, HTTP/readiness, security headers, exact model capabilities and readable/writable private storage with a 64 MiB minimum reserve. This reserve is a startup safeguard, not capacity planning.

Warmup executes lightweight structured generation, a real embedding and a bound vector query. It compares business row counts and records no business mutation. It does not reset, create requests or submit approval. AI latency still depends on host/model/runtime conditions.

## Accounts and recommended sequence

Use [the six synthetic local accounts](LOCAL_DEMO_ACCOUNTS.md); credentials are documented only there, not in evidence or frontend code. Open [the app](http://localhost:3000) and [API docs](http://localhost:3001/api/docs). USER owns submission/confirmation, MANAGER owns approval, and the actual approved STAFF owns work.

Follow [the five-minute](DEMO_SCRIPT_5_MIN.md) or [ten-minute](DEMO_SCRIPT_10_MIN.md) plan. Canonical input: “Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng.” Demonstrate the missing-location, AI-unavailable and manager-modifies-AI alternatives. Model suggestions are current outputs, not guaranteed expected labels. Newly reset history is explicitly synthetic, not measured AI performance.

## Outage and recovery

Liveness checks API process health. Readiness returns HTTP 200 when core DB/vector/API are ready even if AI is DEGRADED; inspect `coreReady`, `aiReady` and RAG components separately. An embedding outage fails retrieval-dependent runs closed; no fake citations are supplied. Manual triage, human approval/work, resolution and SLA remain available.

`npm run verify:runtime:m8` exercises bounded unreachable-provider configurations for LLM and embedding with real PostgreSQL, creates synthetic records, and records explicit errors. Run reset afterward. The M4 browser outage test requires an actual stopped provider first, then its online recovery test; do not run offline assertions while Ollama is healthy.

Restore the original Ollama service/models and normal Compose configuration. Restart API if vector backfill paused on an outage, run `demo:ready`, then explicitly retry the failed request. Do not clear failure records or directly alter request states to make a retry appear successful. Ordinary recovery does not require manual database edits.

## Operations and troubleshooting

| Symptom | Check/action |
|---|---|
| API port active during reset | Stop Compose/native writers; do not disable the guard |
| Migration mismatch | Run `db:validate`/`db:migrate`; inspect the six frozen migrations; do not edit old SQL |
| RAG not ready | Verify exact bge model/dimension and ingest synthetic corpus; never insert fake READY rows |
| Unknown/slow model | Inspect `ollama.exe ps`, exact installed tags and host load; separate model evaluation from active demo workers |
| Docker analytics shows old evaluation | Results are copied into API image at build time; `docker compose up -d --build` and verify latest run ID |
| Stale version/assignee | Reload and review current request; never automatically repeat a protected decision |
| Storage failure | Inspect volume access/capacity; preserve existing files and database volumes |

Compose has loopback-only ports, non-root app users, read-only application filesystems, bounded tmpfs, dropped capabilities, no-new-privileges and CPU/memory limits. Its scheduler remains process-local, without distributed exactly-once guarantees. Shutdown closes workers/app/DB clients with a 15-second bound and a 20-second container grace period.

For a backup before destructive demo reset, use an owner-authorized PostgreSQL dump to an explicit local file and keep it private; verify restore in an isolated allowlisted database before relying on it. Backup/restore disaster recovery has not been benchmarked or certified by this milestone. Never put database dumps in Git.
