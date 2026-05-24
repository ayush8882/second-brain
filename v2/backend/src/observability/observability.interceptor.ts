import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { RateLimitError } from './rate-limit.error';
import { CostMonitorService } from './cost-monitor.service';
import { RateLimiterService } from './rate-limiter.service';
import { recordAiUsage } from './record-ai-usage';

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly costMonitor: CostMonitorService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // SSE streams must not be wrapped in tap/pipe — it breaks chunk delivery to the client.
    const isSse = Reflect.getMetadata(SSE_METADATA, context.getHandler());
    if (isSse) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const userId =
      request.user?.id ??
      (typeof request.headers?.['x-user-id'] === 'string'
        ? request.headers['x-user-id']
        : 'anonymous');
    const startTime = Date.now();

    try {
      await this.rateLimiter.check(userId);
    } catch (err) {
      if (err instanceof RateLimitError) {
        throw new HttpException(
          err.message,
          err.statusCode,
          err.retryAfter
            ? { cause: err, description: String(err.retryAfter) }
            : undefined,
        );
      }
      throw err;
    }

    return next.handle().pipe(
      tap((result: unknown) => {
        const payload = result as {
          usage?: { input_tokens: number; output_tokens: number };
          model?: string;
          cached?: boolean;
        } | null;

        if (!payload?.usage) return;

        void recordAiUsage(this.rateLimiter, this.costMonitor, {
          userId,
          model: payload.model,
          usage: payload.usage,
          latencyMs: Date.now() - startTime,
          cached: payload.cached,
        }).catch((recordErr) => {
          console.error(
            JSON.stringify({
              event: 'ai_observability_error',
              userId,
              errorMsg:
                recordErr instanceof Error
                  ? recordErr.message
                  : String(recordErr),
              timestamp: new Date().toISOString(),
            }),
          );
        });
      }),
      catchError((err: unknown) => {
        console.error(
          JSON.stringify({
            event: 'ai_request_error',
            userId,
            errorType: err instanceof Error ? err.constructor.name : 'Error',
            errorMsg: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          }),
        );
        return throwError(() => err);
      }),
    );
  }
}
