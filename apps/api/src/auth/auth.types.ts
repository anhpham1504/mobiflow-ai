import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';

export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  available: boolean;
}

export interface AuthenticatedActor extends SafeUser {
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedActor;
}

export const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  active: true,
  available: true,
} as const;
