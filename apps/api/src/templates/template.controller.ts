import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags, type ApiBodyOptions } from '@nestjs/swagger';
import { z } from 'zod';
import * as contracts from '@mobiflow/contracts';
import type { Response } from 'express';
import { AccessGuard, Roles, RolesGuard } from '../auth/auth.guards.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { WorkflowGuard } from '../requests/workflow.guard.js';
import { parse, uuid } from '../requests/validation.js';
import { TemplateService } from './template.service.js';

const schema = (value: z.ZodType) => z.toJSONSchema(value, { io: 'input' }) as NonNullable<Extract<ApiBodyOptions, { schema: unknown }>['schema']>;
@ApiTags('Operational templates') @ApiBearerAuth()
@UseGuards(AccessGuard, RolesGuard, WorkflowGuard) @Roles('STAFF', 'MANAGER')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templates: TemplateService) {}
  @Get() @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List operational templates', description: 'STAFF: active RESPONSE only. MANAGER: both types; archived explicit. Stable createdAt/id keyset pagination, default20/max50. No request mutation.' })
  @ApiQuery({ name: 'type', required: false, enum: contracts.templateTypes }) @ApiQuery({ name: 'status', required: false, enum: contracts.templateStatuses })
  @ApiQuery({ name: 'q', required: false, type: String }) @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, schema: schema(contracts.templateListResponseSchema) }) @ApiResponse({ status: 403, description: 'Wrong role or prohibited filter' })
  async list(@Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { ...await this.templates.list(req.auth!, query), requestId: res.locals.requestId };
  }
  @Get(':id') @Header('Cache-Control', 'no-store') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Read current template', description: 'Authorized preview only; does not apply/send/activate. STAFF cannot read archived or CHECKLIST templates.' })
  @ApiResponse({ status: 200, schema: schema(contracts.templateDetailResponseSchema) }) @ApiResponse({ status: 404, description: 'Unknown or prohibited template' })
  async detail(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.templates.detail(uuid(id), req.auth!), requestId: res.locals.requestId };
  }
  @Post() @Roles('MANAGER') @HttpCode(201) @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create template revision 1', description: 'Manager only; safe resource audit, no request or notification mutation.' })
  @ApiBody({ schema: schema(contracts.createTemplateSchema) }) @ApiResponse({ status: 201, schema: schema(contracts.templateDetailResponseSchema) })
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.templates.create(req.auth!, parse(contracts.createTemplateSchema, body), res.locals.requestId), requestId: res.locals.requestId };
  }
  @Get(':id/revisions') @Roles('MANAGER') @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read immutable template history', description: 'Manager only, including archived snapshots; paginated, no standalone revision route.' })
  @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, schema: schema(contracts.templateHistoryResponseSchema) })
  async history(@Param('id') id: string, @Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { ...await this.templates.history(uuid(id), req.auth!, query), requestId: res.locals.requestId };
  }
  @Post(':id/revisions') @Roles('MANAGER') @HttpCode(201) @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create next immutable revision', description: 'expectedRevision must match ACTIVE current revision. No type change. Stale 409 is atomic.' })
  @ApiBody({ schema: schema(contracts.createTemplateRevisionSchema) }) @ApiResponse({ status: 201, schema: schema(contracts.templateDetailResponseSchema) })
  @ApiResponse({ status: 409, description: 'STALE_TEMPLATE_REVISION; reload before retry' })
  async revise(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.templates.revise(uuid(id), req.auth!, parse(contracts.createTemplateRevisionSchema, body), res.locals.requestId), requestId: res.locals.requestId };
  }
  @Post(':id/archive') @Roles('MANAGER') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Archive active template', description: 'One-way archive, expectedRevision required. Existing historical provenance remains valid. No delete/unarchive.' })
  @ApiBody({ schema: schema(contracts.archiveTemplateSchema) }) @ApiResponse({ status: 200, schema: schema(contracts.templateDetailResponseSchema) })
  @ApiResponse({ status: 409, description: 'STALE_TEMPLATE_REVISION; already archived or revised' })
  async archive(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.templates.archive(uuid(id), req.auth!, body, res.locals.requestId), requestId: res.locals.requestId };
  }
}
