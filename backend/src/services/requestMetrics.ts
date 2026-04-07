/**
 * Per-route request metrics — total count, status-class breakdown, and
 * latency percentiles tracked via a bounded reservoir sample.
 *
 * Fed from a single Fastify `onResponse` hook in index.ts. Zero dependencies,
 * in-memory only, resets on backend restart.
 */

interface RouteSample {
  /** Reservoir of response times in ms (bounded). */
  reservoir: number[];
  total: number;
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  sumDurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastDurationMs: number;
  lastAt: number;
}

export interface RouteMetric {
  key: string;
  method: string;
  route: string;
  total: number;
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastDurationMs: number;
  lastAt: number;
}

const RESERVOIR_CAP = 200;

export interface RequestMetrics {
  record(method: string, route: string, status: number, durationMs: number): void;
  snapshot(): RouteMetric[];
  reset(): void;
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return Math.round(sorted[idx] * 100) / 100;
}

export function createRequestMetrics(): RequestMetrics {
  const rows = new Map<string, RouteSample>();

  return {
    record(method, route, status, durationMs) {
      const key = `${method} ${route}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          reservoir: [],
          total: 0,
          count2xx: 0,
          count3xx: 0,
          count4xx: 0,
          count5xx: 0,
          sumDurationMs: 0,
          maxDurationMs: 0,
          lastStatus: 0,
          lastDurationMs: 0,
          lastAt: 0,
        };
        rows.set(key, row);
      }
      row.total++;
      row.sumDurationMs += durationMs;
      if (durationMs > row.maxDurationMs) row.maxDurationMs = durationMs;
      row.lastStatus = status;
      row.lastDurationMs = durationMs;
      row.lastAt = Date.now();

      if (status >= 200 && status < 300) row.count2xx++;
      else if (status >= 300 && status < 400) row.count3xx++;
      else if (status >= 400 && status < 500) row.count4xx++;
      else if (status >= 500) row.count5xx++;

      // Reservoir sampling — keep a bounded, representative sample for percentiles.
      if (row.reservoir.length < RESERVOIR_CAP) {
        row.reservoir.push(durationMs);
      } else {
        const idx = Math.floor(Math.random() * row.total);
        if (idx < RESERVOIR_CAP) row.reservoir[idx] = durationMs;
      }
    },

    snapshot() {
      const out: RouteMetric[] = [];
      for (const [key, row] of rows) {
        const [method, ...rest] = key.split(' ');
        const route = rest.join(' ');
        const sorted = [...row.reservoir].sort((a, b) => a - b);
        out.push({
          key,
          method,
          route,
          total: row.total,
          count2xx: row.count2xx,
          count3xx: row.count3xx,
          count4xx: row.count4xx,
          count5xx: row.count5xx,
          avgDurationMs: row.total > 0 ? Math.round((row.sumDurationMs / row.total) * 100) / 100 : 0,
          p50DurationMs: percentile(sorted, 50),
          p95DurationMs: percentile(sorted, 95),
          p99DurationMs: percentile(sorted, 99),
          maxDurationMs: Math.round(row.maxDurationMs * 100) / 100,
          lastStatus: row.lastStatus,
          lastDurationMs: Math.round(row.lastDurationMs * 100) / 100,
          lastAt: row.lastAt,
        });
      }
      // Sorted by total requests desc
      out.sort((a, b) => b.total - a.total);
      return out;
    },

    reset() {
      rows.clear();
    },
  };
}
