import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT, type RedisClient } from './redis.types';

/** Rough $/token rates for cost estimation (input + output blended). */
const MODEL_COST_PER_TOKEN: Record<string, number> = {
  'claude-haiku-4-5-20251001': 0.000_001,
  'claude-sonnet-4-20250514': 0.000_006,
  'claude-sonnet-4-5': 0.000_006,
};

@Injectable()
export class CostMonitorService {
  private readonly logger = new Logger(CostMonitorService.name);

  private readonly limits = {
    perRequestWarn: 0.05,
    perUserDayWarn: 1.0,
    perUserDayBlock: 5.0,
    globalDayWarn: 50.0,
    globalDayAlert: 100.0,
  };

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  estimateCost(
    model: string | undefined,
    usage: { input_tokens: number; output_tokens: number },
  ): number {
    const rate =
      MODEL_COST_PER_TOKEN[model ?? ''] ??
      MODEL_COST_PER_TOKEN['claude-sonnet-4-20250514'];
    return (usage.input_tokens + usage.output_tokens) * rate;
  }

  async checkRequestCost(userId: string, estimatedCost: number) {
    const today = new Date().toISOString().split('T')[0];

    if (estimatedCost > this.limits.perRequestWarn) {
      this.logger.warn(
        `High-cost request: $${estimatedCost.toFixed(4)} for user ${userId}`,
      );
    }

    const userMicro = parseInt(
      (await this.redis.get(`cost:user:${userId}:${today}`)) || '0',
      10,
    );
    const userSpend = userMicro / 1_000_000;

    if (userSpend >= this.limits.perUserDayBlock) {
      throw new Error('Daily spending limit reached. Try again tomorrow.');
    }

    if (userSpend >= this.limits.perUserDayWarn) {
      this.logger.warn(
        `User ${userId} approaching daily limit: $${userSpend.toFixed(3)}`,
      );
    }
  }

  async recordCost(
    userId: string,
    costUsd: number,
    tokens: number,
    model?: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const microUsd = Math.round(costUsd * 1_000_000);

    await this.redis.incrby(`cost:user:${userId}:${today}`, microUsd);
    await this.redis.expireat(
      `cost:user:${userId}:${today}`,
      this.tomorrowMidnight(),
    );
    await this.redis.incrby(`cost:global:${today}`, microUsd);
    await this.redis.incrby(`tokens:global:${today}`, tokens);

    if (model) {
      await this.redis.incrby(`model_usage:${model}:${today}`, tokens);
    }

    const globalMicro = parseInt(
      (await this.redis.get(`cost:global:${today}`)) || '0',
      10,
    );
    const globalUsd = globalMicro / 1_000_000;
    if (globalUsd >= this.limits.globalDayAlert) {
      this.logger.error(`Global daily cost alert: $${globalUsd.toFixed(2)}`);
    } else if (globalUsd >= this.limits.globalDayWarn) {
      this.logger.warn(`Global daily cost warning: $${globalUsd.toFixed(2)}`);
    }
  }

  async getDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const globalMicro = parseInt(
      (await this.redis.get(`cost:global:${today}`)) || '0',
      10,
    );

    return {
      date: today,
      totalCostUsd: (globalMicro / 1_000_000).toFixed(4),
      totalTokens: (await this.redis.get(`tokens:global:${today}`)) || '0',
      topCostUsers: [],
      noContextRate: await this.calculateNoContextRate(today),
      errorRate: await this.calculateErrorRate(today),
      modelBreakdown: {
        haiku: await this.redis.get(
          `model_usage:claude-haiku-4-5-20251001:${today}`,
        ),
        sonnet: await this.redis.get(`model_usage:claude-sonnet-4-5:${today}`),
      },
    };
  }

  async incrementCounter(key: string) {
    await this.redis.incr(key);
    await this.redis.expireat(key, this.tomorrowMidnight());
  }

  private async calculateNoContextRate(date: string) {
    const noContext = parseInt(
      (await this.redis.get(`no_context:${date}`)) || '0',
      10,
    );
    const total = parseInt(
      (await this.redis.get(`requests:total:${date}`)) || '1',
      10,
    );
    return ((noContext / total) * 100).toFixed(1) + '%';
  }

  private async calculateErrorRate(date: string) {
    const errors = parseInt(
      (await this.redis.get(`errors:total:${date}`)) || '0',
      10,
    );
    const total = parseInt(
      (await this.redis.get(`requests:total:${date}`)) || '1',
      10,
    );
    return ((errors / total) * 100).toFixed(1) + '%';
  }

  private tomorrowMidnight(): number {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.floor(tomorrow.getTime() / 1000);
  }
}
