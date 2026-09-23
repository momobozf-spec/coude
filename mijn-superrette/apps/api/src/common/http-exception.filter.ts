import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody } from '@superrette/validation';

/** Uniform error body: { statusCode, code, message, details? }. Never leaks stack traces. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let body: ApiErrorBody;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const obj = typeof res === 'object' && res !== null ? (res as Record<string, unknown>) : {};
      body = {
        statusCode: status,
        code: typeof obj.code === 'string' ? obj.code : (HttpStatus[status] ?? 'ERROR'),
        message: typeof obj.message === 'string' ? obj.message : exception.message,
        ...(obj.details !== undefined ? { details: obj.details } : {}),
      };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      body = { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
    }
    response.status(body.statusCode).json(body);
  }
}
