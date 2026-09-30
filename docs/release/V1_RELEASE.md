# MobiFlow AI V1.0.0

Release date: 2026-09-30 (Asia/Saigon). Tag: `v1.0.0`. Release SHA: the immutable commit resolved and verified by `git rev-parse v1.0.0^{commit}` after the annotated tag is created; the exact SHA is also reported in the release handoff. A document contained by a commit cannot embed that commit's own hash without changing it.

## Scope and architecture

V1 is the completed M0–M10 local synthetic release. It provides npm-workspace Next.js and NestJS applications, strict TypeScript contracts, REST `/api/v1`, Prisma, one PostgreSQL/pgvector database, and host Ollama behind a provider abstraction. The business workflow has exactly USER, STAFF and MANAGER login roles. AI/SYSTEM are audit actors. Domain services own rules, `RequestStateMachineService` owns request-status writes, and protected AI proposals require human approval.

The local verified generation model is `qwen3:4b-instruct-2507-q4_K_M`, digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`. The embedding model is `bge-m3:latest`, digest `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`, dimension 1024. Model tags/digests describe the tested local installation, not every installation.

## Verification summary

The final gate passes fresh lint, typecheck, all unit suites, production build, database validate/deploy, dependency audit, M8/M9/M10 security scans, guarded synthetic reset, Docker build/start, demo-ready, runtime snapshot, diff and secret checks. The schema has six migrations; no V1 migration was added and historical migrations are unchanged. Production/config/lockfile behavior is unchanged from completed M10 snapshot `584bd984b1769065479c5904a42bd6cb06411b85`, so the approved M10 PostgreSQL integration, actual outage/recovery and M3–M10 browser evidence retain their original timestamps and are explicitly not claimed as rerun. M10 had already regenerated `M9_SECURITY_SCAN.json` relative to the M9 tag; the V1 continuation preserves the M10 baseline copy and records that provenance difference instead of restoring or hiding it.

The final demo snapshot has six synthetic users, eight intended requests, 39 histories, six assignments, three resolutions, two feedback rows, eight notifications, zero AI runs, eight real request embeddings, nine READY knowledge documents and 12 embedded chunks. PostgreSQL, API and web containers are healthy; API/web return HTTP 200.

## Evaluation methodology

The release protocol was frozen before live calls at SHA-256 `a2358fbddea4cf10e692e1a694929304d3deb90ea2cff85b71ceefddc554da51`. It binds the 100 ordered cases in dataset `requests.m9.v2` (SHA-256 `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`), installed model digest, prompt/schema `request-analysis.v4` / `analysis.v1`, temperature 0, seed 42, one warmup, fixed stabilization, isolated runtime and one guarded full-run attempt. Provider identity, per-attempt timings/tokens, environment before/after and a case journal are retained. No threshold, label or production prompt was changed.

Both historical target regressions returned the expected MEDIUM priority 5/5 before the full run. The one final run (`6d080973-d92f-4ed2-9e7d-d5e071e609a4`) produced 68/100 exact label matches, 100/100 schema-valid, 99/100 first-attempt-valid, one repaired success, zero terminal failures, and 2728.38/2653/3085/6681 ms mean/p50/p95/max. The original M9 comparator returned exit 0: zero pass-to-fail, zero fail-to-pass and zero latency regressions. Earlier RED runs are preserved and not relabeled.

These are 100 specification-authored synthetic development cases, not real customer prevalence, semantic ground truth, calibrated confidence or generalized accuracy. Exact-label disagreement is not automatically a semantic error.

## Known limitations

- Local Ollama latency is hardware/runtime sensitive; the mechanism behind the earlier historical slowdown remains unknown.
- No new manual operator productivity benchmark, measured ROI or customer-adoption study was performed.
- SLA scheduling is process-local; V1 does not claim distributed exactly-once execution or enterprise-grade HA.
- Deployment and evidence are local/demo/competition scoped, without an external penetration test or broad production browser/network certification.
- Provider output and source membership remain bounded and validated but do not guarantee every generated statement is factually correct.

## Demo

Follow [the demo runbook](../demo/DEMO_RUNBOOK.md). Stop application writers before the guarded reset, run `npm run demo:ready` after the stack is restored, verify all three containers are healthy, and use only the documented synthetic accounts/data. Do not expose secrets, raw private prompts, model binaries, uploads or database dumps.

M11 implementation started: **NO**.
