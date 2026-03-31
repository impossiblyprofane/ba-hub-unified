/**
 * UnitSelectorModal — modal overlay for picking a unit to add to a deck slot.
 *
 * Filters arsenal cards by category + availability, with search, sort,
 * and inline transport selection for any unit that has available transports.
 *
 * Display pattern (matches legacy):
 *  - Each unit is a row: left = unit info + "Add" button, right = transport buttons.
 *  - Clicking "Add" adds the unit without a transport.
 *  - Clicking a transport button adds the unit WITH that transport in one step.
 */
import { $, component$, useSignal, useComputed$ } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { Set2Key } from '@ba-hub/shared';
import { DECK_CATEGORIES } from '@ba-hub/shared';
import type { ArsenalCard, BuilderAvailability } from '~/lib/graphql-types';
import { toUnitIconPath } from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';
import { GAME_LOCALES, getGameLocaleValueOrKey, useI18n, t } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';

interface UnitSelectorModalProps {
  category: Set2Key;
  arsenalCards: ArsenalCard[];
  availabilities: BuilderAvailability[];
  excludeUnitIds: number[];
  spec1Id: number;
  spec2Id: number;
  locale: Locale;
  onSelect$: PropFunction<(unitId: number, count: number, transportId?: number, transportCount?: number) => void>;
  onClose$: PropFunction<() => void>;
}

export const UnitSelectorModal = component$<UnitSelectorModalProps>(
  ({ category, arsenalCards, availabilities, excludeUnitIds, spec1Id, spec2Id, locale, onSelect$, onClose$ }) => {
    const i18n = useI18n();
    const search = useSignal('');
    const sortBy = useSignal<'name' | 'cost'>('cost');
    const selectedUnitId = useSignal<number | null>(null);
    const selectedTransportId = useSignal<number | null>(null);
    const count = useSignal(1);

    const catDef = DECK_CATEGORIES.find(c => c.set2Key === category)!;

    // Build availability map: unitId → availability at Xp0 (base, no veterancy)
    // Uses whichever single spec lists the unit (max across both specs for safety)
    const availMap = new Map<number, number>();
    for (const av of availabilities) {
      if (av.specializationId === spec1Id || av.specializationId === spec2Id) {
        const existing = availMap.get(av.unitId) ?? 0;
        availMap.set(av.unitId, Math.max(existing, av.maxAvailabilityXp0));
      }
    }

    // Arsenal card lookup map
    const cardMap = new Map(arsenalCards.map(c => [c.unit.Id, c]));
    const excludeSet = new Set(excludeUnitIds);

    // Filter cards for this category + availability
    const filteredCards = useComputed$(() => {
      const q = search.value.toLowerCase();
      return arsenalCards
        .filter(c => {
          if (c.unit.CategoryType !== catDef.categoryType) return false;
          if (!availMap.has(c.unit.Id)) return false;
          if (c.isTransport) return false;
          if (c.unit.IsUnitModification) return false;
          if (excludeSet.has(c.unit.Id)) return false;
          if (q) {
            const name = getGameLocaleValueOrKey(
              GAME_LOCALES.specs, c.unit.HUDName, locale,
            ) || c.unit.HUDName || '';
            if (!name.toLowerCase().includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (sortBy.value === 'cost') return a.unit.Cost - b.unit.Cost;
          const aName = getGameLocaleValueOrKey(GAME_LOCALES.specs, a.unit.HUDName, locale) || a.unit.HUDName || '';
          const bName = getGameLocaleValueOrKey(GAME_LOCALES.specs, b.unit.HUDName, locale) || b.unit.HUDName || '';
          return aName.localeCompare(bName);
        });
    });

    /** Resolve transport ArsenalCards for a given unit */
    const getTransports = (card: ArsenalCard): ArsenalCard[] => {
      if (!card.availableTransports?.length) return [];
      return card.availableTransports
        .map(tId => cardMap.get(tId))
        .filter((c): c is ArsenalCard => c !== undefined);
    };

    /** Confirm – used from the footer when a unit is selected but the user
     *  chose quantity before clicking confirm. */
    const handleConfirm = $(() => {
      if (!selectedUnitId.value) return;
      if (selectedTransportId.value && selectedTransportId.value > 0) {
        onSelect$(selectedUnitId.value, count.value, selectedTransportId.value, count.value);
      } else {
        onSelect$(selectedUnitId.value, count.value);
      }
    });

    return (
      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60"
        onClick$={(e: MouseEvent) => {
          if ((e.target as HTMLElement).classList.contains('fixed')) {
            onClose$();
          }
        }}
      >
        <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] w-full max-w-4xl max-h-[75vh] flex flex-col">
          {/* Header */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
            <span class="font-mono tracking-[0.2em] uppercase text-[var(--text-dim)] text-xs">
              {t(i18n, 'builder.unitSelector.title')} — {t(i18n, catDef.i18nKey)}
            </span>
            <button
              onClick$={onClose$}
              class="ml-auto text-[var(--text-dim)] hover:text-[var(--text)] text-sm transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Search + sort */}
          <div class="flex items-center gap-2 px-4 py-2 border-b border-[rgba(51,51,51,0.15)]">
            <input
              type="text"
              class="flex-1 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-sm font-mono px-3 py-2 placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
              placeholder={t(i18n, 'builder.unitSelector.search')}
              value={search.value}
              onInput$={(e: InputEvent) => {
                search.value = (e.target as HTMLInputElement).value;
              }}
            />
            <button
              onClick$={() => { sortBy.value = sortBy.value === 'cost' ? 'name' : 'cost'; }}
              class="text-xs font-mono text-[var(--text-dim)] border border-[rgba(51,51,51,0.15)] px-3 py-2 hover:border-[var(--accent)] transition-colors"
            >
              {sortBy.value === 'cost'
                ? t(i18n, 'builder.unitSelector.sort.cost')
                : t(i18n, 'builder.unitSelector.sort.name')}
            </button>
          </div>

          {/* Unit list — each unit is a row with inline transport buttons */}
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredCards.value.length === 0 ? (
              <p class="text-[var(--text-dim)] text-sm text-center py-8">
                {t(i18n, 'builder.unitSelector.noResults')}
              </p>
            ) : (
              filteredCards.value.map((card) => {
                const name = getGameLocaleValueOrKey(
                  GAME_LOCALES.specs, card.unit.HUDName, locale,
                ) || card.unit.HUDName || `Unit ${card.unit.Id}`;
                const isSelected = selectedUnitId.value === card.unit.Id;
                const maxAvail = availMap.get(card.unit.Id) ?? 1;
                const transports = getTransports(card);
                const hasTransports = transports.length > 0;

                return (
                  <div
                    key={card.unit.Id}
                    class={`flex items-stretch transition-colors ${
                      isSelected
                        ? 'bg-[rgba(70,151,195,0.1)] border border-[var(--accent)]'
                        : 'bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)] hover:border-[rgba(51,51,51,0.3)]'
                    }`}
                  >
                    {/* ── Left: unit info + add button ── */}
                    <button
                      class={`flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors flex-shrink-0 ${
                        hasTransports ? 'w-[260px] border-r border-[rgba(51,51,51,0.15)]' : 'flex-1'
                      } hover:bg-[rgba(70,151,195,0.08)]`}
                      onClick$={() => {
                        if (hasTransports) {
                          // Select the unit, let user pick transport or confirm without
                          selectedUnitId.value = card.unit.Id;
                          selectedTransportId.value = null;
                          count.value = 1;
                        } else {
                          // No transports — add directly with quantity 1
                          onSelect$(card.unit.Id, 1);
                        }
                      }}
                    >
                      <GameIcon
                        src={toUnitIconPath(card.unit.ThumbnailFileName)}
                        size={32}
                        alt={name}
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-[var(--text)] truncate">{name}</p>
                        <p class="text-xs font-mono font-semibold text-[var(--text-dim)]">
                          {card.unit.Cost} {t(i18n, 'builder.editor.pts')}
                          {' · '}
                          {t(i18n, 'builder.unitSelector.available')}: <span class="text-[var(--text)] font-bold">{maxAvail}</span>
                        </p>
                      </div>
                    </button>

                    {/* ── Right: inline transport buttons ── */}
                    {hasTransports && (
                      <div class="flex-1 flex flex-wrap items-center gap-1 px-2 py-1.5">
                        {/* On Foot / add without transport */}
                        <button
                          onClick$={() => {
                            onSelect$(card.unit.Id, 1);
                          }}
                          class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-[var(--text-dim)] bg-[rgba(26,26,26,0.5)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                        >
                          {t(i18n, 'builder.unitSelector.onFoot')}
                        </button>
                        {/* Transport options */}
                        {transports.map((tc) => {
                          const tName = getGameLocaleValueOrKey(
                            GAME_LOCALES.specs, tc.unit.HUDName, locale,
                          ) || tc.unit.HUDName || `${tc.unit.Id}`;
                          return (
                            <button
                              key={tc.unit.Id}
                              onClick$={() => {
                                onSelect$(card.unit.Id, 1, tc.unit.Id, 1);
                              }}
                              class="flex items-center gap-1.5 px-2.5 py-1.5 bg-[rgba(26,26,26,0.5)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)] transition-colors"
                            >
                              <GameIcon
                                src={toUnitIconPath(tc.unit.ThumbnailFileName)}
                                size={18}
                                alt={tName}
                              />
                              <div class="min-w-0">
                                <p class="text-xs font-semibold text-[var(--text)] truncate leading-tight">{tName}</p>
                                <p class="text-[11px] font-mono font-semibold text-[var(--text-dim)] leading-tight">
                                  {tc.unit.Cost} {t(i18n, 'builder.editor.pts')}
                                  {tc.transportCapacity > 0 && (
                                    <span> · {tc.transportCapacity}</span>
                                  )}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: quantity + confirm — shown when unit with transports is selected */}
          {selectedUnitId.value && (
            <div class="flex items-center gap-3 px-4 py-3 border-t border-[rgba(51,51,51,0.3)]">
              <label class="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                {t(i18n, 'builder.unitEditor.quantity')}
              </label>
              <div class="flex items-center border border-[var(--border)]">
                <button
                  onClick$={() => { if (count.value > 1) count.value--; }}
                  class="px-2.5 py-1.5 text-[var(--text-dim)] hover:text-[var(--text)] text-sm"
                >
                  −
                </button>
                <span class="px-3 py-1.5 text-[var(--text)] text-sm font-mono bg-[rgba(26,26,26,0.4)] tabular-nums">
                  {count.value}
                </span>
                <button
                  onClick$={() => {
                    const max = availMap.get(selectedUnitId.value!) ?? 1;
                    if (count.value < max) count.value++;
                  }}
                  class="px-2.5 py-1.5 text-[var(--text-dim)] hover:text-[var(--text)] text-sm"
                >
                  +
                </button>
              </div>
              <button
                onClick$={handleConfirm}
                class="ml-auto px-5 py-2 bg-[var(--accent)] text-white text-xs font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors"
              >
                {t(i18n, 'builder.unitEditor.confirm')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);
