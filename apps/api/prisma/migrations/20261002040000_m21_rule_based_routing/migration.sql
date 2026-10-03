CREATE TYPE "RoutingRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- Fixed enum data; no evaluation of expressions or dynamic object paths.
CREATE FUNCTION m21_valid_conditions(conditions JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE c JSONB; v JSONB; options TEXT[];
BEGIN
  IF jsonb_typeof(conditions) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(conditions) NOT BETWEEN 1 AND 10 THEN RETURN FALSE; END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(conditions) LOOP
    IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN FALSE; END IF;
    IF NOT (c ?& ARRAY['field','operator','values']) OR (c - ARRAY['field','operator','values']) <> '{}'::jsonb THEN RETURN FALSE; END IF;
    IF jsonb_typeof(c->'field') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'operator') IS DISTINCT FROM 'string' THEN RETURN FALSE; END IF;
    CASE c->>'field'
      WHEN 'category' THEN options := ARRAY['NETWORK','IOT','BILLING','ACCOUNT','SERVICE','OTHER'];
      WHEN 'subcategory' THEN options := ARRAY['IOT_CONNECTIVITY','MOBILE_NETWORK','DEVICE_CONFIGURATION','BILLING_DISCREPANCY','ACCESS_ISSUE','ACTIVATION','INTERNAL_SUPPORT','UNSPECIFIED'];
      WHEN 'priority' THEN options := ARRAY['LOW','MEDIUM','HIGH','URGENT'];
      ELSE RETURN FALSE;
    END CASE;
    IF c->>'operator' NOT IN ('EQ','IN') OR jsonb_typeof(c->'values') IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
    IF jsonb_array_length(c->'values') NOT BETWEEN 1 AND 20 OR (c->>'operator' = 'EQ' AND jsonb_array_length(c->'values') <> 1) THEN RETURN FALSE; END IF;
    FOR v IN SELECT * FROM jsonb_array_elements(c->'values') LOOP
      IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR NOT ((v #>> '{}') = ANY(options)) THEN RETURN FALSE; END IF;
    END LOOP;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE TABLE "RoutingRule" (
  "id" UUID PRIMARY KEY,
  "status" "RoutingRuleStatus" NOT NULL DEFAULT 'INACTIVE',
  "currentRevision" INTEGER NOT NULL DEFAULT 1 CHECK ("currentRevision" > 0),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  CHECK (("status" = 'ARCHIVED') = ("archivedAt" IS NOT NULL))
);
CREATE INDEX "RoutingRule_status_createdAt_id_idx" ON "RoutingRule"("status","createdAt","id");
CREATE TABLE "RoutingRuleRevision" (
  "id" UUID PRIMARY KEY,
  "ruleId" UUID NOT NULL REFERENCES "RoutingRule"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "name" VARCHAR(120) NOT NULL CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  "description" VARCHAR(500) CHECK ("description" IS NULL OR length(btrim("description")) BETWEEN 1 AND 500),
  "priority" INTEGER NOT NULL CHECK ("priority" BETWEEN 1 AND 10000),
  "targetTeamId" UUID NOT NULL REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "conditions" JSONB NOT NULL CHECK (m21_valid_conditions("conditions")),
  "createdById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoutingRuleRevision_ruleId_revision_key" UNIQUE ("ruleId","revision")
);
CREATE INDEX "RoutingRuleRevision_ruleId_createdAt_id_idx" ON "RoutingRuleRevision"("ruleId","createdAt","id");
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_current_fkey" FOREIGN KEY ("id","currentRevision")
  REFERENCES "RoutingRuleRevision"("ruleId","revision") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION m21_immutable_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Routing revisions are immutable' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER m21_revision_immutable BEFORE UPDATE OR DELETE ON "RoutingRuleRevision" FOR EACH ROW EXECUTE FUNCTION m21_immutable_revision();
CREATE FUNCTION m21_rule_lifecycle() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'ARCHIVED' OR NEW."id" IS DISTINCT FROM OLD."id" OR NEW."createdById" IS DISTINCT FROM OLD."createdById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR
    NEW."version" <> OLD."version" + 1 OR NEW."currentRevision" NOT BETWEEN OLD."currentRevision" AND OLD."currentRevision" + 1 OR
    (NEW."currentRevision" <> OLD."currentRevision" AND NEW."status" <> OLD."status") THEN
    RAISE EXCEPTION 'Invalid routing lifecycle change' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER m21_rule_lifecycle BEFORE UPDATE ON "RoutingRule" FOR EACH ROW EXECUTE FUNCTION m21_rule_lifecycle();
CREATE FUNCTION m21_revision_sequence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE rule_id UUID; current_revision INTEGER; revision_count INTEGER; last_revision INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'RoutingRule' THEN rule_id := NEW."id"; ELSE rule_id := NEW."ruleId"; END IF;
  SELECT "currentRevision" INTO STRICT current_revision FROM "RoutingRule" WHERE "id"=rule_id;
  SELECT count(*),max("revision") INTO revision_count,last_revision FROM "RoutingRuleRevision" WHERE "ruleId"=rule_id;
  IF revision_count <> current_revision OR last_revision <> current_revision THEN
    RAISE EXCEPTION 'Routing revisions must be contiguous and current' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER m21_parent_sequence AFTER INSERT OR UPDATE ON "RoutingRule" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m21_revision_sequence();
CREATE CONSTRAINT TRIGGER m21_child_sequence AFTER INSERT ON "RoutingRuleRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m21_revision_sequence();

REVOKE ALL ON "RoutingRule", "RoutingRuleRevision" FROM mobiflow_app;
GRANT SELECT,INSERT ON "RoutingRule", "RoutingRuleRevision" TO mobiflow_app;
GRANT UPDATE ("status","currentRevision","version","updatedAt","archivedAt") ON "RoutingRule" TO mobiflow_app;
