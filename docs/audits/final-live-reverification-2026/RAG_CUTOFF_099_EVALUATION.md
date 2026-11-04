# Lexical RAG cutoff 0.99 evaluation

The implementation and unit test fix the threshold at `LEXICAL_MIN_SCORE_RATIO=0.99`. The same historical five-query labels were replayed without changing ground truth:

| Metric | Historical broad tail | 0.99 replay |
|---|---:|---:|
| Returned results | 25 | 8 |
| Relevant results | 6 | 4 |
| Precision@returned | 0.24 | 0.50 |
| Hit@1 | 1.00 | 1.00 |
| Recall@5 | 1.00 | 1.00 |
| MRR | 1.00 | 1.00 |
| No-answer | 2/2 | 2/2 |

The new three-query live set returned one relevant source and no false positives: Hit@1 1.00, Recall@K 1.00, MRR 1.00, Precision@returned 1.00 and no-answer correct. The IoT source score was `0.7491666682`; top score was the same, relative cutoff was `0.7416750015`, and source `KD-9f4214c3-7b05-4a60-bd70-93e09690cda9-G1-C0` was retained. The conflict and unknown-code runs returned no source/citation.

Deterministic PostgreSQL integration independently passed exact-code, synonym, diacritic/no-diacritic, typo, billing, unknown-query, disabled-document exclusion, active-generation filtering, stable repeat ranking, parameterized injection probe, zero embedding calls and FTS GIN index usage. Unit coverage also passed content-hash deduplication and weak-tail suppression. No legitimate labeled source was observed filtered out.

The cutoff remains a strict tail-suppression heuristic, not semantic confidence or proof of universal optimality.
