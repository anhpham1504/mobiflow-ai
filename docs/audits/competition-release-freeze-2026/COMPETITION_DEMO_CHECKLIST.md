# Competition demo checklist

## Before owner publication approval

- [ ] Review the explicit staging list; do not use `git add .` or `git add -A`.
- [ ] Confirm `.env` remains ignored and unstaged.
- [ ] Review the sidebar hunk, live cap and local integration-target changes separately.
- [ ] Visually inspect all selected synthetic screenshots.
- [ ] Confirm no local runtime helper or mock-provider log is staged.
- [ ] Confirm branch is still `codex/competition-hardening` and the target is the latest fetched `origin/main`.
- [ ] Re-run `git diff --cached --check` after staging.
- [ ] Obtain separate owner authorization before commit or push.

## Demo environment

- [ ] Use only synthetic demo data.
- [ ] Keep the DeepSeek API key backend-only; never paste it into browser code, screenshots, shell output or reports.
- [ ] Confirm `AI_GENERATION_PROVIDER=deepseek` and `RAG_RETRIEVAL_MODE=lexical` for the authorized demo profile.
- [ ] Confirm call budget, concurrency 1 and retry bounds before enabling any live provider call.
- [ ] Confirm database migrations and readiness checks before opening the UI.
- [ ] Confirm USER, STAFF and MANAGER accounts are the only login roles.
- [ ] Confirm no production database, production network or real customer data is connected.

## Three P1 demonstrations

- [ ] Conflict case: retain working power, 12 offline devices and 14:00 restoration; show contradiction and no verified root cause.
- [ ] No-answer case: preserve exact `PROTO-DEMO-917`; show no fabricated SOP/citation and manager review.
- [ ] IoT case: preserve 23 SIMs, 09:15, Omega, gateway restart and `NO_IMPROVEMENT`.
- [ ] Show USER cannot see internal retained-fact projection.
- [ ] Show authorized STAFF/MANAGER can see user-reported provenance labels.
- [ ] Show AI cannot approve, assign, resolve, close or change roles.
- [ ] Show manager/human approval remains required for protected decisions.

## RAG and rollback

- [ ] Confirm the 0.99 relative cutoff and no-answer behavior with the deterministic dataset.
- [ ] Confirm disabled/stale sources cannot be cited.
- [ ] Keep the explicit `ollama` + `vector` rollback profile documented and available.
- [ ] Do not delete pgvector state or historical vectors during rollback.

## After the demo

- [ ] Disable live calls.
- [ ] Stop only task-owned API/web/database processes.
- [ ] Preserve the provider ledger and sanitized audit evidence.
- [ ] Record actual results; do not upgrade NOT RUN or production readiness to PASS.
