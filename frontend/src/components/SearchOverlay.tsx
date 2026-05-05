import { component$, useSignal, useVisibleTask$, $, type Signal } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { IconSearch, IconClose } from '~/components/icons';
import { toUnitIconPath, toCountryIconPath } from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';
import { getCategoryById } from '~/lib/categories';
import { SEARCH_UNITS_QUERY } from '~/lib/queries/search';
import { graphqlFetchRaw } from '~/lib/graphqlClient';
import type { SearchUnitResult } from '~/lib/graphql-types';

type Props = {
  open: Signal<boolean>;
};

/** Cached country flags — loaded once from the countries query. */
const COUNTRY_FLAGS: Record<number, string> = {};

async function fetchSearchResults(search: string): Promise<SearchUnitResult[]> {
  if (!search.trim()) return [];
  try {
    const result = await graphqlFetchRaw<{ searchUnits: SearchUnitResult[] }>(
      SEARCH_UNITS_QUERY,
      { search, limit: 30 },
    );
    return result.data?.searchUnits ?? [];
  } catch {
    return [];
  }
}

async function fetchCountryFlags(): Promise<void> {
  if (Object.keys(COUNTRY_FLAGS).length > 0) return;
  try {
    const result = await graphqlFetchRaw<{ countries: Array<{ Id: number; FlagFileName: string }> }>(
      '{ countries { Id FlagFileName } }',
    );
    for (const c of result.data?.countries ?? []) {
      COUNTRY_FLAGS[c.Id] = toCountryIconPath(c.FlagFileName);
    }
  } catch { /* ignore */ }
}

export const SearchOverlay = component$<Props>(({ open }) => {
  const i18n = useI18n();
  const nav = useNavigate();
  const query = useSignal('');
  const results = useSignal<SearchUnitResult[]>([]);
  const activeIndex = useSignal(-1);
  const loading = useSignal(false);
  const inputRef = useSignal<HTMLInputElement>();
  const debounceTimer = useSignal<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when overlay opens + register global Ctrl+K
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => open.value);

    if (open.value) {
      fetchCountryFlags();
      setTimeout(() => inputRef.value?.focus(), 50);
    } else {
      // Reset state when closed
      query.value = '';
      results.value = [];
      activeIndex.value = -1;
    }

    // Global keyboard shortcut: Ctrl+K / Cmd+K
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        open.value = !open.value;
      }
      if (e.key === 'Escape' && open.value) {
        e.preventDefault();
        open.value = false;
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    cleanup(() => document.removeEventListener('keydown', handleGlobalKey));
  });

  const onInput$ = $((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    query.value = value;
    activeIndex.value = -1;

    if (debounceTimer.value) clearTimeout(debounceTimer.value);

    if (!value.trim()) {
      results.value = [];
      loading.value = false;
      return;
    }

    loading.value = true;
    debounceTimer.value = setTimeout(async () => {
      const data = await fetchSearchResults(value);
      results.value = data;
      loading.value = false;
    }, 200);
  });

  const navigateToUnit$ = $((unit: SearchUnitResult) => {
    open.value = false;
    // Variants (units reached only via another unit's modification, e.g. Marines
    // from Reserve Marines + option) link to the root unit with the option
    // pre-applied so the modification editor loads the correct loadout.
    const href = unit.rootUnitId && unit.rootOptionId
      ? `/arsenal/${unit.rootUnitId}/?m=${unit.rootOptionId}`
      : `/arsenal/${unit.Id}`;
    nav(href);
  });

  const scrollActiveIntoView = $((idx: number) => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-search-index="${idx}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    });
  });

  const onKeyDown$ = $((e: KeyboardEvent) => {
    const len = results.value.length;
    if (!len) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (activeIndex.value + 1) % len;
      activeIndex.value = next;
      scrollActiveIntoView(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (activeIndex.value - 1 + len) % len;
      activeIndex.value = next;
      scrollActiveIntoView(next);
    } else if (e.key === 'Enter' && activeIndex.value >= 0) {
      e.preventDefault();
      const unit = results.value[activeIndex.value];
      if (unit) navigateToUnit$(unit);
    }
  });

  if (!open.value) return null;

  return (
    <div
      class="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]"
      onClick$={(e) => {
        if ((e.target as HTMLElement).classList.contains('search-backdrop')) {
          open.value = false;
        }
      }}
    >
      {/* Backdrop */}
      <div class="search-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div class="relative w-full max-w-xl mx-4 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] shadow-2xl">
        {/* Search input */}
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
          <IconSearch size={16} class="text-[var(--accent)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t(i18n, 'search.placeholder')}
            value={query.value}
            onInput$={onInput$}
            onKeyDown$={onKeyDown$}
            class="flex-1 bg-transparent text-[var(--text)] text-sm placeholder-[var(--text-dim)] focus:outline-none"
            style={{ fontFamily: 'var(--mono)' }}
          />
          {loading.value && (
            <span class="text-[10px] text-[var(--text-dim)] animate-pulse" style={{ fontFamily: 'var(--mono)' }}>
              {t(i18n, 'search.loading')}
            </span>
          )}
          <button
            type="button"
            onClick$={() => (open.value = false)}
            class="p-1 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Results */}
        <div class="max-h-[50vh] overflow-y-auto">
          {query.value.trim() && !loading.value && results.value.length === 0 && (
            <div class="px-4 py-6 text-center text-sm text-[var(--text-dim)]" style={{ fontFamily: 'var(--mono)' }}>
              {t(i18n, 'search.noResults')}
            </div>
          )}

          {results.value.length > 0 && (
            <div class="py-1">
              {/* Results header */}
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[9px] px-4 py-1.5">
                {t(i18n, 'search.units')} — {results.value.length}
              </p>

              {results.value.map((unit, idx) => {
                const cat = getCategoryById(unit.CategoryType);
                const isActive = idx === activeIndex.value;
                return (
                  <button
                    key={unit.Id}
                    type="button"
                    data-search-index={idx}
                    class={[
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-[rgba(70,151,195,0.12)]'
                        : 'hover:bg-[rgba(26,26,26,0.6)]',
                    ].join(' ')}
                    onClick$={() => navigateToUnit$(unit)}
                    onMouseEnter$={() => (activeIndex.value = idx)}
                  >
                    {/* Unit thumbnail */}
                    <div class="w-8 h-8 shrink-0 flex items-center justify-center bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)]">
                      {unit.ThumbnailFileName ? (
                        <GameIcon
                          src={toUnitIconPath(unit.ThumbnailFileName)}
                          size={24}
                          variant="white"
                          alt={unit.HUDName}
                        />
                      ) : (
                        <span class="text-[var(--text-dim)] text-[10px]">?</span>
                      )}
                    </div>

                    {/* Unit info */}
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-[var(--text)] truncate" style={{ fontFamily: 'var(--mono)' }}>
                        {unit.displayName || unit.HUDName}
                      </p>
                      <div class="flex items-center gap-2 text-[10px] text-[var(--text-dim)]" style={{ fontFamily: 'var(--mono)' }}>
                        <span class={cat.color}>{cat.code}</span>
                        <span class="text-[rgba(51,51,51,0.6)]">·</span>
                        <span>{unit.Cost} {t(i18n, 'search.pts')}</span>
                      </div>
                    </div>

                    {/* Country flag */}
                    {COUNTRY_FLAGS[unit.CountryId] && (
                      <img
                        src={COUNTRY_FLAGS[unit.CountryId]}
                        alt=""
                        width={16}
                        height={12}
                        class="shrink-0 opacity-60"
                        style={{ width: '16px', height: '12px', objectFit: 'contain' }}
                      />
                    )}

                    {/* Active indicator */}
                    {isActive && (
                      <kbd class="text-[9px] text-[var(--text-dim)] border border-[rgba(51,51,51,0.3)] px-1.5 py-0.5 shrink-0" style={{ fontFamily: 'var(--mono)' }}>
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state — no query yet */}
          {!query.value.trim() && (
            <div class="px-4 py-6 text-center">
              <p class="text-xs text-[var(--text-dim)]" style={{ fontFamily: 'var(--mono)' }}>
                {t(i18n, 'search.hint')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between px-4 py-2 border-t border-[rgba(51,51,51,0.15)] text-[9px] text-[var(--text-dim)]" style={{ fontFamily: 'var(--mono)' }}>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1">
              <kbd class="border border-[rgba(51,51,51,0.3)] px-1 py-0.5">↑</kbd>
              <kbd class="border border-[rgba(51,51,51,0.3)] px-1 py-0.5">↓</kbd>
              {t(i18n, 'search.navigate')}
            </span>
            <span class="flex items-center gap-1">
              <kbd class="border border-[rgba(51,51,51,0.3)] px-1 py-0.5">↵</kbd>
              {t(i18n, 'search.select')}
            </span>
          </div>
          <span class="flex items-center gap-1">
            <kbd class="border border-[rgba(51,51,51,0.3)] px-1.5 py-0.5">ESC</kbd>
            {t(i18n, 'search.close')}
          </span>
        </div>
      </div>
    </div>
  );
});
