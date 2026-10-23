# Architecture: DeepSeek generation with PostgreSQL lexical retrieval

The repository ADR is `docs/architecture/adr/0006-deepseek-postgres-lexical.md`. This report records the tested candidate configuration.

## Active and rollback profiles

| Concern | V1.3 active profile | Explicit rollback profile |
|---|---|---|
| Generation | `AI_GENERATION_PROVIDER=deepseek` | `AI_GENERATION_PROVIDER=ollama` |
| Retrieval | `RAG_RETRIEVAL_MODE=lexical` | `RAG_RETRIEVAL_MODE=vector` |
| Embedding calls | none | existing Ollama embedding adapter |
| Data | current PostgreSQL chunks and lexical indexes | preserved `vector(1024)`, vectors and HNSW index |

Configuration rejects mixed pairs (`deepseek + vector` and `ollama + lexical`) so rollback is deliberate rather than silent. DeepSeek outages or a missing key report degraded AI while the manual workflow remains available; they never cause an automatic Ollama fallback.

## Data flow

1. Controllers keep authentication and validation boundaries; domain services continue to own rules.
2. Knowledge upload parses and chunks the source locally. In lexical mode, chunks are written without probing or invoking an embedding provider.
3. PostgreSQL applies accent-folded `simple` full-text search, exact SOP/FAQ/SLA code matching and bounded `pg_trgm` word similarity over READY/current-generation chunks.
4. Backend evidence selection filters source membership, current generation, substantive content and business relevance before generation.
5. The backend-only DeepSeek adapter redacts common email/phone/secret patterns, sends bounded JSON-mode prompts to the allowlisted official origin, validates the vendor envelope/model/finish reason, then the existing orchestration validates the application schema and IDs.
6. `AiRun` persists safe structured output, source snapshot, provider/model identity, token usage, price identity and estimated cost. Hidden reasoning content is neither requested as a business artifact nor persisted.
7. Protected business decisions still require the existing manager approval path; `RequestStateMachineService` remains the status writer.

## Tradeoffs

Lexical search removes runtime dependency on BGE-M3 and Ollama, is deterministic and preserves exact citations. It cannot provide the same open-ended semantic recall as an embedding model. The initial synonym groups are deliberately narrow; unsupported paraphrases may return insufficient evidence rather than inventing a match. Trigram fallback improves minor typo tolerance but remains bounded by top-K, query length, transaction timeout and current-source predicates.

No Cloudflare service, worker, D1/R2 store, tunnel or runtime is configured. The installed PostgreSQL driver transitively contains the package `pg-cloudflare`, but repository runtime/config search found zero Cloudflare integration references; it is not invoked by this architecture.
