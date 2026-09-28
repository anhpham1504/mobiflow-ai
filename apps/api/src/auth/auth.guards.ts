import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import type { ApiEnvironment } from '@mobiflow/config';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { API_ENV } from '../tokens.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

const ROLES_KEY = 'mobiflow.roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.auth = await this.auth.authenticateAccessToken(request.header('authorization'));
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth || !required.includes(request.auth.role)) throw new ApiError(403, 'FORBIDDEN', 'This role cannot access the resource.');
    return true;
  }
}

@Injectable()
export class AuthCsrfGuard implements CanActivate {
  constructor(@Inject(API_ENV) private readonly env: ApiEnvironment) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.header('origin') !== this.env.WEB_ORIGIN || request.header('x-csrf-protection') !== '1') {
      throw new ApiError(403, 'CSRF_REJECTED', 'The request origin or CSRF header is invalid.');
    }
    return true;
  }
}
