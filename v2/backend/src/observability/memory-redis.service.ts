import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { RedisClient } from './redis.types';

type Entry = { value: string; expiresAt?: number };

/**
 * In-process Redis substitute for local dev (no REDIS_URL required).
 * Data is lost on restart; use a real Redis in production.
 */
@Injectable()
export class MemoryRedisService implements RedisClient, OnModuleDestroy {
  private readonly logger = new Logger(MemoryRedisService.name);
  private readonly store = new Map<string, Entry>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor() {
    this.sweeper = setInterval(() => this.sweepExpired(), 60_000);
    this.logger.log('Using in-memory Redis (set REDIS_URL for a real instance)');
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.getEntry(key);
    return entry?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const existing = this.store.get(key);
    this.store.set(key, { value, expiresAt: existing?.expiresAt });
  }

  async incr(key: string): Promise<number> {
    const entry = this.getEntry(key);
    const next = (entry ? parseInt(entry.value, 10) || 0 : 0) + 1;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt });
    return next;
  }

  async incrby(key: string, amount: number): Promise<number> {
    const entry = this.getEntry(key);
    const next = (entry ? parseInt(entry.value, 10) || 0 : 0) + amount;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt });
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.getEntry(key) ?? { value: '0' };
    entry.expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, entry);
  }

  async expireat(key: string, unixSeconds: number): Promise<void> {
    const entry = this.getEntry(key) ?? { value: '0' };
    entry.expiresAt = unixSeconds * 1000;
    this.store.set(key, entry);
  }

  private getEntry(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}
