import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@mobiflow/config';
import { argon2id, hash, verify } from 'argon2';
import { jwtVerify, SignJWT } from 'jose';
import { Prisma, type Role } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { ApiError } from '../http.js';
import { API_ENV } from '../tokens.js';
import { safeUserSelect, type AuthenticatedActor, type SafeUser } from './auth.types.js';

const passwordOptions = { type: argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SessionResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: SafeUser;
}

@Injectable()
export class AuthService {
  private readonly jwtKey: Uint8Array;
  private dummyHash?: Promise<string>;

  constructor(private readonly prisma: PrismaService, @Inject(API_ENV) private readonly env: ApiEnvironment) {
    this.jwtKey = new TextEncoder().encode(env.JWT_SECRET);
  }

  normalizeEmail(email: string) { return email.trim().toLowerCase(); }

  async login(emailInput: string, password: string, requestId: string): Promise<SessionResult> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const candidateHash = user?.passwordHash ?? await this.getDummyHash();
    const passwordValid = await verify(candidateHash, password).catch(() => false);
    if (!user || !user.active || !passwordValid) {
      await this.auditDeniedLogin(email, requestId);
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password.');
    }

    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshToken = this.issueRefreshCredential(sessionId);
    const refreshExpiresAt = new Date(Date.now() + this.env.REFRESH_SESSION_TTL_SECONDS * 1000);
    const safeUser = this.toSafeUser(user);
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshSession.create({ data: { id: sessionId, familyId, userId: user.id, tokenHash: this.hashRefresh(refreshToken), expiresAt: refreshExpiresAt } });
      await tx.auditLog.create({ data: this.auditData('AUTH_LOGIN_SUCCEEDED', user.role, user.id, 'RefreshSession', sessionId, requestId, 'SUCCEEDED') });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.result(safeUser, sessionId, refreshToken, refreshExpiresAt);
  }

  async refresh(rawToken: string | undefined, requestId: string): Promise<SessionResult> {
    const parsed = this.parseRefreshCredential(rawToken);
    if (!parsed) {
      await this.auditInvalidRefresh(rawToken, requestId);
      throw new ApiError(401, 'UNAUTHORIZED', 'The refresh session is invalid or expired.');
    }
    const existing = await this.prisma.refreshSession.findUnique({ where: { id: parsed.sessionId }, include: { user: true } });
    if (!existing || !this.hashMatches(existing.tokenHash, rawToken!)) {
      await this.auditInvalidRefresh(rawToken, requestId);
      throw new ApiError(401, 'UNAUTHORIZED', 'The refresh session is invalid or expired.');
    }

    const replacementId = randomUUID();
    const replacementToken = this.issueRefreshCredential(replacementId);
    let rotatedUser: SafeUser | undefined;
    let failure: 'REPLAY' | 'EXPIRED' | 'INACTIVE' | 'REVOKED' | undefined;
    await this.prisma.$transaction(async (tx) => {
      // Lock the presented session row before reading its consumed state. A concurrent
      // refresh then observes the committed rotation and is handled as replay.
      const lockedSession = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "id" = ${existing.id}::uuid FOR UPDATE`,
      );
      if (lockedSession.length === 0) {
        failure = 'REVOKED';
        return;
      }
      // Capture time after acquiring the lock so a waiting replay cannot predate
      // the replacement session committed by the winning refresh request.
      const now = new Date();
      const current = await tx.refreshSession.findUnique({ where: { id: existing.id }, include: { user: true } });
      if (!current || current.revokedAt) {
        if (current) await tx.auditLog.create({ data: this.auditData('AUTH_REFRESH_REVOKED_DENIED', current.user.role, current.userId, 'RefreshSessionFamily', current.familyId, requestId, 'DENIED') });
        failure = 'REVOKED';
        return;
      }
      if (current.consumedAt) {
        if (current) {
          await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: now, revocationReason: 'REFRESH_REPLAY' } });
          await tx.auditLog.create({ data: this.auditData('AUTH_REFRESH_REPLAY_REVOKED', current.user.role, current.userId, 'RefreshSessionFamily', current.familyId, requestId, 'DENIED') });
        }
        failure = 'REPLAY';
        return;
      }
      if (current.expiresAt <= now) {
        await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: now, revocationReason: 'SESSION_EXPIRED' } });
        await tx.auditLog.create({ data: this.auditData('AUTH_REFRESH_EXPIRED_REVOKED', current.user.role, current.userId, 'RefreshSessionFamily', current.familyId, requestId, 'DENIED') });
        failure = 'EXPIRED';
        return;
      }
      if (!current.user.active) {
        await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: now, revocationReason: 'USER_INACTIVE' } });
        await tx.auditLog.create({ data: this.auditData('AUTH_REFRESH_INACTIVE_REVOKED', current.user.role, current.userId, 'RefreshSessionFamily', current.familyId, requestId, 'DENIED') });
        failure = 'INACTIVE';
        return;
      }
      const consumed = await tx.refreshSession.updateMany({ where: { id: current.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) {
        await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: now, revocationReason: 'REFRESH_REPLAY' } });
        failure = 'REPLAY';
        return;
      }
      await tx.refreshSession.create({ data: { id: replacementId, familyId: current.familyId, userId: current.userId, tokenHash: this.hashRefresh(replacementToken), expiresAt: current.expiresAt } });
      await tx.refreshSession.update({ where: { id: current.id }, data: { replacedById: replacementId } });
      await tx.auditLog.create({ data: this.auditData('AUTH_REFRESH_ROTATED', current.user.role, current.userId, 'RefreshSession', replacementId, requestId, 'SUCCEEDED') });
      rotatedUser = this.toSafeUser(current.user);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    if (failure || !rotatedUser) throw new ApiError(401, failure === 'REPLAY' ? 'REFRESH_REPLAY' : 'UNAUTHORIZED', 'The refresh session is invalid or expired.');
    return this.result(rotatedUser, replacementId, replacementToken, existing.expiresAt);
  }

  async logout(rawToken: string | undefined, requestId: string): Promise<void> {
    const parsed = this.parseRefreshCredential(rawToken);
    if (!parsed) return;
    const session = await this.prisma.refreshSession.findUnique({ where: { id: parsed.sessionId }, include: { user: true } });
    if (!session || !this.hashMatches(session.tokenHash, rawToken!)) return;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshSession.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: now, revocationReason: 'LOGOUT' } });
      await tx.auditLog.create({ data: this.auditData('AUTH_LOGOUT_REVOKED', session.user.role, session.userId, 'RefreshSessionFamily', session.familyId, requestId, 'SUCCEEDED') });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async authenticateAccessToken(header: string | undefined): Promise<AuthenticatedActor> {
    if (!header?.startsWith('Bearer ') || header.length < 20) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
    try {
      const { payload, protectedHeader } = await jwtVerify(header.slice(7), this.jwtKey, { issuer: this.env.JWT_ISSUER, audience: this.env.JWT_AUDIENCE, algorithms: ['HS256'] });
      if (protectedHeader.alg !== 'HS256' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !uuidPattern.test(payload.sub) || !uuidPattern.test(payload.sid)) throw new Error('claims');
      const session = await this.prisma.refreshSession.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, consumedAt: null, expiresAt: { gt: new Date() }, user: { active: true } },
        include: { user: { select: safeUserSelect } },
      });
      if (!session) throw new Error('session');
      return { ...session.user, sessionId: session.id };
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }
  }

  async hashPassword(password: string): Promise<string> { return hash(password, passwordOptions); }

  private async result(user: SafeUser, sessionId: string, refreshToken: string, refreshExpiresAt: Date): Promise<SessionResult> {
    const accessToken = await new SignJWT({ sid: sessionId, role: user.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(user.id).setIssuedAt()
      .setIssuer(this.env.JWT_ISSUER).setAudience(this.env.JWT_AUDIENCE)
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_SECONDS}s`).sign(this.jwtKey);
    return { accessToken, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS, refreshToken, refreshExpiresAt, user };
  }

  private issueRefreshCredential(sessionId: string) { return `${sessionId}.${randomBytes(32).toString('base64url')}`; }
  private parseRefreshCredential(token: string | undefined) {
    if (!token || token.length > 200) return undefined;
    const [sessionId, secret, extra] = token.split('.');
    return !extra && secret !== undefined && secret.length >= 43 && sessionId && uuidPattern.test(sessionId) ? { sessionId } : undefined;
  }
  private hashRefresh(token: string) { return createHmac('sha256', this.env.REFRESH_TOKEN_SECRET).update(token).digest('hex'); }
  private hashMatches(expected: string, token: string) {
    const actual = this.hashRefresh(token);
    return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  }
  private getDummyHash() { return this.dummyHash ??= hash('mobiflow-invalid-password', passwordOptions); }
  private toSafeUser(user: { id: string; email: string; displayName: string; role: Role; active: boolean; available: boolean }): SafeUser {
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, active: user.active, available: user.available };
  }
  private auditData(action: string, actorType: Role | 'SYSTEM', actorId: string | null, resourceType: string, resourceId: string, requestCorrelationId: string, outcome: 'SUCCEEDED' | 'DENIED' | 'FAILED') {
    return { action, actorType, actorId, resourceType, resourceId, requestCorrelationId, outcome } as const;
  }
  private async auditDeniedLogin(email: string, requestId: string) {
    const resourceId = createHmac('sha256', this.env.REFRESH_TOKEN_SECRET).update(email).digest('hex').slice(0, 32);
    await this.prisma.auditLog.create({ data: this.auditData('AUTH_LOGIN_DENIED', 'SYSTEM', null, 'LoginIdentity', resourceId, requestId, 'DENIED') });
  }
  private async auditInvalidRefresh(token: string | undefined, requestId: string) {
    const resourceId = createHmac('sha256', this.env.REFRESH_TOKEN_SECRET).update(token ?? 'missing').digest('hex').slice(0, 32);
    await this.prisma.auditLog.create({ data: this.auditData('AUTH_REFRESH_INVALID_DENIED', 'SYSTEM', null, 'RefreshCredential', resourceId, requestId, 'DENIED') });
  }
}
