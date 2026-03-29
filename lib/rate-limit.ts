/**
 * In-memory rate limiter.
 * Uses a Map keyed by an identifier (usually the client IP).
 * Resets the window automatically on the first request after expiry.
 *
 * NOTE: Because Next.js may run multiple workers in production the
 * counter is per-worker, not global.  For a single-instance deployment
 * (Vercel Hobby / self-hosted) this is fully effective.
 */
const rateMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns true if the request is within the allowed limit.
 * Returns false if the caller should respond with 429.
 *
 * @param id        - Unique identifier for the client (e.g. IP address).
 * @param limit     - Maximum allowed requests per window (default 10).
 * @param windowMs  - Window size in milliseconds (default 60 000 = 1 min).
 */
export function checkRateLimit(
  id: string,
  limit = 10,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = rateMap.get(id);

  if (!entry || now > entry.resetAt) {
    rateMap.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
