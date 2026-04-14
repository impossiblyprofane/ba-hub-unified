/**
 * /decks/browse/[id] — Published deck detail page.
 *
 * Shows the deck in a readonly layout that mirrors the deck editor:
 * header (country, specs, name, tags, actions) → stats bar → category
 * grid with left sidebar stats + 7-column ReadonlyDeckSlotCard grid →
 * ReadonlyUnitPanel flyout on card click.
 */
import {
  $, component$, useStore, useSignal, useVisibleTask$, useContext,
} from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import type { CompressedDeck, UnitConfig, Set2Key, Deck } from '@ba-hub/shared';
import { DECK_CATEGORIES, EDITOR_CATEGORY_KEYS, SET2_KEYS, DECK_TAG_I18N } from '@ba-hub/shared';
import type { DeckTag } from '@ba-hub/shared';
import type {
  PublishedDeck, ArsenalCard, BuilderPageData,
} from '~/lib/graphql-types';
import {
  PUBLISHED_DECK_QUERY,
  RECORD_DECK_VIEW_MUTATION,
  TOGGLE_DECK_LIKE_MUTATION,
  DECK_LIKE_STATUS_QUERY,
  CHALLENGE_QUERY,
  UPDATE_PUBLISHED_DECK_MUTATION,
  DELETE_PUBLISHED_DECK_MUTATION,
} from '~/lib/queries/decks';
import { BUILDER_DATA_QUERY, OPTIONS_BY_IDS_QUERY } from '~/lib/queries/builder';
import { graphqlFetch, graphqlFetchRaw } from '~/lib/graphqlClient';
import { GameIcon } from '~/components/GameIcon';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import { toCountryIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { ensureUserId, getUserId } from '~/lib/userIdentity';
import { ToastContext, showToast } from '~/components/ui/Toast';
import { compressedToDeck, createDeckFromImport, computeUnitCost, encryptDekFile, downloadDekFile } from '~/lib/deck';
import { ReadonlyDeckSlotCard } from '~/components/decks/ReadonlyDeckSlotCard';
import { ReadonlyUnitPanel } from '~/components/decks/ReadonlyUnitPanel';

interface DetailState {
  deck: PublishedDeck | null;
  loading: boolean;
  notFound: boolean;
  liked: boolean;
  likeCount: number;
  viewCount: number;
  copied: boolean;
  /** Hydrated Deck (with full UnitConfig[]) */
  hydratedDeck: Deck | null;
  /** Category → max slots from specializations. */
  maxSlots: Record<string, number>;
  /** Category → max points from specializations. */
  maxPoints: Record<string, number>;
  /** Owner manage: editing mode */
  isEditing: boolean;
  /** Owner manage: confirming delete */
  isConfirmingDelete: boolean;
  /** Owner manage: saving in progress */
  editSaving: boolean;
  /** Owner manage: edit fields */
  editName: string;
  editDescription: string;
  editPublisherName: string;
  editTags: string[];
  /** Challenge */
  challengeId: string;
  challengeQuestion: string;
  challengeAnswer: string;
}

export default component$(() => {
  const i18n = useI18n();
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useContext(ToastContext);
  const deckId = loc.params.id;

  const state = useStore<DetailState>({
    deck: null,
    loading: true,
    notFound: false,
    liked: false,
    likeCount: 0,
    viewCount: 0,
    copied: false,
    hydratedDeck: null,
    maxSlots: {},
    maxPoints: {},
    isEditing: false,
    isConfirmingDelete: false,
    editSaving: false,
    editName: '',
    editDescription: '',
    editPublisherName: '',
    editTags: [],
    challengeId: '',
    challengeQuestion: '',
    challengeAnswer: '',
  });

  /** Builder data (arsenal cards, specializations) — loaded once. */
  const builderData = useSignal<BuilderPageData | null>(null);

  /** Arsenal card lookup by unit ID. */
  const cardLookup = useSignal<Record<number, ArsenalCard>>({});

  /** Unit panel selection state. */
  const panelCategory = useSignal<Set2Key | null>(null);
  const panelSlot = useSignal<number | null>(null);
  const showPanel = useSignal(false);

  // ── Load deck → builder data → hydrate ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      // 1. Fetch published deck (pass viewerId so server computes isOwner)
      const viewerId = getUserId();
      const deckResult = await graphqlFetchRaw<{ publishedDeck: PublishedDeck | null }>(
        PUBLISHED_DECK_QUERY,
        { id: deckId, viewerId: viewerId ?? undefined },
      );
      if (!deckResult.data?.publishedDeck) {
        state.notFound = true;
        state.loading = false;
        return;
      }

      state.deck = deckResult.data.publishedDeck;
      state.likeCount = state.deck.likeCount;
      state.viewCount = state.deck.viewCount;

      const deckData = state.deck.deckData as CompressedDeck;

      // 2. Fetch builder data (arsenal + specializations) for this deck's faction
      const builderResult = await graphqlFetchRaw<{ builderData: BuilderPageData }>(
        BUILDER_DATA_QUERY,
        {
          countryId: deckData.country,
          spec1Id: deckData.spec1,
          spec2Id: deckData.spec2,
        },
      );
      if (!builderResult.data) throw new Error('No builder data');
      builderData.value = builderResult.data.builderData;

      // Build card lookup
      const lookup: Record<number, ArsenalCard> = {};
      for (const c of builderResult.data.builderData.arsenalUnitsCards) {
        lookup[c.unit.Id] = c;
      }
      cardLookup.value = lookup;

      // Compute max slots/points from specializations
      const spec1 = builderResult.data.builderData.specializations.find(
        (s) => s.Id === deckData.spec1,
      );
      const spec2 = builderResult.data.builderData.specializations.find(
        (s) => s.Id === deckData.spec2,
      );
      if (spec1 && spec2) {
        const ms: Record<string, number> = {};
        const mp: Record<string, number> = {};
        for (const cat of DECK_CATEGORIES) {
          const s1 = (spec1 as unknown as Record<string, number>)[cat.slotsField] ?? 0;
          const s2 = (spec2 as unknown as Record<string, number>)[cat.slotsField] ?? 0;
          ms[cat.set2Key] = Math.min(s1 + s2, 7);
          const p1 = (spec1 as unknown as Record<string, number>)[cat.pointsField] ?? 0;
          const p2 = (spec2 as unknown as Record<string, number>)[cat.pointsField] ?? 0;
          mp[cat.set2Key] = p1 + p2;
        }
        state.maxSlots = ms;
        state.maxPoints = mp;
      }

      // 3. Collect all option IDs from compressed deck for hydration
      const allOptIds: number[] = [];
      const catKeys: Set2Key[] = ['Recon', 'Infantry', 'GroundCombatVehicles', 'Support', 'Logistic', 'Helicopters', 'Aircrafts'];
      for (const cat of catKeys) {
        const units = deckData.set2[cat] ?? [];
        for (const u of units) {
          for (const m of u.modList) allOptIds.push(m.optId);
          for (const m of (u.tranModList ?? [])) allOptIds.push(m.optId);
        }
      }

      // 4. Fetch options + hydrate
      let optionsById: Map<number, any> = new Map();
      if (allOptIds.length > 0) {
        const optResult = await graphqlFetchRaw<{
          optionsByIds: Array<{ Id: number; [key: string]: unknown }>;
        }>(OPTIONS_BY_IDS_QUERY, { ids: [...new Set(allOptIds)] });
        if (optResult.data) {
          for (const opt of optResult.data.optionsByIds) {
            optionsById.set(opt.Id, opt);
          }
        }
      }

      const hydrated = compressedToDeck(deckData, optionsById);
      hydrated.name = state.deck.name;
      state.hydratedDeck = hydrated;
    } catch {
      state.notFound = true;
    } finally {
      state.loading = false;
    }

    // Record view (fire-and-forget)
    const viewerId = getUserId();
    graphqlFetchRaw<{ recordDeckView: { newViewCount: number } }>(
      RECORD_DECK_VIEW_MUTATION,
      { deckId, viewerId },
    ).then((result) => {
      if (result.data) state.viewCount = result.data.recordDeckView.newViewCount;
    }).catch(() => { /* ignore */ });

    // Check like status
    const userId = getUserId();
    if (userId) {
      graphqlFetchRaw<{ deckLikeStatus: { liked: boolean } }>(
        DECK_LIKE_STATUS_QUERY,
        { deckId, userId },
      ).then((result) => {
        if (result.data) state.liked = result.data.deckLikeStatus.liked;
      }).catch(() => { /* ignore */ });
    }
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleLike = $(async () => {
    try {
      const { userId, isNew } = await ensureUserId();
      if (isNew) {
        showToast(toast, t(i18n, 'decks.user.identityCreated'), 'info');
      }
      const result = await graphqlFetchRaw<{
        toggleDeckLike: { liked: boolean; newLikeCount: number };
      }>(TOGGLE_DECK_LIKE_MUTATION, { deckId, userId });
      if (result.data) {
        state.liked = result.data.toggleDeckLike.liked;
        state.likeCount = result.data.toggleDeckLike.newLikeCount;
      }
    } catch {
      // Silently fail
    }
  });

  const handleCopy = $(() => {
    if (!state.deck) return;
    navigator.clipboard.writeText(state.deck.deckCode).then(() => {
      state.copied = true;
      setTimeout(() => { state.copied = false; }, 2000);
    });
  });

  const handleDownloadDek = $(async () => {
    if (!state.hydratedDeck) return;
    try {
      const buffer = await encryptDekFile(state.hydratedDeck);
      downloadDekFile(buffer, state.deck?.name || 'deck');
    } catch (err) {
      showToast(toast, 'Download failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  });

  const handleImport = $(async () => {
    if (!state.deck || !state.hydratedDeck || !builderData.value) return;
    try {
      const deckData = state.deck.deckData as CompressedDeck;
      const spec1 = builderData.value.specializations.find(s => s.Id === deckData.spec1);
      const spec2 = builderData.value.specializations.find(s => s.Id === deckData.spec2);
      if (!spec1 || !spec2) throw new Error('Specializations not found');

      const hydrated = { ...state.hydratedDeck };
      hydrated.name = state.deck.name;

      const editorDeck = createDeckFromImport(hydrated, spec1 as any, spec2 as any);
      const { saveDeck } = await import('~/lib/deck');
      saveDeck(editorDeck);
      await nav('/decks/builder/edit/' + editorDeck.deckId);
    } catch (err) {
      showToast(toast, 'Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  });

  /** Slot click — open readonly unit panel. */
  const handleSlotClick = $((category: Set2Key, slotIndex: number) => {
    const unitArr = (state.hydratedDeck?.set2?.[category as keyof Deck['set2']] ?? []) as UnitConfig[];
    const unit = unitArr[slotIndex];
    if (!unit?.unitId) return;
    panelCategory.value = category;
    panelSlot.value = slotIndex;
    showPanel.value = true;
  });

  // ── Owner manage helpers ──────────────────────────────────────
  /** Whether the current user is the owner of this deck (server-computed). */
  const isOwner = state.deck?.isOwner ?? false;

  /** Fetch a challenge question (needed for edit/delete). */
  const fetchChallenge = $(async () => {
    try {
      const result = await graphqlFetchRaw<{
        challenge: { challengeId: string; question: string };
      }>(CHALLENGE_QUERY);
      if (result.data) {
        state.challengeId = result.data.challenge.challengeId;
        state.challengeQuestion = result.data.challenge.question;
        state.challengeAnswer = '';
      }
    } catch { /* ignore */ }
  });

  /** Enter edit mode for the deck metadata. */
  const startEdit = $(async () => {
    if (!state.deck) return;
    state.editName = state.deck.name;
    state.editDescription = state.deck.description;
    state.editPublisherName = state.deck.publisherName || '';
    state.editTags = [...state.deck.tags];
    state.isEditing = true;
    state.isConfirmingDelete = false;
    await fetchChallenge();
  });

  /** Save edited metadata to the server. */
  const saveEdit = $(async () => {
    if (!state.deck || !state.challengeAnswer.trim()) return;
    state.editSaving = true;
    try {
      const { userId } = await ensureUserId();
      const data = await graphqlFetch<{ updatePublishedDeck: PublishedDeck }>(
        UPDATE_PUBLISHED_DECK_MUTATION,
        {
          deckId: state.deck.id,
          input: {
            authorId: userId,
            publisherName: state.editPublisherName.trim(),
            name: state.editName.trim(),
            description: state.editDescription.trim(),
            tags: state.editTags,
            challengeId: state.challengeId,
            challengeAnswer: parseInt(state.challengeAnswer, 10),
          },
        },
      );
      state.deck = { ...state.deck, ...data.updatePublishedDeck };
      state.isEditing = false;
      state.challengeAnswer = '';
      showToast(toast, t(i18n, 'decks.publish.updateSuccess'), 'success');
    } catch (err) {
      showToast(toast, (err instanceof Error ? err.message : 'Update failed'), 'error');
    } finally {
      state.editSaving = false;
    }
  });

  /** Cancel edit mode. */
  const cancelEdit = $(() => {
    state.isEditing = false;
    state.challengeAnswer = '';
  });

  /** Start or confirm delete. */
  const handleDelete = $(async () => {
    if (!state.isConfirmingDelete) {
      state.isConfirmingDelete = true;
      state.isEditing = false;
      await fetchChallenge();
      return;
    }
    if (!state.deck || !state.challengeAnswer.trim()) return;
    try {
      const { userId } = await ensureUserId();
      await graphqlFetch<{ deletePublishedDeck: boolean }>(
        DELETE_PUBLISHED_DECK_MUTATION,
        {
          deckId: state.deck.id,
          input: {
            authorId: userId,
            challengeId: state.challengeId,
            challengeAnswer: parseInt(state.challengeAnswer, 10),
          },
        },
      );

      showToast(toast, t(i18n, 'decks.publish.deleteSuccess'), 'success');
      await nav('/decks/browse');
    } catch (err) {
      showToast(toast, (err instanceof Error ? err.message : 'Delete failed'), 'error');
    }
  });

  /** Cancel delete. */
  const cancelDelete = $(() => {
    state.isConfirmingDelete = false;
    state.challengeAnswer = '';
  });

  // ── Loading / Not found states ────────────────────────────────
  if (state.loading) {
    return (
      <div class="w-full max-w-[2000px] mx-auto py-12 text-center">
        <p class="text-sm text-[var(--text-dim)] font-mono">{t(i18n, 'common.loading')}</p>
      </div>
    );
  }

  if (state.notFound || !state.deck) {
    return (
      <div class="w-full max-w-[2000px] mx-auto">
        <a
          href="/decks/browse"
          class="text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
        >
          {'\u2190'} {t(i18n, 'decks.detail.backLink')}
        </a>
        <div class="mt-8 py-12 text-center">
          <p class="text-xl text-[var(--text)] font-mono tracking-wider">{t(i18n, 'decks.detail.notFound')}</p>
          <p class="text-sm text-[var(--text-dim)] mt-2">{t(i18n, 'decks.detail.notFoundDesc')}</p>
        </div>
      </div>
    );
  }

  // ── Resolve display data ──────────────────────────────────────
  const deck = state.deck;
  const bd = builderData.value;
  const hydrated = state.hydratedDeck;

  const country = bd?.countries?.find((c) => c.Id === deck.countryId);
  const spec1 = bd?.specializations?.find((s) => s.Id === deck.spec1Id);
  const spec2 = bd?.specializations?.find((s) => s.Id === deck.spec2Id);

  const countryName = country
    ? getGameLocaleValueOrKey(GAME_LOCALES.specs, country.Name, i18n.locale as Locale)
    : '';
  const spec1Name = spec1
    ? getGameLocaleValueOrKey(GAME_LOCALES.specs, spec1.UIName, i18n.locale as Locale)
    : '';
  const spec2Name = spec2
    ? getGameLocaleValueOrKey(GAME_LOCALES.specs, spec2.UIName, i18n.locale as Locale)
    : '';

  /* ── Compute per-category stats from hydrated deck ── */
  const cardMap = bd
    ? new Map(bd.arsenalUnitsCards.map(c => [c.unit.Id, c]))
    : new Map<number, ArsenalCard>();

  let totalPoints = 0;
  let totalUnits = 0;
  let totalSlots = 0;
  const catStats: Record<string, {
    currentPoints: number;
    currentSlots: number;
    unitCount: number;
    totalSeats: number;
    totalCargo: number;
  }> = {};

  if (hydrated) {
    for (const key of SET2_KEYS) {
      const units = (hydrated.set2[key as keyof typeof hydrated.set2] ?? []) as UnitConfig[];
      const filled = units.filter(u => u.unitId !== undefined);
      let pts = 0;
      let avail = 0;
      let seats = 0;
      let cargo = 0;

      for (const u of filled) {
        pts += computeUnitCost(u, cardMap);
        avail += u.count ?? 0;
        const card = u.unitId ? cardMap.get(u.unitId) : undefined;
        const cnt = u.count ?? 0;
        seats += (card?.transportCapacity ?? 0) * cnt;
        cargo += (card?.cargoCapacity ?? 0) * cnt;
        if (u.tranId && u.tranCount) {
          const tc = cardMap.get(u.tranId);
          seats += (tc?.transportCapacity ?? 0) * u.tranCount;
          cargo += (tc?.cargoCapacity ?? 0) * u.tranCount;
        }
      }

      catStats[key] = {
        currentPoints: pts,
        currentSlots: filled.length,
        unitCount: avail,
        totalSeats: seats,
        totalCargo: cargo,
      };
      totalPoints += pts;
      totalUnits += avail;
      totalSlots += filled.length;
    }
  }

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Breadcrumb */}
      <a
        href="/decks/browse"
        class="text-[var(--text-dim)] text-xs font-mono uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
      >
        {'\u2190'} {t(i18n, 'decks.detail.backLink')}
      </a>

      {/* ── Header panel ── */}
      <div class="mt-4 p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
        {/* Row 1: Name + country + specs */}
        <div class="px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
          <div class="flex items-center gap-3 mb-2">
            {country?.FlagFileName && (
              <GameIcon
                src={toCountryIconPath(country.FlagFileName)}
                alt={countryName}
                size={24}
                class="icon-white shrink-0"
              />
            )}
            {state.isEditing ? (
              <input
                type="text"
                value={state.editName}
                onInput$={(e: InputEvent) => { state.editName = (e.target as HTMLInputElement).value; }}
                class="flex-1 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-lg font-semibold px-2 py-1 focus:border-[var(--accent)] focus:outline-none"
                maxLength={100}
              />
            ) : (
              <h1 class="text-xl font-semibold text-[var(--text)] truncate">{deck.name}</h1>
            )}
            {isOwner && !state.isEditing && !state.isConfirmingDelete && (
              <span class="ml-auto px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-[var(--accent)] text-[var(--accent)] shrink-0">
                {t(i18n, 'decks.detail.ownerBadge')}
              </span>
            )}
          </div>
          {state.isEditing ? (
            <input
              type="text"
              value={state.editPublisherName}
              onInput$={(e: InputEvent) => { state.editPublisherName = (e.target as HTMLInputElement).value; }}
              placeholder={t(i18n, 'decks.publish.publisherPlaceholder')}
              class="w-full bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text-dim)] text-xs font-mono px-2 py-1 mt-1 focus:border-[var(--accent)] focus:outline-none"
              maxLength={50}
            />
          ) : deck.publisherName ? (
            <p class="text-xs font-mono text-[var(--text-dim)] mt-1">
              {t(i18n, 'decks.detail.by')} <span class="text-[var(--text)]">{deck.publisherName}</span>
            </p>
          ) : null}
          <div class="flex items-center gap-4 text-xs font-mono mt-2">
            {spec1 && (
              <div class="flex items-center gap-1.5">
                <span class="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">{t(i18n, 'builder.info.spec1')}:</span>
                {spec1.Icon && (
                  <GameIcon src={toSpecializationIconPath(spec1.Icon)} alt={spec1Name} size={16} class="icon-white" />
                )}
                <span class="text-[var(--accent)]">{spec1Name}</span>
              </div>
            )}
            {spec2 && (
              <div class="flex items-center gap-1.5">
                <span class="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">{t(i18n, 'builder.info.spec2')}:</span>
                {spec2.Icon && (
                  <GameIcon src={toSpecializationIconPath(spec2.Icon)} alt={spec2Name} size={16} class="icon-white" />
                )}
                <span class="text-[var(--accent)]">{spec2Name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Tags, description, stats, actions */}
        <div class="px-4 py-3 space-y-3">
          {/* Tags (readonly or editable) */}
          {state.isEditing ? (
            <div class="space-y-1">
              <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                {t(i18n, 'decks.publish.tagsLabel')}
              </span>
              <div class="flex flex-wrap gap-1.5">
                {Object.entries(DECK_TAG_I18N).map(([tag, i18nKey]) => {
                  const selected = state.editTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick$={() => {
                        if (selected) {
                          state.editTags = state.editTags.filter(t2 => t2 !== tag);
                        } else if (state.editTags.length < 5) {
                          state.editTags = [...state.editTags, tag];
                        }
                      }}
                      class={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                        selected
                          ? 'border-[var(--accent)] text-[var(--accent)]'
                          : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.5)]'
                      }`}
                    >
                      {t(i18n, i18nKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : deck.tags.length > 0 ? (
            <div class="flex flex-wrap gap-1.5">
              {deck.tags.map((tag) => (
                <span
                  key={tag}
                  class="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)]"
                >
                  {t(i18n, DECK_TAG_I18N[tag as DeckTag])}
                </span>
              ))}
            </div>
          ) : null}

          {/* Description */}
          {state.isEditing ? (
            <textarea
              value={state.editDescription}
              onInput$={(e: InputEvent) => { state.editDescription = (e.target as HTMLTextAreaElement).value; }}
              placeholder={t(i18n, 'decks.publish.descPlaceholder')}
              class="w-full h-20 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-sm font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none resize-none"
              maxLength={500}
            />
          ) : deck.description ? (
            <p class="text-sm text-[var(--text-dim)] leading-relaxed max-w-2xl">
              {deck.description}
            </p>
          ) : null}

          {/* Edit: challenge + save/cancel */}
          {state.isEditing && (
            <div class="space-y-2 pt-2 border-t border-[rgba(51,51,51,0.15)]">
              {state.challengeQuestion && (
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-[var(--text-dim)] font-mono">{t(i18n, 'decks.detail.challengeHint')}:</span>
                  <span class="text-[10px] text-[var(--text)] font-mono">{state.challengeQuestion}</span>
                  <input
                    type="text"
                    value={state.challengeAnswer}
                    onInput$={(e: InputEvent) => { state.challengeAnswer = (e.target as HTMLInputElement).value; }}
                    class="w-16 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-1.5 py-0.5 focus:border-[var(--accent)] focus:outline-none"
                    maxLength={10}
                  />
                </div>
              )}
              <div class="flex gap-2">
                <button
                  onClick$={saveEdit}
                  disabled={state.editSaving || !state.challengeAnswer.trim()}
                  class="px-3 py-1.5 bg-[var(--accent)] text-white text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors disabled:opacity-50"
                >
                  {state.editSaving ? t(i18n, 'decks.detail.saving') : t(i18n, 'decks.detail.save')}
                </button>
                <button
                  onClick$={cancelEdit}
                  class="px-3 py-1.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:text-[var(--text)] transition-colors"
                >
                  {t(i18n, 'decks.detail.cancelAction')}
                </button>
              </div>
            </div>
          )}

          {/* Delete confirmation: challenge + confirm/cancel */}
          {state.isConfirmingDelete && !state.isEditing && (
            <div class="space-y-2 pt-2 border-t border-[rgba(51,51,51,0.15)]">
              <p class="text-xs font-mono text-red-400">
                {t(i18n, 'decks.detail.deleteConfirm')}
              </p>
              {state.challengeQuestion && (
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-[var(--text-dim)] font-mono">{t(i18n, 'decks.detail.challengeHint')}:</span>
                  <span class="text-[10px] text-[var(--text)] font-mono">{state.challengeQuestion}</span>
                  <input
                    type="text"
                    value={state.challengeAnswer}
                    onInput$={(e: InputEvent) => { state.challengeAnswer = (e.target as HTMLInputElement).value; }}
                    class="w-16 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-1.5 py-0.5 focus:border-[var(--accent)] focus:outline-none"
                    maxLength={10}
                  />
                </div>
              )}
              <div class="flex gap-2">
                <button
                  onClick$={handleDelete}
                  disabled={!state.challengeAnswer.trim()}
                  class="px-3 py-1.5 border border-red-500 text-red-400 text-[10px] font-mono uppercase tracking-wider hover:bg-[rgba(239,68,68,0.1)] transition-colors disabled:opacity-50"
                >
                  {t(i18n, 'decks.detail.confirmDelete')}
                </button>
                <button
                  onClick$={cancelDelete}
                  class="px-3 py-1.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:text-[var(--text)] transition-colors"
                >
                  {t(i18n, 'decks.detail.cancelAction')}
                </button>
              </div>
            </div>
          )}

          {/* Stats row (show when not editing/deleting) */}
          {!state.isEditing && !state.isConfirmingDelete && (
            <div class="flex items-center gap-4 text-[10px] font-mono text-[var(--text-dim)]">
              <button
                onClick$={handleLike}
                class={`flex items-center gap-1 transition-colors ${state.liked ? 'text-red-400' : 'hover:text-red-400'}`}
              >
                <span>{state.liked ? '\u2665' : '\u2661'}</span>
                <span>{state.likeCount}</span>
              </button>
              <span>{'\uD83D\uDC41'} {state.viewCount}</span>
              <span>{t(i18n, 'decks.detail.publishedOn')} {new Date(deck.createdAt).toLocaleDateString()}</span>
            </div>
          )}

          {/* Action buttons */}
          <div class="flex flex-wrap gap-2">
            <button
              onClick$={handleCopy}
              class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              {state.copied ? t(i18n, 'decks.detail.codeCopied') : t(i18n, 'decks.detail.copyCode')}
            </button>
            <button
              onClick$={handleDownloadDek}
              class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              {t(i18n, 'decks.detail.downloadDek')}
            </button>
            <button
              onClick$={handleImport}
              class="px-3 py-1.5 bg-[var(--accent)] text-white text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors"
            >
              {t(i18n, 'decks.detail.importToDeck')}
            </button>
            {/* Owner actions */}
            {isOwner && !state.isEditing && !state.isConfirmingDelete && (
              <>
                <div class="w-px h-5 bg-[rgba(51,51,51,0.3)] self-center" />
                <button
                  onClick$={startEdit}
                  class="px-3 py-1.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {t(i18n, 'decks.detail.editMetadata')}
                </button>
                <button
                  onClick$={handleDelete}
                  class="px-3 py-1.5 border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-red-500 hover:text-red-400 transition-colors"
                >
                  {t(i18n, 'decks.detail.deleteDeck')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats bar (mirrors editor) ── */}
      {hydrated && (
        <div class="flex items-center gap-6 mt-4 px-4 py-3 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          {/* Points */}
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              {t(i18n, 'builder.editor.totalPoints')}
            </span>
            <span class={`text-base font-bold tabular-nums ${totalPoints > 10000 ? 'text-red-400' : 'text-[var(--accent)]'}`}>
              {totalPoints}
            </span>
            <span class="text-xs text-[var(--text-dim)] tabular-nums">/10,000</span>
          </div>

          <div class="w-px h-5 bg-[rgba(51,51,51,0.3)]" />

          {/* Units */}
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              {t(i18n, 'builder.editor.totalUnits')}
            </span>
            <span class="text-base font-bold text-[var(--text)] tabular-nums">
              {totalUnits}
            </span>
          </div>

          {/* Slots */}
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              {t(i18n, 'builder.editor.totalSlots')}
            </span>
            <span class="text-base font-bold text-[var(--text)] tabular-nums">
              {totalSlots}
            </span>
          </div>
        </div>
      )}

      {/* ── Category grid (mirrors editor layout) ── */}
      {hydrated && (
        <div class="space-y-3 mt-4">
          {EDITOR_CATEGORY_KEYS.map((catKey) => {
            const catDef = DECK_CATEGORIES.find(c => c.set2Key === catKey)!;
            const units = (hydrated.set2[catKey as keyof typeof hydrated.set2] ?? []) as UnitConfig[];
            const maxSlotsForCat = (state.maxSlots[catKey] ?? 7);
            const maxPtsForCat = (state.maxPoints[catKey] ?? 0);
            const cs = catStats[catKey];
            const filledUnits = units.filter(u => u.unitId !== undefined);

            if (filledUnits.length === 0 && maxSlotsForCat === 0) return null;

            // Pad to maxSlots with empty placeholders
            const paddedUnits: UnitConfig[] = [];
            for (let i = 0; i < maxSlotsForCat; i++) {
              paddedUnits.push(units[i] ?? { cat: catDef.categoryType, slot: i, modList: [], modListTr: [] });
            }

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
                      <span class={cs && cs.currentPoints > Math.round(maxPtsForCat * 1.1) ? 'text-red-400' : cs && cs.currentPoints > maxPtsForCat && maxPtsForCat > 0 ? 'text-orange-400' : 'text-[var(--accent)]'}>
                        {cs?.currentPoints ?? 0}
                      </span>
                      {maxPtsForCat > 0 && <span class="text-[var(--text-dim)]">/{maxPtsForCat}</span>}
                    </span>
                  </div>
                  {/* Row 2: Units | Slots */}
                  <div class="flex items-baseline justify-between">
                    <SimpleTooltip text="Total units (availability)">
                      <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                        {cs?.unitCount ?? 0} {t(i18n, 'builder.editor.units')}
                      </span>
                    </SimpleTooltip>
                    <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                      {cs?.currentSlots ?? 0}/{maxSlotsForCat} {t(i18n, 'builder.editor.slots').toLowerCase()}
                    </span>
                  </div>
                  {/* Row 3: Cargo | Seats (dynamic) */}
                  {cs && (cs.totalCargo > 0 || cs.totalSeats > 0) && (
                    <div class="flex items-baseline justify-between">
                      {cs.totalCargo > 0 ? (
                        <SimpleTooltip text="Combined cargo capacity">
                          <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                            {Math.round(cs.totalCargo)} {t(i18n, 'builder.editor.cargo')}
                          </span>
                        </SimpleTooltip>
                      ) : <span />}
                      {cs.totalSeats > 0 ? (
                        <SimpleTooltip text="Total infantry seats">
                          <span class="text-[10px] font-mono tabular-nums text-[var(--text-dim)]">
                            {cs.totalSeats} {t(i18n, 'builder.editor.seats')}
                          </span>
                        </SimpleTooltip>
                      ) : <span />}
                    </div>
                  )}
                </div>

                {/* ── Right: slots grid (7 columns) ── */}
                <div class="flex-1 grid items-start gap-px bg-[rgba(51,51,51,0.1)]" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {paddedUnits.map((unit, idx) => (
                    <ReadonlyDeckSlotCard
                      key={idx}
                      unit={unit}
                      slotIndex={idx}
                      category={catKey}
                      arsenalCard={unit.unitId ? cardMap.get(unit.unitId) : undefined}
                      transportCard={unit.tranId ? cardMap.get(unit.tranId) : undefined}
                      locale={i18n.locale as Locale}
                      onSlotClick$={handleSlotClick}
                    />
                  ))}
                  {/* Ghost placeholders for unused columns up to 7 */}
                  {Array.from({ length: 7 - maxSlotsForCat }).map((_, i) => (
                    <div key={`ghost-${i}`} class="bg-[rgba(26,26,26,0.15)]" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Deck code ── */}
      <div class="mt-4 p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
          {t(i18n, 'decks.detail.deckCode')}
        </p>
        <div class="px-3 py-2">
          <code class="text-[11px] font-mono text-[var(--text-dim)] break-all select-all">
            {deck.deckCode}
          </code>
        </div>
      </div>

      {/* ── Readonly unit panel flyout ── */}
      {showPanel.value && panelCategory.value && panelSlot.value !== null && hydrated && (() => {
        const unitArr = (hydrated.set2[panelCategory.value as keyof typeof hydrated.set2] ?? []) as UnitConfig[];
        const editUnit = unitArr[panelSlot.value!];
        if (!editUnit?.unitId) return null;

        return (
          <ReadonlyUnitPanel
            key={`${editUnit.unitId}-${editUnit.tranId ?? 'foot'}-${panelCategory.value}-${panelSlot.value}`}
            unit={editUnit}
            arsenalCard={cardMap.get(editUnit.unitId)}
            transportCard={editUnit.tranId ? cardMap.get(editUnit.tranId) : undefined}
            locale={i18n.locale as Locale}
            onClose$={$(() => { showPanel.value = false; })}
          />
        );
      })()}
    </div>
  );
});

// ── DocumentHead ────────────────────────────────────────────────

export const head: DocumentHead = {
  title: 'BA HUB - Deck Detail',
  meta: [
    {
      name: 'description',
      content: 'View a community-published deck with full composition details.',
    },
  ],
};