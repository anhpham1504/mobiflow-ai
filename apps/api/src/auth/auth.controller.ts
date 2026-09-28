import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { ApiEnvironment } from '@mobiflow/config';
import { ApiBearerAuth, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { parse, serialize } from 'cookie';
import type { Response } from 'express';
import { AuthEnvelopeDto, LoginDto, SafeUserEnvelopeDto } from './auth.dto.js';
import { AccessGuard, AuthCsrfGuard } from './auth.guards.js';
import { AuthRateLimiter } from './rate-limiter.js';
import { AuthService, type SessionResult } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { API_ENV } from '../tokens.js';

export const REFRESH_COOKIE = 'mobiflow_refresh';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly limiter: AuthRateLimiter, @Inject(API_ENV) private readonly env: ApiEnvironment) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthCsrfGuard)
  @ApiOperation({ summary: 'Authenticate a seeded local account' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthEnvelopeDto })
  @ApiResponse({ status: 401, description: 'Generic invalid credential response' })
  async login(@Body() body: LoginDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    this.limiter.login(this.auth.normalizeEmail(body.email), req.ip ?? req.socket.remoteAddress ?? 'local');
    return this.authResponse(await this.auth.login(body.email, body.password, res.locals.requestId), res);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthCsrfGuard)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: AuthEnvelopeDto })
  async refresh(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const token = this.refreshToken(req);
    this.limiter.refresh(token?.split('.')[0] ?? 'invalid', req.ip ?? req.socket.remoteAddress ?? 'local');
    try {
      return this.authResponse(await this.auth.refresh(token, res.locals.requestId), res);
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthCsrfGuard)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiResponse({ status: 204, description: 'Session family revoked; idempotent' })
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(this.refreshToken(req), res.locals.requestId);
    this.clearCookie(res);
  }

  @Get('me')
  @UseGuards(AccessGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SafeUserEnvelopeDto })
  me(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const { id, email, displayName, role, active, available } = req.auth!;
    const user = { id, email, displayName, role, active, available };
    return { data: user, requestId: res.locals.requestId };
  }

  private authResponse(result: SessionResult, res: Response) {
    const maxAge = Math.max(0, Math.floor((result.refreshExpiresAt.getTime() - Date.now()) / 1000));
    res.setHeader('Set-Cookie', serialize(REFRESH_COOKIE, result.refreshToken, { httpOnly: true, sameSite: 'lax', secure: this.env.AUTH_COOKIE_SECURE, path: '/api/v1/auth', maxAge, expires: result.refreshExpiresAt }));
    return { data: { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user }, requestId: res.locals.requestId };
  }

  private refreshToken(req: AuthenticatedRequest) { return parse(req.header('cookie') ?? '')[REFRESH_COOKIE]; }
  private clearCookie(res: Response) {
    res.setHeader('Set-Cookie', serialize(REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: this.env.AUTH_COOKIE_SECURE, path: '/api/v1/auth', maxAge: 0, expires: new Date(0) }));
  }
}
