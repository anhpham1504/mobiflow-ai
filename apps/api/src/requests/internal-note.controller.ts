import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import { createInternalNoteSchema, internalNoteListSchema, internalNoteResponseSchema } from '@mobiflow/contracts';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessGuard, Roles, RolesGuard } from '../auth/auth.guards.js';
import { InternalNoteService } from './internal-note.service.js';
import { WorkflowGuard } from './workflow.guard.js';
import { parse, uuid } from './validation.js';

const schema = (value: z.ZodType) => z.toJSONSchema(value, { io: 'input' }) as SchemaObject;
@ApiTags('Internal notes')
@ApiBearerAuth()
@Roles('STAFF', 'MANAGER')
@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)
@ApiParam({ name: 'id', format: 'uuid' })
@ApiResponse({ status: 400, description: 'Invalid UUID, strict input/query or pagination cursor' })
@ApiResponse({ status: 401, description: 'Missing, inactive, expired or revoked identity/session' })
@ApiResponse({ status: 403, description: 'USER/wrong role or invalid write origin' })
@ApiResponse({ status: 404, description: 'Unknown or out-of-scope request; same response shape' })
@ApiResponse({ status: 429, description: 'Existing per-actor read/write rate limit; Retry-After' })
@ApiResponse({ status: 503, description: 'Database temporarily unavailable; sanitized error' })
@Controller('requests/:id/internal-notes')
export class InternalNoteController {
  constructor(private readonly notes: InternalNoteService) {}

  @Get()
  @ApiOperation({ operationId: 'listRequestInternalNotes', summary: 'List private request notes', description: 'Active STAFF on current assignments or MANAGER within existing A01 organization scope. USER is forbidden. Authenticated no-store response; newest first (createdAt DESC, id DESC). Strict limit/cursor query only, no note count.' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, description: 'Existing opaque base64url (createdAt,id) keyset cursor', type: String })
  @ApiResponse({ status: 200, schema: schema(internalNoteListSchema) })
  async list(@Param('id') id: string, @Query() query: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { ...await this.notes.list(uuid(id), req.auth!, query), requestId: res.locals.requestId };
  }

  @Post() @HttpCode(201)
  @ApiOperation({ operationId: 'createRequestInternalNote', summary: 'Append a private plain-text note', description: 'Same STAFF/MANAGER scope as list. Server derives author and timestamp. Trimmed body 1–4000 Unicode code points, using the installed shared Zod text policy. Allowed through RESOLVED; CLOSED/CANCELED read-only. Child insertion plus safe audit only: no expectedVersion or workflow changes, notifications or AI input. No edit/delete routes.' })
  @ApiBody({ schema: schema(createInternalNoteSchema) })
  @ApiResponse({ status: 201, schema: schema(internalNoteResponseSchema) })
  @ApiResponse({ status: 409, description: 'INVALID_STATE: CLOSED/CANCELED; no writes' })
  @ApiResponse({ status: 413, description: 'JSON exceeds existing 64 KiB limit' })
  @ApiResponse({ status: 415, description: 'application/json required' })
  async create(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    return { data: await this.notes.create(uuid(id), req.auth!, parse(createInternalNoteSchema, body), res.locals.requestId), requestId: res.locals.requestId };
  }
}
