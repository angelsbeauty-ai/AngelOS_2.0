import { AsyncLocalStorage } from 'node:async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

/** Who is making this request (set after auth guards). Lets AI usage be counted/limited without threading ids everywhere. */
export interface RequestCtx { userId?: string; workspaceId?: string }
export const requestContext = new AsyncLocalStorage<RequestCtx>();
export function currentRequest(): RequestCtx { return requestContext.getStore() ?? {}; }

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest();
      const ws = req?.params?.workspaceId;
      requestContext.enterWith({ userId: req?.user?.id, workspaceId: typeof ws === 'string' && /^[0-9a-f-]{36}$/i.test(ws) ? ws : undefined });
    }
    return next.handle();
  }
}
