/**
 * UnitSelector — Searchable dropdown for picking a unit in compare mode.
 *
 * Fetches the arsenal card list and lets the user search + pick a unit.
 * Emits the chosen unit ID via onSelect$.
 */

import { component$, useSignal, $, type PropFunction } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import { toUnitIconPath } from '~/lib/iconPaths';
import { IconSearch } from '~/components/icons';
import type { ArsenalCard } from '~/lib/graphql-types';

export type UnitSelectorProps = {
  cards: ArsenalCard[];
  selectedUnitId: number | null;
  onSelect$: PropFunction<(unitId: number) => void>;
};

const CATEGORY_CODES: Record<number, string> = {
  0: 'REC', 1: 'INF', 2: 'VEH', 3: 'SUP', 5: 'HEL', 6: 'AIR', 7: 'TRN',
};

export const UnitSelector = component$<UnitSelectorProps>(({ cards, selectedUnitId, onSelect$ }) => {
  const i18n = useI18n();
  const search = useSignal('');
  const open = useSignal(false);

  const filtered = cards.filter(c => {
    if (!c.unit.DisplayInArmory) return false;
    if (!search.value) return true;
    const q = search.value.toLowerCase();
    const name = (c.unit.HUDName || '').toLowerCase();
    return name.includes(q) || String(c.unit.Id).includes(q);
  }).slice(0, 50);

  const selectedCard = selectedUnitId ? cards.find(c => c.unit.Id === selectedUnitId) : null;
  const selectedName = selectedCard ? (selectedCard.unit.HUDName || '') : null;

  const handleSelect = $((unitId: number) => {
    onSelect$(unitId);
    open.value = false;
    search.value = '';
  });

  return (
    <div class="relative">
      {/* Selected unit display / trigger */}
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)]/40 transition-colors text-left"
        onClick$={() => { open.value = !open.value; }}
      >
        {selectedCard ? (
          <>
            <img
              src={toUnitIconPath(selectedCard.unit.ThumbnailFileName || '')}
              alt=""
              width={32}
              height={32}
              class="bg-[rgba(26,26,26,0.4)]"
            />
            <div class="flex-1 min-w-0">
              <span class="text-xs font-mono text-[var(--text-dim)] tracking-[0.15em] uppercase">
                {CATEGORY_CODES[selectedCard.unit.CategoryType] ?? '???'}
              </span>
              <p class="text-sm font-semibold text-[var(--text)] truncate">{selectedName}</p>
            </div>
          </>
        ) : (
          <span class="text-sm font-mono text-[var(--text-dim)]">{t(i18n, 'compare.selectUnit')}</span>
        )}
        <span class="text-[var(--text-dim)] text-xs ml-auto">▼</span>
      </button>

      {/* Dropdown */}
      {open.value && (
        <div class="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--bg-raised)] border border-[var(--border)] shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div class="flex items-center gap-2 px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
            <IconSearch size={14} class="text-[var(--text-dim)]" />
            <input
              type="text"
              class="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
              placeholder={t(i18n, 'compare.searchPlaceholder')}
              value={search.value}
              onInput$={(e) => { search.value = (e.target as HTMLInputElement).value; }}
              autoFocus
            />
          </div>
          <div class="overflow-y-auto flex-1">
            {filtered.map(card => {
              const name = card.unit.HUDName || '';
              const isSelected = card.unit.Id === selectedUnitId;
              return (
                <button
                  key={card.unit.Id}
                  type="button"
                  class={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--accent)]/10 transition-colors ${isSelected ? 'bg-[var(--accent)]/15' : ''}`}
                  onClick$={() => handleSelect(card.unit.Id)}
                >
                  <img
                    src={toUnitIconPath(card.unit.ThumbnailFileName || '')}
                    alt=""
                    width={24}
                    height={24}
                    class="bg-[rgba(26,26,26,0.4)]"
                  />
                  <span class="text-[9px] font-mono text-[var(--text-dim)] tracking-[0.15em] uppercase w-8">
                    {CATEGORY_CODES[card.unit.CategoryType] ?? '???'}
                  </span>
                  <span class="text-xs text-[var(--text)] truncate flex-1">{name}</span>
                  <span class="text-[10px] font-mono text-[var(--text-dim)]">{card.unit.Cost}pt</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p class="px-3 py-4 text-xs text-[var(--text-dim)] text-center font-mono">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
