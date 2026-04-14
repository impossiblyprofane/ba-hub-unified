/**
 * GraphQL operation metrics — tracks each unique operation name and its
 * call count, error count, and latency. Fed from Mercurius `preExecution`
 * and `onResolution` hooks in index.ts.
 *
 * Anonymous operations are grouped under a single bucket keyed by the
 * first 40 characters of the query text so we can still tell them apart
 * from the main named queries.
 */

interface OperationSample {
  calls: number;
  errors: number;
  sumDurationMs: number;
  maxDurationMs: number;
  lastAt: number;
  lastErrorAt: number | null;
  lastError: string | null;
}

export interface GraphqlOperationMetric {
  name: string;
  calls: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  lastAt: number;
  lastErrorAt: number | null;
  lastError: string | null;
}

export interface GraphqlMetrics {
  begin(name: string): { name: string; t0: number };
  end(
    token: { name: string; t0: number },
    opts: { errors?: readonly unknown[] | null },
  ): void;
  snapshot(): GraphqlOperationMetric[];
  reset(): void;
}

export function createGraphqlMetrics(): GraphqlMetrics {
  const ops = new Map<string, OperationSample>();

  return {
    begin(name) {
      return { name: name || '(anonymous)', t0: Date.now() };
    },

    end(token, { errors }) {
      const durationMs = Date.now() - token.t0;
      let row = ops.get(token.name);
      if (!row) {
        row = {
          calls: 0,
          errors: 0,
          sumDurationMs: 0,
          maxDurationMs: 0,
          lastAt: 0,
          lastErrorAt: null,
          lastError: null,
        };
        ops.set(token.name, row);
      }
      row.calls++;
      row.sumDurationMs += durationMs;
      if (durationMs > row.maxDurationMs) row.maxDurationMs = durationMs;
      row.lastAt = Date.now();
      if (errors && errors.length > 0) {
        row.errors++;
        row.lastErrorAt = row.lastAt;
        const first = errors[0];
        row.lastError =
          first && typeof first === 'object' && 'message' in first
            ? String((first as { message: unknown }).message)
            : String(first);
      }
    },

    snapshot() {
      const out: GraphqlOperationMetric[] = [];
      for (const [name, row] of ops) {
        out.push({
          name,
          calls: row.calls,
          errors: row.errors,
          errorRate: row.calls > 0 ? Math.round((row.errors / row.calls) * 1000) / 10 : 0,
          avgDurationMs:
            row.calls > 0 ? Math.round((row.sumDurationMs / row.calls) * 100) / 100 : 0,
          maxDurationMs: Math.round(row.maxDurationMs * 100) / 100,
          lastAt: row.lastAt,
          lastErrorAt: row.lastErrorAt,
          lastError: row.lastError,
        });
      }
      out.sort((a, b) => b.calls - a.calls);
      return out;
    },

    reset() {
      ops.clear();
    },
  };
}
