/**
 * /builder/new — New Deck Wizard.
 *
 * Wide two-column layout:
 *   Left  — Country selection + single spec grid (select any 2).
 *   Right — Deck config + selected spec details + combined budget + create.
 *
 * Spec cards show illustration hero, icon, localised name, description,
 * and per-category slot/point allocation — inspired by the legacy form
 * but kept streamlined for our tactical-UI aesthetic.
 *
 * Data lives in a single useStore populated by useVisibleTask$ so that
 * both rendering and $() event handlers share the same reactive state.
 */
import { $, component$, useStore, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import {
  toCountryIconPath,
  toSpecializationIconPath,
  toSpecializationCoverPath,
} from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';
import { createDeck, saveDeck, setLastUsedDeckId } from '~/lib/deck';
import { BUILDER_WIZARD_QUERY } from '~/lib/queries/builder';
import type {
  BuilderCountry,
  BuilderSpecialization,
  BuilderPageData,
} from '~/lib/graphql-types';
import { DECK_CATEGORIES } from '@ba-hub/shared';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

interface WizardState {
  countries: BuilderCountry[];
  specializations: BuilderSpecialization[];
  loading: boolean;
  fetchError: string;

  name: string;
  countryId: number;
  /** IDs of the two selected specs, in selection order. */
  selectedSpecIds: number[];
  formError: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Category stats for a single spec (only non-zero rows). */
function specCategoryRows(spec: BuilderSpecialization) {
  return DECK_CATEGORIES
    .map((cat) => {
      const slots = (spec as unknown as Record<string, number>)[cat.slotsField] ?? 0;
      const points = (spec as unknown as Record<string, number>)[cat.pointsField] ?? 0;
      return { code: cat.code, set2Key: cat.set2Key, slots, points };
    })
    .filter((r) => r.slots > 0 || r.points > 0);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default component$(() => {
  const i18n = useI18n();
  const nav = useNavigate();

  const state = useStore<WizardState>({
    countries: [],
    specializations: [],
    loading: true,
    fetchError: '',
    name: '',
    countryId: 0,
    selectedSpecIds: [],
    formError: '',
  });

  /* ── Fetch data ── */
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: BUILDER_WIZARD_QUERY,
          variables: { countryId: 1, spec1Id: 1, spec2Id: 2 },
        }),
      });
      if (!resp.ok) throw new Error(`Failed: ${resp.status}`);
      const payload = (await resp.json()) as {
        data?: { builderData: BuilderPageData };
      };
      if (!payload.data) throw new Error('No data returned');
      state.countries = payload.data.builderData.countries;
      state.specializations = payload.data.builderData.specializations;
    } catch (e) {
      state.fetchError = (e as Error).message;
    } finally {
      state.loading = false;
    }
  });

  /* ── Spec toggle (select / deselect / rotate) ── */
  const toggleSpec = $((specId: number) => {
    const ids = [...state.selectedSpecIds];
    const idx = ids.indexOf(specId);
    if (idx >= 0) {
      // Deselect
      ids.splice(idx, 1);
    } else if (ids.length < 2) {
      ids.push(specId);
    } else {
      // Already 2 selected — replace oldest
      ids.shift();
      ids.push(specId);
    }
    state.selectedSpecIds = ids;
    state.formError = '';
  });

  /* ── Create deck ── */
  const handleCreate = $(async () => {
    const [id1, id2] = state.selectedSpecIds;
    if (!state.countryId || !id1 || !id2) return;

    const spec1 = state.specializations.find((s) => s.Id === id1);
    const spec2 = state.specializations.find((s) => s.Id === id2);
    if (!spec1 || !spec2) {
      state.formError = 'Could not find selected specializations';
      return;
    }

    const country = state.countries.find((c) => c.Id === state.countryId);

    // Auto-generate default name: Country_Spec1_Spec2
    const defaultName = (() => {
      const cName = country?.Name ?? 'Deck';
      const s1 = getGameLocaleValueOrKey(GAME_LOCALES.specs, spec1.UIName, i18n.locale as Locale) || spec1.Name;
      const s2 = getGameLocaleValueOrKey(GAME_LOCALES.specs, spec2.UIName, i18n.locale as Locale) || spec2.Name;
      return `${cName} ${s1} ${s2}`;
    })();

    const deck = createDeck(
      {
        name: state.name || defaultName,
        countryId: state.countryId,
        spec1Id: id1,
        spec2Id: id2,
      },
      spec1,
      spec2,
      { countryName: country?.Name, countryFlag: country?.FlagFileName },
    );
    saveDeck(deck);
    setLastUsedDeckId(deck.deckId);

    await nav(`/decks/builder/edit/${deck.deckId}`);
  });

  /* ── Derived ── */
  const visibleCountries = state.countries.filter((c) => !c.Hidden);
  const countrySpecs = state.specializations.filter(
    (s) => s.CountryId === state.countryId,
  );
  const spec1 =
    state.selectedSpecIds[0]
      ? state.specializations.find((s) => s.Id === state.selectedSpecIds[0])
      : undefined;
  const spec2 =
    state.selectedSpecIds[1]
      ? state.specializations.find((s) => s.Id === state.selectedSpecIds[1])
      : undefined;

  const canCreate = state.countryId > 0 && state.selectedSpecIds.length === 2;

  /* ── Render ── */
  return (
    <div class="max-w-5xl">
      {/* Page header */}
      <span class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase">
        {t(i18n, 'builder.tag')}
      </span>
      <h1 class="text-2xl font-bold mt-2 mb-1 text-[var(--text)]">
        {t(i18n, 'builder.wizard.title')}
      </h1>
      <p class="text-[var(--text-dim)] text-sm mb-6">
        {t(i18n, 'builder.subtitle')}
      </p>

      {state.loading ? (
        <div class="text-[var(--text-dim)] text-sm font-mono">
          {t(i18n, 'common.loading')}
        </div>
      ) : state.fetchError ? (
        <div class="text-[var(--red)] text-sm">
          {t(i18n, 'common.error')}: {state.fetchError}
        </div>
      ) : (
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ════════════════════════════════════════════════════════
              LEFT COLUMN — Country + Spec Grid
             ════════════════════════════════════════════════════════ */}
          <div class="space-y-5">
            {/* ── Country selector ── */}
            <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-4 py-2 border-b border-[rgba(51,51,51,0.3)]">
                {t(i18n, 'builder.wizard.country')}
              </p>
              <div class="p-3 flex flex-wrap gap-2">
                {visibleCountries.map((c) => (
                  <button
                    key={c.Id}
                    onClick$={() => {
                      state.countryId = c.Id;
                      state.selectedSpecIds = [];
                      state.formError = '';
                    }}
                    class={`flex items-center gap-2 px-4 py-2 border text-xs font-mono transition-colors ${
                      state.countryId === c.Id
                        ? 'border-[var(--accent)] bg-[rgba(70,151,195,0.1)] text-[var(--accent)]'
                        : 'border-[rgba(51,51,51,0.15)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.3)]'
                    }`}
                  >
                    <GameIcon
                      src={toCountryIconPath(c.FlagFileName)}
                      size={20}
                      alt={c.Name}
                    />
                    <span>{c.Name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Specialization grid ── */}
            {state.countryId > 0 && (
              <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
                <div class="flex items-center justify-between px-4 py-2 border-b border-[rgba(51,51,51,0.3)]">
                  <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px]">
                    {t(i18n, 'builder.wizard.specs')}
                  </p>
                  <span class="text-[9px] font-mono text-[var(--text-dim)]">
                    {state.selectedSpecIds.length}/2 {t(i18n, 'builder.wizard.selected')}
                  </span>
                </div>

                <div class="p-3 space-y-2">
                  {countrySpecs.map((spec) => {
                    const isSelected = state.selectedSpecIds.includes(spec.Id);
                    const selIdx = state.selectedSpecIds.indexOf(spec.Id);
                    const sName =
                      getGameLocaleValueOrKey(
                        GAME_LOCALES.specs,
                        spec.UIName,
                        i18n.locale,
                      ) || spec.Name;
                    const sDesc = getGameLocaleValueOrKey(
                      GAME_LOCALES.specs,
                      spec.UIDescription,
                      i18n.locale,
                    );
                    const rows = specCategoryRows(spec);

                    return (
                      <button
                        key={spec.Id}
                        onClick$={() => toggleSpec(spec.Id)}
                        class={[
                          'w-full text-left border transition-all duration-200 overflow-hidden group flex',
                          isSelected
                            ? 'border-[var(--accent)] ring-1 ring-[var(--accent)] bg-[rgba(70,151,195,0.04)]'
                            : 'border-[rgba(51,51,51,0.15)] hover:border-[rgba(51,51,51,0.3)]',
                        ].join(' ')}
                      >
                        {/* Cover image thumbnail */}
                        <div class="relative w-36 sm:w-40 flex-shrink-0 overflow-hidden">
                          <img
                            src={toSpecializationCoverPath(spec.Illustration)}
                            alt={sName}
                            width={160}
                            height={120}
                            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError$={(e: Event) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[rgba(26,26,26,0.8)]" />

                          {/* Selection badge */}
                          {isSelected && (
                            <div class="absolute top-2 left-2 w-6 h-6 bg-[var(--accent)] flex items-center justify-center text-[11px] font-mono font-bold text-white">
                              {selIdx + 1}
                            </div>
                          )}
                        </div>

                        {/* Content area */}
                        <div class="flex-1 min-w-0 bg-[rgba(26,26,26,0.4)] px-4 py-3 flex flex-col gap-1.5">
                          {/* Name row */}
                          <div class="flex items-center gap-2.5">
                            <GameIcon
                              src={toSpecializationIconPath(spec.Icon)}
                              size={22}
                              variant="white"
                              alt={sName}
                            />
                            <span class="text-sm font-bold text-[var(--text)] tracking-wide truncate">
                              {sName}
                            </span>
                          </div>

                          {/* Description */}
                          {sDesc && sDesc !== spec.UIDescription && (
                            <p class="text-[11px] text-[var(--text-dim)] font-mono leading-relaxed line-clamp-2">
                              {sDesc}
                            </p>
                          )}

                          {/* Category stats — horizontal strip */}
                          <div class="flex flex-wrap gap-1.5 mt-auto">
                            {rows.map((r) => (
                              <div
                                key={r.set2Key}
                                class="bg-[rgba(26,26,26,0.5)] border border-[rgba(51,51,51,0.1)] px-2 py-0.5 flex items-center gap-1"
                              >
                                <span class="text-[10px] font-mono text-[var(--accent)] uppercase font-semibold">
                                  {r.code}
                                </span>
                                <span class="text-[11px] font-mono font-bold text-[var(--text)]">
                                  {r.points}
                                </span>
                                <span class="text-[10px] font-mono text-[var(--text-dim)]">
                                  /{r.slots}s
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════
              RIGHT COLUMN — Config + Budget + Actions
             ════════════════════════════════════════════════════════ */}
          <div class="space-y-4 sticky top-4 self-start">
            {/* ── Deck name ── */}
            <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
                {t(i18n, 'builder.wizard.name')}
              </p>
              <div class="p-3">
                <input
                  type="text"
                  class="w-full bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-sm font-mono px-3 py-2.5 placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder={t(i18n, 'builder.wizard.namePlaceholder')}
                  value={state.name}
                  onInput$={(e: InputEvent) => {
                    state.name = (e.target as HTMLInputElement).value;
                  }}
                />
              </div>
            </div>

            {/* ── Selected spec details (always shows 2 slots) ── */}
            <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
                {t(i18n, 'builder.wizard.specDetails')}
              </p>

              <div class="p-3 space-y-2">
                {/* Spec 1 */}
                {spec1 ? (
                  <SpecDetailCard spec={spec1} index={1} />
                ) : (
                  <div class="border border-dashed border-[rgba(51,51,51,0.2)] bg-[rgba(26,26,26,0.2)] px-3 py-2.5">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-[var(--accent)] text-[10px] font-mono font-bold w-5 text-center opacity-40">1</span>
                      <div class="w-4 h-4 rounded-sm bg-[rgba(51,51,51,0.15)]" />
                      <div class="h-3 w-24 bg-[rgba(51,51,51,0.1)] rounded-sm" />
                    </div>
                    <div class="pl-7 space-y-1.5">
                      <div class="flex gap-3">
                        <div class="h-2.5 w-16 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                        <div class="h-2.5 w-12 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                        <div class="h-2.5 w-14 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                      </div>
                      <div class="h-2 w-20 bg-[rgba(51,51,51,0.06)] rounded-sm" />
                    </div>
                    <p class="text-center text-[var(--text-dim)] text-[10px] font-mono opacity-30 mt-2">
                      {t(i18n, 'builder.wizard.awaitingSpec1')}
                    </p>
                  </div>
                )}

                {/* Spec 2 */}
                {spec2 ? (
                  <SpecDetailCard spec={spec2} index={2} />
                ) : (
                  <div class="border border-dashed border-[rgba(51,51,51,0.2)] bg-[rgba(26,26,26,0.2)] px-3 py-2.5">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-[var(--accent)] text-[10px] font-mono font-bold w-5 text-center opacity-40">2</span>
                      <div class="w-4 h-4 rounded-sm bg-[rgba(51,51,51,0.15)]" />
                      <div class="h-3 w-24 bg-[rgba(51,51,51,0.1)] rounded-sm" />
                    </div>
                    <div class="pl-7 space-y-1.5">
                      <div class="flex gap-3">
                        <div class="h-2.5 w-16 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                        <div class="h-2.5 w-12 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                        <div class="h-2.5 w-14 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                      </div>
                      <div class="h-2 w-20 bg-[rgba(51,51,51,0.06)] rounded-sm" />
                    </div>
                    <p class="text-center text-[var(--text-dim)] text-[10px] font-mono opacity-30 mt-2">
                      {t(i18n, 'builder.wizard.awaitingSpec2')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Combined budget ── */}
            <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
                {t(i18n, 'builder.wizard.combined')}
              </p>

              {spec1 && spec2 ? (
                <div class="p-3 space-y-3">
                  {/* Category rows — vertical list instead of grid */}
                  <div class="space-y-1">
                    {DECK_CATEGORIES.map((cat) => {
                      const s1 =
                        (spec1 as unknown as Record<string, number>)[
                          cat.slotsField
                        ] ?? 0;
                      const s2 =
                        (spec2 as unknown as Record<string, number>)[
                          cat.slotsField
                        ] ?? 0;
                      const p1 =
                        (spec1 as unknown as Record<string, number>)[
                          cat.pointsField
                        ] ?? 0;
                      const p2 =
                        (spec2 as unknown as Record<string, number>)[
                          cat.pointsField
                        ] ?? 0;
                      const totalSlots = Math.min(s1 + s2, 7);
                      const totalPoints = p1 + p2;
                      if (totalSlots === 0) return null;
                      return (
                        <div
                          key={cat.set2Key}
                          class="flex items-center gap-2 bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.1)] px-3 py-1.5"
                        >
                          <span class="text-[10px] font-mono font-semibold text-[var(--accent)] uppercase w-8">
                            {cat.code}
                          </span>
                          {/* Points bar — visual proportion */}
                          <div class="flex-1 h-1.5 bg-[rgba(51,51,51,0.15)] rounded-full overflow-hidden">
                            <div
                              class="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min((totalPoints / 3000) * 100, 100)}%`,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                          <span class="text-xs font-mono font-bold text-[var(--text)] w-12 text-right">
                            {totalPoints}
                          </span>
                          <span class="text-[10px] font-mono text-[var(--text-dim)] w-6 text-right">
                            {totalSlots}s
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary — totals bar */}
                  <div class="border-t border-[rgba(51,51,51,0.3)] pt-3 flex items-center justify-between">
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-lg font-bold text-[var(--accent)] font-mono">
                        {DECK_CATEGORIES.reduce((sum, cat) => {
                          const p1 =
                            (spec1 as unknown as Record<string, number>)[
                              cat.pointsField
                            ] ?? 0;
                          const p2 =
                            (spec2 as unknown as Record<string, number>)[
                              cat.pointsField
                            ] ?? 0;
                          return sum + p1 + p2;
                        }, 0)}
                      </span>
                      <span class="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                        {t(i18n, 'builder.wizard.totalPoints')}
                      </span>
                    </div>
                    <div class="flex gap-4">
                      <div class="flex items-baseline gap-1">
                        <span class="text-sm font-bold text-[var(--text)] font-mono">
                          {DECK_CATEGORIES.reduce((sum, cat) => {
                            const s1 =
                              (spec1 as unknown as Record<string, number>)[
                                cat.slotsField
                              ] ?? 0;
                            const s2 =
                              (spec2 as unknown as Record<string, number>)[
                                cat.slotsField
                              ] ?? 0;
                            return sum + Math.min(s1 + s2, 7);
                          }, 0)}
                        </span>
                        <span class="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                          {t(i18n, 'builder.wizard.totalSlots')}
                        </span>
                      </div>
                      <div class="flex items-baseline gap-1">
                        <span class="text-sm font-bold text-[var(--text)] font-mono">
                          {DECK_CATEGORIES.filter((cat) => {
                            const s1 =
                              (spec1 as unknown as Record<string, number>)[
                                cat.slotsField
                              ] ?? 0;
                            const s2 =
                              (spec2 as unknown as Record<string, number>)[
                                cat.slotsField
                              ] ?? 0;
                            return Math.min(s1 + s2, 7) > 0;
                          }).length}
                        </span>
                        <span class="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                          {t(i18n, 'builder.wizard.activeCategories')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div class="p-3">
                  {/* Skeleton combined budget */}
                  <div class="space-y-1.5 mb-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} class="flex items-center gap-2 px-3 py-1.5">
                        <div class="h-2.5 w-8 bg-[rgba(51,51,51,0.1)] rounded-sm" />
                        <div class="flex-1 h-1.5 bg-[rgba(51,51,51,0.06)] rounded-full" />
                        <div class="h-2.5 w-10 bg-[rgba(51,51,51,0.08)] rounded-sm" />
                      </div>
                    ))}
                  </div>
                  <div class="border-t border-[rgba(51,51,51,0.15)] pt-2">
                    <p class="text-center text-[var(--text-dim)] text-[10px] font-mono opacity-30">
                      {t(i18n, 'builder.wizard.awaitingBoth')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Error ── */}
            {state.formError && (
              <p class="text-[var(--red)] text-[11px] font-mono">
                {state.formError}
              </p>
            )}

            {/* ── Actions ── */}
            <div class="flex gap-3">
              <a
                href="/decks/builder"
                class="flex-1 text-center px-4 py-2.5 border border-[var(--border)] text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors"
              >
                {t(i18n, 'builder.wizard.cancel')}
              </a>
              <button
                onClick$={handleCreate}
                disabled={!canCreate}
                class="flex-1 px-4 py-2.5 bg-[var(--accent)] text-white text-xs font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t(i18n, 'builder.wizard.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Spec Detail Card (right sidebar)                                   */
/* ------------------------------------------------------------------ */

interface SpecDetailCardProps {
  spec: BuilderSpecialization;
  index: number;
}

/**
 * Compact card showing a selected spec's icon, name, and key stats.
 * Used in the right-sidebar "Deck Budget" panel.
 */
const SpecDetailCard = component$<SpecDetailCardProps>(({ spec, index }) => {
  const i18n = useI18n();
  const sName =
    getGameLocaleValueOrKey(GAME_LOCALES.specs, spec.UIName, i18n.locale) ||
    spec.Name;
  const rows = specCategoryRows(spec);

  return (
    <div class="bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)] px-3 py-2.5">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-[var(--accent)] text-[10px] font-mono font-bold w-5 text-center">
          {index}
        </span>
        <GameIcon
          src={toSpecializationIconPath(spec.Icon)}
          size={18}
          variant="white"
          alt={sName}
        />
        <span class="text-[var(--text)] text-xs font-mono font-medium truncate">
          {sName}
        </span>
      </div>
      <div class="space-y-0.5 pl-7">
        {rows.map((r) => (
          <div key={r.set2Key} class="flex items-center gap-2 text-[10px] font-mono">
            <span class="text-[var(--accent)] uppercase font-semibold w-7">{r.code}</span>
            <span class="text-[var(--text)]">{r.slots}s</span>
            <span class="text-[var(--text-dim)]">·</span>
            <span class="text-[var(--text)]">{r.points}pt</span>
          </div>
        ))}
      </div>
      <div class="mt-1.5 text-[10px] font-mono text-[var(--text-dim)] border-t border-[rgba(51,51,51,0.15)] pt-1.5 pl-7">
        {t(i18n, 'builder.wizard.totalSlots')}:{' '}
        <span class="text-[var(--text)] font-semibold">{spec.MaxSlots}</span>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Head                                                               */
/* ------------------------------------------------------------------ */

export const head: DocumentHead = {
  title: 'New Deck - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Create a new deployment deck for Broken Arrow.',
    },
  ],
};
