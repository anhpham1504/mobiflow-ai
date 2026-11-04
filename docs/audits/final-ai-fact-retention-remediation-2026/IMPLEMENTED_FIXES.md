# Implemented Fixes

## Generalized fact-retention projection

- Added `apps/api/src/ai/fact-retention.ts`.
- Added strict `fact-retention.v1` contract fields in `packages/contracts/src/analysis.ts`.
- Extracted bounded observations, exact technical identifiers, troubleshooting attempts/outcomes, contradictions and source-text SHA-256 from the original request input.
- Every retained item is explicitly `USER_REPORTED`; source is `BACKEND_LITERAL_EXTRACTION`.
- Stored the projection inside `AiRun.safeResultJson`; the original request remains the source of truth.
- Bumped prompt identity to `request-analysis.v5` and wired API query and UI projections.
- UI labels retained facts as user-reported, does not present them as verified causes, and hides the internal projection from USER.

## Publication safety

`RequestStateMachineService.finishAnalysis()` now reconstructs the exact locked request/message snapshot, validates the retained projection against that snapshot, and persists only after exact validation. Missing, tampered, stale or unavailable source projections cannot publish an analysis; the request remains in `AI_ANALYZING` and no analysis row is created. The permanent integration regression covers this rejection path.

## Lexical retrieval

- Added `LEXICAL_MIN_SCORE_RATIO = 0.99` after deduplication.
- Bumped retrieval identity to `postgres-simple-trgm.v2`.
- Preserved source-status filtering, current-generation checks, parameterized SQL, FTS index use, no-answer behavior and vector rollback assets.
