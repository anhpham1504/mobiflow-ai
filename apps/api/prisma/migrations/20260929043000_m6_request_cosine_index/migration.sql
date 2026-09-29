-- Complete DATABASE_SPEC's declared cosine index without editing the already
-- applied immutable M6 table migration. Small-corpus queries remain exact/scoped.
CREATE INDEX "RequestEmbedding_cosine_hnsw" ON "RequestEmbedding"
USING hnsw (embedding vector_cosine_ops);
