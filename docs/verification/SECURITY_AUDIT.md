# Final security audit — M10

Scope: local synthetic V1 on `feat/m10-release-hardening`, based on `c0e7c9520ae4172b28415b609f8e66191d906803`. This audit was completed before Git finalization of the branch snapshot. It is a repository review plus automated negative-path evidence, not an external penetration test or enterprise certification. Release remains BLOCKED for the separate live-evaluation issue.

| Boundary | Evidence and actual behavior |
|---|---|
| Authentication/token lifecycle | `auth.integration.test.mjs`: inactive accounts, revoked/expired sessions, refresh rotation/replay, logout and forged roles denied |
| RBAC | USER→STAFF/MANAGER and STAFF→MANAGER protected routes denied in auth/workflow/recommendation tests; role-aware UI is not the security boundary |
| IDOR/current assignee | Ownership-scoped reads/writes/context/files, absent/out-of-scope 404 parity, reassignment/stale staff denial and source authorization tested |
| Request version/concurrency | Real PostgreSQL stale expected-version, double approval, reassignment, rollback and late AI publication tests; stale operations do not partially commit |
| Approval/state authority | Domain services own rules; RequestStateMachineService writes application request state; AI proposals cannot approve/assign/close; seed is labeled historical fixture construction |
| Upload/XSS | MIME/signature/UTF-8/PDF bounds, traversal/empty/corrupt input, private source access tested; no `dangerouslySetInnerHTML` found |
| Browser/network | Explicit CORS origin, origin/CSRF checks, CSP/frame/MIME/referrer/permissions headers; loopback-only published Docker ports |
| SQL/storage | Parameterized vector values, exact model/dimension membership, restricted runtime DB account; audit UPDATE denied; no model-accessible arbitrary SQL/shell/URL tool |
| AI injection/reference | See [AI safety audit](AI_SAFETY_AUDIT.md): strict output, tool allowlist, current permission/source membership and protected decision tests |
| Analytics privacy | `M9 analytics` integration denies non-managers and excludes request text, raw prompts, output and retrieval snapshots; bounded window/history |
| Demo reset | Explicit demo flag, matching allowlisted loopback target, exact marker, stopped API and six-migration check; production/missing-marker/drift refusals tested; storage preserved |
| Secrets/dependencies | M8/M9 scanners, M10 adversarial scan and production npm audit; evidence captures redact configured secrets and retain safe metadata only |
| Runtime hardening | Production rejects placeholder/low-entropy/reused auth secrets with key-only errors; non-root read-only containers, dropped capabilities, tmpfs, resource limits and graceful shutdown |

The M10 static adversarial script verifies repository invariants; it does not independently prove every dynamic attack route. Dynamic coverage is supplied by the unit and real PostgreSQL tests, not by relabeling the static scan as a penetration test. Existing demo-only credentials/placeholders are reviewed fixtures; they are never production advice.

Migration history remains six before/six after. `git diff --exit-code v0.9.0-m9 -- apps/api/prisma/migrations` and M10 hashes protect all historical SQL. No migration was introduced.

Limitations: no real customer data, external network exposure, multi-tenant deployment, distributed scheduling, broad browser matrix or independent security assessment was tested. Reset assumes exclusive control of the dedicated synthetic DB; its stopped-port check is not a distributed writer lock. Security-sensitive invariants have no known failing test. Exact final command results are recorded in [FINAL_VERIFICATION](FINAL_VERIFICATION.md) and [the checklist](../release/M10_RELEASE_CHECKLIST.md).
