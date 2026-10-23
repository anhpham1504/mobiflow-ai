-- Additive lexical retrieval support. Existing pgvector columns, indexes and rows
-- are intentionally retained for the documented rollback profile.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION mobiflow_unaccent(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$ SELECT public.unaccent('public.unaccent', value) $$;

CREATE INDEX "KnowledgeChunk_content_fts_simple_gin"
ON "KnowledgeChunk" USING gin (to_tsvector('simple', mobiflow_unaccent(content)));

CREATE INDEX "KnowledgeChunk_content_trgm_gin"
ON "KnowledgeChunk" USING gin (mobiflow_unaccent(content) gin_trgm_ops);

CREATE INDEX "KnowledgeDocument_title_trgm_gin"
ON "KnowledgeDocument" USING gin (mobiflow_unaccent(title) gin_trgm_ops);

GRANT EXECUTE ON FUNCTION mobiflow_unaccent(text) TO mobiflow_app;
