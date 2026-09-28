import { z } from 'zod';
import { ApiError } from '../http.js';
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(400,'INVALID_INPUT','The request contains missing or invalid fields.');
  return result.data;
}
export function uuid(input: string) { return parse(z.uuid(),input); }

