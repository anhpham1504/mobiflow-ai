import { randomUUID } from 'node:crypto';
import { Catch, HttpException, ValidationPipe } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

export const validationPipe = () => new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, forbidUnknownValues: true, validationError: { target: false, value: false } });
export type LogSink = (entry: Record<string, unknown>) => void;
export function requestContext(log: LogSink) {
  return (req: Request, res: Response, next: NextFunction) => {
    const proposed = req.header('X-Request-ID');
    const requestId = proposed && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposed) ? proposed : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Cache-Control', 'no-store');
    const start = performance.now();
    res.once('finish', () => log({ event: 'http.request', requestId, method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, latencyMs: Math.round(performance.now() - start) }));
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
    const status = exception instanceof HttpException ? exception.getStatus() : oversized ? 413 : 500;
    const code = status === 400 ? 'INVALID_INPUT' : status === 404 ? 'NOT_FOUND' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
    const requestId: string = res.locals.requestId ?? randomUUID();
    this.log({ event: 'http.error', requestId, status, code });
    res.status(status).json({ error: { code, message: status < 500 ? 'The request could not be processed.' : 'An internal error occurred.' }, requestId });
  }
}
