# M5 implementation checklist

Authorized 2026-09-28: M5 only. Stop before M6. Existing uncommitted M4 work is preserved; pre-edit file hashes/status are in ignored `artifacts/m5/baseline-*`.

## Acceptance extracted before implementation

- Master plan section 16: manager PDF/TXT upload, private storage, page-aware extraction, deterministic overlap, verified local embedding dimension before migration, parameterized vector retrieval, real source citations, manager lifecycle UI, request source preview, real synthetic SOP-IOT-04, and 20–30 labeled retrieval queries with Hit@1/3/5.
- RAG_SPEC: 10 MiB / 200 pages / 2,000,000 characters; UTF-8 TXT; no OCR/DOCX; fixed 1,200 code-point chunks with 200 overlap. Duplicate SHA-256 upload is 409. READY is atomic; PROCESSING/FAILED/DISABLED are excluded, including old generations. Reindex explicitly reactivates disabled sources. Immutable KD-{documentId}-G{generation}-C{chunkIndex} identities.
- Query topK 1–5; cosine distance <=0.50 initially; at most 6,000 excerpt characters. Same actual provider/tag/digest/dimension across corpus and queries. Unknown citations, stale sources and outage-as-empty are rejected. No-source result is INSUFFICIENT_EVIDENCE with no procedures.
- MANAGER manages files; MANAGER/STAFF read eligible sources; USER receives no internal sources. Recheck request version, initiator, source generation/availability at publication and source fetch. No tools, recommendation, assignment or M6 state transitions.
- Required gates: deterministic unit negatives; real PostgreSQL/migration/vector/races; live embedding/retrieval/RAG; offline/manual path; M3/M4 regression; real browser sources/lifecycle; native and Docker; dependency audit; diff check; section-34 verification report.

## Implementation plan and clarifications

1. Verify actual host embedding model/dimension, then add a forward migration to existing KnowledgeChunk (M2 has no embeddings and sourceId is incorrectly UUID for the frozen KD contract). Preserve all original migrations/data.
2. Add provider, bounded PDF worker/parser, centralized chunker, private file store, document service/worker, vector repository/retriever and evidence validation.
3. Preserve strict `analysis.v1`. For M5's real cited-response gate, an optional RAG execution envelope wraps that exact analysis plus source IDs and exact quotes; validated citations live in existing AiRun.safeResultJson and retrievalSnapshotJson. No recommendation/actions/tool layer. Non-RAG execution stays explicit and available; failed enabled RAG fails intake safely rather than silently falling back.
4. Add contracts/controller/knowledge UI and authorized source preview, runtime scripts, synthetic corpus and fixed labels before predictions.
5. Verify, correct failures, write exact evidence and stop at M5.

## Risks to verify

PDF resource limits and invalid content; partial embedding failure; equal-dimension different model; source disable/reindex during inference; duplicate upload/reindex races; empty corpus versus failed dependency; private source projection; immutable historical sources; caller abort and expired leases; migration on clean and existing DB; UI stale data after access loss.

The frozen spec overrides the prompt's illustrative old-generation fallback: reindex excludes old generations and failure leaves FAILED. No PUT/replace-document endpoint exists in V1: changed file bytes are a new document, while reindex makes a new generation of the same immutable original file.
