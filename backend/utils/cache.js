/**
 * In-process TTL cache (Redis-compatible interface).
 *
 * Drop-in cache helper for read-heavy endpoints. Designed so the underlying
 * store can later be swapped to Redis without touching call sites.
 *
 * Usage:
 *   import { cached, cacheInvalidate } from "../utils/cache.js";
 *
 *   // Read path
 *   const data = await cached(`analytics:overview:${range}`, 60_000, () =>
 *     runHeavyAggregation(range)
 *   );
 *
 *   // Write path
 *   cacheInvalidate("analytics:");
 *
 * Notes:
 *  - Single Node process only. If/when scaling horizontally, swap the
 *    `store` Map with a Redis-backed implementation; the public API
 *    (`cached`, `cacheGet`, `cacheSet`, `cacheDelete`, `cacheInvalidate`,
 *    `cacheStats`) is identical.
 *  - TTL is in milliseconds.
 *  - Soft cap of 5_000 keys with FIFO eviction prevents runaway memory.
 *  - Cleanup of expired entries runs lazily on read (no background timers).
 *  - In-flight loaders are deduplicated to avoid cache stampedes when
 *    multiple requests hit a cold key concurrently.
 */

const MAX_KEYS = 5_000;

const store = new Map(); // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise (dedupe concurrent loaders)

const stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };

function evictIfNeeded() {
  while (store.size > MAX_KEYS) {
    // Map preserves insertion order — drop the oldest entry.
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
    stats.evictions += 1;
  }
}

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) {
    stats.misses += 1;
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    stats.misses += 1;
    return null;
  }
  stats.hits += 1;
  return entry.value;
}

export function cacheSet(key, value, ttlMs = 60_000) {
  if (typeof key !== "string" || !key) return;
  if (typeof ttlMs !== "number" || ttlMs <= 0) return;
  // Re-insert to bump LRU-ish ordering for FIFO eviction
  store.delete(key);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  stats.sets += 1;
  evictIfNeeded();
}

export function cacheDelete(key) {
  return store.delete(key);
}

/**
 * Invalidate all keys matching a prefix.
 * Example: cacheInvalidate("analytics:") clears every analytics key.
 */
export function cacheInvalidate(prefix) {
  if (typeof prefix !== "string" || !prefix) return 0;
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function cacheClearAll() {
  const size = store.size;
  store.clear();
  inflight.clear();
  return size;
}

export function cacheStats() {
  return {
    ...stats,
    size: store.size,
    inflight: inflight.size,
  };
}

/**
 * Return cached value for `key`, otherwise call `loader()`, cache the
 * resolved value for `ttlMs`, and return it. Concurrent calls for the
 * same key share a single in-flight loader (stampede protection).
 */
export async function cached(key, ttlMs, loader) {
  const hit = cacheGet(key);
  if (hit !== null && hit !== undefined) return hit;

  // Stampede protection: if another caller is already loading this key, await it.
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await loader();
      // Don't cache null/undefined to avoid masking later valid responses.
      if (value !== null && value !== undefined) {
        cacheSet(key, value, ttlMs);
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Express middleware: cache successful JSON responses by request URL.
 *
 * Usage:
 *   router.get("/overview", cacheJSON({ ttlMs: 60_000, prefix: "analytics:" }), handler);
 *
 * Options:
 *   - ttlMs:   how long to cache (default 60 s).
 *   - prefix:  cache-key prefix used for invalidation (e.g. "analytics:").
 *   - keyFn:   optional (req) => string to override the default key.
 *              Default key = `${prefix}${method}:${originalUrl}:${userId|admin|guest}`,
 *              so per-user data isn't shared between accounts.
 */
export function cacheJSON({ ttlMs = 60_000, prefix = "", keyFn } = {}) {
  return async function cacheJSONMiddleware(req, res, next) {
    if (req.method !== "GET") return next();

    const userKey =
      req.admin?._id?.toString?.() ||
      req.user?._id?.toString?.() ||
      req.user?.id?.toString?.() ||
      "anon";
    const defaultKey = `${prefix}${req.method}:${req.originalUrl}:${userKey}`;
    const key = typeof keyFn === "function" ? keyFn(req) : defaultKey;

    try {
      const hit = cacheGet(key);
      if (hit !== null && hit !== undefined) {
        res.setHeader("X-Cache", "HIT");
        return res.status(hit.status || 200).json(hit.body);
      }
    } catch {
      // Fall through to handler on any cache read error.
    }

    res.setHeader("X-Cache", "MISS");

    // Intercept res.json to capture the response payload.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        const status = res.statusCode || 200;
        if (status >= 200 && status < 300) {
          cacheSet(key, { status, body }, ttlMs);
        }
      } catch {
        // Never let cache-write errors break the response.
      }
      return originalJson(body);
    };

    return next();
  };
}

export default {
  cached,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheInvalidate,
  cacheClearAll,
  cacheStats,
  cacheJSON,
};
