---
status: active
appliesTo: v1.4.2
releaseStatus: patch-candidate
---

# V1.4.2 machine checklist

## Identity and non-mutation

- [ ] Candidate is based on commit `d225f0ebacbaf0521ac64349fb4ce9ba6600c092` and tree `5b3de63f2eee6441a5845ac0fcb29dc5bb861794`.
- [ ] Work is in an isolated checkout and does not use a current competition database.
- [ ] Frozen V1.4.1 artifacts and records `MF-AUTOROUTE-DEMO-001` / `MF-AUTOROUTE-EXC-001` remain unchanged.
- [ ] No commit, tag, push, deployment, or release publication is performed by remediation.

## Active profile

- [ ] `AI_GENERATION_PROVIDER=deepseek`.
- [ ] `RAG_RETRIEVAL_MODE=lexical`.
- [ ] `AI_LIVE_CALLS_ENABLED=false` unless separately authorized after this remediation.
- [ ] Readiness reports disabled generation honestly and does not require Ollama for the active lexical path.

## Explicit rollback profile

- [ ] Provider/retrieval pair is exactly `ollama` plus `vector`.
- [ ] Generation model is exactly `qwen3:4b-instruct-2507-q4_K_M`.
- [ ] Embedding model is exactly `bge-m3:latest`.
- [ ] `npm run demo:preflight` confirms both installed tags and capabilities before rollback use.
- [ ] No model download, tag substitution, embedding-dimension change, or automatic fallback occurs.

## Candidate gates

- [ ] `npm ci` uses the locked dependency graph.
- [ ] Lint, typecheck, deterministic tests, and production build pass.
- [ ] `npm run verify:docs:current` passes; historical `Verify-M0.ps1` is not used as the release gate.
- [ ] A clean ephemeral PostgreSQL receives all migrations.
- [ ] DeepSeek/lexical profile integration, auto-routing integration, and lexical RAG integration all run and pass without live provider calls.
- [ ] Evidence manifest, final diff, lockfile, dependency, and frozen-artifact checks are recorded.
