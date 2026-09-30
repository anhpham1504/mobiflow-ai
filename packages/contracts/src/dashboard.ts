import {z} from 'zod';

export const dashboardTimeZone='Asia/Ho_Chi_Minh';
const count=z.number().int().nonnegative();
const risk={slaAtRisk:count,slaBreached:count};
export const userDashboardMetricsSchema=z.object({openRequests:count,inProgress:count,waitingForUser:count,resolved:count,closed:count,...risk}).strict();
export const staffDashboardMetricsSchema=z.object({assignedToMe:count,active:count,waitingForUser:count,...risk,resolvedToday:count}).strict();
export const managerDashboardMetricsSchema=z.object({open:count,pendingApproval:count,unassigned:count,...risk,resolvedToday:count}).strict();
const snapshot={asOf:z.iso.datetime(),timeZone:z.literal(dashboardTimeZone),day:z.object({from:z.iso.datetime(),to:z.iso.datetime()}).strict()};
export const userDashboardSchema=z.object({role:z.literal('USER'),...snapshot,metrics:userDashboardMetricsSchema}).strict();
export const staffDashboardSchema=z.object({role:z.literal('STAFF'),...snapshot,metrics:staffDashboardMetricsSchema}).strict();
export const managerDashboardSchema=z.object({role:z.literal('MANAGER'),...snapshot,metrics:managerDashboardMetricsSchema}).strict();
export const dashboardSchema=z.discriminatedUnion('role',[userDashboardSchema,staffDashboardSchema,managerDashboardSchema]);
export const userDashboardResponseSchema=z.object({data:userDashboardSchema,requestId:z.uuid()}).strict();
export const staffDashboardResponseSchema=z.object({data:staffDashboardSchema,requestId:z.uuid()}).strict();
export const managerDashboardResponseSchema=z.object({data:managerDashboardSchema,requestId:z.uuid()}).strict();
export const dashboardResponseSchema=z.object({data:dashboardSchema,requestId:z.uuid()}).strict();
export type Dashboard=z.infer<typeof dashboardSchema>;
