import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { adminFetch } from '~/lib/admin/adminClient';
import type { HealthReport } from '~/lib/admin/types';

const PANEL = 'p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]';
const HEADER = 'font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]';

function latencyColor(ms?: number): string {
  if (ms === undefined) return 'text-[var(--text-dim)]';
  if (ms < 50) return 'text-green-400';
  if (ms < 200) return 'text-yellow-400';
  return 'text-red-400';
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const HealthDashboard = component$(() => {
  const data = useSignal<HealthReport | null>(null);
  const error = useSignal<string | null>(null);
  const loading = useSignal(false);

  const refresh = $(async () => {
    loading.value = true;
    error.value = null;
    try {
      data.value = await adminFetch<HealthReport>('/admin/health');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load';
    } finally {
      loading.value = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    await refresh();
  });

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-xs">system health</div>
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

      {data.value && (
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Backend */}
          <div class={PANEL}>
            <div class={HEADER}>backend</div>
            <div class="p-3 text-xs font-mono text-[var(--text)] grid grid-cols-2 gap-y-1">
              <span class="text-[var(--text-dim)]">uptime</span>
              <span>{fmtUptime(data.value.backend.uptimeSec)}</span>
              <span class="text-[var(--text-dim)]">node</span>
              <span>{data.value.backend.nodeVersion}</span>
              <span class="text-[var(--text-dim)]">pid</span>
              <span>{data.value.backend.pid}</span>
              <span class="text-[var(--text-dim)]">rss</span>
              <span>{data.value.backend.memoryMb.rss} MB</span>
              <span class="text-[var(--text-dim)]">heap used</span>
              <span>{data.value.backend.memoryMb.heapUsed} / {data.value.backend.memoryMb.heapTotal} MB</span>
              <span class="text-[var(--text-dim)]">log buffer</span>
              <span>{data.value.logBuffer.size}</span>
            </div>
          </div>

          {/* Database */}
          <div class={PANEL}>
            <div class={HEADER}>database</div>
            <div class="p-3 text-xs font-mono grid grid-cols-2 gap-y-1">
              <span class="text-[var(--text-dim)]">reachable</span>
              <span class={data.value.database.reachable ? 'text-green-400' : 'text-red-400'}>
                {data.value.database.reachable ? 'yes' : 'no'}
              </span>
              <span class="text-[var(--text-dim)]">latency</span>
              <span class={latencyColor(data.value.database.latencyMs)}>
                {data.value.database.latencyMs !== undefined ? `${data.value.database.latencyMs} ms` : '-'}
              </span>
              {data.value.database.status && (
                <>
                  <span class="text-[var(--text-dim)]">status</span>
                  <span class="text-[var(--text)]">{data.value.database.status}</span>
                </>
              )}
              {data.value.database.error && (
                <>
                  <span class="text-[var(--text-dim)]">error</span>
                  <span class="text-red-400 break-all">{data.value.database.error}</span>
                </>
              )}
            </div>
          </div>

          {/* Static data counts */}
          <div class={PANEL}>
            <div class={HEADER}>static data</div>
            <div class="p-3 text-xs font-mono grid grid-cols-2 gap-y-1 max-h-80 overflow-auto">
              {Object.entries(data.value.staticData)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => (
                  <span key={k} class="contents">
                    <span class="text-[var(--text-dim)]">{k}</span>
                    <span class="text-[var(--text)]">{v}</span>
                  </span>
                ))}
            </div>
          </div>

          {/* Env (masked) */}
          <div class={PANEL}>
            <div class={HEADER}>env</div>
            <div class="p-3 text-xs font-mono grid grid-cols-2 gap-y-1">
              {Object.entries(data.value.env).map(([k, v]) => (
                <span key={k} class="contents">
                  <span class="text-[var(--text-dim)]">{k}</span>
                  <span
                    class={
                      v === 'set'
                        ? 'text-green-400'
                        : v === 'missing'
                          ? 'text-red-400'
                          : 'text-[var(--text)] break-all'
                    }
                  >
                    {v}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
