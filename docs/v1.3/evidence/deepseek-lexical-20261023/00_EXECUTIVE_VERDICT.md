# MobiFlow AI V1.3 executive verdict

Date: 2026-10-23 (Asia/Saigon)

Verdict: **DEEPSEEK_LEXICAL_RAG_CANDIDATE_PASS — OWNER_LIVE_APPROVAL_PENDING**

The candidate was implemented in the independent clone `C:\Code\MobiFlow-AI-DeepSeek-Lexical-20261023`, branch `codex/deepseek-lexical-v1.3`, from exact baseline `30d47c8d13bb0f44aada79c50527dba88196d32a`. The active profile is backend-only DeepSeek generation plus local PostgreSQL lexical retrieval. The explicit rollback profile remains Ollama generation plus pgvector retrieval; the vector column, old vectors and HNSW index were not removed.

## Acceptance evidence

- Deterministic suite: PASS, 320/320.
- Real PostgreSQL rollback-profile integration: PASS, 47 executed tests; one historical live-Ollama evaluation SKIPPED because no live service was authorized or available.
- Real PostgreSQL V1.3 lexical gate: PASS on an isolated disposable database after all 14 migrations; exact code, Vietnamese accent folding, synonyms, typo tolerance, source currentness, irrelevant/no-result behavior, SQL-injection input, Unicode, GIN plan and rollback artifacts were checked. Embedding provider call counters remained 0/0/0 for probe/document/query.
- Lint, strict typecheck, production build and Prisma schema validation: PASS.
- Production dependency audit: PASS, 0 vulnerabilities. The full development dependency graph retains 5 high findings in the lint-only `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces` chain; the offered force fix is a breaking downgrade and was not applied.
- Browser regression: PASS for USER/STAFF/MANAGER role boundaries, human approval and state transitions, provider-degraded behavior, source evidence, mobile overflow and health visibility. DeepSeek requests: 0. Ollama requests: 0.
- Secret checks: `.env` is ignored, `DEEPSEEK_API_KEY` length was 0, `AI_LIVE_CALLS_ENABLED=false`, and no DeepSeek configuration name was found in the web production bundle.

## Explicitly not run

- Any paid DeepSeek request, balance probe, key validation call or live canary: **NOT RUN — separate owner approval required**.
- Expanded live DeepSeek quality evaluation and human grading: **NOT RUN**.
- Historical live Ollama evaluation: **SKIPPED — rollback-only runtime was not started**.
- Production deployment, push, PR, merge, migration of a protected database or use of real customer data: **NOT RUN / NOT AUTHORIZED**.
- The historical “361 tests” snapshot was not claimed as replayed: the repository has evolved. Current evidence reports the exact observed counts above, plus the dedicated lexical assertions and browser scenario.

## Residual release gates

Before enabling live calls, the owner must supply the key outside Git, reverify the account-supported model and then-current price sheet, approve the proposed 1–3 synthetic cases and privacy/egress posture, and review the estimated maximum spend. The implemented redactor is defense in depth for common email, phone and secret patterns, not a DLP guarantee; real customer data remains prohibited. Provider-side balance cannot be hard-capped by this code, so the local meter is not represented as a vendor-enforced cap.

No push, PR, merge or deployment was performed.
