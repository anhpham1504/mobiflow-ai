import { z } from 'zod';

export const statuses = ['NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL','ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED','CANCELED'] as const;
export const priorities = ['LOW','MEDIUM','HIGH','URGENT'] as const;
export const taxonomy = {
  NETWORK: ['IOT_CONNECTIVITY','MOBILE_NETWORK'], IOT: ['DEVICE_CONFIGURATION'],
  BILLING: ['BILLING_DISCREPANCY'], ACCOUNT: ['ACCESS_ISSUE'],
  SERVICE: ['ACTIVATION'], OTHER: ['INTERNAL_SUPPORT','UNSPECIFIED'],
} as const;
export const categories = ['NETWORK','IOT','BILLING','ACCOUNT','SERVICE','OTHER'] as const;
export const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const versionSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const reasonSchema = versionSchema.extend({ reason: text(1,2000) });
export const messageSchema = versionSchema.extend({ body: text(1,4000) });
export const createRequestSchema = z.object({ description: text(10,10000), title: text(1,160).optional() }).strict();
export const finalDecisionSchema = z.object({
  category: z.enum(categories), subcategory: text(1,80), priority: z.enum(priorities),
  teamId: z.uuid(), staffId: z.uuid(),
  actions: z.array(z.object({ text: text(1,500), required: z.boolean(), sourceIds: z.array(z.uuid()).max(5), provenance: z.enum(['HUMAN','AI']) }).strict()).max(30),
  acknowledgedMissingFields: z.array(z.enum(['customer','location','affectedCount','startedAt','impact','description'])).max(6),
  reason: text(1,2000),
}).strict().refine(d => (taxonomy[d.category] as readonly string[]).includes(d.subcategory), { path: ['subcategory'], message: 'Invalid category/subcategory pair' });
export const triageSchema = versionSchema.extend({ finalDecision: finalDecisionSchema });
export const submitSchema = versionSchema.extend({ manualDraftRevision: z.number().int().positive() });
export const reviewSchema = submitSchema.extend({ reviewKind: z.literal('MANUAL') });
export const acceptSchema = reviewSchema.extend({ acknowledgedMissingFields: finalDecisionSchema.shape.acknowledgedMissingFields });
export const modifySchema = reviewSchema.extend({ finalDecision: finalDecisionSchema });
export const rejectSchema = reviewSchema.extend({ reason: text(1,2000) });
export const reassignSchema = reasonSchema.extend({ teamId: z.uuid(), staffId: z.uuid() });
export const prioritySchema = reasonSchema.extend({ priority: z.enum(priorities) });
export const resolveSchema = versionSchema.extend({ rootCause: text(10,4000), resolution: text(10,4000), verification: text(10,4000) });
export const checklistItemSchema = versionSchema.extend({
  text: text(1,500).optional(), required: z.boolean().optional(),
  operation: z.enum(['COMPLETE','UNCOMPLETE','WAIVE','UNWAIVE']).optional(), reason: text(1,2000).optional(),
}).refine(d => d.text !== undefined || d.required !== undefined || d.operation !== undefined, 'An edit is required')
  .refine(d => d.operation !== 'WAIVE' || !!d.reason, { path: ['reason'], message: 'Waiver reason required' });
export const checklistSchema = versionSchema.extend({ items: z.array(z.object({ text: text(1,500), required: z.boolean(), sourceIds: z.array(z.uuid()).max(0) }).strict()).min(1).max(30) });
export const readNotificationSchema = z.object({ read: z.boolean() }).strict();
export type FinalDecision = z.infer<typeof finalDecisionSchema>;
export type RequestStatus = typeof statuses[number];
export type Priority = typeof priorities[number];

const nullableDate = z.iso.datetime().nullable();
export const slaViewSchema=z.object({
  status:z.enum(['SAFE','AT_RISK','BREACHED','PAUSED','MET']),startedAt:z.iso.datetime(),dueAt:z.iso.datetime(),
  pausedAt:nullableDate,resolvedHoldAt:nullableDate,stoppedAt:nullableDate,stopReason:z.string().nullable(),
  remainingSeconds:z.number(),elapsedSeconds:z.number(),targetSeconds:z.number(),breachedAt:nullableDate,
});
export const requestViewSchema=z.object({
  message:z.object({id:z.uuid(),body:z.string(),kind:z.string(),createdAt:z.iso.datetime()}).optional(),
  id:z.uuid(),publicCode:z.string(),title:z.string(),description:z.string(),status:z.enum(statuses),version:z.number().int().positive(),
  category:z.string().nullable(),subcategory:z.string().nullable(),priority:z.enum(priorities),teamId:z.uuid().nullable(),
  currentAssignee:z.object({id:z.uuid(),displayName:z.string()}).nullable(),
  createdAt:z.iso.datetime(),updatedAt:z.iso.datetime(),resolvedAt:nullableDate,closedAt:nullableDate,canceledAt:nullableDate,aiAnalysisStatus:z.string(),
  sla:slaViewSchema.nullable(),
  currentResolution:z.object({id:z.uuid(),cycle:z.number(),rootCause:z.string(),resolution:z.string(),verification:z.string(),resolvedAt:z.iso.datetime()}).nullable(),
  manualDraft:z.object({...finalDecisionSchema.shape,policyId:z.uuid(),policyVersion:z.number(),targetSeconds:z.number()}).nullable().optional(),
  manualDraftRevision:z.number().optional(),reviewKind:z.enum(['AI','MANUAL']).nullable().optional(),pendingDraftRevision:z.number().nullable().optional(),
  checklist:z.object({id:z.uuid(),version:z.number(),items:z.array(z.object({id:z.uuid(),text:z.string(),required:z.boolean(),completedAt:nullableDate,waivedAt:nullableDate,waiverReason:z.string().nullable()}))}).optional(),
});
export const pageSchema=z.object({nextCursor:z.string().nullable(),hasMore:z.boolean()});
export const requestResponseSchema=z.object({data:requestViewSchema,requestId:z.uuid()});
export const requestListSchema=z.object({data:z.array(requestViewSchema),page:pageSchema,requestId:z.uuid()});
export const historyEventSchema=z.object({id:z.uuid(),createdAt:z.iso.datetime(),action:z.string(),actorType:z.enum(['USER','STAFF','MANAGER','SYSTEM','AI']),actorId:z.uuid().nullable(),messages:z.array(z.object({body:z.string(),kind:z.string()})),histories:z.array(z.object({fromStatus:z.enum(statuses).nullable(),toStatus:z.enum(statuses),requestVersion:z.number()})),resolutions:z.array(z.object({cycle:z.number(),rootCause:z.string(),resolution:z.string(),verification:z.string()}))});
export const historyResponseSchema=z.object({data:z.array(historyEventSchema),page:pageSchema,requestId:z.uuid()});
export const notificationSchema=z.object({id:z.uuid(),requestId:z.uuid().nullable(),type:z.string(),createdAt:z.iso.datetime(),readAt:nullableDate});
export const notificationListSchema=z.object({data:z.array(notificationSchema),page:pageSchema,requestId:z.uuid()});
export const notificationResponseSchema=z.object({data:notificationSchema,requestId:z.uuid()});
export type RequestView=z.infer<typeof requestViewSchema>;
export type HistoryEvent=z.infer<typeof historyEventSchema>;
export type NotificationView=z.infer<typeof notificationSchema>;

export const safeUserSchema=z.object({id:z.uuid(),email:z.email(),displayName:z.string(),role:z.enum(['USER','STAFF','MANAGER']),active:z.boolean(),available:z.boolean()});
export const authResponseSchema=z.object({data:z.object({accessToken:z.string(),expiresIn:z.number(),user:safeUserSchema}),requestId:z.uuid()});
export const staffDirectorySchema=z.object({data:z.array(z.object({id:z.uuid(),email:z.email(),displayName:z.string(),available:z.boolean(),teams:z.array(z.object({id:z.uuid(),code:z.string(),name:z.string()})),skills:z.array(z.object({id:z.uuid(),code:z.string(),name:z.string()}))})),page:pageSchema,requestId:z.uuid()});
export type SafeProfile=z.infer<typeof safeUserSchema>;
export type StaffOption=z.infer<typeof staffDirectorySchema>['data'][number];



