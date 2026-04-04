/**
 * /builder — Deck List page.
 *
 * Lists published decks (from server) and locally-saved decks (localStorage)
 * in two sections, with options to create, duplicate, delete, import, edit,
 * and manage published decks.
 */
import { $, component$, useContext, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import { toCountryIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';
import type { EditorDeck, PublishedDeckSummary, DeckTag } from '@ba-hub/shared';
import { DECK_CATEGORIES, DECK_TAG_I18N } from '@ba-hub/shared';
import {
  listDecks, deleteDeck, duplicateDeck, saveDeck,
  setLastUsedDeckId, purgeAllDecks, createDeckFromImport,
} from '~/lib/deck';
import { decodeDeck, compressedToDeck, decryptDekFile } from '~/lib/deck';
import { BUILDER_WIZARD_QUERY } from '~/lib/queries/builder';
import { OPTIONS_BY_IDS_QUERY } from '~/lib/queries/builder';
import {
  PUBLISHED_DECKS_BY_AUTHOR_QUERY,
  DELETE_PUBLISHED_DECK_MUTATION,
  UPDATE_PUBLISHED_DECK_MUTATION,
  CHALLENGE_QUERY,
} from '~/lib/queries/decks';
import { getUserId, ensureUserId } from '~/lib/userIdentity';
import { ToastContext, showToast } from '~/components/ui/Toast';
import type { BuilderOption, BuilderSpecialization, BuilderCountry } from '~/lib/graphql-types';

export default component$(() => {
  const i18n = useI18n();
  const nav = useNavigate();
  const toast = useContext(ToastContext);
  const decks = useSignal<EditorDeck[]>([]);
  const confirmDeleteId = useSignal<string | null>(null);
  const showPurgeConfirm = useSignal(false);
  const showImportModal = useSignal(false);
  const importCode = useSignal('');
  /** File data stored as serializable values (Qwik can't serialize File instances). */
  const importFileName = useSignal('');
  const importFileData = useSignal<number[] | null>(null);
  const importFileDragging = useSignal(false);
  const importError = useSignal('');

  // ── Published decks state ──
  const publishedDecks = useSignal<PublishedDeckSummary[]>([]);
  const publishedLoading = useSignal(false);
  const confirmDeletePublishedId = useSignal<string | null>(null);
  /** Inline-editing state for a published deck's metadata. */
  const editingPublishedId = useSignal<string | null>(null);
  const editName = useSignal('');
  const editDescription = useSignal('');
  const editTags = useSignal<DeckTag[]>([]);
  const editPublisherName = useSignal('');
  const editSaving = useSignal(false);
  /** Challenge for delete / update of published decks. */
  const challengeId = useSignal('');
  const challengeQuestion = useSignal('');
  const challengeAnswer = useSignal('');

  /** Fetch published decks for the current user from the server. */
  const fetchPublishedDecks = $(async () => {
    const userId = getUserId();
    if (!userId) return;
    publishedLoading.value = true;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: PUBLISHED_DECKS_BY_AUTHOR_QUERY,
          variables: { authorId: userId },
        }),
      });
      if (!resp.ok) return;
      const payload = await resp.json() as {
        data?: { publishedDecksByAuthor: PublishedDeckSummary[] };
      };
      publishedDecks.value = payload.data?.publishedDecksByAuthor ?? [];
    } catch {
      // Silently fail — published section just stays empty
    } finally {
      publishedLoading.value = false;
    }
  });

  /** Fetch a challenge question (needed for delete/update). */
  const fetchChallenge = $(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: CHALLENGE_QUERY }),
      });
      if (!resp.ok) return;
      const payload = await resp.json() as {
        data?: { challenge: { challengeId: string; question: string } };
      };
      if (payload.data) {
        challengeId.value = payload.data.challenge.challengeId;
        challengeQuestion.value = payload.data.challenge.question;
        challengeAnswer.value = '';
      }
    } catch { /* ignore */ }
  });

  // ── Load decks from localStorage + fetch published on mount ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    decks.value = listDecks();
    await fetchPublishedDecks();
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

  /** Delete a published deck (server-side). */
  const handleDeletePublished = $(async (deckId: string) => {
    if (confirmDeletePublishedId.value !== deckId) {
      confirmDeletePublishedId.value = deckId;
      await fetchChallenge();
      return;
    }
    if (!challengeAnswer.value.trim()) return;

    try {
      const { userId } = await ensureUserId();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: DELETE_PUBLISHED_DECK_MUTATION,
          variables: {
            deckId,
            input: {
              authorId: userId,
              challengeId: challengeId.value,
              challengeAnswer: parseInt(challengeAnswer.value, 10),
            },
          },
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const payload = await resp.json() as { errors?: Array<{ message: string }> };
      if (payload.errors?.length) throw new Error(payload.errors[0].message);

      showToast(toast, t(i18n, 'decks.publish.deleteSuccess'), 'success');

      // Remove from published list
      publishedDecks.value = publishedDecks.value.filter(d => d.id !== deckId);
      // Also clear the publishedDeckId on any local deck that was linked
      for (const ed of decks.value) {
        if (ed.publishedDeckId === deckId) {
          ed.publishedDeckId = undefined;
          saveDeck(ed);
        }
      }
      decks.value = listDecks();
      confirmDeletePublishedId.value = null;
      challengeAnswer.value = '';
    } catch (err) {
      showToast(toast, (err instanceof Error ? err.message : 'Delete failed'), 'error');
    }
  });

  /** Start inline editing of a published deck's metadata. */
  const startEditPublished = $((pd: PublishedDeckSummary) => {
    editingPublishedId.value = pd.id;
    editName.value = pd.name;
    editDescription.value = pd.description;
    editTags.value = [...pd.tags] as DeckTag[];
    editPublisherName.value = pd.publisherName || '';
    fetchChallenge();
  });

  /** Save inline edits to a published deck. */
  const saveEditPublished = $(async () => {
    const deckId = editingPublishedId.value;
    if (!deckId || !challengeAnswer.value.trim()) return;

    editSaving.value = true;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: UPDATE_PUBLISHED_DECK_MUTATION,
          variables: {
            deckId,
            input: {
              publisherName: editPublisherName.value.trim(),
              name: editName.value.trim(),
              description: editDescription.value.trim(),
              tags: editTags.value,
              challengeId: challengeId.value,
              challengeAnswer: parseInt(challengeAnswer.value, 10),
            },
          },
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const payload = await resp.json() as {
        data?: { updatePublishedDeck: PublishedDeckSummary };
        errors?: Array<{ message: string }>;
      };
      if (payload.errors?.length) throw new Error(payload.errors[0].message);

      showToast(toast, t(i18n, 'decks.publish.updateSuccess'), 'success');

      // Refresh the published list
      if (payload.data) {
        publishedDecks.value = publishedDecks.value.map(d =>
          d.id === deckId ? { ...d, ...payload.data!.updatePublishedDeck } : d
        );
      }
      editingPublishedId.value = null;
      challengeAnswer.value = '';
    } catch (err) {
      showToast(toast, (err instanceof Error ? err.message : 'Update failed'), 'error');
    } finally {
      editSaving.value = false;
    }
  });

  const importLoading = useSignal(false);

  /** Shared helper: fetch wizard data, create EditorDeck, save & navigate. */
  const finalizeImport = $(async (
    deck: import('@ba-hub/shared').Deck,
  ) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

    const wizardResp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: BUILDER_WIZARD_QUERY,
        variables: { countryId: deck.country, spec1Id: deck.spec1, spec2Id: deck.spec2 },
      }),
    });
    if (!wizardResp.ok) throw new Error(`Failed to fetch specializations: ${wizardResp.status}`);
    const wizardPayload = await wizardResp.json() as {
      data?: { builderData: { countries: BuilderCountry[]; specializations: BuilderSpecialization[] } };
    };
    if (!wizardPayload.data) throw new Error('No specialization data returned');

    const { countries, specializations } = wizardPayload.data.builderData;
    const spec1 = specializations.find(s => s.Id === deck.spec1);
    const spec2 = specializations.find(s => s.Id === deck.spec2);
    if (!spec1 || !spec2) throw new Error('Could not find specializations for this deck');

    const country = countries.find(c => c.Id === deck.country);
    const editorDeck = createDeckFromImport(deck, spec1, spec2, {
      countryName: country?.Name,
      countryFlag: country?.FlagFileName,
    });
    saveDeck(editorDeck);
    setLastUsedDeckId(editorDeck.deckId);

    showImportModal.value = false;
    importCode.value = '';
    importFileName.value = '';
    importFileData.value = null;
    importError.value = '';
    decks.value = listDecks();
    await nav(`/decks/builder/edit/${editorDeck.deckId}`);
  });

  /** Import from deck code string. */
  const handleImportCode = $(async () => {
    const code = importCode.value.trim();
    if (!code) return;
    importError.value = '';
    importLoading.value = true;

    try {
      const compressed = decodeDeck(code);
      if (!compressed) {
        importError.value = t(i18n, 'builder.import.invalidCode');
        return;
      }

      // Collect option IDs for hydration
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
      let optionsById = new Map<number, BuilderOption>();
      if (optionIds.size > 0) {
        const optResp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: OPTIONS_BY_IDS_QUERY,
            variables: { ids: [...optionIds] },
          }),
        });
        if (optResp.ok) {
          const optPayload = await optResp.json() as { data?: { optionsByIds: BuilderOption[] } };
          for (const opt of optPayload.data?.optionsByIds ?? []) {
            optionsById.set(opt.Id, opt);
          }
        }
      }

      const hydrated = compressedToDeck(compressed, optionsById, 'Imported Deck');
      await finalizeImport(hydrated);
    } catch (e) {
      importError.value = (e as Error).message || t(i18n, 'builder.import.invalidCode');
    } finally {
      importLoading.value = false;
    }
  });

  /** Read a File into our serializable signals. */
  const loadFileIntoSignals = $(async (file: File) => {
    const buffer = await file.arrayBuffer();
    importFileName.value = file.name;
    importFileData.value = Array.from(new Uint8Array(buffer));
    importError.value = '';
  });

  /** Import from .dek game file (uses pre-read buffer). */
  const handleImportFile = $(async () => {
    const data = importFileData.value;
    if (!data) return;
    importError.value = '';
    importLoading.value = true;

    try {
      const buffer = new Uint8Array(data).buffer;
      const deck = await decryptDekFile(buffer);
      await finalizeImport(deck);
    } catch (e) {
      importError.value = (e as Error).message || t(i18n, 'builder.import.invalidFile');
    } finally {
      importLoading.value = false;
    }
  });

  /** Unified import — auto-detects file vs code. */
  const handleImport = $(async () => {
    if (importFileData.value) {
      await handleImportFile();
    } else {
      await handleImportCode();
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

      {/* ══════════════════════════════════════════════════════
          PUBLISHED DECKS SECTION
         ══════════════════════════════════════════════════════ */}
      {getUserId() && (
        <div class="mb-8">
          <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] mb-3">
            {t(i18n, 'builder.deckList.publishedSection')}
          </p>

          {publishedLoading.value ? (
            <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] p-6 text-center">
              <p class="text-[var(--text-dim)] text-xs font-mono">
                {t(i18n, 'builder.deckList.publishedLoading')}
              </p>
            </div>
          ) : publishedDecks.value.length === 0 ? (
            <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] p-6 text-center">
              <p class="text-[var(--text-dim)] text-xs font-mono">
                {t(i18n, 'builder.deckList.noPublished')}
              </p>
            </div>
          ) : (
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {publishedDecks.value.map((pd) => {
                const isEditing = editingPublishedId.value === pd.id;
                const isConfirmingDelete = confirmDeletePublishedId.value === pd.id;

                return (
                  <div
                    key={pd.id}
                    class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] flex flex-col hover:border-[rgba(51,51,51,0.3)] transition-colors"
                  >
                    {/* Card header */}
                    <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)] flex items-center gap-2">
                      <span class="text-[var(--accent)] text-[9px] font-mono uppercase tracking-wider">●</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName.value}
                          onInput$={(e: InputEvent) => { editName.value = (e.target as HTMLInputElement).value; }}
                          class="flex-1 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-sm font-medium px-1.5 py-0.5 focus:border-[var(--accent)] focus:outline-none"
                          maxLength={80}
                        />
                      ) : (
                        <span class="text-[var(--text)] text-sm font-medium truncate flex-1">
                          {pd.name}
                        </span>
                      )}
                    </div>

                    {/* Card body */}
                    <div class="px-3 py-3 flex-1 space-y-2">
                      {/* Publisher name */}
                      {isEditing ? (
                        <input
                          type="text"
                          value={editPublisherName.value}
                          onInput$={(e: InputEvent) => { editPublisherName.value = (e.target as HTMLInputElement).value; }}
                          placeholder={t(i18n, 'decks.publish.publisherPlaceholder')}
                          class="w-full bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono px-1.5 py-0.5 focus:border-[var(--accent)] focus:outline-none"
                          maxLength={50}
                        />
                      ) : pd.publisherName ? (
                        <div class="text-[10px] text-[var(--text-dim)] font-mono">
                          {t(i18n, 'decks.detail.by')} {pd.publisherName}
                        </div>
                      ) : null}

                      {/* Description */}
                      {isEditing ? (
                        <textarea
                          value={editDescription.value}
                          onInput$={(e: InputEvent) => { editDescription.value = (e.target as HTMLTextAreaElement).value; }}
                          placeholder={t(i18n, 'decks.publish.descPlaceholder')}
                          class="w-full h-16 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-[10px] font-mono px-1.5 py-1 focus:border-[var(--accent)] focus:outline-none resize-none"
                          maxLength={500}
                        />
                      ) : pd.description ? (
                        <p class="text-[10px] text-[var(--text-dim)] line-clamp-2">{pd.description}</p>
                      ) : null}

                      {/* Tags */}
                      {!isEditing && pd.tags.length > 0 && (
                        <div class="flex gap-1 flex-wrap">
                          {pd.tags.map((tag) => (
                            <span
                              key={tag}
                              class="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)]"
                            >
                              {t(i18n, DECK_TAG_I18N[tag as DeckTag])}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Stats: views + likes */}
                      <div class="flex items-center gap-3 text-[9px] font-mono text-[var(--text-dim)]">
                        <span>{t(i18n, 'builder.deckList.views').replace('{count}', String(pd.viewCount))}</span>
                        <span>{t(i18n, 'builder.deckList.likes').replace('{count}', String(pd.likeCount))}</span>
                      </div>

                      {/* Dates */}
                      <div class="text-[9px] font-mono text-[var(--text-dim)] space-y-0.5">
                        <div>
                          {t(i18n, 'builder.deckList.publishedDate')}{' '}
                          {new Date(pd.createdAt).toLocaleDateString()}
                        </div>
                        {pd.updatedAt !== pd.createdAt && (
                          <div>
                            {t(i18n, 'builder.deckList.updatedDate')}{' '}
                            {new Date(pd.updatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Inline edit: challenge + save */}
                      {isEditing && (
                        <div class="space-y-2 pt-1 border-t border-[rgba(51,51,51,0.15)]">
                          {challengeQuestion.value && (
                            <div class="flex items-center gap-2">
                              <span class="text-[10px] text-[var(--text)] font-mono">{challengeQuestion.value}</span>
                              <input
                                type="text"
                                value={challengeAnswer.value}
                                onInput$={(e: InputEvent) => { challengeAnswer.value = (e.target as HTMLInputElement).value; }}
                                class="w-16 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-1.5 py-0.5 focus:border-[var(--accent)] focus:outline-none"
                                maxLength={10}
                              />
                            </div>
                          )}
                          <div class="flex gap-1.5">
                            <button
                              onClick$={saveEditPublished}
                              disabled={editSaving.value || !challengeAnswer.value.trim()}
                              class="px-2 py-1 bg-[var(--accent)] text-white text-[9px] font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors disabled:opacity-50"
                            >
                              {editSaving.value ? t(i18n, 'decks.publish.updating') : t(i18n, 'decks.publish.update')}
                            </button>
                            <button
                              onClick$={() => { editingPublishedId.value = null; challengeAnswer.value = ''; }}
                              class="px-2 py-1 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[9px] font-mono uppercase tracking-wider hover:text-[var(--text)] transition-colors"
                            >
                              {t(i18n, 'decks.publish.cancel')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline delete: challenge + confirm */}
                      {isConfirmingDelete && !isEditing && (
                        <div class="space-y-2 pt-1 border-t border-[rgba(51,51,51,0.15)]">
                          <p class="text-[10px] font-mono text-[var(--red)]">
                            {t(i18n, 'builder.deckList.deletePublishedConfirm')}
                          </p>
                          {challengeQuestion.value && (
                            <div class="flex items-center gap-2">
                              <span class="text-[10px] text-[var(--text)] font-mono">{challengeQuestion.value}</span>
                              <input
                                type="text"
                                value={challengeAnswer.value}
                                onInput$={(e: InputEvent) => { challengeAnswer.value = (e.target as HTMLInputElement).value; }}
                                class="w-16 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-1.5 py-0.5 focus:border-[var(--accent)] focus:outline-none"
                                maxLength={10}
                              />
                            </div>
                          )}
                          <div class="flex gap-1.5">
                            <button
                              onClick$={() => handleDeletePublished(pd.id)}
                              disabled={!challengeAnswer.value.trim()}
                              class="px-2 py-1 border border-red-500 text-red-400 text-[9px] font-mono uppercase tracking-wider hover:bg-[rgba(239,68,68,0.1)] transition-colors disabled:opacity-50"
                            >
                              {t(i18n, 'builder.deckList.delete')}
                            </button>
                            <button
                              onClick$={() => { confirmDeletePublishedId.value = null; challengeAnswer.value = ''; }}
                              class="px-2 py-1 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[9px] font-mono uppercase tracking-wider hover:text-[var(--text)] transition-colors"
                            >
                              {t(i18n, 'decks.publish.cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    <div class="px-3 py-2 border-t border-[rgba(51,51,51,0.15)] flex items-center gap-2">
                      <a
                        href={`/decks/browse/${pd.id}`}
                        class="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] hover:text-[var(--accent-hi)] transition-colors px-2 py-1"
                      >
                        {t(i18n, 'builder.deckList.viewOnBrowse')}
                      </a>
                      {!isEditing && !isConfirmingDelete && (
                        <>
                          <button
                            onClick$={() => startEditPublished(pd)}
                            class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] transition-colors px-2 py-1"
                          >
                            {t(i18n, 'builder.deckList.manage')}
                          </button>
                          <button
                            onClick$={() => handleDeletePublished(pd.id)}
                            class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--red)] transition-colors px-2 py-1"
                          >
                            {t(i18n, 'builder.deckList.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          LOCAL DECKS SECTION
         ══════════════════════════════════════════════════════ */}
      <div class="mb-8">
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] mb-3">
          {t(i18n, 'builder.deckList.localSection')}
        </p>

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
                    {ed.publishedDeckId && (
                      <span class="text-[var(--accent)] text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 border border-[rgba(70,151,195,0.3)]">
                        {t(i18n, 'builder.deckList.linked')}
                      </span>
                    )}
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
      </div>

      {/* ── Import modal ── */}
      {showImportModal.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          preventdefault:dragover
          preventdefault:drop
          onClick$={(e: MouseEvent) => {
            if ((e.target as HTMLElement).classList.contains('fixed')) {
              showImportModal.value = false;
            }
          }}
          onDragOver$={() => { importFileDragging.value = true; }}
          onDragLeave$={(e: DragEvent) => {
            // Only reset when leaving the overlay itself
            if (!(e.relatedTarget as HTMLElement)?.closest?.('.import-modal-inner')) {
              importFileDragging.value = false;
            }
          }}
          onDrop$={async (e: DragEvent) => {
            importFileDragging.value = false;
            const file = e.dataTransfer?.files?.[0];
            if (file && file.name.toLowerCase().endsWith('.dek')) {
              await loadFileIntoSignals(file);
            } else if (file) {
              importError.value = t(i18n, 'builder.import.invalidFile');
            }
          }}
        >
          <div class="import-modal-inner bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] w-full max-w-md">
            <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'builder.import.title')}
            </p>

            <div class="p-4 space-y-3">
              {/* Drop zone / file picker */}
              <label
                class={`flex flex-col items-center justify-center h-20 border-2 border-dashed bg-[rgba(26,26,26,0.4)] cursor-pointer transition-colors ${
                  importFileDragging.value
                    ? 'border-[var(--accent)] bg-[rgba(26,26,26,0.6)]'
                    : importFileName.value
                      ? 'border-[var(--accent)]/40'
                      : 'border-[rgba(51,51,51,0.3)] hover:border-[var(--accent)]'
                }`}
              >
                <input
                  type="file"
                  accept=".dek"
                  class="hidden"
                  onChange$={async (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) await loadFileIntoSignals(file);
                  }}
                />
                {importFileName.value ? (
                  <div class="flex items-center gap-2">
                    <span class="text-[var(--accent)] text-xs font-mono">{importFileName.value}</span>
                    <button
                      class="text-[var(--text-dim)] text-[10px] hover:text-[var(--red)] transition-colors"
                      onClick$={(e: MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        importFileName.value = '';
                        importFileData.value = null;
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span class="text-[var(--text-dim)] text-[11px] font-mono">
                      {t(i18n, 'builder.import.fileLabel')}
                    </span>
                    <span class="text-[var(--text-dim)] text-[9px] font-mono mt-1 opacity-50">
                      {t(i18n, 'builder.import.fileHint')}
                    </span>
                  </>
                )}
              </label>

              {/* Divider */}
              {!importFileName.value && (
                <div class="flex items-center gap-3">
                  <div class="flex-1 border-t border-[rgba(51,51,51,0.3)]" />
                  <span class="text-[var(--text-dim)] text-[9px] font-mono uppercase tracking-wider">
                    {t(i18n, 'builder.import.or')}
                  </span>
                  <div class="flex-1 border-t border-[rgba(51,51,51,0.3)]" />
                </div>
              )}

              {/* Code textarea (hidden when file is loaded) */}
              {!importFileName.value && (
                <textarea
                  class="w-full h-20 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono p-2 placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none resize-none"
                  placeholder={t(i18n, 'builder.import.placeholder')}
                  value={importCode.value}
                  onInput$={(e: InputEvent) => {
                    importCode.value = (e.target as HTMLTextAreaElement).value;
                    importError.value = '';
                  }}
                />
              )}

              {importError.value && (
                <p class="text-[var(--red)] text-[11px]">{importError.value}</p>
              )}

              <div class="flex gap-2 justify-end">
                <button
                  onClick$={() => {
                    showImportModal.value = false;
                    importCode.value = '';
                    importFileName.value = '';
                    importFileData.value = null;
                    importError.value = '';
                  }}
                  class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors"
                >
                  {t(i18n, 'builder.unitEditor.cancel')}
                </button>
                <button
                  onClick$={handleImport}
                  disabled={importLoading.value || (!importFileData.value && !importCode.value.trim())}
                  class={`px-3 py-1.5 text-white text-[10px] font-mono uppercase tracking-wider transition-colors ${
                    importLoading.value || (!importFileData.value && !importCode.value.trim())
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
  title: 'BA HUB - Deck Builder',
  meta: [
    {
      name: 'description',
      content: 'Create, import, and export custom deployment decks for Broken Arrow.',
    },
  ],
};
