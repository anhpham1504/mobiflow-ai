import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service.js';
import { livenessOpenApi, readinessOpenApi } from './openapi.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}
  @Get('live')
  @ApiOperation({ summary: 'Process liveness, independent of external dependencies' })
  @ApiResponse({ status: 200, description: 'API process alive', schema: livenessOpenApi })
  live(@Res() res: Response) { res.json({ data: { status: 'UP' }, requestId: res.locals.requestId }); }
  @Get('ready')
  @ApiOperation({ summary: 'Core readiness and separate truthful AI component health' })
  @ApiResponse({ status: 200, description: 'Core ready; AI may be degraded', schema: readinessOpenApi })
  @ApiResponse({ status: 503, description: 'Database or vector extension unavailable', schema: readinessOpenApi })
  async ready(@Res() res: Response) {
    const data = await this.health.ready();
    res.status(data.coreReady ? 200 : 503).json({ data, requestId: res.locals.requestId });
  }
}
