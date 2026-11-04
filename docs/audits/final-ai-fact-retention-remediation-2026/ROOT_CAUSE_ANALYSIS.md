# Root Cause Analysis

## Scope and identity

- Worktree: `C:\Users\AnhPhamPC\.codex\worktrees\competition-hardening\MobiFlow AI`
- Branch: `codex/competition-hardening`
- HEAD: `5ecb182ce6afce0b93227b0f5472185768f2c805`
- Profile: DeepSeek generation configuration with lexical retrieval; live calls disabled.
- Historical DeepSeek ledger was not changed: SHA-256 `50BD5170EA696E2D45226001213C61E296890DD669465ABD921EE241E9FA6BB0`, six calls, USD `0.012984816`.

## Confirmed loss boundary

The original request title, description and ordered message bodies were already available in the backend analysis input. The loss occurred at the model-shaped structured analysis boundary: the `analysis.v1` contract only carried classification, entities, missing fields, confidence and a short reason summary. Persistence and UI therefore had no typed place for literal observations, exact identifiers or attempted actions/outcomes. This was confirmed by comparing the source snapshot with the normalized/persisted analysis path; no provider header, key or raw private prompt is included in this report.

The three failures were therefore one generalized contract/projection defect, not three provider-specific strings:

| Case | Lost source fact | Before | Safe closure |
|---|---|---|---|
| QA-CONFLICT-008 | power reported working; network/device contradiction | absent from structured output | backend literal extraction, reported/unverified UI, contradiction evidence |
| QA-NOANSWER-009 | exact `PROTO-DEMO-917` | identifier absent or normalized away | byte-accurate identifier projection and no-source fallback |
| QA-IOT-001 | gateway restart had no improvement | attempted action/outcome absent | typed troubleshooting attempt with `NO_IMPROVEMENT` |

## Secondary RAG cause

PostgreSQL lexical retrieval used broad FTS/trigram scoring and returned a weak tail after the top grounded result. Duplicate content hashes were already deduplicated, active generations and source status were filtered, and parameterized SQL was used. The minimal evidence-based fix is a relative score cutoff (`0.99 * top_score`) after content deduplication, retaining comparable contradictory evidence while suppressing weak tail noise.
