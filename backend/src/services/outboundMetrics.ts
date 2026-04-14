/**
 * Outbound HTTP metrics — tracks calls the backend makes to external
 * services (partner stats API, internal database service). Surfaced on the
 * admin panel so rate-limit surges and latency spikes are visible at a
 * glance.
 *
 * Categories are free-form strings (e.g. 'stats-api', 'database-service',
 * 'steam-api'). Each category keeps its own aggregate counters so the
 * panel can display them side-by-side.
 */

interface CategorySample {
  calls: number;
  errors: number;
  sumDurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastDurationMs: number;
  lastError: string | null;
  lastAt: number;
  lastErrorAt: number | null;
}

export interface OutboundCategoryMetric {
  category: string;
  calls: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastDurationMs: number;
  lastError: string | null;
  lastAt: number;
  lastErrorAt: number | null;
}

export interface OutboundMetrics {
  record(category: string, opts: { durationMs: number; status?: number; error?: string | null }): void;
  snapshot(): OutboundCategoryMetric[];
  reset(): void;
}

export function createOutboundMetrics(): OutboundMetrics {
  const cats = new Map<string, CategorySample>();

  return {
    record(category, { durationMs, status = 0, error = null }) {
      let row = cats.get(category);
      if (!row) {
        row = {
          calls: 0,
          errors: 0,
          sumDurationMs: 0,
          maxDurationMs: 0,
          lastStatus: 0,
          lastDurationMs: 0,
          lastError: null,
          lastAt: 0,
          lastErrorAt: null,
        };
        cats.set(category, row);
      }
      row.calls++;
      row.sumDurationMs += durationMs;
      if (durationMs > row.maxDurationMs) row.maxDurationMs = durationMs;
      row.lastStatus = status;
      row.lastDurationMs = durationMs;
      row.lastAt = Date.now();
      if (error || (status > 0 && status >= 400)) {
        row.errors++;
        row.lastError = error ?? `HTTP ${status}`;
        row.lastErrorAt = row.lastAt;
      }
    },

    snapshot() {
      const out: OutboundCategoryMetric[] = [];
      for (const [category, row] of cats) {
        out.push({
          category,
          calls: row.calls,
          errors: row.errors,
          errorRate: row.calls > 0 ? Math.round((row.errors / row.calls) * 1000) / 10 : 0,
          avgDurationMs:
            row.calls > 0 ? Math.round((row.sumDurationMs / row.calls) * 100) / 100 : 0,
          maxDurationMs: Math.round(row.maxDurationMs * 100) / 100,
          lastStatus: row.lastStatus,
          lastDurationMs: Math.round(row.lastDurationMs * 100) / 100,
          lastError: row.lastError,
          lastAt: row.lastAt,
          lastErrorAt: row.lastErrorAt,
        });
      }
      out.sort((a, b) => b.calls - a.calls);
      return out;
    },

    reset() {
      cats.clear();
    },
  };
}

/**
 * Helper: wrap a `fetch`-style call with outbound metrics. Records the
 * duration and HTTP status automatically; treats thrown errors as a failed
 * call with status 0.
 */
export async function trackOutbound<T>(
  metrics: OutboundMetrics,
  category: string,
  fn: () => Promise<Response>,
  parse: (res: Response) => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const res = await fn();
    const durationMs = Date.now() - t0;
    metrics.record(category, { durationMs, status: res.status });
    return await parse(res);
  } catch (err) {
    const durationMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    metrics.record(category, { durationMs, error: message });
    throw err;
  }
}
