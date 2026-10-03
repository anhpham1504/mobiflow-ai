import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags, type ApiBodyOptions } from '@nestjs/swagger';
import { z } from 'zod';
import * as contracts from '@mobiflow/contracts';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessGuard, RolesGuard } from '../auth/auth.guards.js';
import { WorkflowGuard } from '../requests/workflow.guard.js';
import { parse, uuid } from '../requests/validation.js';
import { SavedViewService } from './saved-view.service.js';
const schema = (value: z.ZodType) => z.toJSONSchema(value, { io: 'input' }) as NonNullable<Extract<ApiBodyOptions, { schema: unknown }>['schema']>;

@ApiTags('Saved request views')
@ApiBearerAuth()
@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)
@ApiResponse({ status: 400, description: 'Invalid strict input/query or UUID' })
@ApiResponse({ status: 401, description: 'Live authentication required' })
@ApiResponse({ status: 403, description: 'Filter not allowed for current role or invalid origin' })
@ApiResponse({ status: 404, description: 'Unknown or foreign view; no manager override' })
@ApiResponse({ status: 409, description: 'Stale view version, duplicate normalized name or per-owner limit' })
@ApiResponse({ status: 422, description: 'Current filter reference unavailable' })
@Controller('saved-request-views')
export class SavedViewController {
  constructor(private readonly views: SavedViewService) {}
  @Get()
  @ApiOperation({ summary: 'List own private views; unavailable items omit filters', description: 'All three current roles. Maximum50, createdAt DESC/id DESC. Empty query only. Authenticated no-store. Preferences never expand Request scope.' })
  @ApiResponse({ status: 200, schema: schema(contracts.savedViewListSchema) })
  async list(@Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    parse(contracts.savedViewQuerySchema, query);
    return { data: await this.views.list(req.auth!), requestId: res.locals.requestId };
  }
  @Post() @HttpCode(201)
  @ApiBody({ schema: schema(contracts.createSavedViewSchema) }) @ApiResponse({ status: 201, schema: schema(contracts.savedViewResponseSchema) })
  async create(@Query() query: unknown, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    parse(contracts.savedViewQuerySchema, query);
    return { data: await this.views.create(req.auth!, parse(contracts.createSavedViewSchema, body), res.locals.requestId), requestId: res.locals.requestId };
  }
  @Get(':id') @ApiParam({ name: 'id', format: 'uuid' }) @ApiResponse({ status: 200, schema: schema(contracts.savedViewResponseSchema) })
  async detail(@Param('id') id: string, @Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    parse(contracts.savedViewQuerySchema, query);
    return { data: await this.views.detail(uuid(id), req.auth!), requestId: res.locals.requestId };
  }
  @Put(':id') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: schema(contracts.updateSavedViewSchema) }) @ApiResponse({ status: 200, schema: schema(contracts.savedViewResponseSchema) })
  async update(@Param('id') id: string, @Query() query: unknown, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    parse(contracts.savedViewQuerySchema, query);
    return { data: await this.views.update(uuid(id), req.auth!, parse(contracts.updateSavedViewSchema, body), res.locals.requestId), requestId: res.locals.requestId };
  }
  @Delete(':id') @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: schema(contracts.deleteSavedViewSchema) }) @ApiResponse({ status: 200, schema: schema(contracts.savedViewDeletedSchema) })
  async remove(@Param('id') id: string, @Query() query: unknown, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    parse(contracts.savedViewQuerySchema, query);
    return { data: await this.views.delete(uuid(id), req.auth!, parse(contracts.deleteSavedViewSchema, body).expectedVersion, res.locals.requestId), requestId: res.locals.requestId };
  }
}
