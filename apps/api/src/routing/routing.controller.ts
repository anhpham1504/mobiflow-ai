import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags, type ApiBodyOptions } from '@nestjs/swagger';
import { z } from 'zod';
import * as contracts from '@mobiflow/contracts';
import type { Response } from 'express';
import { AccessGuard, Roles, RolesGuard } from '../auth/auth.guards.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { WorkflowGuard } from '../requests/workflow.guard.js';
import { parse, uuid } from '../requests/validation.js';
import { RoutingService } from './routing.service.js';

const schema = (value: z.ZodType) => z.toJSONSchema(value, { io: 'input' }) as NonNullable<Extract<ApiBodyOptions, { schema: unknown }>['schema']>;
@ApiTags('Routing rules') @ApiBearerAuth() @Roles('MANAGER')
@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)
@ApiResponse({ status: 400, description: 'Strict input validation failed' }) @ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'MANAGER required' }) @ApiResponse({ status: 404, description: 'Resource not found' })
@Controller('routing-rules')
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}
  @Get() @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List routing rules', description: 'A01 MANAGER only. Current immutable definitions; all statuses by default. Keyset default20/max50.' })
  @ApiQuery({ name: 'status', required: false, enum: contracts.routingStatuses }) @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, schema: schema(contracts.routingListResponseSchema) })
  async list(@Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { ...await this.routing.list(req.auth!, query), requestId: res.locals.requestId };
  }
  @Get('targets') @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List eligible routing teams', description: 'Active team with eligible STAFF membership; max500, no people or workload projection.' })
  @ApiResponse({ status: 200, schema: schema(contracts.routingTargetsResponseSchema) })
  async targets(@Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.targets(req.auth!, query), requestId: res.locals.requestId };
  }
  @Get(':id') @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Read routing rule and current revision' }) @ApiResponse({ status: 200, schema: schema(contracts.routingDetailResponseSchema) })
  async detail(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.detail(uuid(id), req.auth!), requestId: res.locals.requestId };
  }
  @Post() @HttpCode(201) @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create inactive routing rule revision1', description: 'No Request or notification change. Explicit activation required.' })
  @ApiBody({ schema: schema(contracts.createRoutingRuleSchema) }) @ApiResponse({ status: 201, schema: schema(contracts.routingDetailResponseSchema) })
  @ApiResponse({ status: 422, description: 'Invalid/ineligible target' })
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.create(req.auth!, body, res.locals.requestId), requestId: res.locals.requestId };
  }
  @Get(':id/revisions') @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Read immutable routing history', description: 'Includes archived rules. Keyset default20/max50; no standalone revision endpoint.' })
  @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, schema: schema(contracts.routingHistoryResponseSchema) })
  async history(@Param('id') id: string, @Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { ...await this.routing.history(uuid(id), req.auth!, query), requestId: res.locals.requestId };
  }
  @Post(':id/revisions') @HttpCode(201) @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Append routing revision', description: 'expectedRevision and expectedRuleVersion required; immutable past; terminal archive.' })
  @ApiBody({ schema: schema(contracts.createRoutingRevisionSchema) }) @ApiResponse({ status: 201, schema: schema(contracts.routingDetailResponseSchema) })
  @ApiResponse({ status: 409, description: 'STALE_ROUTING_RULE; no writes' }) @ApiResponse({ status: 422, description: 'Invalid/ineligible target' })
  async revise(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.revise(uuid(id), req.auth!, body, res.locals.requestId), requestId: res.locals.requestId };
  }
  @Post(':id/activate') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Activate routing rule', description: 'Revalidates target; expectedRevision and expectedRuleVersion required.' })
  @ApiBody({ schema: schema(contracts.routingCommandSchema) }) @ApiResponse({ status: 200, schema: schema(contracts.routingDetailResponseSchema) })
  @ApiResponse({ status: 409, description: 'STALE_ROUTING_RULE; no writes' }) @ApiResponse({ status: 422, description: 'Invalid/ineligible target' })
  async activate(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.lifecycle(uuid(id), req.auth!, body, 'ACTIVE', res.locals.requestId), requestId: res.locals.requestId };
  }
  @Post(':id/deactivate') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Deactivate routing rule', description: 'Retains immutable history; expectedRevision and expectedRuleVersion required.' })
  @ApiBody({ schema: schema(contracts.routingCommandSchema) }) @ApiResponse({ status: 200, schema: schema(contracts.routingDetailResponseSchema) })
  @ApiResponse({ status: 409, description: 'STALE_ROUTING_RULE; no writes' })
  async deactivate(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.lifecycle(uuid(id), req.auth!, body, 'INACTIVE', res.locals.requestId), requestId: res.locals.requestId };
  }
  @Post(':id/archive') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Archive routing rule permanently', description: 'Historical only; no delete/unarchive. expectedRevision and expectedRuleVersion required.' })
  @ApiBody({ schema: schema(contracts.routingCommandSchema) }) @ApiResponse({ status: 200, schema: schema(contracts.routingDetailResponseSchema) })
  @ApiResponse({ status: 409, description: 'STALE_ROUTING_RULE; no writes' })
  async archive(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.routing.lifecycle(uuid(id), req.auth!, body, 'ARCHIVED', res.locals.requestId), requestId: res.locals.requestId };
  }
}

@ApiTags('Request routing') @ApiBearerAuth() @Roles('MANAGER')
@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)
@Controller('requests/:id/routing')
export class RequestRoutingController {
  constructor(private readonly routing: RoutingService) {}
  @Post('evaluate') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Evaluate routing without business writes', description: 'A01 MANAGER only. Server canonical facts; no client override. Recommendation only, no assignment, Request version change, audit or notification. Same snapshot gives same result.' })
  @ApiBody({ required: false, schema: schema(contracts.routingEmptySchema) }) @ApiResponse({ status: 200, schema: schema(contracts.routingEvaluationResponseSchema) })
  @ApiResponse({ status: 400, description: 'Client facts/unknown fields rejected' }) @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'MANAGER required' }) @ApiResponse({ status: 404, description: 'Unknown/out-of-scope Request' })
  @ApiResponse({ status: 503, description: 'Routing unavailable or active set exceeds500; manual workflow available' })
  async evaluate(@Param('id') id: string, @Query() query: unknown, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    parse(contracts.routingEmptySchema, query);
    return { data: await this.routing.evaluate(uuid(id), req.auth!, body), requestId: res.locals.requestId };
  }
}
