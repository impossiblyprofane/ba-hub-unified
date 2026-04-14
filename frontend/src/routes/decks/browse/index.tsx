import { $, component$, useSignal, useStore, useVisibleTask$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import { DECK_TAG_GROUPS, DECK_TAG_I18N } from '@ba-hub/shared';
import type { DeckTag, BrowseDeckSort } from '@ba-hub/shared';
import { BROWSE_DECKS_QUERY } from '~/lib/queries/decks';
import { BUILDER_WIZARD_QUERY } from '~/lib/queries/builder';
import { graphqlFetchRaw } from '~/lib/graphqlClient';
import type {
  PublishedDeckSummary, BuilderCountry, ArsenalSpecialization,
} from '~/lib/graphql-types';
import { PublishedDeckCard } from '~/components/decks/PublishedDeckCard';


interface BrowseState {
  // Filter state
  countryId: number | null;
  specId: number | null;
  tags: DeckTag[];
  search: string;
  sort: BrowseDeckSort;
  page: number;
  // Data
  decks: PublishedDeckSummary[];
  total: number;
  totalPages: number;
  loading: boolean;
  // Reference data
  countries: BuilderCountry[];
  specializations: ArsenalSpecialization[];
  refDataLoaded: boolean;
}

export default component$(() => {
  const i18n = useI18n();

  const state = useStore<BrowseState>({
    countryId: null,
    specId: null,
    tags: [],
    search: '',
    sort: 'recent',
    page: 1,
    decks: [],
    total: 0,
    totalPages: 0,
    loading: true,
    countries: [],
    specializations: [],
    refDataLoaded: false,
  });

  const searchDebounce = useSignal<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch helper ──────────────────────────────────────────────
  const fetchDecks = $(async () => {
    state.loading = true;
    try {
      const filter: Record<string, unknown> = {
        sort: state.sort,
        page: state.page,
        pageSize: 20,
      };
      if (state.countryId) filter.countryId = state.countryId;
      if (state.specId) filter.spec1Id = state.specId;
      if (state.tags.length) filter.tags = state.tags;
      if (state.search.trim()) filter.search = state.search.trim();

      const result = await graphqlFetchRaw<{
        browseDecks: { decks: PublishedDeckSummary[]; total: number; totalPages: number };
      }>(BROWSE_DECKS_QUERY, { filter });
      if (result.data) {
        state.decks = result.data.browseDecks.decks;
        state.total = result.data.browseDecks.total;
        state.totalPages = result.data.browseDecks.totalPages;
      }
    } catch {
      // Silently fail — UI shows empty state
    } finally {
      state.loading = false;
    }
  });

  // ── Load reference data (countries + specs) + initial decks ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      // Fetch reference data (countries + specializations) for filters
      const refResult = await graphqlFetchRaw<{
        builderData: { countries: BuilderCountry[]; specializations: ArsenalSpecialization[] };
      }>(BUILDER_WIZARD_QUERY, { countryId: 0, spec1Id: 0, spec2Id: 0 });
      if (refResult.data) {
        state.countries = refResult.data.builderData.countries.filter((c) => !c.Hidden);
        state.specializations = refResult.data.builderData.specializations;
        state.refDataLoaded = true;
      }
    } catch {
      // Continue without filter reference data
    }

    // Initial deck fetch
    await fetchDecks();
  });

  // ── Filter change handlers ────────────────────────────────────
  const onCountryChange = $((countryId: number | null) => {
    state.countryId = countryId;
    state.specId = null; // Reset spec when country changes
    state.page = 1;
    fetchDecks();
  });

  const onSpecChange = $((specId: number | null) => {
    state.specId = specId;
    state.page = 1;
    fetchDecks();
  });

  const onTagToggle = $((tag: DeckTag) => {
    if (state.tags.includes(tag)) {
      state.tags = state.tags.filter((t) => t !== tag);
    } else {
      state.tags = [...state.tags, tag];
    }
    state.page = 1;
    fetchDecks();
  });

  const onSortChange = $((sort: BrowseDeckSort) => {
    state.sort = sort;
    state.page = 1;
    fetchDecks();
  });

  const onSearchInput = $((value: string) => {
    state.search = value;
    if (searchDebounce.value) clearTimeout(searchDebounce.value);
    searchDebounce.value = setTimeout(() => {
      state.page = 1;
      fetchDecks();
    }, 400);
  });

  const onPageChange = $((newPage: number) => {
    state.page = newPage;
    fetchDecks();
  });

  // Filtered specs based on selected country
  const filteredSpecs = state.countryId
    ? state.specializations.filter((s) => s.CountryId === state.countryId)
    : state.specializations;

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Breadcrumb + header */}
      <div class="mb-6">
        <a
          href="/decks"
          class="text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
        >
          ← {t(i18n, 'decks.hub.title')}
        </a>
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3 mt-3">
          {t(i18n, 'decks.browse.tag')}
        </p>
        <h1 class="text-3xl font-semibold text-[var(--text)] tracking-tight">
          {t(i18n, 'decks.browse.title')}
        </h1>
        <p class="text-sm text-[var(--text-dim)] mt-2 max-w-2xl">
          {t(i18n, 'decks.browse.subtitle')}
        </p>
      </div>

      {/* Filters panel */}
      <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] mb-4">
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
          filters
        </p>
        <div class="p-3 space-y-3">
          {/* Row 1: Country + Spec + Sort */}
          <div class="flex flex-wrap gap-3">
            {/* Country filter */}
            <select
              class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none"
              value={state.countryId ?? ''}
              onChange$={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                onCountryChange(val ? parseInt(val, 10) : null);
              }}
            >
              <option value="">{t(i18n, 'decks.browse.allCountries')}</option>
              {state.countries.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {getGameLocaleValueOrKey(GAME_LOCALES.specs, c.Name, i18n.locale as Locale)}
                </option>
              ))}
            </select>

            {/* Spec filter */}
            <select
              class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none"
              value={state.specId ?? ''}
              onChange$={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                onSpecChange(val ? parseInt(val, 10) : null);
              }}
            >
              <option value="">{t(i18n, 'decks.browse.allSpecs')}</option>
              {filteredSpecs.map((s) => (
                <option key={s.Id} value={s.Id}>
                  {getGameLocaleValueOrKey(GAME_LOCALES.specs, s.UIName, i18n.locale as Locale)}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none"
              value={state.sort}
              onChange$={(e) => {
                onSortChange((e.target as HTMLSelectElement).value as BrowseDeckSort);
              }}
            >
              <option value="recent">{t(i18n, 'decks.browse.sortRecent')}</option>
              <option value="popular">{t(i18n, 'decks.browse.sortPopular')}</option>
              <option value="mostLiked">{t(i18n, 'decks.browse.sortMostLiked')}</option>
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder={t(i18n, 'decks.browse.filterSearch')}
              value={state.search}
              onInput$={(e) => {
                onSearchInput((e.target as HTMLInputElement).value);
              }}
              class="bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none flex-1 min-w-[200px]"
            />
          </div>

          {/* Row 2: Tags (grouped) */}
          <div class="space-y-2">
            {DECK_TAG_GROUPS.map((group) => (
              <div key={group.group} class="flex flex-wrap items-center gap-1.5">
                <span class="text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] opacity-50 w-[80px] shrink-0">
                  {t(i18n, group.i18nKey)}
                </span>
                {group.tags.map((tag) => {
                  const active = state.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick$={() => onTagToggle(tag)}
                      class={`px-2 py-1 text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                        active
                          ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                          : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]'
                      }`}
                    >
                      {t(i18n, DECK_TAG_I18N[tag])}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Result count */}
      {!state.loading && (
        <p class="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-3">
          {t(i18n, 'decks.browse.resultCount').replace('{count}', String(state.total))}
        </p>
      )}

      {/* Deck grid */}
      {state.loading ? (
        <div class="py-12 text-center">
          <p class="text-sm text-[var(--text-dim)] font-mono">{t(i18n, 'common.loading')}</p>
        </div>
      ) : state.decks.length === 0 ? (
        <div class="py-12 text-center">
          <p class="text-sm text-[var(--text-dim)] font-mono">{t(i18n, 'decks.browse.emptyState')}</p>
        </div>
      ) : (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {state.decks.map((deck) => (
            <PublishedDeckCard
              key={deck.id}
              deck={deck}
              countries={state.countries}
              specializations={state.specializations}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {state.totalPages > 1 && (
        <div class="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={state.page <= 1}
            onClick$={() => onPageChange(state.page - 1)}
            class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t(i18n, 'decks.browse.pagination.prev')}
          </button>
          <span class="text-[10px] font-mono text-[var(--text-dim)]">
            {t(i18n, 'decks.browse.pagination.page')
              .replace('{page}', String(state.page))
              .replace('{total}', String(state.totalPages))}
          </span>
          <button
            disabled={state.page >= state.totalPages}
            onClick$={() => onPageChange(state.page + 1)}
            class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t(i18n, 'decks.browse.pagination.next')}
          </button>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: 'BA HUB - Browse Decks',
  meta: [
    {
      name: 'description',
      content: 'Browse community-created decks and popular strategies.',
    },
  ],
};
