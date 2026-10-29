import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

const TOKEN_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWTs
  /\b(EAA|IGQ|sk-|xai-|sb_)[A-Za-z0-9_-]{10,}/g, // Meta / Instagram / API keys
];
const QUERY_SECRET = /([?&](?:access_token|token|key|code|secret|signature)=)[^&\s]+/gi;

/** Strips anything that looks like a credential from a log line. Request bodies and headers are never logged. */
export function redactSecrets(text: string): string {
  let out = String(text ?? '');
  for (const re of TOKEN_PATTERNS) out = out.replace(re, '[redacted]');
  return out.replace(QUERY_SECRET, '$1[redacted]');
}

/** Route template (e.g. /workspaces/:workspaceId/messaging/threads) so ids and query strings never reach the log. */
export function routeOf(req: any): string {
  const template = req?.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : null;
  if (template) return template;
  const path = String(req?.originalUrl ?? req?.url ?? '').split('?')[0];
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}

/**
 * Logs every 4xx/5xx with method, route and status (plus the stack for 5xx), then hands the response to Nest's
 * default filter, so what clients receive is unchanged. Bodies, headers and tokens are never logged.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly log = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') {
      const req = host.switchToHttp().getRequest();
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      const raw = redactSecrets(exception instanceof Error ? exception.message : String(exception));
      const message = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
      const line = `${req?.method ?? '?'} ${routeOf(req)} ${status} ${message}`;
      if (status >= 500) this.log.error(line, exception instanceof Error && exception.stack ? redactSecrets(exception.stack) : undefined);
      else if (status >= 400) this.log.warn(line);
    }
    super.catch(exception, host);
  }
}
