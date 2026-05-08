/**
 * In-memory sliding-window rate limiter.
 *
 * Each limiter tracks requests per user (keyed by user ID) and rejects
 * excess calls within the configured window.  Suitable for single-instance
 * deployments; for multi-instance use Upstash or Redis instead.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed inside the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(name: string, opts: RateLimiterOptions) {
  // Reuse the same store across hot-reloads in dev (global singleton per name)
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  return {
    /**
     * Returns `{ allowed: true }` if the request is within limits,
     * otherwise `{ allowed: false, retryAfterMs }`.
     */
    check(userId: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
      const now = Date.now();
      const entry = store.get(userId) ?? { timestamps: [] };

      // Remove timestamps outside the current window
      entry.timestamps = entry.timestamps.filter((t) => now - t < opts.windowMs);

      if (entry.timestamps.length >= opts.maxRequests) {
        const oldest = entry.timestamps[0];
        const retryAfterMs = opts.windowMs - (now - oldest);
        return { allowed: false, retryAfterMs };
      }

      entry.timestamps.push(now);
      store.set(userId, entry);
      return { allowed: true };
    },
  };
}
