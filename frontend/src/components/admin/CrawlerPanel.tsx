import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { adminFetch } from '~/lib/admin/adminClient';
import type { CrawlerSummary } from '~/lib/admin/types';

const PANEL = 'p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]';
const HEADER = 'font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]';

function fmtRelative(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  const days = Math.floor(h / 24);
  return `${days}d ${h % 24}h ago`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString();
}

function fmtEndTime(epochSec: number | string | null): string {
  if (!epochSec) return '-';
  const n = typeof epochSec === 'string' ? Number(epochSec) : epochSec;
  if (!Number.isFinite(n)) return '-';
  return new Date(n * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function scanProgress(state: { scanFloor: number; scanCeiling: number; scanPosition: number } | null): number {
  if (!state) return 0;
  const span = state.scanCeiling - state.scanFloor;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((state.scanPosition - state.scanFloor) / span) * 100));
}

export const CrawlerPanel = component$(() => {
  const summary = useSignal<CrawlerSummary | null>(null);
  const error = useSignal<string | null>(null);
  const loading = useSignal(false);

  const refresh = $(async () => {
    loading.value = true;
    error.value = null;
    try {
      summary.value = await adminFetch<CrawlerSummary>('/admin/crawler/summary');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load';
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
        <div class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-xs">match crawler</div>
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

      {summary.value && summary.value.available && (
        <>
          {/* Overview cards */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class={PANEL}>
              <div class={HEADER}>total</div>
              <div class="p-3 font-mono">
                <div class="text-2xl text-[var(--text)]">{fmtNum(summary.value.stats.total)}</div>
                <div class="text-[10px] text-[var(--text-dim)] mt-1">
                  {fmtNum(summary.value.stats.ranked)} ranked · {fmtNum(summary.value.stats.unranked)} unranked
                </div>
              </div>
            </div>
            <div class={PANEL}>
              <div class={HEADER}>last hour</div>
              <div class="p-3 font-mono">
                <div class={`text-2xl ${summary.value.stats.last_hour > 0 ? 'text-green-400' : 'text-[var(--text-dim)]'}`}>
                  {fmtNum(summary.value.stats.last_hour)}
                </div>
                <div class="text-[10px] text-[var(--text-dim)] mt-1">processed</div>
              </div>
            </div>
            <div class={PANEL}>
              <div class={HEADER}>last 24h</div>
              <div class="p-3 font-mono">
                <div class="text-2xl text-[var(--text)]">{fmtNum(summary.value.stats.last_day)}</div>
                <div class="text-[10px] text-[var(--text-dim)] mt-1">{fmtNum(summary.value.stats.last_week)} this week</div>
              </div>
            </div>
            <div class={PANEL}>
              <div class={HEADER}>last seen</div>
              <div class="p-3 font-mono">
                <div class="text-sm text-[var(--text)]">{fmtRelative(summary.value.stats.last_processed)}</div>
                <div class="text-[10px] text-[var(--text-dim)] mt-1 break-all">
                  {summary.value.stats.last_processed
                    ? new Date(summary.value.stats.last_processed).toISOString().slice(0, 19).replace('T', ' ')
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Scan state */}
          {summary.value.state && (
            <div class={PANEL}>
              <div class={HEADER}>scan state</div>
              <div class="p-3 font-mono text-xs flex flex-col gap-2">
                <div class="flex flex-wrap gap-x-6 gap-y-1">
                  <span><span class="text-[var(--text-dim)]">position</span> <span class="text-[var(--text)]">{fmtNum(summary.value.state.scanPosition)}</span></span>
                  <span><span class="text-[var(--text-dim)]">range</span> <span class="text-[var(--text)]">{fmtNum(summary.value.state.scanFloor)} → {fmtNum(summary.value.state.scanCeiling)}</span></span>
                  <span><span class="text-[var(--text-dim)]">id range</span> <span class="text-[var(--text)]">{fmtNum(summary.value.stats.min_fight)} → {fmtNum(summary.value.stats.max_fight)}</span></span>
                  <span>
                    <span class="text-[var(--text-dim)]">initial</span>{' '}
                    <span class={summary.value.state.initialCollectionDone ? 'text-green-400' : 'text-yellow-400'}>
                      {summary.value.state.initialCollectionDone ? 'done' : 'in progress'}
                    </span>
                  </span>
                </div>
                {/* Progress bar */}
                <div class="relative h-2 bg-[rgba(26,26,26,0.6)] border border-[rgba(51,51,51,0.3)]">
                  <div
                    class="absolute inset-y-0 left-0 bg-[var(--accent)]"
                    style={{ width: `${scanProgress(summary.value.state)}%` }}
                  />
                </div>
                <div class="text-[10px] text-[var(--text-dim)]">
                  {scanProgress(summary.value.state).toFixed(1)}% scanned · updated {fmtRelative(summary.value.state.updatedAt)}
                </div>
              </div>
            </div>
          )}

          {/* Recent matches table */}
          <div class={PANEL}>
            <div class={HEADER}>recent matches ({summary.value.recent.length})</div>
            <div class="overflow-auto max-h-[60vh]">
              <table class="text-[11px] font-mono w-full">
                <thead>
                  <tr class="bg-[rgba(26,26,26,0.6)]">
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">fight id</th>
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">map</th>
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">type</th>
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">winner</th>
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">players</th>
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">end time</th>
                    <th class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)]">processed</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.value.recent.map((m) => (
                    <tr key={m.fight_id} class="border-b border-[rgba(51,51,51,0.1)] hover:bg-[rgba(26,26,26,0.4)]">
                      <td class="px-2 py-1 text-[var(--accent)]">{m.fight_id}</td>
                      <td class="px-2 py-1 text-[var(--text)]">{m.map_name ?? '-'}</td>
                      <td class={`px-2 py-1 ${m.is_ranked ? 'text-green-400' : 'text-[var(--text-dim)]'}`}>
                        {m.is_ranked ? 'ranked' : 'unranked'}
                      </td>
                      <td class="px-2 py-1 text-[var(--text)]">{m.winner_team ?? '-'}</td>
                      <td class="px-2 py-1 text-[var(--text)]">{m.player_count}</td>
                      <td class="px-2 py-1 text-[var(--text-dim)]">{fmtEndTime(m.end_time)}</td>
                      <td class="px-2 py-1 text-[var(--text-dim)]">{fmtRelative(m.processed_at)}</td>
                    </tr>
                  ))}
                  {summary.value.recent.length === 0 && (
                    <tr>
                      <td colSpan={7} class="px-2 py-4 text-center text-[var(--text-dim)]">no matches processed yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {summary.value && !summary.value.available && (
        <div class={`${PANEL} opacity-70`}>
          <div class={HEADER}>offline</div>
          <div class="p-4 text-xs font-mono text-[var(--text-dim)] flex flex-col gap-2">
            <div class="text-yellow-400">{summary.value.message}</div>
            {summary.value.error && (
              <details>
                <summary class="cursor-pointer">error detail</summary>
                <pre class="mt-1 whitespace-pre-wrap break-all text-[10px]">{summary.value.error}</pre>
              </details>
            )}
            <div class="mt-2 text-[10px]">
              The stats system is mid-rework. See <code class="text-[var(--accent)]">docs/stats-rework-handoff.md</code>.
              This panel will reconnect once the new crawler lands.
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
