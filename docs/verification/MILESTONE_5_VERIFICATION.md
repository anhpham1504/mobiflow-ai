# Milestone 5 Verification

Verified 2026-09-29 on Windows against the frozen M5 plan/specifications and the explicit M5 execution request. Work started from `6101eccb29d24a7c5ce4964b20c794609fda8938` on `main`, preserves the existing uncommitted M4 implementation, remains uncommitted, and stops before M6.

## Scope implemented

- Manager-only PDF/TXT upload, private local storage, strict file validation, page-aware text extraction, deterministic normalization, SHA-256 deduplication, explicit lifecycle, reindex and disable.
- Versioned code-point chunking, real local Ollama document/query embeddings, immutable chunk generations, atomic publication, model/dimension compatibility checks and pgvector persistence.
- Scoped cosine retrieval, bounded context selection, stable source IDs, snapshot binding and real RAG integration with the existing M4 analysis lifecycle.
- Backend-validated exact quotes and source membership, role-projected citations, source preview and manager knowledge UI.
- Fixed synthetic corpus, real embedding/retrieval/RAG evaluations, clean-database, offline, race, stale-source, browser and M3/M4 regression gates.

The repository/specification audit and extracted acceptance criteria are recorded in [M5_IMPLEMENTATION_CHECKLIST.md](M5_IMPLEMENTATION_CHECKLIST.md). No M6 tool, similar-case, recommendation or autonomous action work was started.

## Architecture

The implemented pipeline is:

```text
Manager upload
  -> DocumentService + private file store
  -> isolated bounded PDF/TXT parser
  -> deterministic normalizer/chunker
  -> EmbeddingProvider (Ollama)
  -> atomic immutable KnowledgeChunk generation
  -> VectorRepository (parameterized pgvector cosine query)
  -> KnowledgeRetriever + bounded context builder
  -> existing AnalysisWorker / RequestStateMachineService
  -> strict analysis.v1 + validated citation envelope
  -> role-projected API/UI source metadata
```

Controllers validate, authorize and delegate. `DocumentService` owns document lifecycle; `IngestionWorker` claims one durable job at a time and publishes a complete generation transactionally. `RequestStateMachineService` remains the sole Request.status writer and revalidates request version, initiator authority, retrieval snapshot, model identity and current source availability before publication. AI output remains advisory and never writes actual category, priority, assignment, SLA, approval or workflow decisions.

Retrieved text is untrusted user data. Only source lines with a concrete normalized term shared by the original request are eligible for the citation schema or included in the model context. Titles, labels, short headings and synthetic disclaimers are not citable. This prevents superficially similar context from changing an underspecified request while preserving the complete retrieval snapshot for audit.

## Files/modules changed

- `apps/api/src/knowledge/`: embedding abstraction/Ollama adapter, parser worker, deterministic chunker, private file store, document service, ingestion worker, vector repository, retriever/context builder, RAG output validation, source projection, readiness, guard and controller.
- `apps/api/src/ai/` and `apps/api/src/requests/request-state-machine.service.ts`: RAG-aware execution, prompt v4, retrieval snapshot and publication checks while retaining the original non-RAG analysis contract.
- `apps/api/prisma/schema.prisma` and migration `20260928145100_m5_knowledge_vectors`.
- `packages/config` and `packages/contracts`: validated embedding/RAG configuration and typed knowledge/source/grounding contracts.
- `apps/web/src/components/knowledge.tsx`, knowledge routes, analysis/source display, navigation, health and responsive styling.
- `datasets/knowledge/`, `datasets/ai-evaluation/rag-queries.json` and `rag-analysis.json`: synthetic fixed corpus and labels.
- `scripts/demo/`, `scripts/evaluation/m5-*`, `scripts/verification/m5-*`, `playwright.m5.config.mjs`, unit/integration/browser tests, Compose/Docker configuration, README and evidence.

## Database changes

One additive migration was added after a real embedding probe established `D=1024`:

- changes `KnowledgeChunk.sourceId` to `varchar(120)` for immutable `KD-{documentId}-G{generation}-C{index}` identities;
- adds nullable `modelIdentity`, `dimension` and `embedding vector(1024)` columns;
- adds a check requiring an exact dimension, a 64-character model-identity hash and nonzero vector norm when an embedding exists;
- adds HNSW `vector_cosine_ops` index `KnowledgeChunk_embedding_cosine_hnsw`;
- revokes runtime UPDATE/DELETE on immutable chunks.

All four migrations apply on a clean DB and the existing DB has no pending migration. The three earlier migration SHA-256 values are unchanged; see [M5_MIGRATION_FREEZE.json](evidence/M5_MIGRATION_FREEZE.json). The runtime DB role retains least privilege. No database reset or deletion of user data was performed.

## Knowledge corpus

The active corpus contains 9 explicitly synthetic/public-safe documents and 12 chunks:

- 3 two-page text-layer PDFs: IoT connectivity, mobile network and SLA policy;
- 6 UTF-8 TXT documents: IoT configuration FAQ, billing, account access, service activation, unrelated fiber negative and adversarial prompt-injection content.

All pages carry a synthetic disclaimer. The ingestion script ran twice with the same document IDs, generations and chunk counts; [M5_INGEST_IDEMPOTENCE.json](evidence/M5_INGEST_IDEMPOTENCE.json) is PASS. Interrupted browser-test documents were disabled through the audited API; final readiness reports exactly 9 active documents and 12 active chunks. No real customer or internal confidential data is present.

## Embedding runtime

| Item | Actual value |
|---|---|
| Provider | Ollama on the Windows host |
| Model | `bge-m3:latest` |
| Digest | `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab` |
| Actual/configured/schema dimension | 1024 / 1024 / 1024 |
| Index revision | `m5.v1` |
| Maximum batch | 16 texts |
| Embedding timeout | 30,000 ms |
| Retry | at most one bounded retry |
| Final probe latency | 86 ms; an earlier cold probe was 15,100 ms and is retained in evidence |

The provider validates tag/digest/dimension, finite nonzero values, response count, cancellation and maximum batch. It never truncates or pads vectors. [M5_EMBEDDING.json](evidence/M5_EMBEDDING.json) and [M5_EMBEDDING_PROBE.json](evidence/M5_EMBEDDING_PROBE.json) contain the real probe without the raw 1024-value vector.

## Chunking

`codepoint-window.v1` normalizes CRLF/CR to LF, NFC-normalizes Unicode and trims outer whitespace without rewriting content. It creates at most 1,200 Unicode-code-point chunks with 200-code-point overlap, never crosses a PDF page, retains page/section/offset metadata, rejects empty content, and caps extracted text at 2,000,000 code points. TXT headings are preserved; PDF pages remain individually traceable. Parser version is `pdfjs-6.3.289-txt-utf8.v1`.

## Vector retrieval

| Item | Actual value |
|---|---|
| Metric/operator/index | cosine distance / pgvector `<=>` / HNSW cosine |
| Evaluation strategy | exact scoped materialized search; HNSW is provisioned but not used to truncate this small corpus |
| Similarity display formula | `1 - cosine distance`; never AI confidence |
| Default topK | 5; validated bound 1–5 |
| Maximum distance | 0.50 |
| Context | at most 5 unique sources, 1,200 chars/source, 6,000 chars total |
| Eligibility | READY document, active generation, exact model identity/dimension, non-null vector |

The vector is passed as a bound parameter and the limit/distance are validated bounded values. Inactive, failed, processing and old generations are excluded. Query and document embeddings use the same actual provider identity.

## RAG

The base prompt is `request-analysis.v4`; persisted RAG runs carry retrieval trace version `request-analysis-rag.v1` and preserve `analysis.v1` inside a strict `{analysis,citations}` envelope. Request data and eligible reference sources are serialized as untrusted user data after fixed instructions. The context builder deduplicates stable source/content identities and enforces the hard limits above.

The response schema permits only actual context source IDs and exact eligible source lines. Backend validation repeats ID/quote membership checks, rejects duplicates/fabrication, checks concrete request/quote term overlap, verifies source generation/hash/availability and verifies the embedding identity before atomic publication. USER sees no internal grounding. MANAGER/authorized STAFF source access is checked again on every fetch. Historical citations become `UNAVAILABLE` when a source is disabled; they are not silently rewritten to a newer generation.

With `AI_RAG_ENABLED=false`, the M4 non-RAG path remains explicit and successful. With RAG enabled, an embedding/vector failure produces a controlled failed intake and preserves the manual workflow; there is no silent claim of grounding. A successful retrieval with no eligible evidence returns `INSUFFICIENT_EVIDENCE` and no citation/procedure.

## API changes

OpenAPI 0.5.0 adds these MANAGER/authorized source routes under `/api/v1`:

| Endpoint | Behavior |
|---|---|
| `POST /knowledge/documents` | MANAGER PDF/TXT upload; 202; strict size/type/name/hash and rate limits |
| `GET /knowledge/documents` | MANAGER list; bounded cursor page; no file path/vector |
| `GET /knowledge/documents/:id` | MANAGER metadata and current source list |
| `GET /knowledge/documents/:id/content` | authorized bounded source content path |
| `POST /knowledge/documents/:id/reindex` | MANAGER expectedVersion command |
| `POST /knowledge/documents/:id/disable` | MANAGER expectedVersion plus reason |
| `GET /knowledge/sources/:sourceId` | MANAGER or eligible STAFF, with live availability check |

Existing M4 analyze/retry/explanation endpoints remain backward-compatible. Grounding appears only in authorized projections; filesystem keys, raw documents, vectors, prompts, provider headers and stack traces are never exposed.

## UI changes

Manager can upload, inspect status/metadata, open sources, reindex and disable documents. Request analysis shows the truthful grounding state and source links. Source preview renders excerpts as text with document/page/section/generation metadata. USER cannot open the manager area or internal sources; STAFF can only open an eligible live cited source.

Indexing and grounding use semantic status/live regions, actions are keyboard accessible, focus is visible and status is not color-only. Playwright verified 360/768/1440 widths with no horizontal overflow. The E2E wait observes a new document version before accepting READY, avoiding a stale-list race.

## AI changes

The M4 LLM remains `qwen3:4b-instruct-2507-q4_K_M`, digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`. RAG does not add tools or protected mutations. The model may propose the same M4 analysis fields plus citations; all values remain untrusted and manager-controlled.

Final M4 regression evaluation on prompt v4 used 50 actual Ollama calls: 50/50 completed and schema-valid, 49/50 valid first attempt, category agreement 47/50, priority agreement 45/50, missing targets 11/11, latency p50 2,610 ms and p95 3,148 ms. These are observed synthetic-set measurements, not calibrated accuracy claims.

## Evaluations

### Retrieval

The fixed set contains 25 queries: 20 labeled positives and 5 negatives. Labels were fixed before results; failures remain in the denominator. No numeric acceptance threshold exists in the master plan.

| Measurement | Observed |
|---|---|
| Hit@1 | 14/20 = 0.70 |
| Hit@3 | 16/20 = 0.80 |
| Hit@5 / Recall@5 | 16/20 = 0.80 |
| MRR | 0.7416667 |
| Negative no-answer | 5/5 |
| Negative false positive | 0/5 |
| Embedding latency | p50 55 ms; p95 2,007 ms |
| End-to-end retrieval latency | p50 62 ms; p95 2,014 ms |

Four positive queries missed the labeled document in top 5. The complete ranking, stable source IDs, distances and query/model identity are retained in [M5_RETRIEVAL_EVAL.json](evidence/M5_RETRIEVAL_EVAL.json).

### RAG versus non-RAG

The fixed 12-case set ran alternating NON_RAG/RAG serially with no explicit prewarm: 24 actual LLM calls. The A11 label explicitly accepts the IoT FAQ because that document directly cross-references SOP-IOT-04 for lost connectivity.

| Measurement | NON_RAG | RAG |
|---|---:|---:|
| Cases completed/schema-valid | 12/12 | 12/12 |
| Citation ID/quote valid | n/a | 12/12 |
| Citation semantically relevant to labeled acceptable document/no-source case | n/a | 12/12 |
| Category agreement | 12/12 | 12/12 |
| Priority agreement | 11/12 | 10/12 |
| Latency p50 | 2,870 ms | 6,786 ms |
| Latency p95 | 3,369 ms | 7,505 ms |

The two RAG priority mismatches and one non-RAG mismatch are retained. Exact quote validation establishes provenance, not correctness of every model conclusion. Complete results and limitations are in [M5_RAG_EVAL.json](evidence/M5_RAG_EVAL.json).

## Security considerations

- File names and storage keys are server-controlled; traversal, nulls, MIME/signature mismatch, invalid UTF-8, embedded nulls, empty/oversized text, corrupt/encrypted/over-page PDFs and unsupported types are rejected.
- PDF parsing is text-only in an isolated worker with timeout/page/size bounds; no JavaScript, link following, macro, OCR, archive or HTML execution.
- Upload/read/write endpoints enforce backend roles, ownership/source availability, origin/content-type checks and per-actor rate limits. Out-of-scope access remains 404 and wrong role 403.
- Vector input must have exact dimension, finite nonzero values and compatible model identity. SQL vector values/source IDs are parameterized; topK/distance are bounded.
- Documents and request text are untrusted data. Prompt injection, HTML/script and SQL-looking adversarial text cannot override instructions, invoke tools or produce fabricated citations.
- New-generation publication is atomic; partial embeddings, disable/reindex races, expired leases, model mismatch, stale request/source and DB rollback fail closed.
- No secrets, uploads, raw prompts, raw completions, model binaries or vectors are committed/logged. [M5_SECRET_SCAN.txt](evidence/M5_SECRET_SCAN.txt) found no high-confidence secret pattern outside ignored local artifacts/config.
- `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities. The only new runtime package is `pdfjs-dist@6.3.289`, Apache-2.0, compatible with Node 24.19.0; see [M5_DEPENDENCY_AUDIT.txt](evidence/M5_DEPENDENCY_AUDIT.txt).

This is a local-demo security review, not a public production penetration test.

## Tests executed

Every PASS command below completed with exit code 0. Failed iterations described under manual verification were corrected and rerun; they are not counted as PASS.

| Command | Actual result |
|---|---|
| `npm run lint` | PASS; zero warnings |
| `npm run typecheck` | PASS; shared packages, Prisma, strict API and Next types |
| `npm run test` | PASS; config 6, API 29, web 1; 36 total, none skipped |
| `npm run build` | PASS; API and Next production build |
| `npm run db:validate` | PASS |
| `npm run db:migrate` | PASS; 4 migrations, none pending |
| `npm run demo:seed` twice | PASS; synthetic seed idempotent |
| `npm run knowledge:ingest` twice | PASS; 9 same documents, 12 same active chunks/generations |
| `npm run test:integration` | PASS; M2 1, M3 3, M5 5 and M4 5 real PostgreSQL suites |
| `npm run test:e2e:m3` | PASS; 2 browser scenarios |
| offline and online `npm run test:e2e:m4` | PASS; 1 offline and 2 online/recovery scenarios |
| `npm run test:e2e:m5` | PASS; manager lifecycle/RBAC/source/keyboard/responsive scenario |
| `npm run verify:embedding:m5` | PASS; real model/digest/dimension/vector validation |
| `npm run eval:retrieval:m5` | PASS; 25 real query embeddings and pgvector searches; metrics retained |
| `npm run eval:rag:m5` | PASS; 24 real LLM paths; metrics retained |
| native and Docker `npm run verify:runtime:m5` | PASS; live RAG, source RBAC, non-RAG and isolated outage |
| `npm run verify:runtime:m4` on final Docker image | PASS; four actual persisted cases including ambiguous request |
| `npm run eval:ai:m4` | PASS; 50 actual provider calls; observed errors retained |
| Docker embedding-offline override + `m5-docker-offline.mjs` | PASS; core/LLM/manual live, RAG controlled failure, normal stack restored READY |
| Docker M4 LLM-offline runtime/browser override | PASS; embedding remained online and manual workflow remained usable |
| `docker compose config --quiet` | PASS |
| `docker compose build` and `docker compose up -d` | PASS; final postgres/api/web healthy |
| `npm ls --depth=0` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS; zero vulnerabilities |
| migration SHA-256 comparison | PASS; all three pre-M5 migrations unchanged |
| `git diff --check` | PASS; only line-ending conversion notices |

Durable evidence: [unit](evidence/M5_TEST.txt), [integration](evidence/M5_INTEGRATION.txt), [browser](evidence/M5_E2E.txt), [embedding](evidence/M5_EMBEDDING.json), [retrieval](evidence/M5_RETRIEVAL_EVAL.json), [RAG](evidence/M5_RAG_EVAL.json), [native runtime](evidence/M5_RUNTIME_NATIVE.json), [Docker runtime](evidence/M5_RUNTIME_DOCKER.json), [Docker offline](evidence/M5_DOCKER_OFFLINE.json), [clean DB](evidence/M5_CLEAN_DATABASE_LIVE.json), [lint](evidence/M5_LINT.txt), [types](evidence/M5_TYPECHECK.txt), [build](evidence/M5_BUILD.txt), [Docker build](evidence/M5_DOCKER_BUILD.txt) and [diff check](evidence/M5_DIFF_CHECK.txt).

## Behavioral coverage

- Deterministic Unicode boundaries/overlap/page isolation/headings/hash; duplicate upload race; repeat ingestion; immutable reindex; disable and historical source behavior.
- Actual PDF/TXT parsing, corrupt/encrypted/no-text/over-page/oversize negatives, cancellation and strict UTF-8.
- Actual embedding probe and batch behavior; dimension/model/digest mismatch; malformed/empty/nonfinite vectors; timeout/offline and bounded retry.
- Actual pgvector search with active-generation/model/dimension filters; no-match negatives; empty corpus; inactive/old-source exclusion.
- Partial embedding and publication rollback; disable during embedding; lease expiry/replay; stale request/corpus; fake source/quote; prompt injection; owner projection; source RBAC.
- Real request -> embedding -> pgvector -> bounded context -> Ollama -> strict analysis/citation -> persisted snapshot/source link.
- M3 state/SLA/authorization/concurrency/manual workflow and M4 queue/retry/stale/cancel/role/offline behavior.

## Manual verification

All six pages of the three generated PDFs were rendered and visually inspected: synthetic labels, body text, footer/page identity and margins were legible with no clipping. Browser screenshots at 360, 768 and 1440 pixels were generated and inspected. Source navigation showed the exact excerpt and page/generation metadata; USER access was denied and STAFF lost access after disable.

The primary Docker demonstration reached READY, retrieved real active source IDs, persisted a successful RAG run with a validated citation, opened the source through the authorized endpoint and left actual request category/priority/assignment/SLA unchanged. Final `/health/ready` reported core, LLM, embedding and RAG ready with 9 documents/12 chunks. The embedding-offline override reported DEGRADED with `EMBEDDING_UNAVAILABLE` while API, DB, pgvector, LLM and manual messaging stayed live, then normal Compose was restored to READY.

Failures were not hidden. During development, an advisory-lock void result, JSONB key ordering assertion, quote newline mismatch, ambiguous-request source contamination, browser locator races and stale E2E test documents were reproduced and fixed at their owners. A browser retry was initially rate-limited after back-to-back runtime tests; it passed after the real limit window. The final E2E assertion now waits for a new document version rather than accepting stale READY text. Interrupted synthetic E2E documents were disabled through the audited API.

## Known limitations

- Retrieval missed 4/20 labeled positives at top 5. The 25-query synthetic development set is small and not an independent holdout or production-quality estimate. Vietnamese/noisy phrasing remains a known weakness.
- HNSW is provisioned for the declared cosine metric, but evaluation intentionally uses exact scoped search because 12 active chunks are too small for a meaningful approximate-index benchmark. No production throughput claim is made.
- Citation eligibility uses deterministic normalized term overlap plus exact quote/source membership. It blocks generic/unsupported evidence but is not a semantic entailment engine. A valid citation can still accompany a wrong model interpretation.
- RAG priority agreement (10/12) was lower than NON_RAG (11/12), and RAG p50/p95 latency was about 6.8/7.5 seconds on this local runtime. RAG is not claimed to improve every metric.
- PDF support requires a text layer; encrypted/image-only documents need no OCR fallback. Only PDF/TXT are supported. The local store, one ingestion worker and in-memory rate windows are appropriate to this single-host demo, not a distributed deployment.
- Reindex creates an immutable new generation of the same original file. V1 has no document-content replacement endpoint; changed bytes are a new document. Disabled historical data is retained for audit and excluded from new retrieval.
- Source labels and evaluation acceptability are specification-authored synthetic labels. No generalized accuracy, calibrated confidence or unsupported-claim absence percentage is asserted.

## Deferred items

- M6: tool registry, request embeddings/similar cases, workload/candidate queries and grounded recommendations.
- M7: AI-bound manager review workflow.
- M8: Copilot, checklist adoption, SLA monitoring, factual resolution summary and feedback.
- M9: expanded independently labeled evaluation, benchmark methodology and analytics.
- M10: release/demo/security hardening and production rollout work.

## Release blockers

No blocker remains for the authorized local M5 gate. Full V1/production release remains blocked on M6–M10 and broader evaluation/security work. Human review remains mandatory for every protected business decision.

The working tree intentionally remains uncommitted because the user did not request a commit. Docker is restored to normal host-Ollama configuration and all services are healthy.

## Gate

**PASS — M5 complete.** Ingestion, deterministic chunking, verified local embeddings, pgvector retrieval, bounded RAG, validated citations, lifecycle/RBAC/UI, evaluations, offline recovery and M0–M4 regressions are verified. Execution stops before M6.
