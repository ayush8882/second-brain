import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT, type RedisClient } from './redis.types';
import { RateLimitError } from './rate-limit.error';

@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async check(userId: string) {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const today = new Date().toISOString().split('T')[0];

    const reqKey = `rl:req:${userId}:${minute}`;
    const reqCount = await this.redis.incr(reqKey);
    if (reqCount === 1) await this.redis.expire(reqKey, 61);

    if (reqCount > 10) {
      const retryAfter = 60 - (now % 60_000) / 1000;
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(retryAfter)} seconds.`,
        429,
        retryAfter,
      );
    }

    const tokenKey = `rl:tokens:${userId}:${today}`;
    const tokenCount = parseInt((await this.redis.get(tokenKey)) || '0', 10);

    if (tokenCount > 100_000) {
      throw new RateLimitError(
        'Daily token limit reached. Resets at midnight.',
        429,
      );
    }

    const globalKey = `rl:global:${minute}`;
    const globalCount = await this.redis.incr(globalKey);
    if (globalCount === 1) await this.redis.expire(globalKey, 61);

    if (globalCount > 45) {
      throw new RateLimitError(
        'System at capacity. Please try again shortly.',
        503,
      );
    }

    return { reqCount, tokenCount, globalCount };
  }

  async recordUsage(userId: string, tokensUsed: number) {
    const today = new Date().toISOString().split('T')[0];
    const key = `rl:tokens:${userId}:${today}`;
    await this.redis.incrby(key, tokensUsed);
    await this.redis.expireat(key, this.tomorrowMidnight());
  }

  private tomorrowMidnight(): number {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.floor(tomorrow.getTime() / 1000);
  }
}
