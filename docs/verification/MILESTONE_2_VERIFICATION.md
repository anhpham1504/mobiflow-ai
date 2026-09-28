# Milestone 2 Verification

Date: 2026-09-28, Asia/Saigon. M2 was explicitly authorized by the user after M1 passed. M0 and M1 remain the frozen baseline. **M2 PASS**, limited to database, authentication, RBAC, ownership policy and deterministic demo seed. M3 has not started.

## Scope implemented

- Complete Prisma V1 baseline domain schema with database constraints, indexes, optimistic `version` fields and migrations.
- Authentication endpoints for login, refresh, logout and current user.
- Argon2id password hashing, short-lived JWT access tokens and opaque rotating refresh credentials.
- Server-side role guards for exactly `USER`, `STAFF` and `MANAGER`.
- Central ownership policy: users own their created requests, staff access their current assignments, managers have management scope.
- Deterministic, idempotent local demo seed: 1 USER, 4 STAFF, 1 MANAGER, 4 teams, 5 skills, mappings and 4 fallback SLA policies.
- Real PostgreSQL integration verification, including an empty-database migration and concurrent refresh replay.
- M1 health, pgvector and host-Ollama behavior preserved.

No request workflow, state transitions, approval behavior, AI classification, RAG, knowledge upload, AI tool, analytics or M3+ endpoint was implemented.

## Database architecture

Prisma now defines `User`, `RefreshSession`, `Team`, `TeamMember`, `Skill`, `StaffSkill`, `Request`, `RequestMessage`, `RequestAttachment`, `RequestStatusHistory`, `Assignment`, `RequestResolution`, `Checklist`, `ChecklistItem`, `Feedback`, `AiRun`, `AiAnalysis`, `AiRecommendation`, `AiToolCall`, `KnowledgeDocument`, `KnowledgeChunk`, `SlaPolicy`, `SlaInstance`, `Notification` and `AuditLog`.

The schema uses the frozen V1 enums and exactly three login roles. Required indexes cover request status, creator, current assignee, creation time, category and priority, plus AI recommendation status, document status and notification user/read state. SQL CHECK constraints enforce normalized email, positive versions, category consistency, numeric ranges, review shape, timestamps and SLA bounds. Partial unique indexes enforce one current assignment and one active SLA instance where applicable.

Migrations, in application order:

1. `202609280001_enable_vector` enables pgvector.
2. `20260928085048_m2_domain_auth` creates the M2 schema, constraints, indexes, foreign keys and restricted runtime grants.
3. `20260928092000_m2_public_code_sequence` adds the atomic request public-code sequence required by the baseline schema; request creation remains deferred to M3.

An empty `mobiflow_m2_test` database applied all three migrations successfully. PostgreSQL **17.11** and pgvector **0.8.6** were verified. No embedding column or dimension was introduced in M2. The `mobiflow_app` runtime role can read/write application tables and insert audit records, but cannot update or delete `AuditLog`; it has only the required sequence privilege.

## Authentication and authorization

Routes under `/api/v1`:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /users/me`
- `GET /users/staff` for managers

Passwords use Argon2id with 65,536 KiB memory, 3 iterations and parallelism 1. Email input is trimmed and lowercased; passwords remain untrimmed. JWTs use HS256, issuer/audience checks, a 15-minute default lifetime, subject and session identifiers. Every protected request verifies the live user and refresh-session state in PostgreSQL.

Refresh credentials contain a UUID session identifier plus 32 random bytes. Only an HMAC-SHA-256 digest is stored. Sessions have a seven-day absolute lifetime, rotate on use, retain consumed records and revoke the full token family on replay, logout, expiry or inactive-user detection. A PostgreSQL row lock serializes simultaneous refresh attempts; the winner rotates, the loser receives `401 REFRESH_REPLAY`, and the resulting family is revoked. Cookies are HttpOnly, SameSite=Lax, scoped to `/api/v1/auth`, omit `Domain`, and are Secure except in the explicitly validated loopback HTTP demo.

State-changing cookie routes require an exact allowed `Origin` and `X-CSRF-Protection: 1`. Login limits are 5 attempts per normalized account plus IP and 20 per IP per minute; refresh is 30 per session plus IP per minute. API errors and structured logs exclude credentials, tokens and request bodies. Audit events record successful and denied authentication outcomes without secret material.

Role requirements use central metadata/decorators and guards. Ownership logic is centralized in `AuthorizationPolicyService`; out-of-scope resources produce the same 404 policy result as absent resources. The request CRUD/approval routes that will consume this policy belong to M3 and were not added early.

## Demo seed

The seed is permitted only when `DEMO_MODE=true` and the database host/name pass the local synthetic-target allowlist. It uses stable IDs and upserts so repeated runs preserve the same counts. Password hashes use unique Argon2 salts and are not rewritten on later seed runs.

Seed result on both the normal local database and the clean integration database:

| Item | Count |
|---|---:|
| Users | 6 (1 USER, 4 STAFF, 1 MANAGER) |
| Teams | 4 |
| Skills | 5 |
| Team memberships | 5 |
| Staff-skill mappings | 7 |
| SLA policies | 4 |

Demo-only accounts and the local password are documented in `docs/demo/LOCAL_DEMO_ACCOUNTS.md`. The password is not presented as production guidance.

## Environment variables

M2 retains all M1 variables and adds or activates:

| Variable | Purpose / verified local behavior |
|---|---|
| `JWT_SECRET` | HS256 signing secret; at least 32 characters |
| `REFRESH_TOKEN_SECRET` | distinct HMAC secret; at least 32 characters |
| `JWT_ISSUER` | access-token issuer, default `mobiflow-api` |
| `JWT_AUDIENCE` | access-token audience, default `mobiflow-web` |
| `ACCESS_TOKEN_TTL_SECONDS` | bounded access lifetime; local value 900 |
| `REFRESH_SESSION_TTL_SECONDS` | bounded absolute refresh lifetime; local value 604800 |
| `AUTH_COOKIE_SECURE` | true outside the validated loopback HTTP demo |
| `DEMO_MODE` | explicit authorization switch for synthetic seeding |
| `DATABASE_URL` | restricted application role URL |
| `MIGRATION_DATABASE_URL` | owner URL used only by explicit migration commands |

Secrets remain in ignored `.env`; none are recorded here or copied into Docker build context.

## Docker and Ollama

The Docker services remain `postgres`, `api` and `web`. All three are running and **healthy**, with ports bound to loopback. PostgreSQL uses `pgvector/pgvector:0.8.6-pg17`; API and web use `node:24.19.0-bookworm-slim` build/runtime stages and run as the unprivileged Node user. OpenSSL is installed only in the Prisma generation stage, removing the prior platform-detection warning without expanding the final runtime image.

Ollama remains on the Windows host. Native API configuration uses `http://localhost:11434`; Docker uses `http://host.docker.internal:11434`. The installed LLM was verified from the real host as **`qwen3:4b-instruct-2507-q4_K_M`** with Ollama **0.34.4**. No embedding model is installed; `OLLAMA_EMBEDDING_MODEL=unconfigured` continues to report truthful AI degradation. M2 does not call the LLM or create embeddings.

## Versions and dependencies

Host/tooling: Node **24.19.0**, npm **11.17.0**, Docker **29.6.2**, Compose **5.3.1**, TypeScript **6.0.3**, ESLint **9.39.4**. Preserved application versions include Next.js **16.3.6**, React/React DOM **19.3.0**, NestJS **12.1.0**, Swagger **12.0.2**, PostgreSQL driver `pg` **8.23.0**, Zod **4.6.5** and Tailwind CSS **4.3.3**.

M2 direct dependencies added at exact versions:

| Dependency | Version | Purpose |
|---|---:|---|
| `prisma` / `@prisma/client` | 7.10.0 | schema, migrations and generated typed client |
| `@prisma/adapter-pg` | 7.10.0 | Prisma PostgreSQL driver adapter |
| `argon2` | 0.45.1 | Argon2id password hashing |
| `jose` | 6.2.12 | JWT signing and strict verification |
| `cookie` | 0.7.2 | refresh-cookie serialization compatible with the Express dependency tree |
| `@types/cookie` | 0.6.0 | TypeScript declarations |

The lockfile pins transitive packages. Root overrides pin `deepmerge-ts` **8.0.2** and `mysql2` **3.24.4** to compatible patched releases. `npm audit --omit=dev --audit-level=high` found **0 vulnerabilities**.

## Tests and commands executed

| Command | Actual result |
|---|---|
| `npm run lint` | PASS, exit 0; no warnings or errors |
| `npm run typecheck` | PASS, exit 0; Prisma generation, API strict TypeScript and Next route types |
| `npm run test` | PASS, exit 0; **19 tests**: 4 config, 14 API, 1 web; 0 failed/skipped |
| `npm run build` | PASS, exit 0; shared packages, Nest API and optimized Next production build |
| `npm run db:validate` | PASS, exit 0; Prisma schema valid |
| `npm run db:migrate` | PASS, exit 0; 3 migrations present, no pending migration on local DB |
| `npm run demo:seed` twice | PASS both runs; identical 6/4/5/5/7/4 counts |
| `npm run test:integration` | PASS, exit 0; production runtime plus clean real-PostgreSQL suite |
| `docker compose config --quiet` | PASS, exit 0; output suppressed to avoid exposing environment values |
| `docker compose build api web` | PASS; Linux production images built |
| `docker compose up -d --force-recreate api web` | PASS; final images started |
| `docker compose ps` | PASS; postgres, API and web all healthy |
| `npm audit --omit=dev --audit-level=high` | PASS; 0 vulnerabilities |
| `git diff --check` | PASS, exit 0; only Git's expected Windows line-ending notices |

The final integration run proved:

- migrations succeed from an empty real PostgreSQL database;
- seed succeeds twice without duplicate data;
- all three roles can log in;
- wrong-role manager access is 403 and missing M3 approval routes remain unavailable;
- inactive users cannot log in or continue a session;
- invalid, expired, revoked and replayed refresh credentials are rejected;
- two concurrent uses of one refresh credential produce one success and one replay rejection, then revoke the family;
- USER and STAFF ownership predicates deny foreign/unassigned requests with 404 semantics;
- audit records exist and the runtime role cannot mutate them;
- OpenAPI contains the M2 auth and RBAC routes without exposing token/cookie schemas as secrets;
- the production container supports login, protected profile and logout;
- pgvector remains enabled with no premature embedding dimension;
- host Ollama online state uses the installed Qwen tag, and an unavailable Ollama leaves API liveness/core readiness available.

## Failures found and fixed

- An early production image resolved an incompatible `cookie` package layout after `npm prune`. Pinning the direct dependency to compatible **0.7.2** made host and container resolution identical.
- Initial concurrent refresh testing found a race that returned a database error. Refresh now locks the presented session row before reading its consumed state.
- The first lock fix retained a timestamp captured before waiting, which violated the session lifetime CHECK when applied to the newly created replacement. The transaction now captures time after acquiring the row lock. The final concurrent replay test passes without weakening the constraint.
- Prisma warned that OpenSSL was unavailable in the slim build stage. Installing OpenSSL only in `api-build` removed the warning; the runtime image remains unchanged.

Failed attempts above are not counted as PASS commands. Only the final successful executions appear in the gate result.

## Known limitations and deferred work

- The ownership service is fully tested against its three policy branches, but request endpoints do not exist until M3; no placeholder business route was added to manufacture an end-to-end ownership claim.
- Rate limiting is process-local, appropriate for the single local API instance. A distributed limiter would be required before horizontal deployment, outside the local V1 architecture.
- Refresh cookies are intentionally non-Secure only for the explicitly validated loopback HTTP demo. Any non-loopback or HTTPS deployment must use `AUTH_COOKIE_SECURE=true`.
- No embedding model is installed, so overall AI readiness remains degraded while core readiness is healthy. Embedding model/dimension selection belongs to M5.
- ESLint 9 is deprecated upstream but retained as the verified compatible version from M1. No peer constraint is bypassed.

No manual check remains required for the M2 gate. Broader request workflow, browser business flows, AI quality, RAG and release verification remain assigned to M3–M10.

## Blockers and gate

M2 blockers: **none**. V1 release remains blocked because M3–M10 are not implemented or verified.

**PASS — M2 database, authentication, RBAC, ownership policy and deterministic seed only.** The master-plan M2 gate is satisfied: clean migration, seed, login for all three roles, authorization/security tests and generated OpenAPI all passed against the actual local stack. Stop here; M3 requires explicit user approval.
