import type { CostMonitorService } from './cost-monitor.service';
import type { RateLimiterService } from './rate-limiter.service';

type Usage = { input_tokens: number; output_tokens: number };

export async function recordAiUsage(
  rateLimiter: RateLimiterService,
  costMonitor: CostMonitorService,
  opts: {
    userId: string;
    model?: string;
    usage: Usage;
    latencyMs: number;
    cached?: boolean;
  },
): Promise<void> {
  const tokens = opts.usage.input_tokens + opts.usage.output_tokens;

  console.log(
    JSON.stringify({
      event: 'ai_request',
      userId: opts.userId,
      latencyMs: opts.latencyMs,
      inputTokens: opts.usage.input_tokens,
      outputTokens: opts.usage.output_tokens,
      model: opts.model,
      cached: opts.cached ?? false,
      timestamp: new Date().toISOString(),
    }),
  );

  await rateLimiter.recordUsage(opts.userId, tokens);

  const cost = costMonitor.estimateCost(opts.model, opts.usage);
  await costMonitor.recordCost(opts.userId, cost, tokens, opts.model);
}
