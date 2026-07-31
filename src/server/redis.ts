import { Redis } from "@upstash/redis";
import { env } from "./env";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Short-TTL read-through cache for frequently-read, rarely-changed data
 * (dashboard aggregates, list endpoints, session/profile lookups). Callers
 * pass a loader that hits Postgres on a cache miss; the result is cached for
 * `ttlSeconds` so repeat requests within that window skip the database.
 *
 * This is the "cache-check-then-database-fallback" pattern referenced
 * throughout the route handlers.
 */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) {
    return hit;
  }
  const fresh = await loader();
  // Fire-and-forget: a cache write failure should never fail the request.
  redis.set(key, fresh, { ex: ttlSeconds }).catch((err) => {
    console.error(`[redis] failed to cache key ${key}:`, err);
  });
  return fresh;
}

/** Invalidate one or more cache keys after a write (create/update/delete). */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.error(`[redis] failed to invalidate keys ${keys.join(", ")}:`, err);
  }
}
