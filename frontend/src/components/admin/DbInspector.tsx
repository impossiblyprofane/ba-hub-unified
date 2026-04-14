import { component$, useSignal, useVisibleTask$, $, useTask$ } from '@builder.io/qwik';
import { adminFetch } from '~/lib/admin/adminClient';
import type { TableSummary, TableDetail, TableRowsResponse } from '~/lib/admin/types';

const PANEL = 'p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]';
const HEADER = 'font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]';

function renderCell(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Database inspector — combines a table list and a row browser. Selecting a
 * table fetches its column metadata + first page of rows. Pagination + sort
 * are passed through to the proxied database service.
 */
export const DbInspector = component$(() => {
  const tables = useSignal<TableSummary[] | null>(null);
  const tablesError = useSignal<string | null>(null);
  const selected = useSignal<string | null>(null);

  const detail = useSignal<TableDetail | null>(null);
  const rows = useSignal<TableRowsResponse | null>(null);
  const detailError = useSignal<string | null>(null);
  const detailLoading = useSignal(false);

  const limit = useSignal(50);
  const offset = useSignal(0);
  const sort = useSignal<string | null>(null);
  const order = useSignal<'asc' | 'desc'>('asc');

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const res = await adminFetch<{ tables: TableSummary[] }>('/admin/db/tables');
      tables.value = res.tables;
    } catch (err) {
      tablesError.value = err instanceof Error ? err.message : 'Failed to load tables';
    }
  });

  const loadTable = $(async (name: string) => {
    selected.value = name;
    offset.value = 0;
    sort.value = null;
    detail.value = null;
    rows.value = null;
    detailError.value = null;
    detailLoading.value = true;
    try {
      const [d, r] = await Promise.all([
        adminFetch<TableDetail>(`/admin/db/table/${name}`),
        adminFetch<TableRowsResponse>(`/admin/db/table/${name}/rows?limit=${limit.value}&offset=0`),
      ]);
      detail.value = d;
      rows.value = r;
    } catch (err) {
      detailError.value = err instanceof Error ? err.message : 'Failed to load table';
    } finally {
      detailLoading.value = false;
    }
  });

  const reloadRows = $(async () => {
    if (!selected.value) return;
    detailLoading.value = true;
    detailError.value = null;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit.value));
      params.set('offset', String(offset.value));
      if (sort.value) {
        params.set('sort', sort.value);
        params.set('order', order.value);
      }
      rows.value = await adminFetch<TableRowsResponse>(
        `/admin/db/table/${selected.value}/rows?${params.toString()}`,
      );
    } catch (err) {
      detailError.value = err instanceof Error ? err.message : 'Failed to load rows';
    } finally {
      detailLoading.value = false;
    }
  });

  // Re-fetch rows when pagination/sort changes
  // eslint-disable-next-line qwik/no-use-visible-task
  useTask$(({ track }) => {
    track(() => limit.value);
    track(() => offset.value);
    track(() => sort.value);
    track(() => order.value);
    if (!selected.value) return;
    reloadRows();
  });

  return (
    <div class="flex flex-col gap-3">
      <div class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-xs">database inspector</div>

      <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        {/* Table list */}
        <div class={PANEL}>
          <div class={HEADER}>tables{tables.value ? ` (${tables.value.length})` : ''}</div>
          <div class="max-h-[70vh] overflow-auto">
            {tablesError.value && (
              <div class="p-3 text-xs font-mono text-red-400">{tablesError.value}</div>
            )}
            {!tables.value && !tablesError.value && (
              <div class="p-3 text-xs font-mono text-[var(--text-dim)]">loading...</div>
            )}
            {tables.value?.map((t) => (
              <button
                key={t.table_name}
                type="button"
                onClick$={() => loadTable(t.table_name)}
                class={[
                  'w-full text-left px-3 py-2 font-mono text-xs border-b border-[rgba(51,51,51,0.15)] transition-colors',
                  selected.value === t.table_name
                    ? 'bg-[rgba(26,26,26,0.4)] text-[var(--accent)]'
                    : 'text-[var(--text)] hover:bg-[rgba(26,26,26,0.4)]',
                ].join(' ')}
              >
                <div class="truncate">{t.table_name}</div>
                <div class="text-[10px] text-[var(--text-dim)]">
                  {t.row_count ?? '?'} rows · {t.column_count} cols
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div class={PANEL}>
          {!selected.value && (
            <div class="p-6 text-xs font-mono text-[var(--text-dim)]">select a table</div>
          )}
          {selected.value && (
            <>
              <div class={HEADER}>{selected.value}</div>
              <div class="p-3 flex flex-col gap-3">
                {detailError.value && (
                  <div class="text-xs font-mono text-red-400">{detailError.value}</div>
                )}
                {detail.value && (
                  <div class="text-[10px] font-mono text-[var(--text-dim)]">
                    {detail.value.rowCount} total rows · {detail.value.columns.length} columns · {detail.value.indexes.length} indexes
                  </div>
                )}

                {/* Pagination controls */}
                <div class="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)]">
                  <span>page size</span>
                  <select
                    class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] px-2 py-1 text-[var(--text)]"
                    value={limit.value}
                    onChange$={(_, el) => {
                      limit.value = Number(el.value);
                      offset.value = 0;
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <button
                    type="button"
                    class="border border-[var(--border)] px-2 py-1 disabled:opacity-30"
                    disabled={offset.value === 0}
                    onClick$={() => (offset.value = Math.max(0, offset.value - limit.value))}
                  >
                    prev
                  </button>
                  <span class="text-[var(--text)]">
                    {offset.value + 1}–{Math.min(offset.value + limit.value, rows.value?.total ?? 0)} / {rows.value?.total ?? '?'}
                  </span>
                  <button
                    type="button"
                    class="border border-[var(--border)] px-2 py-1 disabled:opacity-30"
                    disabled={!rows.value || offset.value + limit.value >= (rows.value.total ?? 0)}
                    onClick$={() => (offset.value = offset.value + limit.value)}
                  >
                    next
                  </button>
                  {detailLoading.value && <span>loading...</span>}
                </div>

                {/* Rows */}
                {rows.value && rows.value.rows.length > 0 && (
                  <div class="overflow-auto max-h-[60vh] border border-[rgba(51,51,51,0.15)]">
                    <table class="text-[11px] font-mono w-full">
                      <thead>
                        <tr class="bg-[rgba(26,26,26,0.6)]">
                          {Object.keys(rows.value.rows[0]).map((col) => {
                            const isSorted = sort.value === col;
                            return (
                              <th
                                key={col}
                                class="px-2 py-1 text-left text-[var(--text-dim)] uppercase tracking-[0.15em] border-b border-[rgba(51,51,51,0.3)] cursor-pointer hover:text-[var(--accent)]"
                                onClick$={() => {
                                  if (sort.value === col) {
                                    order.value = order.value === 'asc' ? 'desc' : 'asc';
                                  } else {
                                    sort.value = col;
                                    order.value = 'asc';
                                  }
                                  offset.value = 0;
                                }}
                              >
                                {col}
                                {isSorted && (order.value === 'asc' ? ' ▲' : ' ▼')}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.value.rows.map((row, i) => (
                          <tr key={i} class="border-b border-[rgba(51,51,51,0.1)] hover:bg-[rgba(26,26,26,0.4)]">
                            {Object.keys(rows.value!.rows[0]).map((col) => {
                              const v = row[col];
                              const text = renderCell(v);
                              const truncated = text.length > 80;
                              return (
                                <td key={col} class="px-2 py-1 text-[var(--text)] align-top max-w-xs">
                                  {truncated ? (
                                    <details>
                                      <summary class="cursor-pointer text-[var(--text-dim)] truncate">
                                        {text.slice(0, 80)}…
                                      </summary>
                                      <pre class="text-[10px] whitespace-pre-wrap break-all mt-1">{text}</pre>
                                    </details>
                                  ) : (
                                    <span class="break-all">{text}</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {rows.value && rows.value.rows.length === 0 && (
                  <div class="text-xs font-mono text-[var(--text-dim)]">no rows</div>
                )}

                {/* Columns + indexes */}
                {detail.value && (
                  <details class="text-[10px] font-mono">
                    <summary class="cursor-pointer text-[var(--text-dim)] uppercase tracking-[0.2em]">schema ({detail.value.columns.length})</summary>
                    <div class="mt-2 grid grid-cols-1 gap-1">
                      {detail.value.columns.map((c) => (
                        <div key={c.column_name} class="text-[var(--text)]">
                          <span class="text-[var(--accent)]">{c.column_name}</span>{' '}
                          <span class="text-[var(--text-dim)]">{c.data_type}</span>
                          {c.is_nullable === 'NO' && <span class="text-[var(--text-dim)]"> not null</span>}
                          {c.column_default && (
                            <span class="text-[var(--text-dim)]"> default {c.column_default}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {detail.value.indexes.length > 0 && (
                      <div class="mt-2">
                        <div class="text-[var(--text-dim)] uppercase tracking-[0.2em]">indexes</div>
                        {detail.value.indexes.map((i) => (
                          <div key={i.indexname} class="text-[var(--text)] break-all">
                            <span class="text-[var(--accent)]">{i.indexname}</span>{' '}
                            <span class="text-[var(--text-dim)]">{i.indexdef}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
