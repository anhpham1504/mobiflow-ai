---
status: active
appliesTo: v1.4.2
releaseStatus: patch-candidate
---

# V1.4.2 operator and rollback runbook

Use synthetic targets only. Do not point these steps at a current competition or production database. Do not enable live DeepSeek calls without separate owner authorization.

## Active profile

1. Copy `.env.example` to an untracked `.env` and generate distinct local secrets with `npm run env:setup`.
2. Keep `AI_GENERATION_PROVIDER=deepseek`, `RAG_RETRIEVAL_MODE=lexical`, and `AI_LIVE_CALLS_ENABLED=false` for offline verification.
3. Run `npm ci`, `npm run db:migrate`, `npm run build`, and `npm run verify:docs:current` against an isolated synthetic database.
4. Confirm readiness truthfully: the core and lexical path may be usable while generation is degraded because live calls are disabled.

## Explicit rollback profile

Rollback is a deliberate operator action, not an automatic provider fallback. Set the following values together:

```dotenv
AI_GENERATION_PROVIDER=ollama
RAG_RETRIEVAL_MODE=vector
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_EMBEDDING_MODEL=bge-m3:latest
```

Run `npm run demo:preflight` before using the rollback profile. Preflight must confirm the exact configured tags and capabilities. This runbook does not authorize downloading a model, changing embedding dimension, rebuilding historical vectors, or claiming a tag is installed without a local probe.

To return to the active profile, restore `deepseek` plus `lexical`, keep live calls disabled unless separately authorized, restart the isolated runtime, and rerun readiness. Never mix DeepSeek with vector retrieval or Ollama with lexical retrieval.

## Failure handling

| Failure | Required behavior |
|---|---|
| DeepSeek disabled, unavailable, rate-limited, or timed out | Report the real degraded state; continue the manual path; do not relabel stored output as live |
| Lexical evidence missing or conflicting | Fail closed to manager review; do not auto-assign |
| No valid staff candidate | Keep assignment unchanged and require manager review |
| Rollback model or embedding tag mismatch | Stop preflight; do not download or silently substitute a model |
| Database or migration gate unavailable | Mark the gate NOT RUN or failed; do not treat it as PASS |

The current [machine checklist](V1_4_2_MACHINE_CHECKLIST.md) is the pre-demo companion. The immutable V1.4.1 checklist remains historical evidence and is not edited by this patch.
