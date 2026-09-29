-- D=1024 verified by real Ollama bge-m3:latest probe before authoring this migration.
-- Evidence: docs/verification/evidence/M5_EMBEDDING_PROBE.json. Existing rows are retained.
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "sourceId" TYPE varchar(120) USING "sourceId"::text;
ALTER TABLE "KnowledgeChunk" ADD COLUMN "modelIdentity" varchar(64), ADD COLUMN "dimension" integer, ADD COLUMN "embedding" vector(1024);
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_embedding_identity_check" CHECK (
  ("embedding" IS NULL AND "dimension" IS NULL AND "modelIdentity" IS NULL) OR
  ("embedding" IS NOT NULL AND "dimension" = 1024 AND "modelIdentity" ~ '^[0-9a-f]{64}$' AND vector_norm("embedding") > 0)
);
CREATE INDEX "KnowledgeChunk_embedding_cosine_hnsw" ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
-- Chunks are immutable generations; application may INSERT and SELECT, never rewrite history.
REVOKE UPDATE, DELETE ON "KnowledgeChunk" FROM mobiflow_app;
-- Rollback (operator-only, after backup): drop index/constraint/new columns. Do NOT cast
-- sourceId back to UUID after ingestion: KD provenance must be preserved in any rollback.
