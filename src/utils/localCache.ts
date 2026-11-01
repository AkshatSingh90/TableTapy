/**
 * TableTapy High-Performance Client Cache
 * Implements Stale-While-Revalidate (SWR) with Instant 0ms Render.
 * Scoped by restaurantId to ensure clean multi-tenant isolation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
  version?: number;
}

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes default cache lifetime

export const LocalCache = {
  /**
   * Get cached data instantly.
   * Returns data if present, regardless of whether it's stale (for 0ms instant UI rendering).
   */
  get<T>(key: string): { data: T | null; isStale: boolean } {
    if (typeof window === "undefined") {
      return { data: null, isStale: true };
    }

    try {
      const raw = localStorage.getItem(`tt_cache_${key}`);
      if (!raw) return { data: null, isStale: true };

      const entry: CacheEntry<T> = JSON.parse(raw);
      const isStale = Date.now() - entry.timestamp > (entry.ttl || DEFAULT_TTL);

      return { data: entry.data, isStale };
    } catch (e) {
      console.warn(`[LocalCache] Failed to read key "${key}":`, e);
      return { data: null, isStale: true };
    }
  },

  /**
   * Store data in cache with an expiration window.
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    if (typeof window === "undefined") return;

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`tt_cache_${key}`, JSON.stringify(entry));

      // Broadcast update to any other listeners/tabs
      window.dispatchEvent(
        new CustomEvent("tt_cache_updated", { detail: { key } })
      );
    } catch (e) {
      console.warn(`[LocalCache] Quota exceeded or write failed for "${key}":`, e);
    }
  },

  /**
   * Invalidate or remove a specific cache key
   */
  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`tt_cache_${key}`);
      window.dispatchEvent(
        new CustomEvent("tt_cache_invalidated", { detail: { key } })
      );
    } catch {}
  },

  /**
   * Universal instant lookup: tries exact key, or scans for any matching prefix
   */
  getAny<T>(scopePrefix: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      // 1. Direct match
      const direct = this.get<T>(scopePrefix);
      if (direct.data) return direct.data;

      // 2. Prefix scan
      const fullPrefix = `tt_cache_${scopePrefix}`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(fullPrefix)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const entry: CacheEntry<T> = JSON.parse(raw);
            if (entry.data) return entry.data;
          }
        }
      }
    } catch {}
    return null;
  },

  /**
   * Helper to construct restaurant-scoped keys
   */
  makeKey(scope: string, restaurantId?: string): string {
    return restaurantId ? `${scope}_${restaurantId}` : scope;
  },
};
