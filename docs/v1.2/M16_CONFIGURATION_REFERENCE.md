# V1.2 local configuration reference

Authority: [M16 specification](M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md). The API's owning validator is `packages/config/src/index.ts`; startup reports invalid key names without values. Configuration categories overlap: a required key may contain a secret. Never paste `.env`, tokens, cookies or full connection strings into reports.

## REQUIRED for core startup

| Configuration | Contract |
|---|---|
| `DATABASE_URL` | PostgreSQL URL for the restricted runtime account. Availability is tested by readiness; an unavailable DB is HTTP 503, never healthy. |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | Distinct generated values, at least 32 characters; production rejects placeholder/low-entropy patterns. |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBEDDING_MODEL` | Syntactically required by the existing validator. Optional AI can use explicit `unconfigured` model sentinels; actual Ollama/model availability is not required for core startup. |
| `WEB_ORIGIN` | One credentialed origin; default `http://localhost:3000`. Insecure cookies are allowed only for an explicit loopback HTTP demo. |
| `API_HOST`, `API_PORT` | Default native loopback/3001. Compose uses container `0.0.0.0:3001` with a loopback-only published host port. |

`NODE_ENV=production` is used for the release rehearsal. Other bounded settings have owning-validator defaults, including issuer/audience, token lifetimes and health timeout. Unknown provider names, invalid ports/timeouts, URL credentials on provider origins and reused auth secrets fail validation.

Runtime Prisma/pg pool acquisition has a 5000 ms connection timeout. Recognized database connectivity/pool failures return sanitized HTTP 503 `DATABASE_UNAVAILABLE`; they never grant authentication. Invalid/expired/revoked credentials remain 401. The independent readiness probe retains its own bounded health timeout. Port conflicts close startup resources and emit `startup.failed` / `PORT_OCCUPIED` without environment values.

## OPTIONAL for specific operations

| Configuration | Purpose |
|---|---|
| `MIGRATION_DATABASE_URL`, `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD` | Owner-only migration/Compose initialization, separate from runtime credentials. Required for fresh database setup, not browser exposure. |
| `NEXT_PUBLIC_API_BASE_URL` | Public browser API address, embedded at web build time. Default localhost:3001. Changing it requires a rebuild, including Compose build arguments. Never place credentials here. |
| `POSTGRES_PORT`, `WEB_PORT`, `COMPOSE_PROJECT_NAME` | Optional isolated Compose host ports/project. Defaults preserve the existing 5432/3000 ports/project; `API_PORT` selects the API host port. |
| `DEMO_MODE=true` | Required by seed/reset. The target still must be an allowlisted loopback database. This flag alone does not authorize reset. |
| `DEMO_SEED_REFERENCE_TIME` | Optional fixed ISO timestamp for deterministic synthetic history; unset uses current time. Repeat seed preserves existing timestamps. |
| `AI_RAG_ENABLED`, `EMBEDDING_DIMENSION` | Core can run with RAG disabled. The full grounded demo requires true and the locally verified bge-m3 dimension 1024. |
| `AI_AUTO_ANALYZE` | Defaults true; false explicitly selects manual intake. M16 live demo uses the unchanged true baseline. |
| `AI_ATTEMPT_TIMEOUT_MS`, `AI_RUN_TIMEOUT_MS`, `AI_TEMPERATURE`, `AI_MAX_OUTPUT_TOKENS` | Existing bounds/defaults: 120000/300000/0/1200. No M16 inference or prompt change. |
| `EMBEDDING_BASE_URL`, embedding/RAG/storage settings | Optional existing retrieval configuration, validated bounds and model identity; never mix models/dimensions. |
| `VERIFY_API_URL` | Native operator corpus-ingestion API origin, when using a custom API port. Origin/CSRF still use configured `WEB_ORIGIN`. |
| `DEMO_EVIDENCE_ROOT` | New operational evidence destination. V1.2 operators set it to an ignored directory or `docs/v1.2/evidence/m16/operator` so historical M10 evidence is preserved. |

## SECRET

Both auth secrets, both PostgreSQL passwords, credential-bearing database URLs, opaque refresh credentials, access JWTs and passwords are private. `.env` and nested `.env` files remain ignored and excluded from Docker contexts. `.env.example` contains replace-me placeholders, not working credentials. Use `npm run env:setup -- qwen3:4b-instruct-2507-q4_K_M` in a new checkout; it generates separate random secrets and refuses to overwrite an existing `.env`. The documented demo account password is intentionally synthetic/local-only and remains in the approved account reference.

No new configuration service, cloud secret manager or observability platform is introduced. `.env.example` is a reference: copying its placeholders directly does not yield valid startup configuration.
