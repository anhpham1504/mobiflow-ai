import { randomUUID } from 'node:crypto';
import { Catch, HttpException, ValidationPipe } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

export const validationPipe = () => new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, forbidUnknownValues: true, validationError: { target: false, value: false } });
export type LogSink = (entry: Record<string, unknown>) => void;
export class ApiError extends HttpException {
  constructor(status: number, readonly code: string, readonly publicMessage: string, readonly retryAfterSeconds?: number) {
    super(publicMessage, status);
  }
}
export function requestContext(log: LogSink) {
  return (req: Request, res: Response, next: NextFunction) => {
    const proposed = req.header('X-Request-ID');
    const requestId = proposed && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposed) ? proposed : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Cache-Control', 'no-store');
    const start = performance.now();
    res.once('finish', () => {
      const actor = (req as Request & { auth?: { id: string; sessionId: string } }).auth;
      log({ event: 'http.request', requestId, method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, latencyMs: Math.round(performance.now() - start), ...(actor ? { actorId: actor.id, sessionId: actor.sessionId } : {}) });
    });
    next();
  };
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly log: LogSink) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    // Express body-parser's size error is not a Nest HttpException.
    const oversized = exception instanceof Error && 'type' in exception && exception.type === 'entity.too.large' && 'status' in exception && exception.status === 413;
    const databaseUnavailable = !(exception instanceof HttpException) && isDatabaseUnavailable(exception);
    const status = exception instanceof HttpException ? exception.getStatus() : oversized ? 413 : databaseUnavailable ? 503 : 500;
    const apiError = exception instanceof ApiError ? exception : undefined;
    const code = apiError?.code ?? (databaseUnavailable ? 'DATABASE_UNAVAILABLE' : status === 400 ? 'INVALID_INPUT' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR');
    const requestId: string = res.locals.requestId ?? randomUUID();
    if (apiError?.retryAfterSeconds) res.setHeader('Retry-After', String(apiError.retryAfterSeconds));
    const internalErrorCode = status >= 500 && typeof exception === 'object' && exception !== null && 'code' in exception && typeof exception.code === 'string' && /^[A-Z0-9_-]{1,40}$/.test(exception.code) ? exception.code : undefined;
    const databaseErrorCode = status >= 500 ? getDatabaseErrorCode(exception) : undefined;
    this.log({ event: 'http.error', requestId, status, code, ...(internalErrorCode ? { internalErrorCode } : {}), ...(databaseErrorCode ? { databaseErrorCode } : {}) });
    res.status(status).json({ error: { code, message: apiError?.publicMessage ?? (databaseUnavailable ? 'The database is temporarily unavailable.' : status < 500 ? 'The request could not be processed.' : 'An internal error occurred.') }, requestId });
  }
}

function isDatabaseUnavailable(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;
  if ('code' in exception && typeof exception.code === 'string' && ['P1001', 'P1002', 'P1017', 'P2024', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(exception.code)) return true;
  if (exception instanceof Error && ['timeout exceeded when trying to connect', 'Connection terminated due to connection timeout'].includes(exception.message)) return true;
  const meta = 'meta' in exception ? exception.meta : undefined;
  const adapter = typeof meta === 'object' && meta !== null && 'driverAdapterError' in meta ? meta.driverAdapterError : exception;
  const cause = typeof adapter === 'object' && adapter !== null && 'cause' in adapter ? adapter.cause : undefined;
  return typeof cause === 'object' && cause !== null && 'kind' in cause && typeof cause.kind === 'string' && ['DatabaseNotReachable', 'ConnectionClosed', 'SocketTimeout', 'TooManyConnections'].includes(cause.kind);
}

function getDatabaseErrorCode(exception: unknown): string | undefined {
  if (typeof exception !== 'object' || exception === null || !('meta' in exception)) return undefined;
  const meta = exception.meta;
  if (typeof meta !== 'object' || meta === null || !('driverAdapterError' in meta)) return undefined;
  const adapterError = meta.driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null || !('cause' in adapterError)) return undefined;
  const cause = adapterError.cause;
  if (typeof cause !== 'object' || cause === null || !('originalCode' in cause)) return undefined;
  return typeof cause.originalCode === 'string' && /^[A-Z0-9]{3,10}$/.test(cause.originalCode) ? cause.originalCode : undefined;
}
