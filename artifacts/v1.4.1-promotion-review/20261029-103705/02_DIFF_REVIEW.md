# Candidate diff review

Reviewed with `git status --short`, `git diff --stat`, `git diff --check` and the full diff.

- Scope is the v1.4.1 hybrid auto-routing contract, routing calculation, canonical state-machine integration, projections, UI labels, tests, verification scripts and documentation.
- New migration: **NO**.
- New database status: **NO**.
- New assignment authority: **NO**.
- Docker/deployment changes: **NO**.
- Lockfile changes: **NO**.
- Historical v1.4.0 asset changes: **NO**.
- Credential changes: **NO**.
- Temporary live runner/compose files: **NO**.
- `git diff --check`: **PASS**.

Promotion rerun found a real serializable-transaction race. The narrow correction recognizes Prisma adapter `TransactionWriteConflict` shapes and retries only the database transaction with bounded backoff; it does not retry DeepSeek or create another mutation path.

Result: **PASS**.
