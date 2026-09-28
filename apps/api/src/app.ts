import 'reflect-metadata';
import { Module, ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import type { Request, Response } from 'express';
import type { ApiEnvironment } from '@mobiflow/config';
import { HealthController } from './health/health.controller.js';
import { DATABASE_PROBE, OLLAMA_HEALTH, HealthService } from './health/health.service.js';
import { PostgresProbe, type DatabaseProbe } from './health/database.js';
import { OllamaHealthClient } from './health/ollama.js';
import { ApiExceptionFilter, requestContext, validationPipe, type LogSink } from './http.js';
import { PrismaService } from './database/prisma.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AccessGuard, AuthCsrfGuard, RolesGuard } from './auth/auth.guards.js';
import { AuthRateLimiter } from './auth/rate-limiter.js';
import { AuthService } from './auth/auth.service.js';
import { AuthorizationPolicyService } from './authorization/authorization-policy.service.js';
import { UsersController } from './users/users.controller.js';
import { API_ENV } from './tokens.js';

export async function createApplication(env: ApiEnvironment, options: { database?: DatabaseProbe; prisma?: PrismaService; log?: LogSink; quiet?: boolean } = {}) {
  const database = options.database ?? new PostgresProbe(env.DATABASE_URL, env.HEALTH_TIMEOUT_MS);
  const prisma = options.prisma ?? new PrismaService(env.DATABASE_URL);
  const log = options.log ?? ((entry) => console.log(JSON.stringify({ time: new Date().toISOString(), ...entry })));
  @Module({
    controllers: [HealthController, AuthController, UsersController],
    providers: [
      HealthService, AuthService, AuthRateLimiter, AccessGuard, AuthCsrfGuard, RolesGuard, AuthorizationPolicyService,
      { provide: API_ENV, useValue: env }, { provide: PrismaService, useValue: prisma },
      { provide: DATABASE_PROBE, useValue: database }, { provide: OLLAMA_HEALTH, useValue: new OllamaHealthClient(env) },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: options.quiet ? false : new ConsoleLogger({ json: true }) });
  app.use(requestContext(log));
  app.use(json({ limit: '64kb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true, exposedHeaders: ['X-Request-ID'] });
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter(log));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('MobiFlow AI — M2 domain and authentication').setDescription('Local infrastructure, rotating-session authentication, safe user profiles and manager staff directory.').setVersion('0.2.0').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }).addCookieAuth('mobiflow_refresh').build());
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  // A dependency-free alias is useful for Docker probes; canonical REST routes remain /api/v1.
  app.getHttpAdapter().get('/health/live', (_req: Request, res: Response) => res.json({ data: { status: 'UP' }, requestId: res.locals.requestId }));
  app.getHttpAdapter().get('/health/ready', async (_req: Request, res: Response) => {
    const data = await app.get(HealthService).ready();
    res.status(data.coreReady ? 200 : 503).json({ data, requestId: res.locals.requestId });
  });
  return { app, database, prisma, document };
}
