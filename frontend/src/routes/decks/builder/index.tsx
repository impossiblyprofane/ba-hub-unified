/**
 * /builder — Deck List page.
 *
 * Lists all locally-saved decks with options to create, duplicate, delete,
 * import, and edit. Uses localStorage via the deck service (client-only).
 */
import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import { toCountryIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';
import type { EditorDeck } from '@ba-hub/shared';
import { DECK_CATEGORIES } from '@ba-hub/shared';
import {
  listDecks, deleteDeck, duplicateDeck, saveDeck,
  setLastUsedDeckId, purgeAllDecks, createDeckFromImport,
} from '~/lib/deck';
import { decodeDeck, compressedToDeck } from '~/lib/deck';
import { BUILDER_WIZARD_QUERY } from '~/lib/queries/builder';
import { OPTIONS_BY_IDS_QUERY } from '~/lib/queries/builder';
import type { BuilderOption, BuilderSpecialization, BuilderCountry } from '~/lib/graphql-types';

export default component$(() => {
  const i18n = useI18n();
  const nav = useNavigate();
  const decks = useSignal<EditorDeck[]>([]);
  const confirmDeleteId = useSignal<string | null>(null);
  const showPurgeConfirm = useSignal(false);
  const showImportModal = useSignal(false);
  const importCode = useSignal('');
  const importError = useSignal('');

  // ── Load decks from localStorage on mount ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    decks.value = listDecks();
  });

  const handleDelete = $((deckId: string) => {
    if (confirmDeleteId.value === deckId) {
      deleteDeck(deckId);
      decks.value = listDecks();
      confirmDeleteId.value = null;
    } else {
      confirmDeleteId.value = deckId;
    }
  });

  const handleDuplicate = $((deck: EditorDeck) => {
    const copy = duplicateDeck(deck);
    saveDeck(copy);
    decks.value = listDecks();
  });

  const handleEdit = $((deckId: string) => {
    setLastUsedDeckId(deckId);
    nav(`/decks/builder/edit/${deckId}`);
  });

  const handlePurge = $(() => {
    if (showPurgeConfirm.value) {
      purgeAllDecks();
      decks.value = [];
      showPurgeConfirm.value = false;
    } else {
      showPurgeConfirm.value = true;
    }
  });

  const importLoading = useSignal(false);

  const handleImport = $(async () => {
    const code = importCode.value.trim();
    if (!code) return;
    importError.value = '';
    importLoading.value = true;

    try {
      // 1. Fully decode the deck code
      const compressed = decodeDeck(code);
      if (!compressed) {
        importError.value = t(i18n, 'builder.import.invalidCode');
        return;
      }

      // 2. Collect all unique option IDs from every unit in the deck
      const optionIds = new Set<number>();
      const allCategories = [
        compressed.set2.Recon, compressed.set2.Infantry,
        compressed.set2.GroundCombatVehicles, compressed.set2.Support,
        compressed.set2.Logistic, compressed.set2.Helicopters,
        compressed.set2.Aircrafts,
      ];
      for (const cat of allCategories) {
        for (const unit of cat) {
          for (const m of unit.modList) optionIds.add(m.optId);
          if (unit.tranModList) {
            for (const m of unit.tranModList) optionIds.add(m.optId);
          }
        }
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

      // 3. Fetch specialization data + option details in parallel
      const [wizardResp, optionsResp] = await Promise.all([
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: BUILDER_WIZARD_QUERY,
            variables: { countryId: compressed.country, spec1Id: compressed.spec1, spec2Id: compressed.spec2 },
          }),
        }),
        optionIds.size > 0
          ? fetch(apiUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                query: OPTIONS_BY_IDS_QUERY,
                variables: { ids: [...optionIds] },
              }),
            })
          : Promise.resolve(null),
      ]);

      if (!wizardResp.ok) throw new Error(`Failed to fetch specializations: ${wizardResp.status}`);
      const wizardPayload = await wizardResp.json() as {
        data?: { builderData: { countries: BuilderCountry[]; specializations: BuilderSpecialization[] } };
      };
      if (!wizardPayload.data) throw new Error('No specialization data returned');

      const { countries, specializations } = wizardPayload.data.builderData;

      // Build option lookup map
      const optionsById = new Map<number, BuilderOption>();
      if (optionsResp) {
        if (!optionsResp.ok) throw new Error(`Failed to fetch options: ${optionsResp.status}`);
        const optPayload = await optionsResp.json() as { data?: { optionsByIds: BuilderOption[] } };
        for (const opt of optPayload.data?.optionsByIds ?? []) {
          optionsById.set(opt.Id, opt);
        }
      }

      // 4. Find the matching specs
      const spec1 = specializations.find(s => s.Id === compressed.spec1);
      const spec2 = specializations.find(s => s.Id === compressed.spec2);
      if (!spec1 || !spec2) {
        importError.value = 'Could not find specializations for this deck code';
        return;
      }

      // 5. Hydrate compressed deck into full Deck
      const country = countries.find(c => c.Id === compressed.country);
      const hydrated = compressedToDeck(compressed, optionsById, 'Imported Deck');

      // 6. Create EditorDeck with correct slot/point limits
      const editorDeck = createDeckFromImport(hydrated, spec1, spec2, {
        countryName: country?.Name,
        countryFlag: country?.FlagFileName,
      });
      saveDeck(editorDeck);
      setLastUsedDeckId(editorDeck.deckId);

      // 7. Navigate directly to the editor
      showImportModal.value = false;
      importCode.value = '';
      importError.value = '';
      decks.value = listDecks();
      await nav(`/decks/builder/edit/${editorDeck.deckId}`);
    } catch (e) {
      importError.value = (e as Error).message || t(i18n, 'builder.import.invalidCode');
    } finally {
      importLoading.value = false;
    }
  });

  return (
    <div class="w-full">
      {/* ── Header ── */}
      <span class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase">
        {t(i18n, 'builder.tag')}
      </span>
      <h1 class="text-3xl font-bold mt-2 mb-1 text-[var(--text)]">
        {t(i18n, 'builder.title')}
      </h1>
      <p class="text-[var(--text-dim)] text-sm mb-6">
        {t(i18n, 'builder.subtitle')}
      </p>

      {/* ── Actions bar ── */}
      <div class="flex flex-wrap gap-3 mb-6">
        <a
          href="/decks/builder/new"
          class="px-4 py-2 bg-[var(--accent)] text-white text-xs font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors"
        >
          {t(i18n, 'builder.deckList.create')}
        </a>
        <button
          onClick$={() => { showImportModal.value = true; }}
          class="px-4 py-2 border border-[var(--border)] text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          {t(i18n, 'builder.deckList.import')}
        </button>
        {decks.value.length > 0 && (
          <button
            onClick$={handlePurge}
            class="ml-auto px-3 py-2 border border-[rgba(231,76,60,0.3)] text-[var(--red)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--red)] transition-colors"
          >
            {showPurgeConfirm.value
              ? t(i18n, 'builder.deckList.purgeConfirm')
              : t(i18n, 'builder.deckList.purge')}
          </button>
        )}
      </div>

      {/* ── Deck grid ── */}
      {decks.value.length === 0 ? (
        <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] p-8 text-center">
          <p class="text-[var(--text-dim)] text-sm">{t(i18n, 'builder.deckList.empty')}</p>
        </div>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {decks.value.map((ed) => {
            // Use stored metadata from EditorDeck; fall back to game locale or generic label
            const countryName = ed.countryName || `Country ${ed.deck.country}`;
            const spec1Name = ed.spec1UIName
              ? getGameLocaleValueOrKey(GAME_LOCALES.specs, ed.spec1UIName, i18n.locale) || `Spec ${ed.deck.spec1}`
              : `Spec ${ed.deck.spec1}`;
            const spec2Name = ed.spec2UIName
              ? getGameLocaleValueOrKey(GAME_LOCALES.specs, ed.spec2UIName, i18n.locale) || `Spec ${ed.deck.spec2}`
              : `Spec ${ed.deck.spec2}`;

            return (
              <div
                key={ed.deckId}
                class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] flex flex-col hover:border-[rgba(51,51,51,0.3)] transition-colors group"
              >
                {/* Card header */}
                <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)] flex items-center gap-2">
                  {ed.countryFlag && (
                    <GameIcon src={toCountryIconPath(ed.countryFlag)} size={16} alt={countryName} />
                  )}
                  <span class="text-[var(--text)] text-sm font-medium truncate flex-1">
                    {ed.deck.name || 'Unnamed Deck'}
                  </span>
                  <span class="text-[var(--text-dim)] text-[10px] font-mono">
                    v{ed.deck.v}
                  </span>
                </div>

                {/* Card body */}
                <div class="px-3 py-3 flex-1 space-y-2">
                  <div class="flex items-center gap-2 text-[11px]">
                    <span class="text-[var(--text-dim)]">{countryName}</span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-[var(--text-dim)] font-mono">
                    {ed.spec1Icon && (
                      <GameIcon src={toSpecializationIconPath(ed.spec1Icon)} size={14} alt="spec1" />
                    )}
                    <span>{spec1Name}</span>
                    <span class="text-[rgba(51,51,51,0.5)]">+</span>
                    {ed.spec2Icon && (
                      <GameIcon src={toSpecializationIconPath(ed.spec2Icon)} size={14} alt="spec2" />
                    )}
                    <span>{spec2Name}</span>
                  </div>

                  {/* Points summary */}
                  <div class="flex gap-1 flex-wrap mt-2">
                    {ed.cachedCategoryPoints ? (
                      DECK_CATEGORIES.map((cat) => {
                        const pts = ed.cachedCategoryPoints?.[cat.set2Key] ?? 0;
                        const maxSlots = ed.deckMaxSlots[cat.set2Key] ?? 0;
                        if (maxSlots === 0) return null;
                        return (
                          <span
                            key={cat.set2Key}
                            class={`text-[9px] font-mono bg-[rgba(26,26,26,0.4)] px-1.5 py-0.5 ${
                              pts > 0 ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                            }`}
                          >
                            {cat.code} {pts}
                          </span>
                        );
                      })
                    ) : (
                      Object.entries(ed.deck.set2).map(([key, units]) => {
                        const filled = (units as any[]).filter((u: any) => u.unitId).length;
                        const max = ed.deckMaxSlots[key as keyof typeof ed.deckMaxSlots] ?? 0;
                        if (max === 0) return null;
                        return (
                          <span
                            key={key}
                            class="text-[9px] font-mono bg-[rgba(26,26,26,0.4)] px-1.5 py-0.5 text-[var(--text-dim)]"
                          >
                            {key.slice(0, 3).toUpperCase()} {filled}/{max}
                          </span>
                        );
                      })
                    )}
                  </div>
                  {/* Total points */}
                  {ed.cachedTotalPoints !== undefined && (
                    <div class="text-[10px] font-mono text-[var(--text-dim)] mt-1">
                      <span class={ed.cachedTotalPoints > 0 ? 'text-[var(--accent)]' : ''}>
                        {ed.cachedTotalPoints.toLocaleString()}
                      </span>
                      <span class="text-[rgba(51,51,51,0.5)]"> / </span>
                      <span>10,000</span>
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div class="px-3 py-2 border-t border-[rgba(51,51,51,0.15)] flex items-center gap-2">
                  <span class="text-[9px] text-[var(--text-dim)] font-mono flex-1">
                    {t(i18n, 'builder.deckList.lastUpdated')}{' '}
                    {new Date(ed.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick$={() => handleEdit(ed.deckId)}
                    class="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] hover:text-[var(--accent-hi)] transition-colors px-2 py-1"
                  >
                    {t(i18n, 'builder.deckList.edit')}
                  </button>
                  <button
                    onClick$={() => handleDuplicate(ed)}
                    class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] transition-colors px-2 py-1"
                  >
                    {t(i18n, 'builder.deckList.duplicate')}
                  </button>
                  <button
                    onClick$={() => handleDelete(ed.deckId)}
                    class={`text-[10px] font-mono uppercase tracking-wider transition-colors px-2 py-1 ${
                      confirmDeleteId.value === ed.deckId
                        ? 'text-[var(--red)]'
                        : 'text-[var(--text-dim)] hover:text-[var(--red)]'
                    }`}
                  >
                    {confirmDeleteId.value === ed.deckId
                      ? t(i18n, 'builder.deckList.deleteConfirm')
                      : t(i18n, 'builder.deckList.delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Import modal ── */}
      {showImportModal.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick$={(e: MouseEvent) => {
            if ((e.target as HTMLElement).classList.contains('fixed')) {
              showImportModal.value = false;
            }
          }}
        >
          <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] w-full max-w-md">
            <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'builder.import.title')}
            </p>
            <div class="p-4 space-y-3">
              <textarea
                class="w-full h-24 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono p-2 placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none resize-none"
                placeholder={t(i18n, 'builder.import.placeholder')}
                value={importCode.value}
                onInput$={(e: InputEvent) => {
                  importCode.value = (e.target as HTMLTextAreaElement).value;
                  importError.value = '';
                }}
              />
              {importError.value && (
                <p class="text-[var(--red)] text-[11px]">{importError.value}</p>
              )}
              <div class="flex gap-2 justify-end">
                <button
                  onClick$={() => { showImportModal.value = false; importCode.value = ''; importError.value = ''; }}
                  class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors"
                >
                  {t(i18n, 'builder.unitEditor.cancel')}
                </button>
                <button
                  onClick$={handleImport}
                  disabled={importLoading.value}
                  class={`px-3 py-1.5 text-white text-[10px] font-mono uppercase tracking-wider transition-colors ${
                    importLoading.value
                      ? 'bg-[var(--text-dim)] cursor-wait'
                      : 'bg-[var(--accent)] hover:bg-[var(--accent-hi)]'
                  }`}
                >
                  {importLoading.value
                    ? t(i18n, 'common.loading')
                    : t(i18n, 'builder.import.button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Deck Builder - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Create, import, and export custom deployment decks for Broken Arrow.',
    },
  ],
};
