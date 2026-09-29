-- Real host probe: docs/verification/evidence/M6_EMBEDDING_PROBE.json.
-- Separate request-domain vectors, immutable by request version and input revision.
CREATE TABLE "RequestEmbedding" (
  "id" uuid PRIMARY KEY,
  "requestId" uuid NOT NULL REFERENCES "Request"("id") ON DELETE RESTRICT,
  "contextVersion" integer NOT NULL CHECK ("contextVersion" > 0),
  "modelIdentity" varchar(64) NOT NULL CHECK ("modelIdentity" ~ '^[0-9a-f]{64}$'),
  "dimension" integer NOT NULL CHECK ("dimension" = 1024),
  "inputVersion" varchar(80) NOT NULL,
  "inputHash" varchar(64) NOT NULL,
  "identityJson" jsonb NOT NULL,
  "embedding" vector(1024) NOT NULL CHECK (vector_norm("embedding") > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("requestId", "modelIdentity", "contextVersion", "inputVersion")
);
CREATE INDEX "RequestEmbedding_request_version" ON "RequestEmbedding"("requestId", "contextVersion");
-- Exact scoped search is used for this small synthetic corpus. No HNSW claim.
GRANT SELECT, INSERT ON "RequestEmbedding" TO mobiflow_app;
REVOKE UPDATE, DELETE ON "RequestEmbedding" FROM mobiflow_app;
