import {z} from 'zod';
import {categories,copilotActions,priorities,statuses} from './workflow.js';
import {dashboardTimeZone} from './dashboard.js';

export const analyticsPresets=['7d','30d','90d'] as const;
export const analyticsMaxDays=365;
const calendarDate=z.iso.date().refine(value=>!value.startsWith('0000-'),{message:'Calendar year must be at least 0001'});
export const analyticsQuerySchema=z.object({
  preset:z.enum(analyticsPresets).optional(),
  from:calendarDate.optional(),to:calendarDate.optional(),
  windowDays:z.string().regex(/^[1-9]\d{0,2}$/).refine(value=>Number(value)<=analyticsMaxDays).optional(),
  priority:z.enum(priorities).optional(),status:z.enum(statuses).optional(),
  category:z.enum(categories).optional(),teamId:z.uuid().optional(),
}).strict().superRefine((query,context)=>{
  const custom=query.from!==undefined||query.to!==undefined;
  if(custom&&(!query.from||!query.to))context.addIssue({code:'custom',path:['from'],message:'Both from and to are required'});
  if((custom&&(query.preset!==undefined||query.windowDays!==undefined))||(query.preset!==undefined&&query.windowDays!==undefined))context.addIssue({code:'custom',path:['preset'],message:'Choose a preset or custom range'});
  if(query.from&&query.to){const days=(Date.parse(query.to)-Date.parse(query.from))/86400000;if(!(days>0&&days<=analyticsMaxDays))context.addIssue({code:'custom',path:['to'],message:'Range must be 1–365 days, from inclusive and to exclusive'});}
});
export type AnalyticsQuery=z.infer<typeof analyticsQuerySchema>;
const count=z.number().int().nonnegative();
const rate=z.number().min(0).max(1).nullable();
const average=z.number().nonnegative().nullable();
export const analyticsPeriodSchema=z.object({
  asOf:z.iso.datetime(),from:z.iso.datetime(),to:z.iso.datetime(),fromDate:z.iso.date(),toDate:z.iso.date(),
  days:z.number().int().min(1).max(analyticsMaxDays),timeZone:z.literal(dashboardTimeZone),granularity:z.literal('day'),
}).strict();
export const operationsAnalyticsSchema=z.object({requestVolume:count,createdCount:count,resolvedCount:count,closedCount:count,statusDistribution:z.record(z.enum(statuses),count),priorityDistribution:z.record(z.enum(priorities),count)}).strict();
export const slaAnalyticsSchema=z.object({slaEligibleCount:count,slaMetCount:count,slaBreachedCount:count,slaComplianceRate:rate,averageResolutionSeconds:average,averageWallClockResolutionSeconds:average}).strict();
export const reopenAnalyticsSchema=z.object({reopenedRequestCount:count,resolvedRequestCount:count,reopenRate:rate}).strict();
export const feedbackAnalyticsSchema=z.object({feedbackCount:count,averageFeedbackScore:z.number().min(1).max(5).nullable(),feedbackDistribution:z.object({'1':count,'2':count,'3':count,'4':count,'5':count}).strict()}).strict();
const copilotActionCount=z.object({action:z.enum(copilotActions),runs:count,succeeded:count,failed:count,canceled:count,pending:count}).strict();
export const copilotAnalyticsSchema=z.object({copilotRuns:count,successfulCopilotRuns:count,failedCopilotRuns:count,canceledCopilotRuns:count,pendingCopilotRuns:count,unclassifiedRuns:count,copilotRunsByAction:z.array(copilotActionCount).length(6)}).strict();
export const analyticsTrendSchema=z.array(z.object({date:z.iso.date(),createdCount:count,resolvedCount:count}).strict()).min(1).max(analyticsMaxDays);

const countRate=z.object({count:z.number().int().nonnegative(),rate:z.number().min(0).max(1).nullable()}).strict();
export const evaluationSnapshotSchema=z.object({
  runId:z.string(),datasetVersion:z.string(),datasetHash:z.string(),mode:z.enum(['LIVE_OLLAMA','OFFLINE_FIXTURE']),
  startedAt:z.iso.datetime(),finishedAt:z.iso.datetime().nullable(),provider:z.string(),model:z.string(),promptVersion:z.string(),schemaVersion:z.string(),
  totalCases:z.number().int().nonnegative(),passed:countRate,firstAttemptValid:countRate,repairedSuccess:countRate,terminalFailure:countRate,schemaValid:countRate,referenceValid:countRate,
  latency:z.object({mean:z.number().nullable(),p50:z.number().nullable(),p95:z.number().nullable(),max:z.number().nullable()}).strict(),
  averageAttempts:z.number().nonnegative().nullable(),failureCounts:z.record(z.string(),z.number().int().nonnegative()),limitations:z.string()
}).strict();
export const analyticsOverviewSchema=z.object({
  asOf:z.iso.datetime(),windowDays:z.number().int(),requests:z.object({created:z.number().int(),open:z.number().int(),highUrgent:z.number().int(),resolved:z.number().int(),averageResolutionSeconds:z.number().nullable()}).strict(),
  sla:z.object({atRisk:z.number().int(),breached:z.number().int(),met:z.number().int(),denominator:z.number().int()}).strict()
}).strict();
export const aiAnalyticsSchema=z.object({
  asOf:z.iso.datetime(),windowDays:z.number().int(),runs:z.object({total:z.number().int(),succeeded:z.number().int(),failed:z.number().int(),firstAttemptValid:z.number().int(),repairedSuccess:z.number().int(),averageAttempts:z.number().nullable(),averageLatencyMs:z.number().nullable(),p50LatencyMs:z.number().nullable(),p95LatencyMs:z.number().nullable()}).strict(),
  byPurpose:z.record(z.string(),z.number().int()),byModel:z.record(z.string(),z.number().int()),byVersion:z.record(z.string(),z.number().int()),failures:z.record(z.string(),z.number().int()),recommendations:z.object({generated:count,accepted:count,modified:count,rejected:count,denominator:count,acceptanceRate:rate,modificationRate:rate,rejectionRate:rate}).strict()
}).strict();
export const analyticsDataSchema=z.object({
  period:analyticsPeriodSchema,
  filters:z.object({priority:z.enum(priorities).nullable(),status:z.enum(statuses).nullable(),category:z.enum(categories).nullable(),teamId:z.uuid().nullable()}).strict(),
  filterOptions:z.object({teams:z.array(z.object({id:z.uuid(),code:z.string(),name:z.string()}).strict())}).strict(),
  operations:operationsAnalyticsSchema,sla:slaAnalyticsSchema,reopen:reopenAnalyticsSchema,feedback:feedbackAnalyticsSchema,copilot:copilotAnalyticsSchema,trends:analyticsTrendSchema,
  overview:analyticsOverviewSchema,ai:aiAnalyticsSchema,evaluations:z.array(evaluationSnapshotSchema),
}).strict();
export const analyticsResponseSchema=z.object({data:analyticsDataSchema,requestId:z.uuid()}).strict();
export type EvaluationSnapshot=z.infer<typeof evaluationSnapshotSchema>;
export type AnalyticsData=z.infer<typeof analyticsResponseSchema>['data'];
