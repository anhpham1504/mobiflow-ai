# V1.3 local demo runbook

Use a deliberately selected synthetic target. This runbook does not authorize migrating/resetting a normal developer database. The executed M24 test resources were isolated and removed; historical evidence remains in [verification](M24_RELEASE_HARDENING_VERIFICATION.md). Production deployment NOT RUN.

## Prerequisites and fresh synthetic target

Windows with Docker Desktop Linux containers, Node24.19.x/npm11.x and installed Edge for browser tests. Existing images use pgvector/pgvector:0.8.6-pg17. Prepare network-dependent packages/images before an offline demo. Host Ollama is required only for a live AI demonstration; verify actual installed model/digest/dimension rather than downloading or changing a model automatically. Six synthetic accounts are listed in [local accounts](../demo/LOCAL_DEMO_ACCOUNTS.md).

In a fresh checkout/dedicated env, run `npm ci` and `npm run env:setup -- unconfigured` for a manual/degraded demo. Privately review generated `.env`; distinct owner/runtime/JWT/refresh credentials are required. Choose an unused Compose project name, fresh PostgreSQL/knowledge volumes and loopback host ports. Set POSTGRES_PORT, API_PORT, WEB_PORT, WEB_ORIGIN and NEXT_PUBLIC_API_BASE_URL consistently; DATABASE_URL/MIGRATION_DATABASE_URL must address that exact synthetic host database with separate roles. Set DEMO_MODE=true only for this verified synthetic target. Keep RAG=false and truthful unconfigured model values for manual mode. Never print or commit credentials.

Review `docker compose config --quiet` using the selected private env/project before startup. Then, in that same deliberately configured environment:

```powershell
npm run build:foundation
npm run prisma:generate
docker compose up -d --wait postgres
npm run db:validate
npm run db:migrate
npm run demo:seed
docker compose up -d --build --wait api web
docker compose ps
```

The current repository contains13 migrations. Verify the actual target and13 successful rows before showing the application. Seed is idempotent; it preserves existing synthetic requests and V1.3 data. It is not reset. If Windows policy blocks native argon2, use the provided isolated Linux verification runner or a deliberately configured Linux execution environment; do not weaken host security. The M24 rehearsal used Linux Node24.19.0 for compilation/real-auth tests and the transient seed process.

For an intentional V1.2 upgrade, back up and verify the chosen target first. Apply existing migrations8–13 with owner credentials; never edit old migrations or replace this with a latest-schema-only mock. M24 verified actual v1.2.0 schema/data followed by successive migrations, preserving original rows and checksums. The normal developer target observed during M24 remains at7 migrations; this is separate from the release rehearsal and requires a deliberate future operator upgrade.

## Demo path and human controls

1. USER (`user@mobiflow.local`) logs in, opens dashboard/list, creates a synthetic connectivity request and checks public history/conversation. No internal notes, templates, routing internals or operational notices are visible.
2. MANAGER (`manager@mobiflow.local`) opens the request. Create or select a checklist template and inspect routing evaluation. NO_MATCH/CONFLICT retain manual choice. Apply a template/routing match only into the editable local draft; verify no assignment or active checklist exists yet.
3. MANAGER chooses category/priority/team/staff and human-reviewed steps, saves the draft, submits approval, then explicitly approves/assigns with the current version. Only that business command activates assignment/SLA/checklist.
4. STAFF (`staff.iot@mobiflow.local`) opens authorized work. Add an internal note and select an allowed manager mention; toggle personal watch. Show manager mention/watch dedup and the USER's public-only view. Reassignment revokes the previous staff member's internal Request/notice access.
5. STAFF previews a RESPONSE template, applies it into the draft, edits it and explicitly sends. USER sees the final message, not template metadata. An archived source at adoption requires the documented conflict/manual fallback.
6. MANAGER demonstrates template revision/archive history and rule lifecycle; neither operation performs hidden business decisions. Open analytics and current SLA. In a synthetic request with genuine elapsed SLA, open STAFF/MANAGER notifications and inspect the persisted operational snapshot. Do not edit normal database clock rows for a presentation.
7. Each role saves and applies its own Request filters. Show dirty/explicit save, replace/reset/back navigation, confirmation and private ownership. Manager-only assignee filter never gives USER/STAFF more access.

## Health, recovery and shutdown

`/health/live` is process liveness. `/health/ready` distinguishes coreReady and aiReady. Optional Ollama unavailable permits core200/DEGRADED with aiReady=false; manual workflows remain available, and AI errors must be described truthfully. Do not present deterministic fixtures or M15 historical evaluation as live responses. A live AI demonstration requires actual verified model/embedding runtime, sources and targeted readiness; no automatic model download/change.

A temporary DB outage should produce ready503/coreReady=false and safe authenticated503 while liveness remains200. Restore the chosen database and retry; the M24 actual container outage/restart passed without reset. API/Web restarts preserve manual data. M22 persists scan progress/events; changed cadence/ratio does not open a new lifetime or duplicate recipients. See [all7 SLA settings](M24_CONFIGURATION_REFERENCE.md).

Stop only the explicitly selected demo project with `docker compose stop` (same env/project arguments). Retain its volumes unless their owner/identity is verified and deletion is specifically appropriate. Never use a generic down-with-volumes against a normal developer project. M24 verification cleanup asserts its own labels/IDs before removal; caches/images and ignored evidence may remain. Backup/restore disaster recovery and production deployment were not exercised.

## Recorded M24 rehearsal, not a generic reset recipe

Verification project `mobiflow-m24-verification` used PostgreSQL55424/HTTP33024; production project `mobiflow-m24-release` used55425/33601/33600 with private generated env files. `m24-runtime.mjs start`, `m24-linux.mjs prepare/sync/run/collect`, and `m24-release.mjs prepare/build/database/start` implement the guarded setup. Initial runner prerequisites were git/OpenSSL/CA certificates plus `npm ci --no-audit --no-fund`; build must precede the transient production seed. Actual gate commands, failures and fixes are recorded in verification. The final audit intentionally expects the historical M23 pre-commit HEAD; do not reset a released checkout to satisfy it. A later rehearsal needs a new declared baseline and evidence directory, preserving these accepted reports.
