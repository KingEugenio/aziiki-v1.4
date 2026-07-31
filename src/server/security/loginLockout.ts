import { redis } from "../redis";

/**
 * Progressive account lockout, layered ON TOP OF (not instead of):
 *  - Supabase Auth's own project-wide rate limiting on GoTrue endpoints
 *    (configurable under Dashboard -> Authentication -> Rate Limits), which
 *    protects the project/infrastructure from being overwhelmed but is
 *    IP/project scoped, not per-account.
 *  - The express-rate-limit `loginLimiter` in rateLimiters.ts, which is
 *    IP+email scoped and resets on its own fixed window.
 *
 * This module tracks failed attempts PER ACCOUNT (by normalized email)
 * regardless of source IP, so an attacker spreading attempts across many IPs
 * still can't brute-force one specific account. Cooldown length increases
 * with repeated lockouts of the same account.
 */

const FAILED_ATTEMPT_THRESHOLD = 5;
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // failed-attempt counter itself expires after 15 minutes of no new failures
const LOCKOUT_STAGES_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60]; // 1m, 5m, 15m, 60m (repeat offenses cap at 60m)
const LOCKOUT_STAGE_MEMORY_SECONDS = 24 * 60 * 60; // how long we remember "this account has been locked before"

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds?: number;
}

export async function checkLockout(email: string): Promise<LockoutStatus> {
  const key = `lockout:locked:${normalize(email)}`;
  const ttl = await redis.ttl(key);
  if (ttl && ttl > 0) {
    return { locked: true, retryAfterSeconds: ttl };
  }
  return { locked: false };
}

/**
 * Call after a failed password verification. Returns the resulting lockout
 * status so the caller can decide what to tell the user (still generically,
 * per the "Incorrect email or password" requirement - only the retry-after
 * timing changes, never the wording).
 */
export async function recordFailedAttempt(email: string): Promise<LockoutStatus> {
  const normalized = normalize(email);
  const attemptsKey = `lockout:attempts:${normalized}`;

  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) {
    await redis.expire(attemptsKey, ATTEMPT_WINDOW_SECONDS);
  }

  if (attempts < FAILED_ATTEMPT_THRESHOLD) {
    return { locked: false };
  }

  // Threshold reached: lock the account and escalate the cooldown based on
  // how many times this account has been locked recently.
  const stageKey = `lockout:stage:${normalized}`;
  const stage = await redis.incr(stageKey);
  await redis.expire(stageKey, LOCKOUT_STAGE_MEMORY_SECONDS);

  const cooldownSeconds = LOCKOUT_STAGES_SECONDS[Math.min(stage - 1, LOCKOUT_STAGES_SECONDS.length - 1)];

  const lockedKey = `lockout:locked:${normalized}`;
  await redis.set(lockedKey, "1", { ex: cooldownSeconds });
  await redis.del(attemptsKey);

  return { locked: true, retryAfterSeconds: cooldownSeconds };
}

/** Call after a successful login: the rightful owner is back in control. */
export async function clearLockout(email: string): Promise<void> {
  const normalized = normalize(email);
  await Promise.all([
    redis.del(`lockout:attempts:${normalized}`),
    redis.del(`lockout:locked:${normalized}`),
    redis.del(`lockout:stage:${normalized}`),
  ]);
}
