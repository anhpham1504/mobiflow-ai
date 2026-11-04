# Proposed commit and pull request

## Proposed commit

Title:

`fix(ai): harden fact retention and lexical grounding`

Description:

- add a backend-owned `fact-retention.v1` projection for reported observations, exact technical identifiers, troubleshooting outcomes and contradictions;
- recompute and validate the projection against the locked request/message snapshot before publication;
- expose retained facts only to authorized MANAGER/current STAFF views while preserving the limited USER projection;
- suppress weak lexical tail matches with the measured 0.99 relative cutoff;
- add API, web, security and PostgreSQL regressions for all three P1 scenarios;
- update the owning AI/API/database/RAG specifications and attach sanitized competition evidence.

This commit should use only the explicit staging set in `RELEASE_CANDIDATE_MANIFEST.md`. It should not include the sidebar hunk, live-cap change, local runtime harnesses or `.env`.

## Proposed PR

Title:

`Competition RC: close P1 fact-retention and lexical-grounding gaps`

Body:

### Summary

This PR prepares the MobiFlow AI competition release candidate. It preserves user-reported technical facts independently of model prose, fails closed when the retained projection is missing/tampered/stale, retains exact diagnostic identifiers and troubleshooting outcomes, surfaces contradictions without asserting a root cause, and filters weak lexical RAG tail matches.

The existing branch commit also clarifies the decision/audit workflow in the UI.

### Safety and human control

- AI does not approve, assign, resolve or close a request.
- USER does not receive internal retained-fact evidence.
- MANAGER/current STAFF access remains backend-scoped.
- Protected mutations keep expected-version, RBAC, state-machine and audit requirements.
- No raw provider response, hidden reasoning, secret or customer data is added.

### Verification

- 370/370 deterministic tests PASS.
- Typecheck, lint and production build PASS.
- Security and documentation gates PASS.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Disposable PostgreSQL lexical integration PASS with 14 migrations, zero embedding calls, no-answer/disabled-source/index/least-privilege coverage.
- Latest authorized live evidence: 3/3 blocking P1 scenarios and 24/24 database/API checks PASS.
- No paid provider request was made during release freeze.

### Limitations

- Production readiness is not assessed.
- Raw DeepSeek response text was intentionally not retained; the audit distinguishes this raw-model limitation from the passing system-level retention result.
- Historical/intermediate audit harnesses are intentionally excluded from the focused commit.
- CI must rerun from the published commit after separate owner authorization.

### Rollback

If the candidate regresses after publication, revert the hardening commit as one unit. Runtime generation/retrieval rollback remains the documented `ollama` + `vector` profile; pgvector and historical vectors remain intact. Do not reset databases or rewrite history. Preserve audit evidence and use a normal reviewed revert PR.
