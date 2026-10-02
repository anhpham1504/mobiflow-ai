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
import { RequestsController } from './requests/requests.controller.js';
import { InternalNoteController } from './requests/internal-note.controller.js';
import { InternalNoteService } from './requests/internal-note.service.js';
import { RequestCollaborationController } from './requests/request-collaboration.controller.js';
import { RequestCollaborationService } from './requests/request-collaboration.service.js';
import { RequestStateMachineService } from './requests/request-state-machine.service.js';
import { RequestQueryService } from './requests/request-query.service.js';
import { WorkflowGuard } from './requests/workflow.guard.js';
import { AnalysisController } from './ai/analysis.controller.js';
import { AnalysisWorker } from './ai/analysis-worker.js';
import { AnalysisQueryService } from './ai/analysis-query.service.js';
import { OllamaProvider } from './ai/ollama-provider.js';
import { AI_PROVIDER_TOKEN,AI_LOG,AI_WORKER_ENABLED,type AiProvider } from './ai/provider.js';
import {EMBEDDING_PROVIDER,KNOWLEDGE_WORKER_ENABLED,OllamaEmbeddingProvider,type EmbeddingProvider} from './knowledge/embedding-provider.js';
import {DocumentService} from './knowledge/document.service.js';
import {VectorRepository} from './knowledge/vector.repository.js';
import {IngestionWorker} from './knowledge/ingestion-worker.js';
import {KnowledgeRetriever} from './knowledge/retriever.js';
import {SourceService} from './knowledge/source.service.js';
import {KnowledgeController} from './knowledge/knowledge.controller.js';
import {KnowledgeGuard} from './knowledge/knowledge.guard.js';
import {RagHealth} from './knowledge/rag-health.js';
import {RecommendationController} from './ai/recommendation.controller.js';
import {RecommendationService} from './ai/recommendation.service.js';
import {DomainTools} from './ai/tools/domain-tools.js';
import {RequestVectors} from './ai/tools/request-vectors.js';
import {RECOMMENDATION_PROVIDER,type StructuredProvider} from './ai/provider.js';
import {OperationalAiController} from './ai/operational-ai.controller.js';
import {OperationalAiService} from './ai/operational-ai.service.js';
import {SlaMonitorService} from './requests/sla-monitor.service.js';
import {AnalyticsController} from './analytics/analytics.controller.js';
import {AnalyticsService} from './analytics/analytics.service.js';
import {DashboardController} from './dashboard/dashboard.controller.js';
import {DashboardService} from './dashboard/dashboard.service.js';
import { TemplateController } from './templates/template.controller.js';
import { TemplateService } from './templates/template.service.js';

export async function createApplication(env: ApiEnvironment, options: { database?: DatabaseProbe; prisma?: PrismaService; log?: LogSink; quiet?: boolean; aiProvider?:AiProvider; recommendationProvider?:StructuredProvider; aiWorker?:boolean;embeddingProvider?:EmbeddingProvider;knowledgeWorker?:boolean } = {}) {
  if(env.NODE_ENV!=='test'&&(options.aiProvider||options.recommendationProvider||options.aiWorker!==undefined||options.embeddingProvider||options.knowledgeWorker!==undefined))throw new Error('AI test overrides require NODE_ENV=test');
  const database = options.database ?? new PostgresProbe(env.DATABASE_URL, env.HEALTH_TIMEOUT_MS);
  const prisma = options.prisma ?? new PrismaService(env.DATABASE_URL);
  const log = options.log ?? ((entry) => console.log(JSON.stringify({ time: new Date().toISOString(), ...entry })));
  @Module({
    controllers: [HealthController, AuthController, UsersController, RequestsController, InternalNoteController, RequestCollaborationController,TemplateController,AnalysisController,KnowledgeController,RecommendationController,OperationalAiController,AnalyticsController,DashboardController],
    providers: [
      HealthService, AuthService, AuthRateLimiter, AccessGuard, AuthCsrfGuard, RolesGuard, AuthorizationPolicyService,
      RequestStateMachineService, RequestQueryService, InternalNoteService, RequestCollaborationService, TemplateService, WorkflowGuard, DashboardService,
      AnalysisWorker,AnalysisQueryService,
      RecommendationService,DomainTools,RequestVectors,OperationalAiService,SlaMonitorService,AnalyticsService,
      {provide:RECOMMENDATION_PROVIDER,useValue:options.recommendationProvider??new OllamaProvider(env)},
      DocumentService,VectorRepository,IngestionWorker,KnowledgeRetriever,SourceService,KnowledgeGuard,RagHealth,
      {provide:EMBEDDING_PROVIDER,useValue:options.embeddingProvider??new OllamaEmbeddingProvider(env)},
      {provide:KNOWLEDGE_WORKER_ENABLED,useValue:options.knowledgeWorker??env.NODE_ENV!=='test'},
      {provide:AI_PROVIDER_TOKEN,useValue:options.aiProvider??new OllamaProvider(env)},
      {provide:AI_LOG,useValue:log},{provide:AI_WORKER_ENABLED,useValue:options.aiWorker??env.NODE_ENV!=='test'},
      { provide: API_ENV, useValue: env }, { provide: PrismaService, useValue: prisma },
      { provide: DATABASE_PROBE, useValue: database }, { provide: OLLAMA_HEALTH, useValue: new OllamaHealthClient(env) },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: options.quiet ? false : new ConsoleLogger({ json: true }) });
  app.use(requestContext(log));
  app.use((_request:Request,response:Response,next:()=>void)=>{
    response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('X-Frame-Options','DENY');
    response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(json({ limit: '64kb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true, exposedHeaders: ['X-Request-ID'] });
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter(log));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('MobiFlow AI — M10 local release').setDescription('Local-first request workflow with bounded AI, retrieval, human approval, analytics, and explicit degraded operation.').setVersion('1.0.0-rc.1').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }).addCookieAuth('mobiflow_refresh').build());
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  // A dependency-free alias is useful for Docker probes; canonical REST routes remain /api/v1.
  app.getHttpAdapter().get('/health/live', (_req: Request, res: Response) => res.json({ data: { status: 'UP' }, requestId: res.locals.requestId }));
  app.getHttpAdapter().get('/health/ready', async (_req: Request, res: Response) => {
    const data = await app.get(HealthService).ready();
    res.status(data.coreReady ? 200 : 503).json({ data, requestId: res.locals.requestId });
  });
  return { app, database, prisma, document };
}
