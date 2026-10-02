-- Private child resource: no workflow/history/AI/notification fields are changed.
CREATE TABLE "RequestInternalNote" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestInternalNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RequestInternalNote_body_check" CHECK (char_length("body") BETWEEN 1 AND 4000 AND "body" ~ '[^[:space:]]')
);

CREATE INDEX "RequestInternalNote_requestId_createdAt_id_idx" ON "RequestInternalNote"("requestId", "createdAt", "id");
ALTER TABLE "RequestInternalNote" ADD CONSTRAINT "RequestInternalNote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestInternalNote" ADD CONSTRAINT "RequestInternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Override the historical default CRUD grant: operational notes are append-only.
GRANT SELECT, INSERT ON TABLE "RequestInternalNote" TO mobiflow_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "RequestInternalNote" FROM mobiflow_app;
