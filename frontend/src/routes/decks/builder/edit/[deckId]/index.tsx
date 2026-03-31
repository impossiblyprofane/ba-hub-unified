/**
 * /builder/edit/[deckId] — Deck Editor page.
 *
 * The core editing experience: loads the deck from localStorage, fetches
 * builder data (arsenal cards + availabilities) via GraphQL, and renders
 * the category grid with unit slots.
 */
import {
  $, component$, useSignal, useStore, useVisibleTask$,
} from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import type { EditorDeck, UnitConfig, Set2Key } from '@ba-hub/shared';
import { DECK_CATEGORIES, EDITOR_CATEGORY_KEYS } from '@ba-hub/shared';
import type { DeckModification } from '@ba-hub/shared';
import { getDeck, saveDeck, deleteDeck, duplicateDeck, computeDeckStats } from '~/lib/deck';
import { UnitType } from '~/lib/unit-types';
import { BUILDER_DATA_QUERY } from '~/lib/queries/builder';
import type { BuilderPageData, ArsenalCard } from '~/lib/graphql-types';
import { DeckSlotCard } from '~/components/builder/DeckSlotCard';
import { UnitSelectorModal } from '~/components/builder/UnitSelectorModal';
import { UnitEditorPanel } from '~/components/builder/UnitEditorPanel';
import { ExportModal } from '~/components/builder/ExportModal';
import { GameIcon } from '~/components/GameIcon';
import { toCountryIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';

/** Convert Record<number, ArsenalCard> (from signal) to Map for saveDeck stats caching. */
function toCardMap(lookup: Record<number, ArsenalCard>): Map<number, ArsenalCard> {
  return new Map(Object.entries(lookup).map(([k, v]) => [Number(k), v]));
}

interface EditorState {
  deck: EditorDeck | null;
  selectedCategory: Set2Key | null;
  selectedSlot: number | null;
  showUnitSelector: boolean;
  showUnitEditor: boolean;
  showExport: boolean;
  showAdvisor: boolean;
  isRenaming: boolean;
  showDeleteConfirm: boolean;
}

export default component$(() => {
  const i18n = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const deckId = loc.params.deckId;

  const state = useStore<EditorState>({
    deck: null,
    selectedCategory: null,
    selectedSlot: null,
    showUnitSelector: false,
    showUnitEditor: false,
    showExport: false,
    showAdvisor: false,
    isRenaming: false,
    showDeleteConfirm: false,
  });

  /** Rename input value (kept outside store for fast typing) */
  const renameValue = useSignal('');

  // ── Builder data (arsenal cards + availabilities) ──
  const builderData = useSignal<BuilderPageData | null>(null);
  const builderLoading = useSignal(true);
  const builderError = useSignal('');

  /** Arsenal card lookup — stored when builder data loads */
  const arsenalCardLookup = useSignal<Record<number, ArsenalCard>>({});

  /** Availability map: unitId → maxXp0 count — populated when builder data loads */
  const availMapRef = useSignal<Record<number, number>>({});

  // ── Load deck from localStorage, then fetch builder data. ──
  // Uses eagerness: 'load' so this fires reliably on cold page loads
  // (direct URL navigation), not just client-side SPA transitions.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const loaded = getDeck(deckId);
    if (!loaded) {
      nav('/decks/builder');
      return;
    }
    // Assign as a fresh object to ensure Qwik detects the change
    state.deck = { ...loaded };

    // Fetch builder data (one-shot — country/spec never change in the editor)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: BUILDER_DATA_QUERY,
          variables: {
            countryId: loaded.deck.country,
            spec1Id: loaded.deck.spec1,
            spec2Id: loaded.deck.spec2,
          },
        }),
      });
      if (!resp.ok) throw new Error(`Failed: ${resp.status}`);
      const payload = await resp.json() as { data?: { builderData: BuilderPageData } };
      if (!payload.data) throw new Error('No builder data');
      builderData.value = payload.data.builderData;

      // Populate arsenal card lookup for handlers (plain object, serializable)
      const lookup: Record<number, ArsenalCard> = {};
      for (const c of payload.data.builderData.arsenalUnitsCards) {
        lookup[c.unit.Id] = c;
      }
      arsenalCardLookup.value = lookup;

      // Populate availability map (unitId → Xp0 count) for handlers
      const am: Record<number, number> = {};
      for (const av of payload.data.builderData.availabilities) {
        if (av.specializationId === loaded.deck.spec1 || av.specializationId === loaded.deck.spec2) {
          am[av.unitId] = Math.max(am[av.unitId] ?? 0, av.maxAvailabilityXp0);
        }
      }
      availMapRef.value = am;
    } catch (e) {
      builderError.value = (e as Error).message;
    } finally {
      builderLoading.value = false;
    }
  }, { strategy: 'document-ready' });

  /** Click a slot — opens unit selector for empty, editor for filled.
   *  When the editor flyout is already open and you click another filled
   *  slot, we just update the coordinates — the panel re-keys and
   *  switches content seamlessly without closing/reopening. */
  const handleSlotClick = $((category: Set2Key, slotIndex: number) => {
    const units = state.deck?.deck.set2[category] as UnitConfig[] | undefined;
    const unit = units?.[slotIndex];

    if (!unit?.unitId) {
      // Empty slot → close editor flyout (if open) and open unit selector
      state.showUnitEditor = false;
      state.selectedCategory = category;
      state.selectedSlot = slotIndex;
      state.showUnitSelector = true;
    } else {
      // Filled slot → close selector (if open) and open/switch editor flyout
      state.showUnitSelector = false;
      state.selectedCategory = category;
      state.selectedSlot = slotIndex;
      state.showUnitEditor = true;
    }
  });

  const handleUnitSelected = $((unitId: number, count: number, transportId?: number, transportCount?: number) => {
    if (!state.deck || !state.selectedCategory || state.selectedSlot === null) return;
    const category = state.selectedCategory;
    const slotIdx = state.selectedSlot;

    const lookup = arsenalCardLookup.value;
    const unitCard = lookup[unitId];
    const tranCard = transportId ? lookup[transportId] : undefined;

    // Build default DeckModification[] from ArsenalCard.defaultModificationOptions
    const toMods = (card: ArsenalCard | undefined): DeckModification[] => {
      if (!card?.defaultModificationOptions?.length) return [];
      return card.defaultModificationOptions.map(m => ({
        modId: m.modId,
        optId: m.optId,
        cost: m.optCost,
        run: m.optRun ?? undefined,
        cwun: m.optCwun ?? undefined,
        type: m.type ?? 0,
        thumbnailOverride: m.optThumbnailOverride ?? undefined,
        portraitOverride: m.optPortraitOverride ?? undefined,
      }));
    };

    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    units[slotIdx] = {
      ...units[slotIdx],
      unitId,
      count,
      cat: DECK_CATEGORIES.find(c => c.set2Key === category)?.categoryType ?? 0,
      slot: slotIdx,
      tranId: transportId,
      tranCount: transportId ? (transportCount ?? count) : undefined,
      modList: toMods(unitCard),
      modListTr: toMods(tranCard),
    };

    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
    state.showUnitSelector = false;
  });

  const handleRemoveUnit = $((category: Set2Key, slotIndex: number) => {
    if (!state.deck) return;
    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    const catType = units[slotIndex].cat;

    // Remove the slot and shift all subsequent units up to close the gap
    units.splice(slotIndex, 1);
    // Append an empty slot at the end to keep array length constant
    units.push({ cat: catType, slot: units.length, modList: [], modListTr: [] });
    // Re-index slot numbers so they stay sequential
    for (let i = 0; i < units.length; i++) units[i] = { ...units[i], slot: i };

    // If the editor was showing this slot, close it
    if (state.selectedCategory === category && state.selectedSlot === slotIndex) {
      state.showUnitEditor = false;
    }

    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
  });

  /** Change unit count (+/- delta) for a filled slot */
  const handleChangeCount = $((category: Set2Key, slotIndex: number, delta: number) => {
    if (!state.deck) return;
    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    const unit = units[slotIndex];
    if (!unit?.unitId) return;

    const maxAvail = availMapRef.value[unit.unitId] ?? 99;
    const newCount = Math.max(1, Math.min((unit.count ?? 1) + delta, maxAvail));
    if (newCount === (unit.count ?? 1)) return; // no change

    // Clamp transport count so it never exceeds the new unit count
    const clampedTranCount = unit.tranId && unit.tranCount
      ? Math.min(unit.tranCount, newCount)
      : unit.tranCount;
    units[slotIndex] = { ...unit, count: newCount, tranCount: clampedTranCount };

    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
  });

  /** Change transport count (+/- delta) for a filled slot with a transport */
  const handleChangeTransportCount = $((category: Set2Key, slotIndex: number, delta: number) => {
    if (!state.deck) return;
    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    const unit = units[slotIndex];
    if (!unit?.unitId || !unit.tranId) return;

    const maxTran = unit.count ?? 1;
    const newCount = Math.max(1, Math.min((unit.tranCount ?? 1) + delta, maxTran));
    if (newCount === (unit.tranCount ?? 1)) return;
    units[slotIndex] = { ...unit, tranCount: newCount };

    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
  });

  /** Swap two slots within a category */
  const handleSwapSlots = $((category: Set2Key, fromIndex: number, toIndex: number) => {
    if (!state.deck) return;
    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    const maxSlots = state.deck.deckMaxSlots[category] ?? 0;
    if (toIndex < 0 || toIndex >= maxSlots) return;

    // Swap the two entries
    const temp = { ...units[fromIndex] };
    units[fromIndex] = { ...units[toIndex], slot: fromIndex };
    units[toIndex] = { ...temp, slot: toIndex };

    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
  });

  /** Update a single modification option for a unit (main or transport). */
  const handleModificationChange = $((
    category: Set2Key,
    slotIndex: number,
    modId: number,
    optId: number,
    cost: number,
    run: string | undefined,
    cwun: string | undefined,
    type: number,
    isTransport: boolean,
    thumbnailOverride: string | undefined,
    portraitOverride: string | undefined,
  ) => {
    if (!state.deck) return;
    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    const unit = units[slotIndex];
    if (!unit?.unitId) return;

    const field = isTransport ? 'modListTr' : 'modList';
    const currentList = [...(unit[field] ?? [])];
    const idx = currentList.findIndex(m => m.modId === modId);
    const newMod: DeckModification = { modId, optId, cost, run, cwun, type, thumbnailOverride, portraitOverride };
    if (idx >= 0) {
      currentList[idx] = newMod;
    } else {
      currentList.push(newMod);
    }

    units[slotIndex] = { ...unit, [field]: currentList };
    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
  });

  /** Change or remove the transport for a slot */
  const handleTransportChange = $((category: Set2Key, slotIndex: number, newTransportId: number | null) => {
    if (!state.deck) return;
    const units = [...(state.deck.deck.set2[category] as UnitConfig[])];
    const unit = units[slotIndex];
    if (!unit?.unitId) return;

    if (newTransportId) {
      // Switching to a new transport — reset transport mods to defaults
      const lookup = arsenalCardLookup.value;
      const tranCard = lookup[newTransportId];
      const toMods = (card: ArsenalCard | undefined): DeckModification[] => {
        if (!card?.defaultModificationOptions?.length) return [];
        return card.defaultModificationOptions.map(m => ({
          modId: m.modId,
          optId: m.optId,
          cost: m.optCost,
          run: m.optRun ?? undefined,
          cwun: m.optCwun ?? undefined,
          type: m.type ?? 0,
          thumbnailOverride: m.optThumbnailOverride ?? undefined,
          portraitOverride: m.optPortraitOverride ?? undefined,
        }));
      };
      units[slotIndex] = {
        ...unit,
        tranId: newTransportId,
        tranCount: unit.tranCount ?? Math.min(unit.count ?? 1, 1),
        modListTr: toMods(tranCard),
      };
    } else {
      // On foot — clear transport fields
      units[slotIndex] = {
        ...unit,
        tranId: undefined,
        tranCount: undefined,
        modListTr: [],
      };
    }

    state.deck = {
      ...state.deck,
      deck: {
        ...state.deck.deck,
        set2: { ...state.deck.deck.set2, [category]: units },
      },
    };
    saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
  });

  return (
    <div class="max-w-[1600px]">
      {!state.deck ? (
        <div class="text-[var(--text-dim)] text-sm font-mono">
          {t(i18n, 'common.loading')}
        </div>
      ) : (
        <>
          {/* ── Editor header ── */}
          <div class="mb-4">
            {/* Row 1: Back link */}
            <div class="mb-3">
              <a
                href="/decks/builder"
                class="text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
              >
                ← {t(i18n, 'builder.editor.backToList')}
              </a>
            </div>

            {/* Row 2: Deck name (click to rename) + Controls */}
            <div class="flex items-center gap-4 mb-3">
              {state.isRenaming ? (
                <div class="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={renameValue.value}
                    onInput$={(e: InputEvent) => { renameValue.value = (e.target as HTMLInputElement).value; }}
                    onKeyDown$={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        const name = renameValue.value.trim();
                        if (name && state.deck) {
                          state.deck = { ...state.deck, deck: { ...state.deck.deck, name } };
                          saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
                        }
                        state.isRenaming = false;
                      }
                      if (e.key === 'Escape') { state.isRenaming = false; }
                    }}
                    class="flex-1 bg-[rgba(26,26,26,0.6)] border border-[var(--accent)] text-[var(--text)] text-xl font-bold px-3 py-1 focus:outline-none font-mono"
                    autoFocus
                  />
                  <button
                    onClick$={() => {
                      const name = renameValue.value.trim();
                      if (name && state.deck) {
                        state.deck = { ...state.deck, deck: { ...state.deck.deck, name } };
                        saveDeck(state.deck, toCardMap(arsenalCardLookup.value));
                      }
                      state.isRenaming = false;
                    }}
                    class="px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] text-xs font-mono uppercase tracking-wider hover:bg-[rgba(70,151,195,0.1)] transition-colors"
                  >✓</button>
                  <button
                    onClick$={() => { state.isRenaming = false; }}
                    class="px-3 py-1.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:text-[var(--text)] transition-colors"
                  >✕</button>
                </div>
              ) : (
                <SimpleTooltip text={t(i18n, 'builder.editor.rename')}>
                  <h1
                    class="text-2xl font-bold text-[var(--text)] flex-1 truncate cursor-pointer hover:text-[var(--accent)] transition-colors group"
                    onClick$={() => {
                      renameValue.value = state.deck?.deck.name || '';
                      state.isRenaming = true;
                    }}
                  >
                    {state.deck.deck.name || 'Unnamed Deck'}
                    <span class="text-[var(--text-dim)] text-sm ml-2 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                  </h1>
                </SimpleTooltip>
              )}

              {/* ── Control buttons ── */}
              <div class="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick$={() => { state.showExport = true; }}
                  class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {t(i18n, 'builder.editor.export')}
                </button>

                <SimpleTooltip text={t(i18n, 'builder.controls.duplicateDesc')}>
                  <button
                    onClick$={() => {
                      if (!state.deck) return;
                      const copy = duplicateDeck(state.deck);
                      saveDeck(copy, toCardMap(arsenalCardLookup.value));
                      nav('/decks/builder/edit/' + copy.deckId);
                    }}
                    class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    {t(i18n, 'builder.controls.duplicate')}
                  </button>
                </SimpleTooltip>
                <SimpleTooltip text={t(i18n, 'builder.controls.publishDesc')}>
                  <button
                    disabled
                    class="px-3 py-1.5 border border-[rgba(51,51,51,0.15)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider opacity-40 cursor-not-allowed"
                  >
                    {t(i18n, 'builder.controls.publish')}
                  </button>
                </SimpleTooltip>
                {state.showDeleteConfirm ? (
                  <div class="flex items-center gap-1">
                    <span class="text-[10px] font-mono text-orange-400 mr-1">Sure?</span>
                    <button
                      onClick$={() => {
                        if (state.deck) {
                          deleteDeck(state.deck.deckId);
                          nav('/decks/builder');
                        }
                      }}
                      class="px-2 py-1.5 border border-red-500 text-red-400 text-[10px] font-mono uppercase tracking-wider hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                    >Yes</button>
                    <button
                      onClick$={() => { state.showDeleteConfirm = false; }}
                      class="px-2 py-1.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:text-[var(--text)] transition-colors"
                    >No</button>
                  </div>
                ) : (
                  <button
                    onClick$={() => { state.showDeleteConfirm = true; }}
                    class="px-3 py-1.5 border border-[rgba(51,51,51,0.15)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-red-500 hover:text-red-400 transition-colors"
                  >
                    {t(i18n, 'builder.controls.delete')}
                  </button>
                )}
              </div>
            </div>

            {/* Row 3: Deck Info — Country + Specializations */}
            <div class="flex items-center gap-4 text-xs font-mono">
              {/* Country */}
              {state.deck.countryFlag && (
                <div class="flex items-center gap-1.5">
                  <GameIcon src={toCountryIconPath(state.deck.countryFlag)} size={16} alt="flag" />
                  <span class="text-[var(--text-dim)] uppercase tracking-wider">{state.deck.countryName || ''}</span>
                </div>
              )}
              {/* Spec 1 */}
              {state.deck.spec1UIName && (
                <div class="flex items-center gap-1.5">
                  <span class="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">{t(i18n, 'builder.info.spec1')}:</span>
                  {state.deck.spec1Icon && (
                    <GameIcon src={toSpecializationIconPath(state.deck.spec1Icon)} size={16} alt="spec1" />
                  )}
                  <span class="text-[var(--accent)]">{getGameLocaleValueOrKey(GAME_LOCALES.specs, state.deck.spec1UIName, i18n.locale as Locale)}</span>
                </div>
              )}
              {/* Spec 2 */}
              {state.deck.spec2UIName && (
                <div class="flex items-center gap-1.5">
                  <span class="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">{t(i18n, 'builder.info.spec2')}:</span>
                  {state.deck.spec2Icon && (
                    <GameIcon src={toSpecializationIconPath(state.deck.spec2Icon)} size={16} alt="spec2" />
                  )}
                  <span class="text-[var(--accent)]">{getGameLocaleValueOrKey(GAME_LOCALES.specs, state.deck.spec2UIName, i18n.locale as Locale)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats summary + editor grid ── */}
          {builderLoading.value ? (
            <div class="text-[var(--text-dim)] text-sm font-mono mb-5">
              {t(i18n, 'common.loading')}
            </div>
          ) : builderError.value ? (
            <div class="text-[var(--red)] text-sm mb-5">
              {builderError.value}
            </div>
          ) : builderData.value && (() => {
              const data = builderData.value!;
              const cardMap = new Map(data.arsenalUnitsCards.map(c => [c.unit.Id, c]));
              const stats = computeDeckStats(state.deck!, cardMap);

              // Collect all unit IDs already in the deck (for duplicate prevention)
              const usedUnitIds: number[] = [];
              for (const catKey of EDITOR_CATEGORY_KEYS) {
                const catUnits = (state.deck!.deck.set2[catKey] ?? []) as UnitConfig[];
                for (const u of catUnits) {
                  if (u.unitId) usedUnitIds.push(u.unitId);
                }
              }

              return (
                <>
                  {/* ── Total stats bar ── */}
                  {(() => {
                    const totalAvail = EDITOR_CATEGORY_KEYS.reduce((sum, k) => sum + stats.categoryStats[k].totalAvailability, 0);
                    return (
                      <div class="flex items-center gap-6 mb-5 px-4 py-3 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
                        {/* Points */}
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                            {t(i18n, 'builder.editor.totalPoints')}
                          </span>
                          <span class={`text-base font-bold tabular-nums ${stats.totalPoints > 10000 ? 'text-red-400' : 'text-[var(--accent)]'}`}>
                            {stats.totalPoints}
                          </span>
                          <span class="text-xs text-[var(--text-dim)] tabular-nums">/10,000</span>
                        </div>

                        {/* Divider */}
                        <div class="w-px h-5 bg-[rgba(51,51,51,0.3)]" />

                        {/* Units (total availability) */}
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                            {t(i18n, 'builder.editor.totalUnits')}
                          </span>
                          <span class="text-base font-bold text-[var(--text)] tabular-nums">
                            {totalAvail}
                          </span>
                        </div>

                        {/* Slots */}
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                            {t(i18n, 'builder.editor.totalSlots')}
                          </span>
                          <span class="text-base font-bold text-[var(--text)] tabular-nums">
                            {stats.totalSlots}
                          </span>
                        </div>

                        {/* Divider */}
                        <div class="w-px h-5 bg-[rgba(51,51,51,0.3)]" />

                        {/* Spacer + Advisor toggle (right side) */}
                        <div class="ml-auto relative">
                          <button
                            onClick$={() => { state.showAdvisor = !state.showAdvisor; }}
                            class={`px-3 py-1.5 border text-[10px] font-mono uppercase tracking-wider transition-colors ${
                              state.showAdvisor
                                ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.08)]'
                                : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                            }`}
                          >
                            {t(i18n, 'builder.editor.advisor')}
                          </button>

                          {/* ── Advisor dropdown panel ── */}
                          {state.showAdvisor && (() => {
                            type WarningSev = 'critical' | 'warning' | 'notice';
                            interface DeckWarn { id: string; sev: WarningSev; title: string; desc: string }
                            const warnings: DeckWarn[] = [];

                            // ── 1. Total deck cost check ──
                            if (stats.totalPoints > 10000) {
                              warnings.push({
                                id: 'deck-cost-exceeded',
                                sev: 'critical',
                                title: 'DECK',
                                desc: t(i18n, 'builder.advisor.deckCostExceeded'),
                              });
                            }

                            // ── 2. Per-category budget & slot checks (10% overflow rule) ──
                            for (const catKey of EDITOR_CATEGORY_KEYS) {
                              const cs = stats.categoryStats[catKey];
                              if (!cs) continue;
                              const catDef = DECK_CATEGORIES.find(c => c.set2Key === catKey);
                              const label = catDef?.code ?? catKey;
                              const hardCap = Math.round(cs.maxPoints * 1.1);

                              if (cs.currentPoints > hardCap) {
                                warnings.push({
                                  id: `invalid-${catKey}`,
                                  sev: 'critical',
                                  title: label,
                                  desc: `${cs.currentPoints}/${cs.maxPoints} pts — ${t(i18n, 'builder.advisor.invalidCategory')}`,
                                });
                              } else if (cs.currentPoints > cs.maxPoints) {
                                warnings.push({
                                  id: `overbudget-${catKey}`,
                                  sev: 'warning',
                                  title: label,
                                  desc: `${cs.currentPoints}/${cs.maxPoints} pts — ${t(i18n, 'builder.advisor.overBudget')}`,
                                });
                              }

                              const maxSlotsForCat = state.deck!.deckMaxSlots[catKey] ?? 0;
                              if (cs.currentSlots > maxSlotsForCat) {
                                warnings.push({
                                  id: `overslots-${catKey}`,
                                  sev: 'critical',
                                  title: label,
                                  desc: `${cs.currentSlots}/${maxSlotsForCat} slots — ${t(i18n, 'builder.advisor.overSlots')}`,
                                });
                              }
                            }

                            // ── Helper: count filled units per category ──
                            const catUnitsCount = (key: Set2Key) =>
                              ((state.deck!.deck.set2[key] ?? []) as UnitConfig[]).filter(u => u.unitId).length;

                            // ── Helper: get all filled unit IDs for a category ──
                            const catUnitIds = (key: Set2Key) =>
                              ((state.deck!.deck.set2[key] ?? []) as UnitConfig[])
                                .filter(u => u.unitId)
                                .map(u => u.unitId!);

                            // ── 3. No recon ──
                            if (catUnitsCount('Recon') === 0) {
                              warnings.push({ id: 'no-recon', sev: 'warning', title: 'REC', desc: t(i18n, 'builder.advisor.noRecon') });
                            }

                            // ── 4. Vehicle-only recon (no infantry recon) ──
                            if (catUnitsCount('Recon') > 0) {
                              const reconIds = catUnitIds('Recon');
                              const hasInfantryRecon = reconIds.some(id => {
                                const card = cardMap.get(id);
                                return card && card.unit.Type === UnitType.Infantry;
                              });
                              if (!hasInfantryRecon) {
                                warnings.push({ id: 'vehicle-only-recon', sev: 'notice', title: 'REC', desc: t(i18n, 'builder.advisor.vehicleOnlyRecon') });
                              }
                            }

                            // ── 5. No infantry ──
                            if (catUnitsCount('Infantry') === 0) {
                              warnings.push({ id: 'no-inf', sev: 'warning', title: 'INF', desc: t(i18n, 'builder.advisor.noInfantry') });
                            }

                            // ── 6. Cargo / supply checks ──
                            const totalCargo = EDITOR_CATEGORY_KEYS.reduce((sum, k) => sum + stats.categoryStats[k].totalCargo, 0);
                            const totalSeats = EDITOR_CATEGORY_KEYS.reduce((sum, k) => sum + stats.categoryStats[k].totalSeats, 0);

                            if (totalCargo === 0) {
                              warnings.push({ id: 'no-cargo', sev: 'warning', title: 'LOG', desc: t(i18n, 'builder.advisor.noCargo') });
                            } else {
                              const groundCargoKeys: Set2Key[] = ['Logistic', 'GroundCombatVehicles', 'Support', 'Infantry', 'Recon'];
                              const groundCargo = groundCargoKeys.reduce((sum, k) => sum + stats.categoryStats[k].totalCargo, 0);
                              if (groundCargo === 0) {
                                warnings.push({ id: 'no-ground-cargo', sev: 'notice', title: 'LOG', desc: t(i18n, 'builder.advisor.noGroundCargo') });
                              }
                            }

                            // ── 7. Transport seat coverage ──
                            const infantryDemand = EDITOR_CATEGORY_KEYS.reduce((sum, k) => {
                              const units = (state.deck!.deck.set2[k] ?? []) as UnitConfig[];
                              for (const u of units) {
                                if (!u.unitId) continue;
                                const card = cardMap.get(u.unitId);
                                if (card && card.unit.Type === UnitType.Infantry) {
                                  sum += 1;
                                }
                              }
                              return sum;
                            }, 0);

                            if (infantryDemand > 0 && totalSeats > 0) {
                              const coverage = totalSeats / infantryDemand;
                              if (coverage < 0.2) {
                                warnings.push({ id: 'insufficient-transport', sev: 'warning', title: 'LOG', desc: t(i18n, 'builder.advisor.insufficientTransport') });
                              } else if (coverage < 0.4) {
                                warnings.push({ id: 'low-transport', sev: 'notice', title: 'LOG', desc: t(i18n, 'builder.advisor.lowTransport') });
                              }
                            } else if (infantryDemand > 2 && totalSeats === 0) {
                              warnings.push({ id: 'insufficient-transport', sev: 'warning', title: 'LOG', desc: t(i18n, 'builder.advisor.insufficientTransport') });
                            }

                            // ── 8. Low unit diversity ──
                            const totalFilled = EDITOR_CATEGORY_KEYS.reduce((sum, k) => sum + catUnitsCount(k), 0);
                            if (totalFilled > 0 && totalFilled < 10) {
                              warnings.push({ id: 'low-diversity', sev: 'notice', title: 'COMP', desc: t(i18n, 'builder.advisor.lowDiversity') });
                            }

                            const sevColor: Record<WarningSev, string> = {
                              critical: 'border-red-500/50 bg-red-900/20 text-red-400',
                              warning: 'border-orange-500/50 bg-orange-900/20 text-orange-400',
                              notice: 'border-blue-500/50 bg-blue-900/20 text-blue-400',
                            };

                            const critCount = warnings.filter(w => w.sev === 'critical').length;
                            const warnCount = warnings.filter(w => w.sev === 'warning').length;

                            return (
                              <div class="absolute right-0 top-full mt-1 z-40 w-[360px] max-h-[calc(100vh-12rem)] overflow-y-auto bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] shadow-xl shadow-black/50">
                                {/* Header */}
                                <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
                                  <div class="flex items-center gap-2">
                                    <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[9px]">
                                      {t(i18n, 'builder.advisor.title')}
                                    </p>
                                    {warnings.length > 0 && (
                                      <div class="flex items-center gap-1">
                                        {critCount > 0 && (
                                          <span class="text-[9px] font-mono font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5">{critCount}</span>
                                        )}
                                        {warnCount > 0 && (
                                          <span class="text-[9px] font-mono font-bold text-orange-400 bg-orange-900/30 px-1.5 py-0.5">{warnCount}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <SimpleTooltip text="Close">
                                    <button
                                      onClick$={() => { state.showAdvisor = false; }}
                                      class="text-[var(--text-dim)] hover:text-[var(--text)] text-xs px-1"
                                    >✕</button>
                                  </SimpleTooltip>
                                </div>

                                {/* Body */}
                                <div class="px-3 py-2">
                                  {warnings.length === 0 ? (
                                    <div class="flex items-center gap-2 py-3">
                                      <span class="text-green-400 text-sm">✓</span>
                                      <span class="text-xs font-mono text-[var(--text-dim)]">{t(i18n, 'builder.advisor.balanced')}</span>
                                    </div>
                                  ) : (
                                    <div class="space-y-1.5">
                                      {warnings.sort((a, b) => {
                                        const order: Record<WarningSev, number> = { critical: 0, warning: 1, notice: 2 };
                                        return order[a.sev] - order[b.sev];
                                      }).map((w) => (
                                        <div key={w.id} class={`flex items-start gap-2 px-2 py-1.5 border text-[10px] font-mono ${sevColor[w.sev]}`}>
                                          <span class="uppercase tracking-wider font-bold flex-shrink-0 mt-px">
                                            {w.sev === 'critical' ? '!!' : w.sev === 'warning' ? '!' : 'i'}
                                          </span>
                                          <span class="font-bold flex-shrink-0">{w.title}</span>
                                          <span class="text-[var(--text-dim)] flex-1">{w.desc}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Category grid ── */}
                  <div class="space-y-3">
                    {EDITOR_CATEGORY_KEYS.map((catKey) => {
                      const catDef = DECK_CATEGORIES.find(c => c.set2Key === catKey)!;
                      const units = (state.deck!.deck.set2[catKey] ?? []) as UnitConfig[];
                      const maxSlots = state.deck!.deckMaxSlots[catKey] ?? 0;
                      const catStats = stats.categoryStats[catKey];

                      if (maxSlots === 0) return null;

                      return (
                        <div
                          key={catKey}
                          class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]"
                        >
                          {/* ── Left sidebar: category label + stats ── */}
                          <div class="w-[160px] flex-shrink-0 flex flex-col justify-center gap-1 px-4 py-3 border-r border-[rgba(51,51,51,0.15)]">
                            {/* Row 1: Category Code | Pts */}
                            <div class="flex items-baseline justify-between">
                              <SimpleTooltip text={t(i18n, catDef.i18nKey)}>
                                <span class="font-mono tracking-[0.2em] uppercase text-[var(--text)] text-xs font-semibold leading-tight">
                                  {catDef.code}
                                </span>
                              </SimpleTooltip>
                              <span class="text-[11px] font-mono tabular-nums">
                                <span class={catStats.currentPoints > Math.round(catStats.maxPoints * 1.1) ? 'text-red-400' : catStats.currentPoints > catStats.maxPoints ? 'text-orange-400' : 'text-[var(--accent)]'}>{catStats.currentPoints}</span>
                                <span class="text-[var(--text-dim)]">/{catStats.maxPoints}</span>
                              </span>
                            </div>
                            {/* Row 2: Units | Slots */}
                            <div class="flex items-baseline justify-between">
                              <SimpleTooltip text="Total units (availability)">
                                <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                                  {catStats.totalAvailability} {t(i18n, 'builder.editor.units')}
                                </span>
                              </SimpleTooltip>
                              <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                                {catStats.currentSlots}/{maxSlots} {t(i18n, 'builder.editor.slots').toLowerCase()}
                              </span>
                            </div>
                            {/* Row 3: Cargo | Seats (dynamic) */}
                            {(catStats.totalCargo > 0 || catStats.totalSeats > 0) && (
                              <div class="flex items-baseline justify-between">
                                {catStats.totalCargo > 0 ? (
                                  <SimpleTooltip text="Combined cargo capacity">
                                    <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                                      {Math.round(catStats.totalCargo)} {t(i18n, 'builder.editor.cargo')}
                                    </span>
                                  </SimpleTooltip>
                                ) : <span />}
                                {catStats.totalSeats > 0 ? (
                                  <SimpleTooltip text="Total infantry seats">
                                    <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                                      {catStats.totalSeats} {t(i18n, 'builder.editor.seats')}
                                    </span>
                                  </SimpleTooltip>
                                ) : <span />}
                              </div>
                            )}
                          </div>

                          {/* ── Right: slots grid ── */}
                          <div class="flex-1 grid items-start gap-px bg-[rgba(51,51,51,0.1)]" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                            {units.slice(0, maxSlots).map((unit, idx) => (
                              <DeckSlotCard
                                key={idx}
                                unit={unit}
                                slotIndex={idx}
                                maxSlots={maxSlots}
                                category={catKey}
                                arsenalCard={unit.unitId ? cardMap.get(unit.unitId) : undefined}
                                transportCard={unit.tranId ? cardMap.get(unit.tranId) : undefined}
                                locale={i18n.locale}
                                onSlotClick$={handleSlotClick}
                                onRemoveUnit$={handleRemoveUnit}
                                onSwapSlot$={handleSwapSlots}
                                onChangeCount$={handleChangeCount}
                                onChangeTransportCount$={handleChangeTransportCount}
                              />
                            ))}
                            {/* Ghost placeholders for unused columns up to 7 */}
                            {Array.from({ length: 7 - maxSlots }).map((_, i) => (
                              <div key={`ghost-${i}`} class="bg-[rgba(26,26,26,0.15)]" />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Unit selector modal ── */}
                  {state.showUnitSelector && state.selectedCategory && (
                    <UnitSelectorModal
                      category={state.selectedCategory}
                      arsenalCards={data.arsenalUnitsCards}
                      availabilities={data.availabilities}
                      excludeUnitIds={usedUnitIds}
                      spec1Id={state.deck!.deck.spec1}
                      spec2Id={state.deck!.deck.spec2}
                      locale={i18n.locale}
                      onSelect$={handleUnitSelected}
                      onClose$={$(() => { state.showUnitSelector = false; })}
                    />
                  )}

                  {/* ── Export modal ── */}
                  {state.showExport && state.deck && (
                    <ExportModal
                      deck={state.deck}
                      onClose$={$(() => { state.showExport = false; })}
                    />
                  )}

                  {/* ── Unit editor flyout (modifications + stats) ── */}
                  {state.showUnitEditor && state.selectedCategory && state.selectedSlot !== null && (() => {
                    const unitArr = (state.deck!.deck.set2[state.selectedCategory!] ?? []) as UnitConfig[];
                    const editUnit = unitArr[state.selectedSlot!];
                    if (!editUnit?.unitId) return null;

                    // Resolve available transport cards for this unit
                    const mainCard = cardMap.get(editUnit.unitId);
                    const transportCards: ArsenalCard[] = (mainCard?.availableTransports ?? [])
                      .map(tId => cardMap.get(tId))
                      .filter((c): c is ArsenalCard => c !== undefined);

                    return (
                      <UnitEditorPanel
                        key={`${editUnit.unitId}-${editUnit.tranId ?? 'foot'}-${state.selectedCategory}-${state.selectedSlot}`}
                        unit={editUnit}
                        category={state.selectedCategory!}
                        slotIndex={state.selectedSlot!}
                        arsenalCard={mainCard}
                        transportCard={editUnit.tranId ? cardMap.get(editUnit.tranId) : undefined}
                        availableTransportCards={transportCards}
                        locale={i18n.locale}
                        onModificationChange$={handleModificationChange}
                        onTransportChange$={handleTransportChange}
                        onClose$={$(() => { state.showUnitEditor = false; })}
                      />
                    );
                  })()}


                </>
              );
            })()}
        </>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Edit Deck - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Edit your Broken Arrow deployment deck.',
    },
  ],
};
