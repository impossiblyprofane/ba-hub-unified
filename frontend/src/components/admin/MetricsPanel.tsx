import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { adminFetch } from '~/lib/admin/adminClient';
import type {
  RoutesResponse,
  OutboundResponse,
  GraphqlResponse,
  SlowRequestsResponse,
  RouteMetric,
  OutboundCategoryMetric,
  GraphqlOperationMetric,
  SlowRequestEntry,
} from '~/lib/admin/types';

const PANEL = 'p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]';
const HEADER = 'font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]';
const THEAD = 'bg-[rgba(26,26,26,0.6)]';
const TH = 'px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]';
const TR = 'border-b border-[rgba(51,51,51,0.1)] hover:bg-[rgba(26,26,26,0.4)]';

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString();
}
function fmtMs(n: number): string {
  if (n < 1) return `${(n * 1000).toFixed(0)}µs`;
  if (n < 1000) return `${n.toFixed(n < 10 ? 1 : 0)}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}
function fmtRelative(ts: number | null): string {
  if (!ts) return '-';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusClass(status: number): string {
  if (status === 0) return 'text-[var(--text-dim)]';
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-yellow-400';
  if (status >= 300) return 'text-[var(--text-dim)]';
  return 'text-green-400';
}

function latencyClass(ms: number): string {
  if (ms >= 1000) return 'text-red-400';
  if (ms >= 500) return 'text-yellow-400';
  if (ms >= 100) return 'text-[var(--text)]';
  return 'text-green-400';
}

export const MetricsPanel = component$(() => {
  const routes = useSignal<RouteMetric[] | null>(null);
  const outbound = useSignal<OutboundCategoryMetric[] | null>(null);
  const graphql = useSignal<GraphqlOperationMetric[] | null>(null);
  const slow = useSignal<SlowRequestEntry[] | null>(null);
  const slowThreshold = useSignal(500);
  const error = useSignal<string | null>(null);
  const loading = useSignal(false);

  const refresh = $(async () => {
    loading.value = true;
    error.value = null;
    try {
      const [r, o, g, s] = await Promise.all([
        adminFetch<RoutesResponse>('/admin/metrics/routes'),
        adminFetch<OutboundResponse>('/admin/metrics/outbound'),
        adminFetch<GraphqlResponse>('/admin/metrics/graphql'),
        adminFetch<SlowRequestsResponse>('/admin/logs/slow'),
      ]);
      routes.value = r.routes;
      outbound.value = o.categories;
      graphql.value = g.operations;
      slow.value = s.entries;
      slowThreshold.value = s.thresholdMs;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load metrics';
    } finally {
      loading.value = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async () => {
      await refresh();
    },
    { strategy: 'document-ready' },
  );

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-xs">metrics</div>
        <button
          type="button"
          class="font-mono uppercase tracking-[0.2em] text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-1"
          onClick$={refresh}
          disabled={loading.value}
        >
          {loading.value ? 'refreshing...' : 'refresh'}
        </button>
      </div>

      {error.value && (
        <div class={`${PANEL} p-3 text-red-400 font-mono text-xs`}>{error.value}</div>
      )}

      {/* Outbound API metrics */}
      <div class={PANEL}>
        <div class={HEADER}>outbound apis</div>
        <div class="overflow-auto">
          <table class="text-[11px] font-mono w-full">
            <thead>
              <tr class={THEAD}>
                <th class={TH}>category</th>
                <th class={TH}>calls</th>
                <th class={TH}>errors</th>
                <th class={TH}>error %</th>
                <th class={TH}>avg</th>
                <th class={TH}>max</th>
                <th class={TH}>last</th>
                <th class={TH}>last error</th>
              </tr>
            </thead>
            <tbody>
              {outbound.value?.map((o) => (
                <tr key={o.category} class={TR}>
                  <td class="px-2 py-1 text-[var(--accent)]">{o.category}</td>
                  <td class="px-2 py-1 text-[var(--text)]">{fmtNum(o.calls)}</td>
                  <td class={`px-2 py-1 ${o.errors > 0 ? 'text-red-400' : 'text-[var(--text-dim)]'}`}>{o.errors}</td>
                  <td class={`px-2 py-1 ${o.errorRate > 0 ? 'text-yellow-400' : 'text-[var(--text-dim)]'}`}>{o.errorRate}%</td>
                  <td class={`px-2 py-1 ${latencyClass(o.avgDurationMs)}`}>{fmtMs(o.avgDurationMs)}</td>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{fmtMs(o.maxDurationMs)}</td>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{fmtRelative(o.lastAt)}</td>
                  <td class="px-2 py-1 text-red-400 max-w-xs truncate">{o.lastError ?? '-'}</td>
                </tr>
              ))}
              {outbound.value?.length === 0 && (
                <tr><td colSpan={8} class="px-2 py-4 text-center text-[var(--text-dim)]">no calls yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-route metrics */}
      <div class={PANEL}>
        <div class={HEADER}>routes ({routes.value?.length ?? 0})</div>
        <div class="overflow-auto max-h-[60vh]">
          <table class="text-[11px] font-mono w-full">
            <thead>
              <tr class={THEAD}>
                <th class={TH}>method</th>
                <th class={TH}>route</th>
                <th class={TH}>total</th>
                <th class={TH}>2xx</th>
                <th class={TH}>3xx</th>
                <th class={TH}>4xx</th>
                <th class={TH}>5xx</th>
                <th class={TH}>avg</th>
                <th class={TH}>p50</th>
                <th class={TH}>p95</th>
                <th class={TH}>p99</th>
                <th class={TH}>max</th>
                <th class={TH}>last</th>
              </tr>
            </thead>
            <tbody>
              {routes.value?.map((r) => (
                <tr key={r.key} class={TR}>
                  <td class="px-2 py-1 text-[var(--accent)]">{r.method}</td>
                  <td class="px-2 py-1 text-[var(--text)] break-all">{r.route}</td>
                  <td class="px-2 py-1 text-[var(--text)]">{fmtNum(r.total)}</td>
                  <td class={`px-2 py-1 ${r.count2xx > 0 ? 'text-green-400' : 'text-[var(--text-dim)]'}`}>{r.count2xx}</td>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{r.count3xx}</td>
                  <td class={`px-2 py-1 ${r.count4xx > 0 ? 'text-yellow-400' : 'text-[var(--text-dim)]'}`}>{r.count4xx}</td>
                  <td class={`px-2 py-1 ${r.count5xx > 0 ? 'text-red-400' : 'text-[var(--text-dim)]'}`}>{r.count5xx}</td>
                  <td class={`px-2 py-1 ${latencyClass(r.avgDurationMs)}`}>{fmtMs(r.avgDurationMs)}</td>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{fmtMs(r.p50DurationMs)}</td>
                  <td class={`px-2 py-1 ${latencyClass(r.p95DurationMs)}`}>{fmtMs(r.p95DurationMs)}</td>
                  <td class={`px-2 py-1 ${latencyClass(r.p99DurationMs)}`}>{fmtMs(r.p99DurationMs)}</td>
                  <td class={`px-2 py-1 ${latencyClass(r.maxDurationMs)}`}>{fmtMs(r.maxDurationMs)}</td>
                  <td class={`px-2 py-1 ${statusClass(r.lastStatus)}`}>{r.lastStatus || '-'} · {fmtRelative(r.lastAt)}</td>
                </tr>
              ))}
              {routes.value?.length === 0 && (
                <tr><td colSpan={13} class="px-2 py-4 text-center text-[var(--text-dim)]">no requests yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GraphQL operations */}
      <div class={PANEL}>
        <div class={HEADER}>graphql operations ({graphql.value?.length ?? 0})</div>
        <div class="overflow-auto max-h-[60vh]">
          <table class="text-[11px] font-mono w-full">
            <thead>
              <tr class={THEAD}>
                <th class={TH}>operation</th>
                <th class={TH}>calls</th>
                <th class={TH}>errors</th>
                <th class={TH}>error %</th>
                <th class={TH}>avg</th>
                <th class={TH}>max</th>
                <th class={TH}>last</th>
                <th class={TH}>last error</th>
              </tr>
            </thead>
            <tbody>
              {graphql.value?.map((g) => (
                <tr key={g.name} class={TR}>
                  <td class="px-2 py-1 text-[var(--accent)] break-all">{g.name}</td>
                  <td class="px-2 py-1 text-[var(--text)]">{fmtNum(g.calls)}</td>
                  <td class={`px-2 py-1 ${g.errors > 0 ? 'text-red-400' : 'text-[var(--text-dim)]'}`}>{g.errors}</td>
                  <td class={`px-2 py-1 ${g.errorRate > 0 ? 'text-yellow-400' : 'text-[var(--text-dim)]'}`}>{g.errorRate}%</td>
                  <td class={`px-2 py-1 ${latencyClass(g.avgDurationMs)}`}>{fmtMs(g.avgDurationMs)}</td>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{fmtMs(g.maxDurationMs)}</td>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{fmtRelative(g.lastAt)}</td>
                  <td class="px-2 py-1 text-red-400 max-w-xs truncate">{g.lastError ?? '-'}</td>
                </tr>
              ))}
              {graphql.value?.length === 0 && (
                <tr><td colSpan={8} class="px-2 py-4 text-center text-[var(--text-dim)]">no operations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slow requests */}
      <div class={PANEL}>
        <div class={HEADER}>slow requests (&gt; {slowThreshold.value}ms, {slow.value?.length ?? 0})</div>
        <div class="overflow-auto max-h-[50vh]">
          <table class="text-[11px] font-mono w-full">
            <thead>
              <tr class={THEAD}>
                <th class={TH}>when</th>
                <th class={TH}>method</th>
                <th class={TH}>url</th>
                <th class={TH}>status</th>
                <th class={TH}>duration</th>
              </tr>
            </thead>
            <tbody>
              {slow.value?.map((s, i) => (
                <tr key={i} class={TR}>
                  <td class="px-2 py-1 text-[var(--text-dim)]">{fmtRelative(s.ts)}</td>
                  <td class="px-2 py-1 text-[var(--accent)]">{s.method}</td>
                  <td class="px-2 py-1 text-[var(--text)] break-all">{s.url}</td>
                  <td class={`px-2 py-1 ${statusClass(s.status)}`}>{s.status}</td>
                  <td class={`px-2 py-1 ${latencyClass(s.durationMs)}`}>{fmtMs(s.durationMs)}</td>
                </tr>
              ))}
              {slow.value?.length === 0 && (
                <tr><td colSpan={5} class="px-2 py-4 text-center text-[var(--text-dim)]">nothing slow yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
