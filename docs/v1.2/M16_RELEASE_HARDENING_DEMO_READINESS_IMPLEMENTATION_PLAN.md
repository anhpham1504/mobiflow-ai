# M16 Release Hardening & Demo Readiness implementation plan

Authority: [the user request](M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md), supplied 2026-10-01; wording preserved, with trailing-space/final-newline normalization documented in the later closure. Baseline/starting HEAD: `310b6db40e8b42189baa665eb04958e999eec0dc`, clean. Branch: `feat/v1.2-release-hardening-demo-readiness`. M0–M15 evidence is preserved; M17 is NOT STARTED.

## Scope and boundaries

Prove reproducible installation, seven migrations, synthetic seed/real knowledge indexing, production startup, role flows, live Recommendation V2 smoke, dependency degradation/recovery, focused security, responsive/accessibility, and release packaging. No feature, role, provider, prompt, public recommendation schema, database schema or migration is planned. No commit/push/tag/merge/release/deployment.

## Files and checks

1. Preserve the authoritative specification; update this plan, V1.2 index, M16 verification/gate, current demo runbook and a V1.2 inventory/configuration reference.
2. Repair confirmed operational blockers only: preflight/reset's obsolete six-migration expectation, configurable loopback host ports for isolated Compose, configured Origin for corpus ingestion, and optional operational evidence destination to preserve M10 evidence. Measured seed repetition must preserve timestamps/resolution links. Failed listen must close workers/pools; database acquisition must be bounded and dependency errors must use the existing sanitized 503 contract rather than JWT-invalid 401. Reset must compare exact successful migration names and retain all demo target/marker/writer guards.
3. Add an M16 runner that copies only repository source into a new ignored candidate directory, with no dependencies/generated client/build caches/local .env. Install with the unchanged lockfile; generate private secrets using the existing env setup; use a dedicated Compose project, fresh volumes, isolated ports and storage. Refuse existing candidate/containers/ports. Do not touch the developer's database/volume.
4. Run `npm ci`, Prisma generation, lint/typecheck/unit/build in the clean candidate. Bring up isolated pgvector PostgreSQL; deploy migrations 1–7, seed twice and compare business fixtures. Verify legacy/null-confidence behavior and a controlled failed migration in a separate synthetic schema/database; no production migration/reset.
5. Build/start the actual API/web containers. Ingest the tracked synthetic corpus through the owning upload/indexing services. Prove startup/readiness, no optional-Ollama dependency for core use, safe errors, port/config diagnostics and restart persistence.
6. Run a bounded live smoke of three representative V2 requests through production providers/tools, with real retrieved sources and separate missing-information coverage. Original AI prompt/schema hashes must equal M15; do not rerun 100+30 unless AI behavior changes. This smoke provides no new accuracy result.
7. Test the canonical USER→STAFF→MANAGER presentation order, then explicit manager business approval, staff work/Copilot/checklist, owner confirmation/feedback and real Analytics V2. Deterministic browser transport fixtures, if needed for loading/failure/empty states, must be labeled separately from real API/live AI.
8. Run targeted real PostgreSQL HTTP security negatives, revoked/expired sessions, ownership and stale version checks, raw prompt/model-output exclusion, CSP/cache/sanitized errors/log/secret scans. Browser: 360/768/1440/1920, current supported themes, keyboard/dialog/focus, Axe serious/critical zero.
9. Reconcile commands/evidence and source hashes, run `git diff --check`, leave a reviewable working tree and stop before M17.

## Risks and evidence policy

Docker Desktop and installed Ollama models are dependencies to verify, not assumed PASS. Build downloads may require Internet while runtime AI remains local. Every command records exit status and safe logs; unavailable checks are NOT RUN/BLOCKED. Candidate outputs are ignored and only sanitized M16 reports are copied into `docs/v1.2/evidence/m16/`. Failed attempts remain identifiable. New volume/database cleanup targets only resources created by this runner after identity verification. No broad historical milestone gates, fake penetration claim, model-quality claims, or destructive auto recovery.
