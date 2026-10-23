# Patch scope and configuration

## Implementation areas

- Provider abstraction and backend wiring: native DeepSeek chat-completions adapter, typed failures, health state, structured usage/cost identity and bounded local guards.
- Knowledge retrieval: PostgreSQL lexical repository, lexical ingestion/retrieval routing, additive migration and zero-embedding test path.
- Evidence semantics: exact whole-word substantive spans, title-only rejection and boundary-safe excerpts.
- Operational behavior: provider-neutral degraded UI, health/readiness split for generation and retrieval, demo preflight without Ollama.
- Specifications and ADR: V1.3 profile, privacy/budget caveats, rollback behavior and migration contract.
- Tests: deterministic provider/citation tests, real PostgreSQL isolated lexical runner and existing rollback-profile regression.

At the final pre-commit audit, the tracked implementation diff relative to the baseline contained 57 modified paths with 466 insertions and 200 deletions, before adding this evidence package and new source files.

## Configuration controls

- Defaults: `deepseek + lexical`, `AI_LIVE_CALLS_ENABLED=false`, empty `DEEPSEEK_API_KEY`.
- Official origin outside tests: `https://api.deepseek.com/`; non-official origins are rejected, with loopback allowed only in test mode.
- Model candidate: `deepseek-flash`; account availability must be reverified before live approval.
- Generation: temperature 0, 1,200 output-token default, 120-second attempt ceiling, 64,000-character outbound ceiling and 32 KiB response/output ceilings.
- Local limits: USD 0.25 process budget, 3 calls/process, 2 starts/minute and 1 concurrent request. These are local controls, not a provider balance lock.
- Retrieval: top-K at most 5, context at most 6,000 characters, query at most 2,000 Unicode code points, read-only transaction and 5-second PostgreSQL statement timeout.

The `.env` file is ignored, contains no DeepSeek key and is not part of the patch or manifest. Secrets are not passed to the web application. The web production bundle had zero matches for DeepSeek key/base URL/budget configuration names. Database URLs and task JWT/refresh values are not included in evidence.

## Migration and compatibility

Migration `20261023010000_v13_lexical_retrieval` adds `pg_trgm`, `unaccent`, an immutable schema-qualified unaccent wrapper, FTS/trigram GIN indexes and least-privilege execute permission. It does not drop or rewrite business tables, the pgvector extension, vector column, old vector rows or HNSW index.

No Cloudflare configuration or application integration was added. No new application dependency was needed for DeepSeek HTTP because the adapter uses the Node runtime `fetch` implementation.
