# RAG Before / After

The comparison uses the same historical five-query ground-truth labels; it is a score replay, not a new live-corpus claim.

| Metric | Before | After replay |
|---|---:|---:|
| Returned results | 25 | 8 |
| Relevant results | 6 | 4 |
| Precision@returned | 0.24 | 0.50 |
| Hit@1 | 3/3 | 3/3 |
| Recall@5 | 3/3 | 3/3 |
| MRR | 1.0 | 1.0 |
| No-answer | 2/2 | 2/2 |

Real PostgreSQL lexical integration independently passed with 14 migrations, zero embedding calls, disabled-source exclusion, active-generation filtering, FTS GIN index usage and parameterized SQL/injection checks. The integration reported `ftsPlanUsesIndex: true`, `embeddingCalls: 0`, and `none: []` for the no-answer query.
