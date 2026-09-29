# Milestone 6 Verification

## Scope implemented

M6 is complete on `feat/m6-grounded-recommendations`, based on `7fe687ae4517c37f9fbe3fcf01668980ebe85a23` / `v0.5.0-m5`. Existing uncommitted work was preserved. No commit, push, tag, or M7 implementation was performed.

Implemented scope: a closed read-only tool registry, version/model-bound request embeddings, scoped similar-request retrieval, deterministic candidate/workload queries, grounded structured recommendations, immutable provenance, stale revalidation, atomic `PENDING_APPROVAL` publication, manager-only API projection, and a minimal explanatory manager UI. M6 does not assign staff, approve a request, apply category/priority/SLA/checklist changes, or expose manager evidence to USER/STAFF.

## Architecture

The pipeline is:

```text
TRIAGED request + latest M4/M5 analysis
  -> six fixed read-only tools
  -> bounded evidence snapshot
  -> one structured Ollama synthesis (at most one repair)
  -> strict schema/reference/current-state validation
  -> serializable publication through RequestStateMachineService
  -> manager-only recommendation view
```

The scheduling transaction commits before embeddings, tools, and Ollama run. Publication uses a separate serializable transaction. No database lock/transaction spans model inference. `RequestStateMachineService` remains the only request-status writer.

## Tool registry

| Tool | Version | Bound output | Timeout | Side effect |
|---|---:|---:|---:|---|
| `searchKnowledge` | v1 | 5 sources | 30s | READ_ONLY |
| `findSimilarRequests` | v1 | 5 cases | 30s | READ_ONLY |
| `getSlaPolicy` | v1 | 1 policy | 5s | READ_ONLY |
| `getCandidateStaff` | v1 | 10 candidates | 5s | READ_ONLY |
| `getStaffWorkload` | v1 | 10 rows | 5s | READ_ONLY |
| `getRequestHistory` | v1 | 50 events | 5s | READ_ONLY |

Inputs and outputs are strict shared schemas; unknown tools, extra fields, invalid output, duplicate calls, timeouts, oversized output, and calls beyond the budget fail closed. The run budget is eight calls. A tool normally runs once; SLA policy may run up to three times for bounded priority reconciliation. Output is capped at 32 KiB/tool. Authorization is checked before and after every tool execution, and database-backed tool transactions are `READ ONLY`. Persisted traces contain safe IDs/counts/status/timing rather than raw request, SOP, message, prompt, or model text.

## Similar requests and embeddings

- Provider/model: Ollama `bge-m3:latest`.
- Verified digest: `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`.
- Dimension: 1024; model/digest/dimension/input revision/key and request version are persisted and required to match.
- Metric: exact PostgreSQL pgvector cosine distance, mapped to `v=clamp((cosine+1)/2,0,1)`.
- Ranking: `0.60*v + 0.20*category + 0.10*location + 0.10*recency`.
- Candidate cutoff: vector component `v >= 0.70`; limit 5; default window 30 minutes, maximum 10,080 minutes.
- Filters: permission scope before ranking, current compatible vector only, self/future/CANCELED/out-of-window cases excluded; stable tie order by score, creation time, and ID.

Similarity is evidence for review, not confidence or historical truth. The provisioned HNSW cosine index is not claimed as a production-scale benchmark; the scoped M6 query deliberately uses exact ranking for the small local corpus.

## Candidate and workload logic

Candidate eligibility reuses the M3 predicate and filters before `LIMIT`: login role `STAFF`, active/available staff, active team and membership, required team/skills, and current actor scope. Score is deterministic: `(60*skillMatch + 25*(1/(1+activeWorkload)))/85`; eligible staff have `skillMatch=1`. Ties use workload then lexical staff ID.

Workload is a timestamped database snapshot counting only current assignments in `ASSIGNED`, `IN_PROGRESS`, and `WAITING_USER`; resolved/terminal work is excluded. It is not an employee-quality score.

## Grounded recommendation

`grounded-recommendation.v3` emits strict `recommendation.v1`: suggested priority/team/staff/SLA, source-bound actions, procedure source IDs, similar-case alert, bounded confidence, concise reason summary, and `SUFFICIENT` or `INSUFFICIENT_EVIDENCE`. Actual source, case, staff, policy, workload, analysis, and request-version references are validated against the same run snapshot and current database state. Invented IDs/counts/SLA, unsupported actions, stale request/actor/analysis/source/candidate/policy/case versions, and insufficient-evidence actions fail closed.

At most two synthesis attempts are allowed inside a 300-second run and 120-second provider attempt. Repair feedback contains fixed validation categories, not raw hidden reasoning. Original suggestions and human decisions remain separate. Successful publication atomically records the recommendation, history, audit, manager notifications, AI run result, and `PENDING_APPROVAL` pointer without operational category/priority/assignment/SLA/checklist mutations.

## Database changes

- `20260929034000_m6_request_embeddings`: immutable request/version/model/input-bound `vector(1024)` artifacts and integrity hashes.
- `20260929043000_m6_request_cosine_index`: additive cosine HNSW index matching the declared schema.

Both existing and disposable clean databases applied all six migrations. The clean integration database was seeded twice without duplicate fixture counts. The four pre-M6 migration blobs remain byte-identical to the M5 baseline. Runtime request-vector privileges permit required SELECT/INSERT and deny UPDATE/DELETE.

## API and UI

- `POST /api/v1/manager/requests/:id/ai/recommend`: manager-only, expected-version and state checked, returns `202` for a durable queued run.
- `GET /api/v1/manager/requests/:id/ai/recommendation`: manager-only current safe snapshot with stale reasons.
- `GET /api/v1/ai/runs/:id`: exact recommendation run polling for MANAGER only; USER receives scoped 404 and STAFF is forbidden.

OpenAPI is version 0.6.0. The manager request page displays progress, failure/retry, evidence status, procedure sources, related cases, candidates/workload, and stale state. It has no M7 accept/modify/reject or automatic assignment control. USER/STAFF projections do not receive manager recommendation data. Browser checks covered keyboard behavior and 360/768/1440 widths without horizontal overflow or page errors.

## Evaluations

### Similar requests

Fixed synthetic dataset hash and per-case results are in `evidence/M6_SIMILAR_CASE_EVAL.json`.

| Metric | Result |
|---|---:|
| Cases / positive / negative | 10 / 8 / 2 |
| Hit@1 / Hit@3 / Hit@5 | 1.00 / 1.00 / 1.00 |
| MRR | 1.00 |
| Negative no-match | 1/2 |

One negative query returned a false positive at the unchanged engineering threshold. This limitation is retained rather than tuning labels or threshold after prediction.

### Candidates and workload

Seven deterministic cases covered multiple valid candidates, inactive/unavailable/wrong-role staff, inactive membership, missing skill, inactive team, and zero candidates. All applicable non-empty sets had precision 1.00 and recall 1.00; both empty-set cases were exactly empty. The multiple-candidate and zero-candidate paths passed. Exact `ASSIGNED`, `IN_PROGRESS`, `WAITING_USER`, and `RESOLVED` workload lifecycle behavior was verified.

### Recommendations

| Metric | Result |
|---|---:|
| Cases | 8 |
| Schema-valid / reference-valid / candidate-valid | 8/8 / 8/8 / 8/8 |
| Category agreement | 8/8 |
| Priority agreement | 6/8 |
| Staff match | 7/7 applicable; the remaining case correctly returned no staff under insufficient evidence |
| Total latency p50 / p95 | 9,477 ms / 14,611 ms |

All eight actual-model runs succeeded without a repair attempt. The dataset is small, synthetic, and development-authored. Agreement is not generalized production accuracy, and valid provenance does not prove semantic correctness.

### M4/M5 regression evaluations

- M4: 50/50 completed and schema-valid, 49/50 first-attempt-valid, category agreement 47/50, priority agreement 45/50, p50/p95 2,864/3,412 ms.
- M5 retrieval: 25 cases, Hit@1 0.70, Hit@3/Hit@5/Recall@5 0.80, MRR 0.742, 5/5 negative no-match, retrieval p50/p95 141/169 ms.
- M5 paired RAG: 12/12 schema-valid and 12/12 citation-valid/relevant; category 12/12, priority 9/12, p50/p95 7,125/8,535 ms. NON_RAG remained 12/12 schema/category with priority 11/12.

## Security and failure verification

Tests cover unknown tool, strict schema, duplicate/budget/timeout/output bounds, request and tool-output prompt injection, fake source/case/staff IDs, manager RBAC, scoped 404 behavior, stale request/cancel/actor/staff/source/policy races, expired lease, tool database failure, zero history/candidate/source paths, actual unreachable LLM/embedding adapters, and transaction rollback on notification persistence failure. LLM-offline produced `AI_PROVIDER_UNAVAILABLE`; embedding-offline produced `EMBEDDING_UNAVAILABLE`; both left the request `TRIAGED`, published no recommendation, and left manual messaging available.

Docker ports remain loopback-only, containers retain `no-new-privileges`, and no arbitrary tool, SQL, shell, or network execution endpoint was added. The production dependency audit found zero high vulnerabilities. The conservative secret scan found only six reviewed localhost demo/test placeholder database URLs and no item requiring review. This is a scoped repository review, not a penetration-test claim.

## Tests executed

Durable command records and timestamped logs are under `docs/verification/evidence`; failed/interrupted iterations were preserved.

| Command / gate | Actual result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS: config 6, API 35, web 1 |
| `npm run build` | PASS |
| `npm run db:validate` | PASS |
| `npm run db:migrate` | PASS: six migrations applied/current |
| `npm run demo:seed` | PASS |
| `npm run test:integration` | PASS: M2 1, M3 3, M5 5, M4 5, M6 24 at the full-suite checkpoint |
| `npm run test:integration:m6` | PASS: final M6 source, 25 tests |
| `npm run test:e2e:m3` | PASS: 2 tests; an initial Ollama-down environmental failure is retained |
| `npm run test:e2e:m4` offline then online | PASS: 1 offline + 2 online/recovery tests |
| `npm run test:e2e:m5` | PASS: 1 test |
| `npm run test:e2e:m6` | PASS: 1 test |
| `npm run eval:ai:m4` | PASS: 50 cases |
| `npm run eval:retrieval:m5` | PASS: 25 cases |
| `npm run eval:rag:m5` | PASS: 24 paired runs |
| `npm run verify:runtime:m6` native/online | PASS |
| `npm run verify:runtime:m6` Docker/online | PASS |
| `npm run verify:runtime:m6` Docker LLM-offline / embedding-offline | PASS / PASS |
| `docker compose config --quiet` and offline override config | PASS |
| `docker compose build` | PASS |
| final `docker compose ps` | PASS: postgres/api/web healthy, loopback ports |
| `npm ls --depth=0` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS: zero vulnerabilities |
| migration freeze / secret scan | PASS |
| `git diff --check` | PASS |

## Known limitations

- Small local synthetic datasets are neither independent holdouts nor evidence of production quality.
- One of two similar-request negative cases is a false positive at `v >= 0.70`.
- Recommendation priority agreement is 6/8; human manager review remains mandatory.
- Source membership proves provenance, not entailment or factual correctness.
- Request vectors bind bounded original request text; newer messages are included in bounded recommendation history rather than silently changing an old vector.
- Background vector backfill pauses after one provider failure until API restart; explicit recommendation retry can recover its own vector.
- Worker serialization and rate limits are process-local/single-host, not distributed infrastructure.
- No production-scale vector performance, internet deployment, or real-customer-data claim is made.

## Deferred

M7 owns AI-bound human accept/modify/reject. M8 owns Copilot/checklist adoption/SLA monitoring/summary. M9 owns expanded evaluation/analytics. M10 owns release hardening. None were started.

## Gate

**PASS — M6 complete.**
