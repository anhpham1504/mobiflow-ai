import { Body, Controller, Delete, Get, Param, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags, type SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import { emptyCollaborationSchema, mentionCandidateListSchema, watchStateResponseSchema } from '@mobiflow/contracts';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessGuard, Roles, RolesGuard } from '../auth/auth.guards.js';
import { WorkflowGuard } from './workflow.guard.js';
import { uuid } from './validation.js';
import { RequestCollaborationService } from './request-collaboration.service.js';
const schema = (value: z.ZodType) => z.toJSONSchema(value, { io: 'input' }) as SchemaObject;

@ApiTags('Internal collaboration') @ApiBearerAuth() @Roles('STAFF', 'MANAGER')
@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)
@Controller('requests/:id') @ApiParam({ name: 'id', format: 'uuid' })
@ApiResponse({ status: 400, description: 'Invalid UUID or strict body/query' })
@ApiResponse({ status: 401, description: 'Inactive/expired/revoked identity/session' })
@ApiResponse({ status: 403, description: 'USER or unapproved write origin' })
@ApiResponse({ status: 404, description: 'Unknown or out-of-scope request' })
@ApiResponse({ status: 429, description: 'Existing authenticated read/write rate limit' })
@ApiResponse({ status: 503, description: 'Sanitized database unavailable error' })
export class RequestCollaborationController {
  constructor(private readonly collaboration: RequestCollaborationService) {}
  @Get('mention-candidates')
  @ApiOperation({ operationId: 'listRequestMentionCandidates', summary: 'Search current eligible collaborators', description: 'Scope first; active operational users already allowed to read this request, excluding self. No directory access, emails or authorization grant. No-store.' })
  @ApiQuery({ name: 'q', required: false, schema: { type: 'string', maxLength: 80 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 20, default: 20 } })
  @ApiResponse({ status: 200, schema: schema(mentionCandidateListSchema) })
  async candidates(@Param('id') id: string, @Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.collaboration.candidates(uuid(id), req.auth!, query), requestId: res.locals.requestId };
  }
  @Get('watch')
  @ApiOperation({ operationId: 'getRequestWatchState', summary: 'Read my watch state', description: 'Strict empty query; current scope; terminal readable requests allowed; no count/list of other watchers.' })
  @ApiResponse({ status: 200, schema: schema(watchStateResponseSchema) })
  async state(@Param('id') id: string, @Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.collaboration.watch(uuid(id), req.auth!, undefined, res.locals.requestId, query), requestId: res.locals.requestId };
  }
  @Put('watch')
  @ApiOperation({ operationId: 'watchRequest', summary: 'Start watching explicitly', description: 'Idempotent own child subscription, strict empty body/query. No expectedVersion or Request writes. Max100 subscriptions/request; never grants access.' })
  @ApiBody({ required: false, schema: schema(emptyCollaborationSchema) })
  @ApiResponse({ status: 200, schema: schema(watchStateResponseSchema) })
  @ApiResponse({ status: 409, description: 'WATCH_LIMIT: subscription bound reached' })
  @ApiResponse({ status: 415, description: 'JSON required' })
  async watch(@Param('id') id: string, @Query() query: unknown, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.collaboration.watch(uuid(id), req.auth!, true, res.locals.requestId, query, body), requestId: res.locals.requestId };
  }
  @Delete('watch')
  @ApiOperation({ operationId: 'unwatchRequest', summary: 'Stop watching explicitly', description: 'Idempotent own child subscription delete; strict empty body/query; no workflow/version effect.' })
  @ApiBody({ required: false, schema: schema(emptyCollaborationSchema) })
  @ApiResponse({ status: 200, schema: schema(watchStateResponseSchema) })
  @ApiResponse({ status: 415, description: 'JSON required' })
  async unwatch(@Param('id') id: string, @Query() query: unknown, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.collaboration.watch(uuid(id), req.auth!, false, res.locals.requestId, query, body), requestId: res.locals.requestId };
  }
}
