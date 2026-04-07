import { $, component$, useComputed$, useSignal, useStore, useOnDocument, useVisibleTask$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { GAME_LOCALES, getGameLocaleValueOrKey, useI18n, t } from '~/lib/i18n';
import { toCountryIconPath, toSpecializationIconPath, toUnitIconPath } from '~/lib/iconPaths';
import { ArsenalUnitCard } from '~/components/arsenal/ArsenalUnitCard';
import { TooltipOverlay } from '~/components/ui/TooltipOverlay';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import type { ArsenalCard, ArsenalPageData } from '~/lib/graphql-types';
import { ARSENAL_PAGE_QUERY } from '~/lib/queries/arsenal';
import { ArsenalSkeleton } from '~/components/skeletons/ArsenalSkeleton';
import { GenericErrorView } from '~/components/errors/GenericErrorView';

const CATEGORY_DEFS = [
  { id: 0, code: 'REC', label: 'Recon', i18nKey: 'arsenal.category.rec' },
  { id: 1, code: 'INF', label: 'Infantry', i18nKey: 'arsenal.category.inf' },
  { id: 2, code: 'VEH', label: 'Vehicle', i18nKey: 'arsenal.category.veh' },
  { id: 3, code: 'SUP', label: 'Support', i18nKey: 'arsenal.category.sup' },
  { id: 5, code: 'HEL', label: 'Helicopter', i18nKey: 'arsenal.category.hel' },
  { id: 6, code: 'AIR', label: 'Airplane', i18nKey: 'arsenal.category.air' },
  { id: 7, code: 'TRN', label: 'Transport', i18nKey: 'arsenal.category.trn' },
];

const CATEGORY_CODE = new Map(CATEGORY_DEFS.map(cat => [cat.id, cat.code]));


async function fetchArsenalData(signal: AbortSignal): Promise<ArsenalPageData> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: ARSENAL_PAGE_QUERY }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load arsenal data: ${response.status}`);
  }

  const payload = await response.json() as { data?: ArsenalPageData; errors?: Array<{ message: string }> };
  if (!payload.data) {
    const msg = payload.errors?.map(err => err.message).join(', ') || 'Unknown error';
    throw new Error(`Failed to load arsenal data: ${msg}`);
  }

  return payload.data;
}

const ArsenalContent = component$<{ data: ArsenalPageData }>(({ data: arsenalData }) => {
  const i18n = useI18n();
  const dataSignal = useSignal<ArsenalPageData>(arsenalData);
  const search = useSignal('');
  const selectedCountries = useSignal<number[]>([]);
  const selectedCategories = useSignal<number[]>([]);
  const selectedSpecializations = useSignal<number[]>([]);
  const sortBy = useSignal<'name' | 'cost' | 'category' | 'specialization'>('name');
  const sortDir = useSignal<'asc' | 'desc'>('asc');
  const openPanel = useSignal<null | 'countries' | 'categories' | 'specializations'>(null);
  const panelTop = useSignal(0);
  const panelLeft = useSignal(0);
  const gridRef = useSignal<HTMLElement>();
  const previousRects = useSignal<Map<number, DOMRect>>(new Map());
  const tooltipText = useSignal('');
  const tooltipX = useSignal(0);
  const tooltipY = useSignal(0);
  const tooltipVisible = useSignal(false);
  const collapsedGroups = useStore<Record<string, boolean>>({});

  const showTooltip = $((event: MouseEvent, text: string) => {
    tooltipText.value = text;
    tooltipX.value = event.clientX + 12;
    tooltipY.value = event.clientY + 12;
    tooltipVisible.value = true;
  });

  const moveTooltip = $((event: MouseEvent) => {
    tooltipX.value = event.clientX + 12;
    tooltipY.value = event.clientY + 12;
  });

  const hideTooltip = $(() => {
    tooltipVisible.value = false;
  });

  const toggleSpecSelection = $((specId: number) => {
    const next = new Set(selectedSpecializations.value);
    const wasSelected = next.has(specId);
    if (wasSelected) {
      next.delete(specId);
    } else {
      next.add(specId);
    }
    selectedSpecializations.value = Array.from(next);

    const spec = dataSignal.value.specializations.find((item) => item.Id === specId);
    if (spec) {
      const countries = new Set(selectedCountries.value);
      if (!wasSelected) {
        // Adding a spec — auto-select its country
        if (!countries.has(spec.CountryId)) {
          countries.add(spec.CountryId);
          selectedCountries.value = Array.from(countries);
        }
      } else {
        // Removing a spec — if no remaining specs belong to this country, deselect it
        const countryStillHasSpec = Array.from(next).some((id) => {
          const s = dataSignal.value.specializations.find((item) => item.Id === id);
          return s?.CountryId === spec.CountryId;
        });
        if (!countryStillHasSpec && countries.has(spec.CountryId)) {
          countries.delete(spec.CountryId);
          selectedCountries.value = Array.from(countries);
        }
      }
    }
  });

  const specNameById = useComputed$(() => {
    const map = new Map<number, string>();
    dataSignal.value.specializations.forEach((spec) => {
      const name = getGameLocaleValueOrKey(GAME_LOCALES.specs, spec.UIName, i18n.locale) || spec.UIName;
      map.set(spec.Id, name);
    });
    return map;
  });

  const countrySummary = useComputed$(() => {
    if (selectedCountries.value.length === 0) return t(i18n, 'arsenal.filter.countries');
    const names = dataSignal.value.countries
      .filter((country) => selectedCountries.value.includes(country.Id))
      .map((country) => country.Name);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  });

  const categorySummary = useComputed$(() => {
    if (selectedCategories.value.length === 0) return t(i18n, 'arsenal.filter.categories');
    const names = CATEGORY_DEFS
      .filter((cat) => selectedCategories.value.includes(cat.id))
      .map((cat) => t(i18n, cat.i18nKey));
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  });

  const specializationSummary = useComputed$(() => {
    if (selectedSpecializations.value.length === 0) return t(i18n, 'arsenal.filter.specializations');
    const names = dataSignal.value.specializations
      .filter((spec) => selectedSpecializations.value.includes(spec.Id))
      .map((spec) => specNameById.value.get(spec.Id) || spec.UIName);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  });

  useOnDocument(
    'click',
    $((event: Event) => {
      if (!openPanel.value) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.arsenal-filter-panel') && !target.closest('[data-filter-trigger]')) {
        openPanel.value = null;
      }
    }),
  );

  useOnDocument(
    'keydown',
    $((event: Event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        openPanel.value = null;
      }
    }),
  );

  const availableCountryIds = useComputed$(() => {
    const ids = new Set<number>();
    dataSignal.value.arsenalUnitsCards.forEach((card) => {
      if (!card.unit.DisplayInArmory || card.unit.IsUnitModification) return;
      ids.add(card.unit.CountryId);
    });
    return ids;
  });

  const availableSpecIds = useComputed$(() => {
    const ids = new Set<number>();
    dataSignal.value.arsenalUnitsCards.forEach((card) => {
      card.specializationIds.forEach((id) => ids.add(id));
    });
    return ids;
  });

  const filteredCards = useComputed$(() => {
    const { arsenalUnitsCards } = dataSignal.value;
    const searchTerm = search.value.trim().toLowerCase();
    const countryIds = selectedCountries.value;
    const categoryIds = selectedCategories.value;
    const specIds = selectedSpecializations.value;
    const transportOnly = categoryIds.includes(7);

    const filtered = arsenalUnitsCards.filter(card => {
      const unit = card.unit;
      if (!unit.DisplayInArmory || unit.IsUnitModification) {
        return false;
      }
      if (unit.CategoryType === 7 && !transportOnly) {
        return false;
      }
      if (searchTerm) {
        const nameMatch = unit.Name.toLowerCase().includes(searchTerm);
        const hudMatch = unit.HUDName?.toLowerCase().includes(searchTerm) ?? false;
        if (!nameMatch && !hudMatch) {
          return false;
        }
      }
      if (countryIds.length > 0 && !countryIds.includes(unit.CountryId)) {
        return false;
      }
      if (categoryIds.length > 0) {
        const nonTransportCategories = categoryIds.filter((id) => id !== 7);
        if (nonTransportCategories.length > 0 && !nonTransportCategories.includes(unit.CategoryType)) {
          return false;
        }
        if (transportOnly && !card.isTransport) {
          return false;
        }
      }
      if (specIds.length > 0 && !specIds.some((id) => card.specializationIds.includes(id))) {
        return false;
      }
      return true;
    });

    const getCost = (card: ArsenalCard) => {
      const modCost = card.defaultModificationOptions?.reduce((sum, opt) => sum + (opt.optCost ?? 0), 0) ?? 0;
      return card.unit.Cost + modCost;
    };

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy.value === 'cost') {
        return getCost(a) - getCost(b);
      }
      if (sortBy.value === 'category') {
        const catDiff = a.unit.CategoryType - b.unit.CategoryType;
        if (catDiff !== 0) return catDiff;
        return a.unit.HUDName.localeCompare(b.unit.HUDName);
      }
      if (sortBy.value === 'specialization') {
        const aSpec = a.specializationIds[0] ?? Infinity;
        const bSpec = b.specializationIds[0] ?? Infinity;
        if (aSpec !== bSpec) return aSpec - bSpec;
        return a.unit.HUDName.localeCompare(b.unit.HUDName);
      }
      return a.unit.HUDName.localeCompare(b.unit.HUDName);
    });

    if (sortDir.value === 'desc') {
      sorted.reverse();
    }

    return sorted;
  });

  useVisibleTask$(({ track }) => {
    track(() => filteredCards.value.map((card) => card.unit.Id).join(','));

    const container = gridRef.value;
    if (!container) return;

    const elements = Array.from(container.querySelectorAll('[data-card-id]')) as HTMLElement[];
    const nextRects = new Map<number, DOMRect>();
    elements.forEach((el) => {
      const id = Number(el.dataset.cardId);
      if (Number.isFinite(id)) {
        nextRects.set(id, el.getBoundingClientRect());
      }
    });

    const prevRects = previousRects.value;
    if (prevRects.size > 0) {
      elements.forEach((el) => {
        const id = Number(el.dataset.cardId);
        const prev = prevRects.get(id);
        const next = nextRects.get(id);
        if (!prev || !next) return;

        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (dx || dy) {
          el.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: 'translate(0, 0)' },
            ],
            {
              duration: 220,
              easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            },
          );
        }
      });
    }

    previousRects.value = nextRects;
  });

  const toggleSelection = $((targetSignal: { value: number[] }, id: number) => {
    const set = new Set(targetSignal.value);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    targetSignal.value = Array.from(set);
  });

  const isSelected = (list: number[], id: number) => list.includes(id);

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">{t(i18n, 'arsenal.tag')}</p>
        <div class="flex items-end justify-between gap-6">
          <div>
            <h1 class="text-3xl font-semibold text-[var(--text)] tracking-tight">{t(i18n, 'arsenal.title')}</h1>
            <p class="text-sm text-[var(--text-dim)] mt-2 max-w-2xl">
              {t(i18n, 'arsenal.subtitle')}
            </p>
          </div>
          <div class="text-xs font-mono tracking-widest text-[var(--text-dim)] uppercase">
            {filteredCards.value.length} / {dataSignal.value.arsenalUnitsCards.length} {t(i18n, 'arsenal.units')}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 mb-8">
        <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]">
          <label class="text-[10px] font-mono text-[var(--text-dim)] tracking-[0.3em] uppercase px-3 py-2 border-b border-[rgba(51,51,51,0.3)] block">{t(i18n, 'arsenal.search')}</label>
          <input
            value={search.value}
            onInput$={(event) => {
              search.value = (event.target as HTMLInputElement).value;
            }}
            placeholder={t(i18n, 'arsenal.search.placeholder')}
            class="w-full bg-transparent text-sm text-[var(--text)] border border-[var(--border)] px-3 py-2 mx-0 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div class="flex flex-wrap items-center gap-6">
          {/* ── Filter dropdowns ── */}
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-[var(--text-dim)] tracking-[0.25em] uppercase select-none">{t(i18n, 'arsenal.filter.label')}</span>
            <div class="w-px h-5 bg-[var(--border)]" />
            <button
              class={[
                'px-3 py-2 text-xs font-mono uppercase border min-w-[140px] text-left truncate transition-colors',
                selectedCountries.value.length > 0
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-dim)]',
              ].join(' ')}
              onClick$={(event) => {
                const btn = (event.target as HTMLElement).closest('button') as HTMLElement | null;
                const rect = btn?.getBoundingClientRect();
                if (rect) {
                  panelTop.value = rect.bottom + 6;
                  panelLeft.value = rect.left;
                }
                openPanel.value = openPanel.value === 'countries' ? null : 'countries';
              }}
              data-filter-trigger="countries"
            >
              {countrySummary.value}
            </button>
            <button
              class={[
                'px-3 py-2 text-xs font-mono uppercase border min-w-[160px] text-left truncate transition-colors',
                selectedSpecializations.value.length > 0
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-dim)]',
              ].join(' ')}
              onClick$={(event) => {
                const btn = (event.target as HTMLElement).closest('button') as HTMLElement | null;
                const rect = btn?.getBoundingClientRect();
                if (rect) {
                  panelTop.value = rect.bottom + 6;
                  panelLeft.value = rect.left;
                }
                openPanel.value = openPanel.value === 'specializations' ? null : 'specializations';
              }}
              data-filter-trigger="specializations"
            >
              {specializationSummary.value}
            </button>
            <button
              class={[
                'px-3 py-2 text-xs font-mono uppercase border min-w-[140px] text-left truncate transition-colors',
                selectedCategories.value.length > 0
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-dim)]',
              ].join(' ')}
              onClick$={(event) => {
                const btn = (event.target as HTMLElement).closest('button') as HTMLElement | null;
                const rect = btn?.getBoundingClientRect();
                if (rect) {
                  panelTop.value = rect.bottom + 6;
                  panelLeft.value = rect.left;
                }
                openPanel.value = openPanel.value === 'categories' ? null : 'categories';
              }}
              data-filter-trigger="categories"
            >
              {categorySummary.value}
            </button>
            {(selectedCountries.value.length > 0 || selectedCategories.value.length > 0 || selectedSpecializations.value.length > 0) && (
              <SimpleTooltip text="Clear all filters">
                <button
                  class="px-2 py-2 text-xs font-mono uppercase text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                  onClick$={() => {
                    search.value = '';
                    selectedCountries.value = [];
                    selectedCategories.value = [];
                    selectedSpecializations.value = [];
                  }}
                >
                  ✕
                </button>
              </SimpleTooltip>
            )}
          </div>

          {/* ── Divider ── */}
          <div class="w-px h-7 bg-[var(--border)] hidden sm:block" />

          {/* ── Sort controls ── */}
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-[var(--text-dim)] tracking-[0.25em] uppercase select-none">{t(i18n, 'arsenal.sort.label')}</span>
            <div class="w-px h-5 bg-[var(--border)]" />
            <div class="flex">
              <button
                class={[
                  'px-3 py-2 text-xs font-mono uppercase border border-r-0 transition-colors',
                  sortBy.value === 'name'
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                ].join(' ')}
                onClick$={() => { sortBy.value = 'name'; }}
              >
                {t(i18n, 'arsenal.sort.name')}
              </button>
              <button
                class={[
                  'px-3 py-2 text-xs font-mono uppercase border border-r-0 transition-colors',
                  sortBy.value === 'cost'
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                ].join(' ')}
                onClick$={() => { sortBy.value = 'cost'; }}
              >
                {t(i18n, 'arsenal.sort.cost')}
              </button>
              <button
                class={[
                  'px-3 py-2 text-xs font-mono uppercase border border-r-0 transition-colors',
                  sortBy.value === 'category'
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                ].join(' ')}
                onClick$={() => { sortBy.value = 'category'; }}
              >
                {t(i18n, 'arsenal.sort.category')}
              </button>
              <button
                class={[
                  'px-3 py-2 text-xs font-mono uppercase border transition-colors',
                  sortBy.value === 'specialization'
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                ].join(' ')}
                onClick$={() => { sortBy.value = 'specialization'; }}
              >
                {t(i18n, 'arsenal.sort.spec')}
              </button>
            </div>
            <SimpleTooltip text={sortDir.value === 'asc' ? t(i18n, 'arsenal.sort.ascending') : t(i18n, 'arsenal.sort.descending')}>
              <button
                class="px-2 py-2 text-xs font-mono uppercase border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                onClick$={() => {
                  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
                }}
              >
                {sortDir.value === 'asc' ? '↑' : '↓'}
              </button>
            </SimpleTooltip>
          </div>
        </div>
      </div>

      {openPanel.value && (
        <div
          class="arsenal-filter-panel fixed z-40 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] backdrop-blur-sm border border-[rgba(51,51,51,0.3)] p-4 max-h-[60vh] overflow-auto"
          style={{
            top: `${panelTop.value}px`,
            left: `${panelLeft.value}px`,
            minWidth: '260px',
          }}
        >
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-mono uppercase tracking-[0.3em] text-[var(--text-dim)]">
              {openPanel.value === 'countries' && t(i18n, 'arsenal.filter.countries')}
              {openPanel.value === 'categories' && t(i18n, 'arsenal.filter.categories')}
              {openPanel.value === 'specializations' && t(i18n, 'arsenal.filter.specializations')}
            </p>
            <button
              class="text-xs font-mono uppercase text-[var(--text-dim)] hover:text-[var(--text)]"
              onClick$={() => { openPanel.value = null; }}
            >
              {t(i18n, 'arsenal.panel.close')}
            </button>
          </div>

          {openPanel.value === 'countries' && (
            <div class="grid grid-cols-1 gap-2">
              {dataSignal.value.countries
                .filter((country) => availableCountryIds.value.has(country.Id))
                .map((country) => (
                  <button
                    key={country.Id}
                    class={[
                      'px-3 py-2 text-xs font-mono uppercase border flex items-center gap-2',
                      isSelected(selectedCountries.value, country.Id)
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                        : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                    ].join(' ')}
                    onClick$={() => toggleSelection(selectedCountries, country.Id)}
                  >
                    <span class="w-4 h-3 border border-[var(--border)] bg-black/40">
                      <img
                        src={toCountryIconPath(country.FlagFileName)}
                        width={16}
                        height={12}
                        class="w-full h-full object-cover"
                        alt={country.Name}
                      />
                    </span>
                    {country.Name}
                  </button>
                ))}
            </div>
          )}

          {openPanel.value === 'categories' && (
            <div class="grid grid-cols-1 gap-2">
              {CATEGORY_DEFS.map((cat) => (
                <button
                  key={cat.id}
                  class={[
                    'px-3 py-2 text-xs font-mono uppercase border flex items-center justify-between gap-2',
                    isSelected(selectedCategories.value, cat.id)
                      ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                      : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                  ].join(' ')}
                  onClick$={() => toggleSelection(selectedCategories, cat.id)}
                >
                  <span>{t(i18n, cat.i18nKey)}</span>
                  <span class="text-[10px] opacity-70">{cat.code}</span>
                </button>
              ))}
            </div>
          )}

          {openPanel.value === 'specializations' && (
            <div class="grid grid-cols-1 gap-2">
              {dataSignal.value.specializations
                .filter((spec) => availableSpecIds.value.has(spec.Id))
                  .map((spec) => (
                    <button
                      key={spec.Id}
                      class={[
                        'px-3 py-2 text-xs font-mono uppercase border text-left flex items-center gap-2',
                        isSelected(selectedSpecializations.value, spec.Id)
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                          : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      ].join(' ')}
                      onClick$={() => toggleSpecSelection(spec.Id)}
                    >
                      <span class="w-4 h-4 border border-[var(--border)] bg-black/40">
                        <img
                          src={toSpecializationIconPath(spec.Icon)}
                          width={16}
                          height={16}
                          class="w-full h-full object-cover"
                          alt={spec.UIName}
                        />
                      </span>
                      {specNameById.value.get(spec.Id) || spec.UIName}
                    </button>
                  ))}
            </div>
          )}
        </div>
      )}

      {(sortBy.value === 'category' || sortBy.value === 'specialization') ? (
        <div class="flex flex-col gap-6" ref={gridRef}>
          {(() => {
            const groups = new Map<string, ArsenalCard[]>();
            filteredCards.value.forEach((card) => {
              let groupKey: string;
              if (sortBy.value === 'category') {
                const catDef = CATEGORY_DEFS.find((c) => c.id === card.unit.CategoryType);
                groupKey = catDef ? `${catDef.code} — ${t(i18n, catDef.i18nKey)}` : t(i18n, 'arsenal.group.unknown');
              } else {
                const primarySpecId = card.specializationIds[0];
                groupKey = primarySpecId
                  ? specNameById.value.get(primarySpecId) || t(i18n, 'arsenal.group.unknown')
                  : t(i18n, 'arsenal.group.noSpecialization');
              }
              if (!groups.has(groupKey)) groups.set(groupKey, []);
              groups.get(groupKey)!.push(card);
            });

            const renderCardGrid = (cards: ArsenalCard[]) => (
              <div
                class="grid gap-3 md:gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
              >
                {cards.map((card) => {
                  const unit = card.unit;
                  const country = dataSignal.value.countries.find((c) => c.Id === unit.CountryId);
                  const primarySpecId = card.specializationIds[0];
                  const specName = primarySpecId
                    ? specNameById.value.get(primarySpecId) || ''
                    : '';
                  const specIcon = primarySpecId
                    ? dataSignal.value.specializations.find((spec) => spec.Id === primarySpecId)?.Icon
                    : undefined;
                  const cost = unit.Cost + (card.defaultModificationOptions?.reduce((sum, opt) => sum + (opt.optCost ?? 0), 0) ?? 0);
                  const unitIconUrl = toUnitIconPath(unit.ThumbnailFileName);
                  const countryFlagUrl = country ? toCountryIconPath(country.FlagFileName) : undefined;
                  const specIconUrl = specIcon ? toSpecializationIconPath(specIcon) : undefined;
                  const seats = card.transportCapacity > 0 ? card.transportCapacity : undefined;
                  const lift = card.cargoCapacity > 0 ? Math.round(card.cargoCapacity) : undefined;

                  return (
                    <ArsenalUnitCard
                      key={unit.Id}
                      href={`/arsenal/${unit.Id}`}
                      dataCardId={unit.Id}
                      unitName={unit.HUDName}
                      unitIconUrl={unitIconUrl}
                      categoryCode={CATEGORY_CODE.get(unit.CategoryType) ?? 'UNK'}
                      cost={cost}
                      countryName={country?.Name}
                      countryFlagUrl={countryFlagUrl}
                      specName={specName}
                      specIconUrl={specIconUrl}
                      seats={seats}
                      lift={lift}
                      onTooltipShow$={showTooltip}
                      onTooltipMove$={moveTooltip}
                      onTooltipHide$={hideTooltip}
                    />
                  );
                })}
              </div>
            );

            return Array.from(groups.entries()).map(([groupLabel, cards]) => {
              const isCollapsed = !!collapsedGroups[groupLabel];
              return (
                <div key={groupLabel}>
                  <button
                    type="button"
                    class="flex items-center gap-3 mb-2 w-full text-left group cursor-pointer"
                    onClick$={() => { collapsedGroups[groupLabel] = !collapsedGroups[groupLabel]; }}
                  >
                    <span class="text-[10px] font-mono text-[var(--text-dim)] transition-transform" style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                    <h2 class="text-xs font-mono uppercase tracking-[0.3em] text-[var(--accent)] group-hover:text-[var(--accent-hi)] transition-colors">{groupLabel}</h2>
                    <div class="flex-1 h-px bg-[var(--border)]" />
                    <span class="text-[10px] font-mono text-[var(--text-dim)]">{cards.length}</span>
                  </button>
                  {!isCollapsed && (
                    sortBy.value === 'specialization' ? (
                      <div class="flex flex-col gap-4 pl-2">
                        {(() => {
                          const catGroups = new Map<string, ArsenalCard[]>();
                          cards.forEach((card) => {
                            const catDef = CATEGORY_DEFS.find((c) => c.id === card.unit.CategoryType);
                            const catKey = catDef ? `${catDef.code} — ${t(i18n, catDef.i18nKey)}` : t(i18n, 'arsenal.group.unknown');
                            if (!catGroups.has(catKey)) catGroups.set(catKey, []);
                            catGroups.get(catKey)!.push(card);
                          });
                          return Array.from(catGroups.entries()).map(([catLabel, catCards]) => {
                            const subKey = `${groupLabel}::${catLabel}`;
                            const subCollapsed = !!collapsedGroups[subKey];
                            return (
                              <div key={catLabel}>
                                <button
                                  type="button"
                                  class="flex items-center gap-2 mb-1.5 w-full text-left group cursor-pointer"
                                  onClick$={() => { collapsedGroups[subKey] = !collapsedGroups[subKey]; }}
                                >
                                  <span class="text-[9px] font-mono text-[var(--text-dim)] transition-transform" style={{ display: 'inline-block', transform: subCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                                  <h3 class="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)] group-hover:text-[var(--text)] transition-colors">{catLabel}</h3>
                                  <div class="flex-1 h-px bg-[var(--border)]/50" />
                                  <span class="text-[9px] font-mono text-[var(--text-dim)]">{catCards.length}</span>
                                </button>
                                {!subCollapsed && renderCardGrid(catCards)}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : renderCardGrid(cards)
                  )}
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <div
          class="grid gap-3 md:gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          ref={gridRef}
        >
          {filteredCards.value.map((card) => {
            const unit = card.unit;
            const country = dataSignal.value.countries.find((c) => c.Id === unit.CountryId);
            const primarySpecId = card.specializationIds[0];
            const specName = primarySpecId
              ? specNameById.value.get(primarySpecId) || ''
              : '';
            const specIcon = primarySpecId
              ? dataSignal.value.specializations.find((spec) => spec.Id === primarySpecId)?.Icon
              : undefined;
            const cost = unit.Cost + (card.defaultModificationOptions?.reduce((sum, opt) => sum + (opt.optCost ?? 0), 0) ?? 0);
            const unitIconUrl = toUnitIconPath(unit.ThumbnailFileName);
            const countryFlagUrl = country ? toCountryIconPath(country.FlagFileName) : undefined;
            const specIconUrl = specIcon ? toSpecializationIconPath(specIcon) : undefined;
            const seats = card.transportCapacity > 0 ? card.transportCapacity : undefined;
            const lift = card.cargoCapacity > 0 ? Math.round(card.cargoCapacity) : undefined;

            return (
              <ArsenalUnitCard
                key={unit.Id}
                href={`/arsenal/${unit.Id}`}
                dataCardId={unit.Id}
                unitName={unit.HUDName}
                unitIconUrl={unitIconUrl}
                categoryCode={CATEGORY_CODE.get(unit.CategoryType) ?? 'UNK'}
                cost={cost}
                countryName={country?.Name}
                countryFlagUrl={countryFlagUrl}
                specName={specName}
                specIconUrl={specIconUrl}
                seats={seats}
                lift={lift}
                onTooltipShow$={showTooltip}
                onTooltipMove$={moveTooltip}
                onTooltipHide$={hideTooltip}
              />
            );
          })}
        </div>
      )}
      <TooltipOverlay
        text={tooltipText.value}
        x={tooltipX.value}
        y={tooltipY.value}
        visible={tooltipVisible.value}
      />
    </div>
  );
});

export default component$(() => {
  const data = useSignal<ArsenalPageData | null>(null);
  const error = useSignal<unknown>(null);
  const refreshCounter = useSignal(0);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => refreshCounter.value);
    const abort = new AbortController();
    cleanup(() => abort.abort());
    data.value = null;
    error.value = null;
    fetchArsenalData(abort.signal)
      .then((result) => {
        data.value = result;
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        error.value = err;
      });
  });

  const retry$ = $(() => {
    refreshCounter.value++;
  });

  if (error.value) {
    return (
      <GenericErrorView
        titleKey="errors.arsenalLoadFailed"
        messageKey="errors.arsenalLoadMessage"
        error={error.value}
        retry$={retry$}
      />
    );
  }
  if (!data.value) {
    return <ArsenalSkeleton />;
  }
  return <ArsenalContent data={data.value} />;
});

export const head: DocumentHead = {
  title: 'BA HUB - Arsenal',
  meta: [
    {
      name: 'description',
      content: 'Browse and analyze 300+ units, weapons, and equipment with advanced filtering.',
    },
  ],
};
