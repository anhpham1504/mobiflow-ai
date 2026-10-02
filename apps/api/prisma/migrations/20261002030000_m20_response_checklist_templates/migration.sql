CREATE TYPE "OperationalTemplateType" AS ENUM ('RESPONSE', 'CHECKLIST');
CREATE TYPE "OperationalTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "OperationalTemplate" (
  "id" UUID NOT NULL PRIMARY KEY,
  "type" "OperationalTemplateType" NOT NULL,
  "status" "OperationalTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "name" VARCHAR(120) NOT NULL CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  "description" VARCHAR(500) CHECK ("description" IS NULL OR length(btrim("description")) BETWEEN 1 AND 500),
  "currentRevision" INTEGER NOT NULL DEFAULT 1 CHECK ("currentRevision" > 0),
  "createdById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  CHECK (("status" = 'ACTIVE' AND "archivedAt" IS NULL) OR ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL))
);
CREATE INDEX "OperationalTemplate_status_type_createdAt_id_idx" ON "OperationalTemplate"("status", "type", "createdAt", "id");

CREATE TABLE "OperationalTemplateRevision" (
  "id" UUID NOT NULL PRIMARY KEY,
  "templateId" UUID NOT NULL REFERENCES "OperationalTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "name" VARCHAR(120) NOT NULL CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  "description" VARCHAR(500) CHECK ("description" IS NULL OR length(btrim("description")) BETWEEN 1 AND 500),
  "body" VARCHAR(4000) CHECK ("body" IS NULL OR length(btrim("body")) BETWEEN 1 AND 4000),
  "itemCount" INTEGER NOT NULL CHECK ("itemCount" BETWEEN 0 AND 30),
  "createdById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalTemplateRevision_templateId_revision_key" UNIQUE ("templateId", "revision")
);
CREATE INDEX "OperationalTemplateRevision_templateId_createdAt_id_idx" ON "OperationalTemplateRevision"("templateId", "createdAt", "id");
ALTER TABLE "OperationalTemplate" ADD CONSTRAINT "OperationalTemplate_current_fkey"
  FOREIGN KEY ("id", "currentRevision") REFERENCES "OperationalTemplateRevision"("templateId", "revision")
  ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE "OperationalTemplateChecklistItemRevision" (
  "revisionId" UUID NOT NULL REFERENCES "OperationalTemplateRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 1 AND 30),
  "text" VARCHAR(500) NOT NULL CHECK (length(btrim("text")) BETWEEN 1 AND 500),
  "required" BOOLEAN NOT NULL,
  PRIMARY KEY ("revisionId", "position")
);

ALTER TABLE "Request" ADD COLUMN "manualDraftSourceTemplateRevisionId" UUID REFERENCES "OperationalTemplateRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RequestMessage" ADD COLUMN "sourceTemplateRevisionId" UUID REFERENCES "OperationalTemplateRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Checklist" ADD COLUMN "sourceTemplateRevisionId" UUID REFERENCES "OperationalTemplateRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Historical snapshots cannot be edited even by the migration owner through DML.
CREATE FUNCTION m20_immutable_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Template revision snapshots are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER m20_revision_immutable BEFORE UPDATE OR DELETE ON "OperationalTemplateRevision" FOR EACH ROW EXECUTE FUNCTION m20_immutable_snapshot();
CREATE TRIGGER m20_item_immutable BEFORE UPDATE OR DELETE ON "OperationalTemplateChecklistItemRevision" FOR EACH ROW EXECUTE FUNCTION m20_immutable_snapshot();

CREATE FUNCTION m20_template_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'ARCHIVED' OR
    NEW."id" IS DISTINCT FROM OLD."id" OR NEW."type" IS DISTINCT FROM OLD."type" OR
    NEW."createdById" IS DISTINCT FROM OLD."createdById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR
    NEW."currentRevision" < OLD."currentRevision" OR NEW."currentRevision" > OLD."currentRevision" + 1 OR
    (NEW."status" = 'ARCHIVED' AND NEW."currentRevision" <> OLD."currentRevision") THEN
    RAISE EXCEPTION 'Invalid template lifecycle change' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER m20_template_identity BEFORE UPDATE ON "OperationalTemplate" FOR EACH ROW EXECUTE FUNCTION m20_template_identity();

-- Deferred checks allow template + revision + ordered items to be inserted atomically.
CREATE FUNCTION m20_template_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  template_id UUID;
  t "OperationalTemplate"%ROWTYPE;
  r "OperationalTemplateRevision"%ROWTYPE;
  item_count INTEGER;
  last_position INTEGER;
  revision_count INTEGER;
  last_revision INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'OperationalTemplate' THEN template_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'OperationalTemplateRevision' THEN template_id := NEW."templateId";
  ELSE SELECT "templateId" INTO template_id FROM "OperationalTemplateRevision" WHERE "id" = NEW."revisionId";
  END IF;
  SELECT * INTO STRICT t FROM "OperationalTemplate" WHERE "id" = template_id;
  SELECT count(*), max("revision") INTO revision_count, last_revision FROM "OperationalTemplateRevision" WHERE "templateId" = template_id;
  IF revision_count <> t."currentRevision" OR last_revision <> t."currentRevision" THEN
    RAISE EXCEPTION 'Invalid template revision sequence' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT r FROM "OperationalTemplateRevision" WHERE "templateId" = template_id AND "revision" = t."currentRevision";
  IF r."name" IS DISTINCT FROM t."name" OR r."description" IS DISTINCT FROM t."description" THEN
    RAISE EXCEPTION 'Template metadata must match its current snapshot' USING ERRCODE = '23514';
  END IF;
  FOR r IN SELECT * FROM "OperationalTemplateRevision" WHERE "templateId" = template_id LOOP
    SELECT count(*), max("position") INTO item_count, last_position FROM "OperationalTemplateChecklistItemRevision" WHERE "revisionId" = r."id";
    IF item_count <> r."itemCount" OR (t."type" = 'RESPONSE' AND (r."body" IS NULL OR item_count <> 0)) OR
       (t."type" = 'CHECKLIST' AND (r."body" IS NOT NULL OR item_count NOT BETWEEN 1 AND 30 OR last_position <> item_count)) THEN
      RAISE EXCEPTION 'Invalid template content shape or order' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER m20_template_integrity AFTER INSERT OR UPDATE ON "OperationalTemplate" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m20_template_integrity();
CREATE CONSTRAINT TRIGGER m20_revision_integrity AFTER INSERT ON "OperationalTemplateRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m20_template_integrity();
CREATE CONSTRAINT TRIGGER m20_item_integrity AFTER INSERT ON "OperationalTemplateChecklistItemRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m20_template_integrity();

REVOKE ALL ON "OperationalTemplate", "OperationalTemplateRevision", "OperationalTemplateChecklistItemRevision" FROM mobiflow_app;
GRANT SELECT, INSERT ON "OperationalTemplate", "OperationalTemplateRevision", "OperationalTemplateChecklistItemRevision" TO mobiflow_app;
GRANT UPDATE ("name", "description", "status", "currentRevision", "updatedAt", "archivedAt") ON "OperationalTemplate" TO mobiflow_app;
