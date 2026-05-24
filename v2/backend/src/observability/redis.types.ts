/** Minimal Redis surface used by rate limiting and cost tracking. */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  incr(key: string): Promise<number>;
  incrby(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  expireat(key: string, unixSeconds: number): Promise<void>;
}

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
