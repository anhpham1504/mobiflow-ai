# ADR 0006: DeepSeek generation with local PostgreSQL lexical retrieval

Status: accepted for the isolated V1.3 technical candidate on 2026-10-23. Live paid canary, merge and deployment remain owner decisions.

## Context

The released lineage used host Ollama for generation and BGE-M3 embeddings with pgvector. On the target laptop this made the demo dependent on local model startup and constrained RAM/VRAM. The owner selected DeepSeek API for all generation and local PostgreSQL lexical retrieval for SOP/FAQ/SLA, while requiring existing vectors to remain recoverable.

## Decision

Support exactly two explicit configuration pairs:

- `deepseek` generation + `lexical` retrieval is the new default candidate. DeepSeek is backend-only, official HTTPS only, disabled by default for paid calls, bounded by rate/concurrency/call/cost guards and strict structured-output validation.
- `ollama` generation + `vector` retrieval is the preserved rollback profile. It is never an automatic failure fallback.

Lexical search runs in the existing PostgreSQL instance using exact source codes, the `simple` FTS dictionary over unaccented content, bounded `pg_trgm` word similarity, controlled synonyms and deterministic ranking. Only current READY generations are eligible. Backend evidence decisions, source currentness and exact substantive citation validation remain authoritative. In lexical mode ingestion and request similarity make zero embedding calls.

Migration14 is additive: it adds `unaccent`, `pg_trgm`, a normalization function and GIN indexes. It preserves pgvector, vector(1024), HNSW indexes, historical vector values and immutable source generations. No Cloudflare, external embedding API, second database or autonomous model loop is introduced.

## Consequences and tradeoffs

The demo no longer needs Ollama, BGE-M3 or GPU memory for its active path. Retrieval stays local, auditable and inexpensive, and exact business codes/phrases work well. It is not semantic vector RAG: unseen paraphrases, vocabulary gaps and long indirect descriptions can produce false negatives. Vietnamese diacritic folding, a narrow source-controlled synonym list and trigram fallback improve recall but must not be expanded until irrelevant documents look authoritative. Missing or conflicting evidence fails closed as `INSUFFICIENT_EVIDENCE`.

Generation now depends on Internet availability, DeepSeek account balance and an approved data-egress policy. Manual workflow and lexical search remain available during generation outage. The application-side USD guard is conservative accounting, not a provider-side hard cap. Real customer data is prohibited until separate governance/legal approval.

## Verification and rollback

Verify mock adapter failures, schema/citation rejection, deterministic suites, fresh 14-migration PostgreSQL, zero embedding calls, index use, least privilege, role/browser regression and truthful degraded health before candidate PASS. A live 1–3 case synthetic canary requires separate owner approval. Rollback changes only the explicit provider/retrieval pair after operator review; it does not delete lexical indexes or vector data.
