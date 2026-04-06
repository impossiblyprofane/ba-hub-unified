import { component$, useSignal, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { adminFetch, openLogStream } from '~/lib/admin/adminClient';
import type { LogEntry } from '~/lib/admin/types';

const PANEL = 'p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]';
const HEADER = 'font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]';

const LEVEL_COLORS: Record<string, string> = {
  trace: 'text-[var(--text-dim)]',
  debug: 'text-[var(--text-dim)]',
  info: 'text-[var(--text)]',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  fatal: 'text-red-500',
  unknown: 'text-[var(--text-dim)]',
};

const LEVEL_THRESHOLDS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const MAX_DISPLAYED = 500;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toISOString().slice(11, 23);
}

export const LogStream = component$(() => {
  const store = useStore<{ items: LogEntry[] }>({ items: [] });
  const minLevel = useSignal<string>('info');
  const grep = useSignal('');
  const paused = useSignal(false);
  const status = useSignal<'connecting' | 'connected' | 'error' | 'paused'>('connecting');
  const error = useSignal<string | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    let active = true;

    const init = async () => {
      // Backfill recent history first.
      try {
        const minLevelNum = LEVEL_THRESHOLDS[minLevel.value] ?? 30;
        const res = await adminFetch<{ entries: LogEntry[] }>(
          `/admin/logs?limit=200&minLevel=${minLevelNum}`,
        );
        if (!active) return;
        // /admin/logs returns newest-first; reverse so the on-screen order is
        // oldest→newest like a normal terminal tail.
        store.items = res.entries.slice().reverse();
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to load history';
      }

      // Then open SSE.
      const close = openLogStream(
        (entry) => {
          if (paused.value) return;
          store.items = [...store.items, entry].slice(-MAX_DISPLAYED);
          status.value = 'connected';
        },
        () => {
          status.value = 'error';
        },
      );
      status.value = 'connected';
      cleanup(() => close());
    };

    init();
  });

  const clear = $(() => {
    store.items = [];
  });

  const togglePause = $(() => {
    paused.value = !paused.value;
    status.value = paused.value ? 'paused' : 'connected';
  });

  const minLevelNum = LEVEL_THRESHOLDS[minLevel.value] ?? 30;
  const filtered = store.items.filter((e) => {
    if (e.level < minLevelNum) return false;
    if (grep.value) {
      const needle = grep.value.toLowerCase();
      const hay = (e.msg + ' ' + JSON.stringify(e.extra ?? '')).toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-xs">live logs</div>
        <div class="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)]">
          <span>status:</span>
          <span
            class={
              status.value === 'connected'
                ? 'text-green-400'
                : status.value === 'paused'
                  ? 'text-yellow-400'
                  : status.value === 'error'
                    ? 'text-red-400'
                    : 'text-[var(--text-dim)]'
            }
          >
            {status.value}
          </span>
        </div>
      </div>

      <div class={`${PANEL}`}>
        <div class={`${HEADER} flex items-center gap-2 flex-wrap`}>
          <span>level</span>
          <select
            class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] px-2 py-1 text-[var(--text)] tracking-normal normal-case"
            value={minLevel.value}
            onChange$={(_, el) => (minLevel.value = el.value)}
          >
            <option value="trace">trace+</option>
            <option value="debug">debug+</option>
            <option value="info">info+</option>
            <option value="warn">warn+</option>
            <option value="error">error+</option>
          </select>
          <input
            type="text"
            placeholder="grep"
            class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] px-2 py-1 text-[var(--text)] tracking-normal normal-case"
            value={grep.value}
            onInput$={(_, el) => (grep.value = el.value)}
          />
          <button
            type="button"
            class="border border-[var(--border)] px-2 py-1 text-[var(--text)] tracking-normal normal-case hover:border-[var(--accent)]"
            onClick$={togglePause}
          >
            {paused.value ? 'resume' : 'pause'}
          </button>
          <button
            type="button"
            class="border border-[var(--border)] px-2 py-1 text-[var(--text)] tracking-normal normal-case hover:border-[var(--accent)]"
            onClick$={clear}
          >
            clear
          </button>
          <span class="ml-auto text-[var(--text-dim)] tracking-normal normal-case">{filtered.length} / {store.items.length}</span>
        </div>
        <div class="overflow-auto max-h-[70vh] p-2 text-[11px] font-mono">
          {error.value && <div class="text-red-400">{error.value}</div>}
          {filtered.map((e, i) => (
            <div key={i} class="flex gap-2 hover:bg-[rgba(26,26,26,0.4)] px-1">
              <span class="text-[var(--text-dim)] shrink-0">{fmtTime(e.ts)}</span>
              <span class={`${LEVEL_COLORS[e.levelName] ?? ''} uppercase shrink-0 w-10`}>
                {e.levelName}
              </span>
              <span class="text-[var(--text)] break-all">
                {e.msg}
                {e.extra && (
                  <span class="text-[var(--text-dim)]"> {JSON.stringify(e.extra)}</span>
                )}
              </span>
            </div>
          ))}
          {filtered.length === 0 && !error.value && (
            <div class="text-[var(--text-dim)]">waiting for log lines...</div>
          )}
        </div>
      </div>
    </div>
  );
});
