import {z} from 'zod';

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
  byPurpose:z.record(z.string(),z.number().int()),byModel:z.record(z.string(),z.number().int()),byVersion:z.record(z.string(),z.number().int()),failures:z.record(z.string(),z.number().int()),recommendations:z.object({accepted:z.number().int(),modified:z.number().int(),rejected:z.number().int(),denominator:z.number().int()}).strict()
}).strict();
export const analyticsResponseSchema=z.object({data:z.object({overview:analyticsOverviewSchema,ai:aiAnalyticsSchema,evaluations:z.array(evaluationSnapshotSchema)}).strict(),requestId:z.uuid()}).strict();
export type EvaluationSnapshot=z.infer<typeof evaluationSnapshotSchema>;
export type AnalyticsData=z.infer<typeof analyticsResponseSchema>['data'];
