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

export async function createApplication(env: ApiEnvironment, options: { database?: DatabaseProbe; log?: LogSink; quiet?: boolean } = {}) {
  const database = options.database ?? new PostgresProbe(env.DATABASE_URL, env.HEALTH_TIMEOUT_MS);
  const log = options.log ?? ((entry) => console.log(JSON.stringify({ time: new Date().toISOString(), ...entry })));
  @Module({ controllers: [HealthController], providers: [HealthService, { provide: DATABASE_PROBE, useValue: database }, { provide: OLLAMA_HEALTH, useValue: new OllamaHealthClient(env) }] })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: options.quiet ? false : new ConsoleLogger({ json: true }) });
  app.use(requestContext(log));
  app.use(json({ limit: '64kb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true, exposedHeaders: ['X-Request-ID'] });
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter(log));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('MobiFlow AI — M1 infrastructure').setDescription('Public local health endpoints only. No authentication or business APIs implemented.').setVersion('0.1.0').build());
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  // A dependency-free alias is useful for Docker probes; canonical REST routes remain /api/v1.
  app.getHttpAdapter().get('/health/live', (_req: Request, res: Response) => res.json({ data: { status: 'UP' }, requestId: res.locals.requestId }));
  app.getHttpAdapter().get('/health/ready', async (_req: Request, res: Response) => {
    const data = await app.get(HealthService).ready();
    res.status(data.coreReady ? 200 : 503).json({ data, requestId: res.locals.requestId });
  });
  return { app, database, document };
}
