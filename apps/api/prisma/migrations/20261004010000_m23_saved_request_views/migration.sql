CREATE TABLE "SavedRequestView" (
  "id" UUID NOT NULL PRIMARY KEY,
  "ownerUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 80 AND "name" = btrim("name")),
  "normalizedName" TEXT NOT NULL CHECK (char_length("normalizedName") BETWEEN 1 AND 160),
  "schemaVersion" VARCHAR(80) NOT NULL,
  "filters" JSONB NOT NULL CHECK (jsonb_typeof("filters") = 'object'),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SavedRequestView_ownerUserId_normalizedName_key" ON "SavedRequestView"("ownerUserId", "normalizedName");
CREATE INDEX "SavedRequestView_ownerUserId_createdAt_id_idx" ON "SavedRequestView"("ownerUserId", "createdAt" DESC, "id" DESC);
REVOKE ALL ON "SavedRequestView" FROM mobiflow_app;
GRANT SELECT, INSERT, DELETE ON "SavedRequestView" TO mobiflow_app;
GRANT UPDATE ("name", "normalizedName", "schemaVersion", "filters", "version", "updatedAt") ON "SavedRequestView" TO mobiflow_app;
