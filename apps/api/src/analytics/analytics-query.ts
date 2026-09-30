import {copilotActions,dashboardTimeZone,priorities,statuses,type AnalyticsQuery} from '@mobiflow/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {slaElapsedSql,slaStateSql} from '../requests/sla-sql.js';

// SQL identifiers are static. Every date/filter/enum value is a bound parameter.
export function analyticsQuery(query:AnalyticsQuery,at?:Date):Prisma.Sql{
  const days=query.windowDays?Number(query.windowDays):Number((query.preset??'30d').slice(0,-1));
  const filters=[Prisma.sql`TRUE`];
  if(query.priority)filters.push(Prisma.sql`r.priority=${query.priority}::"Priority"`);
  if(query.status)filters.push(Prisma.sql`r.status=${query.status}::"RequestStatus"`);
  if(query.category)filters.push(Prisma.sql`r.category=${query.category}`);
  if(query.teamId)filters.push(Prisma.sql`r."teamId"=${query.teamId}::uuid`);
  const distribution=(field:Prisma.Sql,values:readonly string[])=>Prisma.sql`jsonb_build_object(${Prisma.join(values.flatMap(value=>[Prisma.sql`${value}::text`,Prisma.sql`COUNT(*) FILTER (WHERE ${field}=${value})::int`]))})`;
  return Prisma.sql`WITH instant AS (
    SELECT ${at?Prisma.sql`${at}::timestamptz`:Prisma.sql`statement_timestamp()`} AS "asOf"
  ), dates AS (
    SELECT "asOf",COALESCE(${query.from??null}::date,("asOf" AT TIME ZONE ${dashboardTimeZone})::date+1-${days}::int) AS "fromDate",
      COALESCE(${query.to??null}::date,("asOf" AT TIME ZONE ${dashboardTimeZone})::date+1) AS "toDate" FROM instant
  ), clock AS (
    SELECT *,"fromDate"::timestamp AT TIME ZONE ${dashboardTimeZone} AS "from",
      "toDate"::timestamp AT TIME ZONE ${dashboardTimeZone} AS "to" FROM dates
  ), matched AS MATERIALIZED (
    SELECT r.id,r.status,r.priority,r."createdAt",r."resolvedAt",r."closedAt" FROM "Request" r WHERE ${Prisma.join(filters,' AND ')}
  ), created AS (
    SELECT r.* FROM matched r CROSS JOIN clock WHERE r."createdAt">=clock."from" AND r."createdAt"<clock."to"
  ), resolutions AS (
    SELECT e."requestId",e."resolvedAt",e."reopenedAt" FROM "RequestResolution" e JOIN matched r ON r.id=e."requestId" CROSS JOIN clock
      WHERE e."resolvedAt">=clock."from" AND e."resolvedAt"<clock."to" AND e."resolvedAt">=r."createdAt"
  ), resolved AS (
    SELECT COUNT(DISTINCT "requestId")::int AS count,
      COUNT(DISTINCT "requestId") FILTER (WHERE "reopenedAt">="resolvedAt" AND "reopenedAt"<LEAST(clock."to",clock."asOf"))::int AS reopened
      FROM resolutions CROSS JOIN clock
  ), completed_sla AS (
    SELECT ${slaStateSql} AS state,${slaElapsedSql}::double precision AS elapsed,
      EXTRACT(EPOCH FROM (r."resolvedAt"-r."createdAt"))::double precision AS wall
    FROM matched r JOIN "SlaInstance" s ON s."requestId"=r.id CROSS JOIN clock
    WHERE r.status IN ('RESOLVED','CLOSED') AND r."resolvedAt">=clock."from" AND r."resolvedAt"<clock."to"
      AND r."resolvedAt">=r."createdAt" AND s."resolvedHoldAt" IS NOT NULL AND s."pausedAt" IS NULL
      AND COALESCE(s."stopReason",'')<>'CANCELED' AND s."targetSeconds">0
      AND s."totalPausedSeconds">=0 AND s."totalResolvedHoldSeconds">=0
      AND s."startedAt">=date_trunc('second',r."createdAt") AND (s."stoppedAt" IS NULL OR s."stoppedAt">=s."resolvedHoldAt")
      AND date_trunc('second',s."resolvedHoldAt")=date_trunc('second',r."resolvedAt")
      AND EXTRACT(EPOCH FROM date_trunc('second',s."resolvedHoldAt")-date_trunc('second',s."startedAt"))>=s."totalPausedSeconds"+s."totalResolvedHoldSeconds"
  ), sla AS (
    SELECT COUNT(*)::int AS eligible,COUNT(*) FILTER (WHERE state='MET')::int AS met,
      COUNT(*) FILTER (WHERE state='BREACHED')::int AS breached,AVG(elapsed) AS average,AVG(wall) AS wall
      FROM completed_sla WHERE state IN ('MET','BREACHED')
  ), feedback AS (
    SELECT f.rating FROM "Feedback" f JOIN matched r ON r.id=f."requestId" CROSS JOIN clock WHERE f."createdAt">=clock."from" AND f."createdAt"<clock."to"
  ), generated AS (
    SELECT COUNT(*)::int AS count FROM "AiRecommendation" a JOIN matched r ON r.id=a."requestId" CROSS JOIN clock WHERE a."createdAt">=clock."from" AND a."createdAt"<clock."to"
  ), decisions AS (
    SELECT COUNT(*)::int AS denominator,COUNT(*) FILTER (WHERE a.status='ACCEPTED')::int AS accepted,
      COUNT(*) FILTER (WHERE a.status='MODIFIED')::int AS modified,COUNT(*) FILTER (WHERE a.status='REJECTED')::int AS rejected
    FROM "AiRecommendation" a JOIN matched r ON r.id=a."requestId" CROSS JOIN clock
      WHERE a.status IN ('ACCEPTED','MODIFIED','REJECTED') AND a."reviewedById" IS NOT NULL AND a."invalidatedAt" IS NULL
        AND a."reviewedAt">=clock."from" AND a."reviewedAt"<clock."to"
  ), runs AS MATERIALIZED (
    SELECT a.purpose,a.action,a.status,a.model,a."promptVersion",a."schemaVersion",a."latencyMs",a."retryCount",a."errorCode"
    FROM "AiRun" a JOIN matched r ON r.id=a."requestId" CROSS JOIN clock WHERE a."createdAt">=clock."from" AND a."createdAt"<clock."to"
  ), run_stats AS (
    SELECT jsonb_build_object('total',COUNT(*)::int,'succeeded',COUNT(*) FILTER (WHERE status='SUCCEEDED')::int,'failed',COUNT(*) FILTER (WHERE status='FAILED')::int,
      'firstAttemptValid',COUNT(*) FILTER (WHERE status='SUCCEEDED' AND "retryCount"=0)::int,'repairedSuccess',COUNT(*) FILTER (WHERE status='SUCCEEDED' AND "retryCount">0)::int,
      'averageAttempts',AVG("retryCount"+1)::double precision,'averageLatencyMs',AVG("latencyMs") FILTER (WHERE "latencyMs">=0)::double precision,
      'p50LatencyMs',percentile_disc(0.5) WITHIN GROUP (ORDER BY "latencyMs") FILTER (WHERE "latencyMs">=0),
      'p95LatencyMs',percentile_disc(0.95) WITHIN GROUP (ORDER BY "latencyMs") FILTER (WHERE "latencyMs">=0)) AS data FROM runs
  ), copilot AS MATERIALIZED (
    SELECT * FROM runs WHERE purpose='COPILOT'
  ), copilot_actions AS (
    SELECT jsonb_agg(jsonb_build_object('action',action,'runs',total,'succeeded',succeeded,'failed',failed,'canceled',canceled,'pending',pending) ORDER BY ordinal) AS data
    FROM (SELECT action_names.action,action_names.ordinal,COUNT(c.purpose)::int AS total,
      COUNT(c.purpose) FILTER (WHERE c.status='SUCCEEDED')::int AS succeeded,COUNT(c.purpose) FILTER (WHERE c.status='FAILED')::int AS failed,
      COUNT(c.purpose) FILTER (WHERE c.status='CANCELED')::int AS canceled,COUNT(c.purpose) FILTER (WHERE c.status IN ('QUEUED','RUNNING'))::int AS pending
      FROM unnest(ARRAY[${Prisma.join(copilotActions.map(action=>Prisma.sql`${action}::text`))}]) WITH ORDINALITY AS action_names(action,ordinal)
      LEFT JOIN copilot c ON c.action=action_names.action GROUP BY action_names.action,action_names.ordinal) grouped
  ), created_days AS (
    SELECT ("createdAt" AT TIME ZONE ${dashboardTimeZone})::date AS day,COUNT(*)::int AS count FROM created GROUP BY day
  ), resolved_days AS (
    SELECT ("resolvedAt" AT TIME ZONE ${dashboardTimeZone})::date AS day,COUNT(DISTINCT "requestId")::int AS count FROM resolutions GROUP BY day
  ), trends AS (
    SELECT jsonb_agg(jsonb_build_object('date',to_char(clock."fromDate"+day.n,'YYYY-MM-DD'),'createdCount',COALESCE(c.count,0),'resolvedCount',COALESCE(r.count,0)) ORDER BY day.n) AS data
    FROM clock CROSS JOIN LATERAL generate_series(0,clock."toDate"-clock."fromDate"-1) AS day(n)
      LEFT JOIN created_days c ON c.day=clock."fromDate"+day.n LEFT JOIN resolved_days r ON r.day=clock."fromDate"+day.n
  ), legacy_sla AS (
    SELECT ${slaStateSql} AS state FROM created r JOIN "SlaInstance" s ON s."requestId"=r.id CROSS JOIN clock WHERE r.status<>'CANCELED'
  )
  SELECT to_char(clock."asOf" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "asOf",
    to_char(clock."from" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "from",
    to_char(clock."to" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "to",
    to_char(clock."fromDate",'YYYY-MM-DD') AS "fromDate",to_char(clock."toDate",'YYYY-MM-DD') AS "toDate",(clock."toDate"-clock."fromDate")::int AS days,
    (SELECT jsonb_build_object('requestVolume',COUNT(*)::int,'createdCount',COUNT(*)::int,'resolvedCount',resolved.count,
      'closedCount',(SELECT COUNT(*)::int FROM matched WHERE "closedAt">=clock."from" AND "closedAt"<clock."to" AND "closedAt">="createdAt"),
      'statusDistribution',${distribution(Prisma.sql`status::text`,statuses)},'priorityDistribution',${distribution(Prisma.sql`priority::text`,priorities)}) FROM created) AS operations,
    jsonb_build_object('slaEligibleCount',sla.eligible,'slaMetCount',sla.met,'slaBreachedCount',sla.breached,'slaComplianceRate',sla.met::double precision/NULLIF(sla.eligible,0),
      'averageResolutionSeconds',sla.average,'averageWallClockResolutionSeconds',sla.wall) AS sla,
    jsonb_build_object('reopenedRequestCount',resolved.reopened,'resolvedRequestCount',resolved.count,'reopenRate',resolved.reopened::double precision/NULLIF(resolved.count,0)) AS reopen,
    (SELECT jsonb_build_object('feedbackCount',COUNT(*)::int,'averageFeedbackScore',AVG(rating)::double precision,'feedbackDistribution',${distribution(Prisma.sql`rating::text`,['1','2','3','4','5'])}) FROM feedback) AS feedback,
    jsonb_build_object('runs',run_stats.data,
      'byPurpose',COALESCE((SELECT jsonb_object_agg(key,total) FROM (SELECT purpose::text AS key,COUNT(*)::int AS total FROM runs GROUP BY purpose) g),'{}'::jsonb),
      'byModel',COALESCE((SELECT jsonb_object_agg(key,total) FROM (SELECT COALESCE(model,'UNKNOWN') AS key,COUNT(*)::int AS total FROM runs GROUP BY key) g),'{}'::jsonb),
      'byVersion',COALESCE((SELECT jsonb_object_agg(key,total) FROM (SELECT "promptVersion"||' / '||"schemaVersion" AS key,COUNT(*)::int AS total FROM runs GROUP BY key) g),'{}'::jsonb),
      'failures',COALESCE((SELECT jsonb_object_agg(key,total) FROM (SELECT COALESCE("errorCode",'UNCLASSIFIED') AS key,COUNT(*)::int AS total FROM runs WHERE status='FAILED' GROUP BY key) g),'{}'::jsonb),
      'recommendations',jsonb_build_object('generated',generated.count,'accepted',decisions.accepted,'modified',decisions.modified,'rejected',decisions.rejected,'denominator',decisions.denominator,
        'acceptanceRate',decisions.accepted::double precision/NULLIF(decisions.denominator,0),'modificationRate',decisions.modified::double precision/NULLIF(decisions.denominator,0),'rejectionRate',decisions.rejected::double precision/NULLIF(decisions.denominator,0))) AS ai,
    (SELECT jsonb_build_object('copilotRuns',COUNT(*)::int,'successfulCopilotRuns',COUNT(*) FILTER (WHERE status='SUCCEEDED')::int,'failedCopilotRuns',COUNT(*) FILTER (WHERE status='FAILED')::int,
      'canceledCopilotRuns',COUNT(*) FILTER (WHERE status='CANCELED')::int,'pendingCopilotRuns',COUNT(*) FILTER (WHERE status IN ('QUEUED','RUNNING'))::int,
      'unclassifiedRuns',COUNT(*) FILTER (WHERE action IS NULL OR action NOT IN (${Prisma.join(copilotActions)}))::int,'copilotRunsByAction',copilot_actions.data) FROM copilot) AS copilot,
    trends.data AS trends,
    jsonb_build_object('teams',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) ORDER BY code) FROM "Team"),'[]'::jsonb)) AS "filterOptions",
    jsonb_build_object('requests',jsonb_build_object('created',(SELECT COUNT(*)::int FROM created),
      'open',(SELECT COUNT(*)::int FROM matched WHERE status NOT IN ('CLOSED','CANCELED')),
      'highUrgent',(SELECT COUNT(*)::int FROM matched WHERE status NOT IN ('CLOSED','CANCELED') AND priority IN ('HIGH','URGENT')),
      'resolved',(SELECT COUNT(*)::int FROM matched WHERE "resolvedAt">=clock."from" AND "resolvedAt"<clock."to"),
      'averageResolutionSeconds',(SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt"-"createdAt")))::double precision FROM matched WHERE "resolvedAt">=clock."from" AND "resolvedAt"<clock."to" AND "resolvedAt">="createdAt")),
      'sla',(SELECT jsonb_build_object('atRisk',COUNT(*) FILTER (WHERE state='AT_RISK')::int,'breached',COUNT(*) FILTER (WHERE state='BREACHED')::int,'met',COUNT(*) FILTER (WHERE state='MET')::int,'denominator',COUNT(*)::int) FROM legacy_sla)) AS overview
  FROM clock CROSS JOIN resolved CROSS JOIN sla CROSS JOIN generated CROSS JOIN decisions CROSS JOIN run_stats CROSS JOIN copilot_actions CROSS JOIN trends`;
}
