CREATE TYPE "SlaOperationalAlertType" AS ENUM ('SLA_REMINDER','SLA_AT_RISK_ESCALATION','SLA_BREACH_ESCALATION');
CREATE UNIQUE INDEX "SlaInstance_requestId_id_key" ON "SlaInstance"("requestId","id");
CREATE TABLE "SlaOperationalAlert" (
  "id" UUID PRIMARY KEY,
  "requestId" UUID NOT NULL REFERENCES "Request"("id") ON DELETE RESTRICT,
  "slaInstanceId" UUID NOT NULL,
  "dimension" VARCHAR(40) NOT NULL CHECK ("dimension" = 'RESOLUTION'),
  "eventType" "SlaOperationalAlertType" NOT NULL,
  "thresholdKey" VARCHAR(80) NOT NULL,
  "canonicalState" "SlaStatus" NOT NULL,
  "deadlineAt" TIMESTAMPTZ(6) NOT NULL,
  "elapsedSeconds" INTEGER NOT NULL CHECK ("elapsedSeconds" >= 0),
  "remainingSeconds" INTEGER NOT NULL,
  "targetSeconds" INTEGER NOT NULL CHECK ("targetSeconds" > 0),
  "observedAt" TIMESTAMPTZ(6) NOT NULL,
  "configIdentity" VARCHAR(200) NOT NULL CHECK (length("configIdentity") > 0),
  "eventId" UUID NOT NULL UNIQUE REFERENCES "AuditLog"("id") ON DELETE RESTRICT,
  CONSTRAINT "SlaOperationalAlert_instance_fkey" FOREIGN KEY ("requestId","slaInstanceId") REFERENCES "SlaInstance"("requestId","id") ON DELETE RESTRICT,
  CONSTRAINT "SlaOperationalAlert_snapshot_check" CHECK ("remainingSeconds" = "targetSeconds" - "elapsedSeconds"),
  CONSTRAINT "SlaOperationalAlert_level_check" CHECK (
    ("eventType"='SLA_REMINDER' AND "thresholdKey"='EARLY_REMINDER_PRIMARY' AND "canonicalState"='SAFE') OR
    ("eventType"='SLA_AT_RISK_ESCALATION' AND "thresholdKey"='CANONICAL_AT_RISK' AND "canonicalState"='AT_RISK') OR
    ("eventType"='SLA_BREACH_ESCALATION' AND "thresholdKey"='CANONICAL_BREACH' AND "canonicalState"='BREACHED'))
);
CREATE UNIQUE INDEX "SlaOperationalAlert_cycle_level_key" ON "SlaOperationalAlert"("requestId","slaInstanceId","dimension","eventType","thresholdKey");
ALTER TABLE "Notification" ADD COLUMN "slaAlertId" UUID REFERENCES "SlaOperationalAlert"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "Notification_slaAlertId_recipientId_key" ON "Notification"("slaAlertId","recipientId");
CREATE TABLE "SlaAlertScanProgress" (
  "id" VARCHAR(40) PRIMARY KEY CHECK ("id"='M22_PRIMARY'),
  "cursorId" UUID,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
INSERT INTO "SlaAlertScanProgress"("id") VALUES ('M22_PRIMARY');
CREATE FUNCTION m22_immutable_alert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SLA operational observations are immutable' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER "SlaOperationalAlert_immutable" BEFORE UPDATE OR DELETE ON "SlaOperationalAlert" FOR EACH ROW EXECUTE FUNCTION m22_immutable_alert();
CREATE FUNCTION m22_notification_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "SlaOperationalAlert";
BEGIN
  IF NEW."slaAlertId" IS NOT NULL THEN
    SELECT * INTO a FROM "SlaOperationalAlert" WHERE "id"=NEW."slaAlertId";
    IF a."id" IS NULL OR NEW."requestId" IS DISTINCT FROM a."requestId" OR NEW."slaInstanceId" IS DISTINCT FROM a."slaInstanceId" OR NEW."eventId" IS DISTINCT FROM a."eventId" OR
      NEW."type" IS DISTINCT FROM (CASE a."eventType" WHEN 'SLA_REMINDER' THEN 'SLA_REMINDER' WHEN 'SLA_AT_RISK_ESCALATION' THEN 'SLA_AT_RISK' ELSE 'SLA_BREACHED' END) OR
      NEW."warningLevel" IS DISTINCT FROM (CASE a."eventType" WHEN 'SLA_REMINDER' THEN 'REMINDER' WHEN 'SLA_AT_RISK_ESCALATION' THEN 'AT_RISK' ELSE 'BREACHED' END) THEN
      RAISE EXCEPTION 'Invalid SLA notification source' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Notification_sla_source" BEFORE INSERT OR UPDATE ON "Notification" FOR EACH ROW EXECUTE FUNCTION m22_notification_source();
REVOKE ALL ON "SlaOperationalAlert","SlaAlertScanProgress" FROM mobiflow_app;
GRANT SELECT,INSERT ON "SlaOperationalAlert" TO mobiflow_app;
GRANT SELECT ON "SlaAlertScanProgress" TO mobiflow_app;
GRANT UPDATE ("cursorId","version","updatedAt") ON "SlaAlertScanProgress" TO mobiflow_app;
