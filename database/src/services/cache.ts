/**
 * Generic in-memory TTL cache with max-entry eviction.
 *
 * Intended for caching external API responses (fight data, user lookups)
 * so repeat requests within the TTL window are served instantly without
 * hitting the external game API again.
 *
 * - Lazy expiry: stale entries are evicted on `get()`.
 * - FIFO eviction: when `maxEntries` is reached, the oldest entry is removed.
 * - Supports negative caching (`null` is a valid value).
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { data: T; expires: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(opts: { ttlMs: number; maxEntries: number }) {
    this.ttlMs = opts.ttlMs;
    this.maxEntries = opts.maxEntries;
  }

  /** Return cached value if present and not expired. `undefined` = cache miss. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /** Return `true` if the key exists and is not expired. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Store a value with the default TTL. Evicts oldest entry if at capacity. */
  set(key: string, value: T): void {
    // If the key already exists, delete first so it moves to end of Map order
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    // Evict oldest when at capacity
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
      else break;
    }
    this.store.set(key, { data: value, expires: Date.now() + this.ttlMs });
  }

  /** Number of entries currently in the cache (may include expired). */
  get size(): number {
    return this.store.size;
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Diagnostic summary. */
  stats(): { size: number; maxEntries: number; ttlMs: number } {
    return { size: this.store.size, maxEntries: this.maxEntries, ttlMs: this.ttlMs };
  }
}
