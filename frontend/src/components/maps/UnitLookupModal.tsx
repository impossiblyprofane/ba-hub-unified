// ══════════════════════════════════════════════════════════════
// UnitLookupModal — search & select a unit for placement on the tactical map
// ══════════════════════════════════════════════════════════════

import { $, component$, useSignal, useComputed$, useVisibleTask$ } from '@builder.io/qwik';
import type { PropFunction, Signal } from '@builder.io/qwik';
import type { ArsenalCard, ArsenalCountry } from '~/lib/graphql-types';
import { ARSENAL_PAGE_QUERY } from '~/lib/queries/arsenal';
import { graphqlFetchRaw } from '~/lib/graphqlClient';
import { toUnitIconPath } from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';
import { GAME_LOCALES, getGameLocaleValueOrKey, useI18n, t } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';

/** Category labels (CategoryType → display label key) */
const CATEGORY_LABELS: Record<number, string> = {
  0: 'maps.unit.catRecon',
  1: 'maps.unit.catInfantry',
  2: 'maps.unit.catCombat',
  3: 'maps.unit.catSupport',
  4: 'maps.unit.catLogistics',
  5: 'maps.unit.catHelicopters',
  6: 'maps.unit.catAir',
};

export interface UnitLookupModalProps {
  open: Signal<boolean>;
  onSelect$: PropFunction<(unitId: number, unitName: string, thumbnailPath: string) => void>;
}

export const UnitLookupModal = component$<UnitLookupModalProps>(({ open, onSelect$ }) => {
  const i18n = useI18n();
  const search = useSignal('');
  const selectedCountry = useSignal<number | null>(null);
  const selectedCategory = useSignal<number | null>(null);
  const sortBy = useSignal<'name' | 'cost'>('cost');

  // Cached data from the arsenal query
  const cards = useSignal<ArsenalCard[]>([]);
  const countries = useSignal<ArsenalCountry[]>([]);
  const loading = useSignal(false);
  const error = useSignal('');

  // Fetch arsenal data when opened
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const isOpen = track(() => open.value);
    if (!isOpen || cards.value.length > 0) return;

    loading.value = true;
    error.value = '';

    graphqlFetchRaw<{ arsenalUnitsCards: ArsenalCard[]; countries: ArsenalCountry[] }>(
      ARSENAL_PAGE_QUERY,
    )
      .then((result) => {
        const data = result.data;
        if (!data?.arsenalUnitsCards) throw new Error('No data received');
        cards.value = data.arsenalUnitsCards;
        countries.value = data.countries ?? [];
      })
      .catch(e => {
        error.value = e.message || 'Failed to load units';
      })
      .finally(() => {
        loading.value = false;
      });
  });

  // Derive unique categories from data
  const availableCategories = useComputed$(() => {
    const cats = new Set<number>();
    for (const c of cards.value) {
      if (c.unit.DisplayInArmory && !c.unit.IsUnitModification && !c.isTransport) {
        cats.add(c.unit.CategoryType);
      }
    }
    return Array.from(cats).sort((a, b) => a - b);
  });

  // Filter + search
  const filteredCards = useComputed$(() => {
    const locale = i18n.locale as Locale;
    const q = search.value.toLowerCase().trim();

    return cards.value
      .filter(c => {
        if (!c.unit.DisplayInArmory) return false;
        if (c.unit.IsUnitModification) return false;
        if (c.isTransport) return false;
        if (selectedCountry.value !== null && c.unit.CountryId !== selectedCountry.value) return false;
        if (selectedCategory.value !== null && c.unit.CategoryType !== selectedCategory.value) return false;
        if (q) {
          const name = (getGameLocaleValueOrKey(GAME_LOCALES.specs, c.unit.HUDName, locale) || c.unit.HUDName || '').toLowerCase();
          if (!name.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy.value === 'cost') return a.unit.Cost - b.unit.Cost;
        const locale = i18n.locale as Locale;
        const aName = getGameLocaleValueOrKey(GAME_LOCALES.specs, a.unit.HUDName, locale) || a.unit.HUDName || '';
        const bName = getGameLocaleValueOrKey(GAME_LOCALES.specs, b.unit.HUDName, locale) || b.unit.HUDName || '';
        return aName.localeCompare(bName);
      });
  });

  const handleSelect = $((card: ArsenalCard) => {
    const locale = i18n.locale as Locale;
    const name = getGameLocaleValueOrKey(GAME_LOCALES.specs, card.unit.HUDName, locale) || card.unit.HUDName || 'Unit';
    onSelect$(card.unit.Id, name, card.unit.ThumbnailFileName);
    open.value = false;
    search.value = '';
  });

  const handleClose = $(() => {
    open.value = false;
    search.value = '';
  });

  if (!open.value) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick$={(e) => {
        if ((e.target as HTMLElement).classList.contains('fixed')) handleClose();
      }}
    >
      <div class="w-full max-w-3xl max-h-[80vh] flex flex-col bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)]">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
          <p class="font-mono tracking-[0.3em] uppercase text-[10px] text-[var(--text-dim)]">
            {t(i18n, 'maps.unit.selectUnit')}
          </p>
          <button
            class="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            onClick$={handleClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters row */}
        <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[rgba(51,51,51,0.15)]">
          {/* Search */}
          <input
            type="text"
            placeholder={t(i18n, 'maps.unit.search')}
            class="flex-1 min-w-[150px] px-2 py-1.5 bg-transparent border border-[rgba(51,51,51,0.3)] text-xs font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] outline-none"
            value={search.value}
            onInput$={(e) => { search.value = (e.target as HTMLInputElement).value; }}
          />

          {/* Country filter */}
          <select
            class="px-2 py-1.5 bg-[var(--bg)] border border-[rgba(51,51,51,0.3)] text-xs font-mono text-[var(--text)] focus:border-[var(--accent)] outline-none"
            value={selectedCountry.value ?? ''}
            onChange$={(e) => {
              const val = (e.target as HTMLSelectElement).value;
              selectedCountry.value = val ? parseInt(val, 10) : null;
            }}
          >
            <option value="">{t(i18n, 'maps.unit.allCountries')}</option>
            {countries.value.map(c => {
              const locale = i18n.locale as Locale;
              const countryName = getGameLocaleValueOrKey(GAME_LOCALES.specs, c.Name, locale) || c.Name;
              return (
                <option key={c.Id} value={c.Id}>{countryName}</option>
              );
            })}
          </select>

          {/* Category filter */}
          <select
            class="px-2 py-1.5 bg-[var(--bg)] border border-[rgba(51,51,51,0.3)] text-xs font-mono text-[var(--text)] focus:border-[var(--accent)] outline-none"
            value={selectedCategory.value ?? ''}
            onChange$={(e) => {
              const val = (e.target as HTMLSelectElement).value;
              selectedCategory.value = val ? parseInt(val, 10) : null;
            }}
          >
            <option value="">{t(i18n, 'maps.unit.allCategories')}</option>
            {availableCategories.value.map(cat => (
              <option key={cat} value={cat}>{t(i18n, CATEGORY_LABELS[cat] ?? 'maps.unit.catOther')}</option>
            ))}
          </select>

          {/* Sort toggle */}
          <button
            class={[
              'px-2 py-1.5 text-[9px] font-mono uppercase tracking-wider border transition-colors',
              sortBy.value === 'cost'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:text-[var(--text)]',
            ].join(' ')}
            onClick$={() => { sortBy.value = sortBy.value === 'cost' ? 'name' : 'cost'; }}
          >
            {sortBy.value === 'cost' ? t(i18n, 'maps.unit.sortCost') : t(i18n, 'maps.unit.sortName')}
          </button>
        </div>

        {/* Unit list */}
        <div class="flex-1 overflow-y-auto min-h-0">
          {loading.value && (
            <div class="flex items-center justify-center py-12">
              <p class="text-xs font-mono text-[var(--text-dim)]">{t(i18n, 'maps.unit.loading')}</p>
            </div>
          )}

          {error.value && (
            <div class="flex items-center justify-center py-12">
              <p class="text-xs font-mono text-red-400">{error.value}</p>
            </div>
          )}

          {!loading.value && !error.value && filteredCards.value.length === 0 && (
            <div class="flex items-center justify-center py-12">
              <p class="text-xs font-mono text-[var(--text-dim)]">{t(i18n, 'maps.unit.noResults')}</p>
            </div>
          )}

          {!loading.value && !error.value && filteredCards.value.map(card => {
            const locale = i18n.locale as Locale;
            const name = getGameLocaleValueOrKey(GAME_LOCALES.specs, card.unit.HUDName, locale) || card.unit.HUDName || `Unit ${card.unit.Id}`;
            const thumbSrc = toUnitIconPath(card.unit.ThumbnailFileName);

            return (
              <button
                key={card.unit.Id}
                class="w-full flex items-center gap-3 px-4 py-2 border-b border-[rgba(51,51,51,0.1)] hover:bg-[rgba(70,151,195,0.08)] transition-colors text-left"
                onClick$={() => handleSelect(card)}
              >
                <div class="shrink-0 w-8 h-8 flex items-center justify-center bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)]">
                  <GameIcon src={thumbSrc} size={26} alt={name} />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-mono text-[var(--text)] truncate">{name}</p>
                  <p class="text-[9px] font-mono text-[var(--text-dim)]">
                    {card.unit.Cost} pts
                    {CATEGORY_LABELS[card.unit.CategoryType] && (
                      <span class="ml-2 opacity-60">{t(i18n, CATEGORY_LABELS[card.unit.CategoryType])}</span>
                    )}
                  </p>
                </div>
                <div class="shrink-0 text-[9px] font-mono text-[var(--accent)] uppercase tracking-wider">
                  {t(i18n, 'maps.unit.place')}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
