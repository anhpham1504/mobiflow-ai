import type { RequestStatus } from '@mobiflow/contracts';
import type { Role } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';

export const manualTransitions = [
  ['NEW','MANUAL_TRIAGE','TRIAGED','MANAGER'],
  ['TRIAGED','SUBMIT_FOR_APPROVAL','PENDING_APPROVAL','MANAGER'],
  ['PENDING_APPROVAL','APPROVE_AND_ASSIGN','ASSIGNED','MANAGER'],
  ['PENDING_APPROVAL','REJECT_APPROVAL','TRIAGED','MANAGER'],
  ['ASSIGNED','START_WORK','IN_PROGRESS','STAFF'],
  ['IN_PROGRESS','REQUEST_USER_INFO','WAITING_USER','STAFF'],
  ['WAITING_USER','USER_PROVIDE_INFO','IN_PROGRESS','USER'],
  ['IN_PROGRESS','RESOLVE','RESOLVED','STAFF'],
  ['RESOLVED','USER_CONFIRM','CLOSED','USER'],
  ['RESOLVED','USER_REOPEN','IN_PROGRESS','USER'],
  ...(['NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL'] as const).flatMap(s => [[s,'CANCEL','CANCELED','USER'],[s,'CANCEL','CANCELED','MANAGER']]),
  ...(['ASSIGNED','IN_PROGRESS','WAITING_USER'] as const).map(s => [s,'CANCEL','CANCELED','MANAGER']),
] as readonly (readonly string[])[];
export type Action = 'MANUAL_TRIAGE'|'SUBMIT_FOR_APPROVAL'|'APPROVE_AND_ASSIGN'|'REJECT_APPROVAL'|'START_WORK'|'REQUEST_USER_INFO'|'USER_PROVIDE_INFO'|'RESOLVE'|'USER_CONFIRM'|'USER_REOPEN'|'CANCEL'|'MESSAGE'|'REASSIGN'|'PRIORITY'|'CHECKLIST_ADD'|'CHECKLIST_EDIT'|'FEEDBACK';

export function transitionTarget(status: RequestStatus, action: Action, role: Role): RequestStatus {
  const roles: Partial<Record<Action, readonly Role[]>> = {
    MANUAL_TRIAGE:['MANAGER'], SUBMIT_FOR_APPROVAL:['MANAGER'], APPROVE_AND_ASSIGN:['MANAGER'], REJECT_APPROVAL:['MANAGER'],
    START_WORK:['STAFF'], REQUEST_USER_INFO:['STAFF'], RESOLVE:['STAFF'], USER_PROVIDE_INFO:['USER'], USER_CONFIRM:['USER'], USER_REOPEN:['USER'],
    CANCEL:['USER','MANAGER'], REASSIGN:['MANAGER'], PRIORITY:['MANAGER'], CHECKLIST_ADD:['STAFF'], CHECKLIST_EDIT:['STAFF'], FEEDBACK:['USER'],
  };
  if (roles[action] && !roles[action]!.includes(role)) throw new ApiError(403,'FORBIDDEN','This role cannot perform the action.');
  if (action === 'MANUAL_TRIAGE' && status === 'TRIAGED') return status;
  if (action === 'MESSAGE' && !['CLOSED','CANCELED'].includes(status)) return status;
  if (['REASSIGN','PRIORITY'].includes(action) && ['ASSIGNED','IN_PROGRESS','WAITING_USER'].includes(status)) return status;
  if (['CHECKLIST_ADD','CHECKLIST_EDIT'].includes(action) && status === 'IN_PROGRESS') return status;
  if (action==='FEEDBACK' && status==='CLOSED') return status;
  const edge = manualTransitions.find(([from,a,,r]) => from === status && a === action && r === role);
  if (!edge) throw new ApiError(409,'INVALID_STATE','The action is not allowed in the current state.');
  return edge[2] as RequestStatus;
}

