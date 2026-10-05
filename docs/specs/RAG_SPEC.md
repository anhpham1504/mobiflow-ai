# RAG Specification

Authority: master-plan §3.4–3.6, M5, §§23–24. RAG must retrieve real persisted chunks and identify their provenance. Source membership checks are necessary but do not prove semantic entailment; labeled retrieval tests and manager review remain required.

## Actors and storage

Only MANAGER uploads, reindexes or disables knowledge. MANAGER and STAFF can read eligible READY synthetic SOPs under [AUTHORIZATION_SPEC](AUTHORIZATION_SPEC.md); USER cannot access internal files. Only controlled tools pass scoped excerpts into AI. Store business/chunk/vector data in the same PostgreSQL instance and original files in a configured local private storage root outside the web public directory. Return authorized resource IDs, never local paths.

Required formats: PDF with extractable text and UTF-8 TXT. DOCX and OCR are deferred. Max upload 10 MiB, max 200 PDF pages, max 2,000,000 extracted characters per document; reject encrypted, unsupported, malformed, empty or over-limit input with a safe typed error. Validate extension, MIME and signature together; MIME claims alone are insufficient. Normalize display filename, reject traversal characters/NUL, use server-generated storage key, compute SHA-256 and never execute embedded document content or fetch remote resources.

## Document lifecycle

| Status | Meaning and allowed next states |
|---|---|
| UPLOADED | Authorized validated file and metadata saved; PROCESSING or DISABLED next. |
| PROCESSING | Bounded worker extracts/chunks/embeds; READY, FAILED or DISABLED next. |
| READY | A complete active generation exists; PROCESSING for reindex or DISABLED next. |
| FAILED | Error code/reason retained; PROCESSING on manager retry or DISABLED next. |
| DISABLED | Excluded immediately from all live retrieval; manager reindex may explicitly reactivate through PROCESSING. |

Upload creates metadata and a durable job reference; worker polls persisted state with a lease. Initial per-document deadline 10 minutes; embedding batch <=16 texts, shared embedding timeouts from AI_BEHAVIOR_SPEC, index concurrency 1. Large PDF extraction uses a worker thread/process to avoid blocking the API event loop. Startup recovers expired PROCESSING leases as FAILED; a manager can retry. No infinite retry and no partial READY index.

Reindex sets PROCESSING and builds a new immutable generation; the old generation is retained for audit but excluded from new retrieval while processing. Atomic successful promotion makes only the new generation active. Failure leaves FAILED and no live retrieval from the failed document. Disabling cancels work best-effort and prevents a late worker from republishing READY using a document-version guard. Reindex DISABLED is an explicit audited manager reactivation. Exact duplicate SHA-256 upload returns 409 with existing authorized document ID; reindex is the recovery action.

## Deterministic extraction and chunking v1 (A08)

1. PDF text is extracted per real page with 1-based page numbers. TXT validates UTF-8 and has pageNumber=null. Reject no-extractable-text PDF with `NO_EXTRACTABLE_TEXT`; do not pretend OCR occurred.
2. Normalize CRLF to LF, Unicode to NFC and trim leading/trailing whitespace; preserve line boundaries. Do not lowercase or discard source text. Record parser/chunker versions.
3. Chunk each PDF page independently and TXT as one stream. Window is 1,200 Unicode code points, overlap 200 (next offset = previous start+1,000). Trim chunk edges; skip whitespace-only chunks; never create an empty trailing chunk. Store original normalized start/end offsets and monotonically increasing zero-based chunkIndex. This fixed strategy deliberately avoids ambiguous variable boundary rules.
4. Section is the nearest preceding explicitly parsed Markdown-style heading in TXT (`#` through `######` followed by space) within the stream; otherwise null. PDF section remains null in v1 unless extraction explicitly supplies a verified heading. No inferred section/page citations.
5. Embedding input is the exact normalized chunk content, never generated summaries. Preserve document hash and generation with each chunk. Deduplicate identical overlapping results by chunk ID and exact content hash for context assembly, retaining at least one real source identity.

## Embedding identity and migrations

OLLAMA_EMBEDDING_MODEL is configurable. Before first index, query actual local model metadata and probe an embedding; require nonempty finite numeric values with nonzero norm, consistent dimensions and identical model identity across batches. Store provider/model tag/resolved digest where available/dimension/index generation/chunker version. If digest cannot be obtained, record the available identity plus an operator-controlled index revision and require full reindex after any model change; never assume tag stability proves identity.

No dimension is guessed in M0. M5 records the validated dimension D and creates an explicit migration for vector(D) columns/indexes. If the ORM cannot handle vector types, use `Unsupported("vector")` and a dedicated repository with parameterized SQL. Select an appropriate pgvector cosine index after verifying the installed extension/version. Model or dimension changes require a documented migration/reindex, one compatible active generation at a time, and a full corpus/request-vector rebuild. Even equal dimensions from different models must not mix. Query with model identity mismatch returns `INDEX_MODEL_MISMATCH`; no silent fallback.

## Retrieval and source contract

The authorized V1.3 stability repair retains one candidate per available AI-worker tick, with a 30-second call budget and a busy guard against overlapping background calls. Analysis, recommendation and operational generation retain their existing precedence. Request-vector scanning uses a circular request-ID cursor and advances it before inference, including when that candidate becomes stale; a changing request cannot indefinitely hide other eligible requests when the worker has backfill opportunities. The cursor/state are process-local, not a new durable queue or database schema.

| Backfill condition | State and resume behavior |
|---|---|
| Current context changes or request becomes CANCELED during inference (`STALE_CONTEXT`) | Request-local failure; READY with no global backoff. A later fair scan considers eligible current versions. |
| Retryable provider/network error, provider timeout or recognized database unavailability | RETRY_WAIT; 1/2/4-second exponential backoff capped at 60 seconds after failure completion. Each call remains bounded; periodic attempts resume automatically when the dependency recovers. A prolonged outage does not become a fake success. |
| Worker cancellation/shutdown (`KNOWLEDGE_CANCELED`) | STOPPED for the canceled call, no retry using its aborted signal. A later call with a fresh non-aborted lifecycle can resume. Shutdown waits for the current worker call to finish. |
| Non-retryable invalid vector, missing model, dimension or model-identity/configuration error | BLOCKED; no repeated background inference until operator correction/new instance. No fallback identity, model download or mixed vectors. |
| Unexpected exception | BLOCKED with safe code `REQUEST_EMBEDDING_UNAVAILABLE`, category UNEXPECTED and safe error type; retain the failing stage/correlation instead of treating it as a known stale or transient error. |

Safe deferred telemetry includes correlation ID, stage, request ID/context version where known, category/error type, code, state, failure count, next retry time, attempt timeout and maximum backoff. Recovery telemetry links the successful probe/scan/index to the prior safe error and failure count. It excludes input text, raw exception messages, credentials and connection details. The embedding adapter still permits at most two bounded attempts per invocation. A successful attempt clears the failure state without restarting the process. The originally swallowed demo exception remains unknown; controlled reproductions establish the failure modes repaired here without assigning its unrecorded type.

Inference occurs outside the publication transaction. Publication acquires the existing Request share lock, rechecks current version/eligibility and cancellation, and uses parameterized SQL plus the existing logical unique key to prevent stale inserts and duplicates. Failed/canceled attempts do not delete unrelated valid vectors or alter Request versions, business history, assignment, SLA or notifications. The probed identity is refreshed on eligible work after its 60-second cache; a changed digest/dimension is rejected, including a mismatch between probe and returned batch.

RAG readiness additionally checks all non-CANCELED requests for an embedding matching the current Request version, probed model identity/dimension and input version. Missing current vectors yield `rag.status=NOT_READY` with `REQUEST_INDEX_INCOMPLETE`, even when embedding is UP and the corpus is READY. A BLOCKED backfill exposes its safe error through RAG readiness. Refresh uses the existing 30-second cadence, so readiness is a timestamped observation rather than an instantaneous index counter. Core/manual API readiness and HTTP status retain the existing API contract; inspect the RAG field separately. These checks introduce no public response shape change and do not prove retrieval or recommendation quality.

searchKnowledge(query,topK) embeds the bounded query and performs a parameterized cosine-distance search filtered by READY document, active compatible generation and authorization. topK 1–5, default 5. Initial maximum accepted cosine distance 0.50 is a configurable demo starting point, not calibrated confidence; validate against M5 retrieval cases and record any tuning. Sort distance ascending then chunk ID; deduplicate before taking topK. Keep <=6,000 excerpt characters total, drawn exactly from persisted chunks; no generated replacements.

Source IDs use `KD-{documentId}-G{generation}-C{chunkIndex}`; they identify immutable chunks across reindexing and never get reassigned. Output contains sourceId/chunkId/documentId/generation/document title/pageNumber?/section?/excerpt/score and content hash. Title and location metadata come from storage. Model receives labeled evidence blocks such as `[SOURCE:KD-...-G1-C3]` and may reference only supplied IDs.

Persist the retrieval snapshot for each AiRun with IDs, generation, content hashes, query metadata, model identity and scores. The backend validates model citations against that run, resolves metadata itself and checks current permission/availability before publication and later fetch/approval. Reindex/disable invalidates live use of prior sources; historical audit can show them as unavailable without treating them as current instructions. A source API fetch returns an authorized excerpt/document/page metadata; it never opens a user-supplied URL/path.

No retrieval result means no source-backed answer. No fabricated page/section/title/source ID. Procedural suggestions need real source references per action; unknown citations invalidate output. On no evidence, return INSUFFICIENT_EVIDENCE and no procedural actions as specified in AI_BEHAVIOR_SPEC. On failed retrieval/index service, fail the dependent AI run with an actionable error; an outage is not a zero-result success.

## Security and audit

SOP text and uploaded filenames are untrusted data. Instruction-like text in them cannot change system prompts, tools, permissions or output validation. HTML is escaped; PDF delivery uses controlled content type/disposition and authorization, never inline unsafe HTML. Parameterize every vector/filter query; all ordering/filter keys are allowlisted. Audit upload, failure, promotion, reindex/reactivation, disable and retrieval tool metadata without logging full private content by default.

## Acceptance and evaluation

M5 must upload the real synthetic SOP-IOT-04 artifact, reach READY, retrieve stored chunks for IoT outage queries and show clickable real metadata. Verify TXT null pages, real PDF pages, chunk determinism/overlap, empty/corrupt/oversized documents, duplicate hash, disable while indexing, model/dimension mismatch, canceled worker publication, source fabrication, stale generation, permissions and no-results behavior. Use real PostgreSQL+pgvector for integration.

Create 20–30 manually labeled questions with expected document IDs and optional known page/section. Report Hit@1/3/5 (questions with expected doc in top k / total labeled questions), include misses/errors and exact embedding identity. Thresholds and vector scores do not establish correctness alone. No RAG accuracy or model availability is asserted in M0.
