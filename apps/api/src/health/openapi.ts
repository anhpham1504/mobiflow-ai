import { z } from 'zod';
import { readinessResponseSchema } from '@mobiflow/contracts';
import type { SchemaObject } from '@nestjs/swagger';

// Generated from the same runtime schema used by the web client and API tests.
export const readinessOpenApi = z.toJSONSchema(readinessResponseSchema, { target: 'openapi-3.0' }) as SchemaObject;
export const livenessOpenApi: SchemaObject = {
  type: 'object', required: ['data', 'requestId'], properties: {
    data: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['UP'] } } },
    requestId: { type: 'string', format: 'uuid' },
  },
};
