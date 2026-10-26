# Owner decisions and rollback

## Decisions still required

- Approve or reject the first paid DeepSeek synthetic canary after reviewing `09_BUDGET_PRIVACY_AND_LIVE_GATE.md`.
- Confirm account model availability, current price sheet and privacy/retention posture.
- Review live quality/citation output and explicitly approve any later push, PR, merge, protected database migration or deployment.
- Decide whether to remediate or accept the 5 high lint-only development dependency audit findings. The currently suggested automated force fix is a breaking downgrade and was intentionally not applied.

The current candidate verdict does not authorize any of those actions.

## Operational rollback profile

Rollback does not require deleting lexical indexes or historical data. Set the coupled profile before starting the API:

```text
AI_GENERATION_PROVIDER=ollama
AI_PROVIDER=ollama
RAG_RETRIEVAL_MODE=vector
AI_LIVE_CALLS_ENABLED=false
```

Then verify the configured Ollama generation/embedding models, pgvector extension, 1024-dimension vector column and HNSW index before serving traffic. The full real-PostgreSQL rollback integration passed after this switch. There is no automatic runtime fallback; an explicit configuration change and restart are required.

If the code candidate itself must be abandoned, preserve this evidence and use the baseline/patch/commit identity for a reviewed Git revert in the independent clone. No reset, deletion or modification of the owner's protected worktrees is part of rollback.

## Release stop conditions

Stop on secret exposure, unexpected provider/model/origin, privacy-policy uncertainty, source/currentness failure, title-only or partial-word citation, authorization/IDOR regression, unbounded cost, schema mismatch, protected-state drift or any failing technical gate.
