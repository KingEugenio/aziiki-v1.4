import type { Store, IncrementResponse, Options } from "express-rate-limit";
import { redis } from "./redis";

/**
 * express-rate-limit ships an in-memory store by default, which only counts
 * requests seen by the single process handling them - useless the moment
 * you run more than one server instance behind a load balancer. This store
 * keeps counters in Upstash Redis instead, so the limit is enforced
 * correctly no matter how many instances are running.
 */
export class UpstashRateLimitStore implements Store {
  windowMs = 60_000;
  prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `ratelimit:${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = this.key(key);
    const totalHits = await redis.incr(redisKey);
    if (totalHits === 1) {
      await redis.pexpire(redisKey, this.windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.key(key);
    const current = await redis.decr(redisKey);
    if (current <= 0) {
      await redis.del(redisKey);
    }
  }

  async resetKey(key: string): Promise<void> {
    await redis.del(this.key(key));
  }
}
