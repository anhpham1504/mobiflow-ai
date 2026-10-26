# Lexical retrieval real PostgreSQL evidence

Final command (task-local database URLs were loaded from ignored `.env` and are intentionally not reproduced):

```powershell
$env:V13_ISOLATED_DATABASE_ACK='mobiflow-deepseek-lexical-20261023'
npm run test:integration:v13-lexical
```

Result: **PASS**.

The runner validates that both URLs are loopback, port 55439 and the expected task database; it then creates `mobiflow_v13_lexical_test`, deploys all 14 migrations, runs assertions with the least-privilege application connection and drops the database in `finally`.

## Covered behavior

- Exact `SOP-IOT-04` match and current generation 2 after reindex.
- Equivalent accented and accent-folded Vietnamese queries.
- Narrow network/IoT synonym expansion and a minor `ket noii` typo via trigram search.
- Billing query ranks the billing source, while network evidence selection excludes it.
- Disabled source exclusion, READY/current-generation enforcement and stable repeated ordering.
- No-result query returns an empty source set and downstream evidence becomes `INSUFFICIENT_EVIDENCE`.
- 2,001-code-point query rejection, Unicode input and SQL-injection-like text without schema damage.
- Business table set unchanged by the additive migration.
- FTS GIN index selected by the plan check.
- pgvector rollback evidence: extension present, vector dimension 1024 and HNSW index present.
- Embedding-provider counters: `probe=0`, `documents=0`, `query=0`.

The first execution exposed that the initial verifier targeted the already-seeded demo database. It failed an isolation/count assertion and was not called PASS. The runner was changed to create/drop its own exact database; the final result above is from that isolated implementation.

## Known recall boundary

This is lexical ranking, not semantic embedding similarity. Unlisted paraphrases and domain synonyms can be false negatives. The safe behavior is an empty/insufficient-evidence result; improving recall requires reviewed dictionary/query fixtures, not weakening source validation or allowing title-only matches.
