/**
 * PublishModal — modal dialog for publishing a deck to the community.
 *
 * Flow: name + description + tags → fetch challenge → user answers → submit.
 * Uses ensureUserId() to silently create/retrieve an anonymous identity.
 */
import {
  $, component$, useStore, useContext, useVisibleTask$,
} from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { EditorDeck, CompressedDeck, DeckTag } from '@ba-hub/shared';
import { DECK_TAG_GROUPS, DECK_TAG_I18N } from '@ba-hub/shared';
import { useI18n, t } from '~/lib/i18n';
import { encodeDeck, deckToCompressedDeck } from '~/lib/deck';
import { ensureUserId } from '~/lib/userIdentity';
import {
  CHALLENGE_QUERY,
  PUBLISH_DECK_MUTATION,
  UPDATE_PUBLISHED_DECK_MUTATION,
} from '~/lib/queries/decks';
import { graphqlFetch, graphqlFetchRaw } from '~/lib/graphqlClient';
import { ToastContext, showToast } from '~/components/ui/Toast';

/** Publish mode when the deck already has a publishedDeckId. */
type PublishMode = 'update' | 'new';

interface PublishModalProps {
  deck: EditorDeck;
  onClose$: PropFunction<() => void>;
  onPublished$?: PropFunction<(publishedId: string) => void>;
}

interface ModalState {
  mode: PublishMode;
  publisherName: string;
  name: string;
  description: string;
  tags: DeckTag[];
  challengeId: string;
  challengeQuestion: string;
  challengeAnswer: string;
  submitting: boolean;
  error: string;
  nameError: boolean;
}

export const PublishModal = component$<PublishModalProps>(({ deck, onClose$, onPublished$ }) => {
  const i18n = useI18n();
  const toast = useContext(ToastContext);

  const hasPublished = !!deck.publishedDeckId;

  const state = useStore<ModalState>({
    mode: hasPublished ? 'update' : 'new',
    publisherName: '',
    name: deck.deck.name || '',
    description: '',
    tags: [],
    challengeId: '',
    challengeQuestion: '',
    challengeAnswer: '',
    submitting: false,
    error: '',
    nameError: false,
  });

  // Fetch challenge on mount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const result = await graphqlFetchRaw<{
        challenge: { challengeId: string; question: string };
      }>(CHALLENGE_QUERY);
      if (result.data) {
        state.challengeId = result.data.challenge.challengeId;
        state.challengeQuestion = result.data.challenge.question;
      }
    } catch {
      // Challenge fetch failed — user can still try, server will reject
    }
  });

  const toggleTag = $((tag: DeckTag) => {
    if (state.tags.includes(tag)) {
      state.tags = state.tags.filter((t) => t !== tag);
    } else if (state.tags.length < 5) {
      state.tags = [...state.tags, tag];
    }
  });

  const handleSubmit = $(async () => {
    // Validate
    state.nameError = false;
    state.error = '';

    if (!state.name.trim()) {
      state.nameError = true;
      return;
    }
    if (!state.challengeAnswer.trim()) {
      state.error = t(i18n, 'decks.publish.challengeRequired');
      return;
    }

    state.submitting = true;

    try {
      // Ensure user identity
      const { userId, isNew } = await ensureUserId();
      if (isNew) {
        showToast(toast, t(i18n, 'decks.user.identityCreated'), 'info');
      }

      // Encode deck
      const deckCode = encodeDeck(deck.deck);
      const deckData: CompressedDeck = deckToCompressedDeck(deck.deck);

      const isUpdate = state.mode === 'update' && hasPublished;

      if (isUpdate) {
        // ── Update existing published deck ──
        const data = await graphqlFetch<{ updatePublishedDeck: { id: string } }>(
          UPDATE_PUBLISHED_DECK_MUTATION,
          {
            deckId: deck.publishedDeckId,
            input: {
              publisherName: state.publisherName.trim(),
              name: state.name.trim(),
              description: state.description.trim(),
              deckCode,
              deckData,
              tags: state.tags,
              challengeId: state.challengeId,
              challengeAnswer: parseInt(state.challengeAnswer, 10),
            },
          },
        );

        showToast(toast, t(i18n, 'decks.publish.updateSuccess'), 'success');
        if (onPublished$) {
          await onPublished$(data.updatePublishedDeck.id);
        }
      } else {
        // ── Publish as new ──
        const data = await graphqlFetch<{ publishDeck: { id: string } }>(
          PUBLISH_DECK_MUTATION,
          {
            input: {
              authorId: userId,
              publisherName: state.publisherName.trim(),
              name: state.name.trim(),
              description: state.description.trim(),
              deckCode,
              countryId: deck.deck.country,
              spec1Id: deck.deck.spec1,
              spec2Id: deck.deck.spec2,
              deckData,
              tags: state.tags,
              challengeId: state.challengeId,
              challengeAnswer: parseInt(state.challengeAnswer, 10),
            },
          },
        );

        showToast(toast, t(i18n, 'decks.publish.success'), 'success');
        if (onPublished$) {
          await onPublished$(data.publishDeck.id);
        }
      }

      onClose$();
    } catch (err: unknown) {
      state.error = (err instanceof Error ? err.message : t(i18n, 'decks.publish.error'));
    } finally {
      state.submitting = false;
    }
  });

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick$={(e: MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains('fixed')) {
          onClose$();
        }
      }}
    >
      <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] w-full max-w-lg">
        {/* Header */}
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
          {hasPublished && state.mode === 'update'
            ? t(i18n, 'decks.publish.update')
            : t(i18n, 'decks.publish.title')}
        </p>

        <div class="p-4 space-y-4">
          {/* Mode selector — only when deck was previously published */}
          {hasPublished && (
            <div>
              <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider mb-2">
                {t(i18n, 'decks.publish.modeLabel')}
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick$={() => { state.mode = 'update'; }}
                  class={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                    state.mode === 'update'
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                      : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]'
                  }`}
                >
                  {t(i18n, 'decks.publish.modeUpdate')}
                </button>
                <button
                  type="button"
                  onClick$={() => { state.mode = 'new'; }}
                  class={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                    state.mode === 'new'
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                      : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]'
                  }`}
                >
                  {t(i18n, 'decks.publish.modeNew')}
                </button>
              </div>
              <p class="text-[9px] font-mono text-[var(--text-dim)] mt-1.5 opacity-60">
                {state.mode === 'update'
                  ? t(i18n, 'decks.publish.updateDesc')
                  : t(i18n, 'decks.publish.newDesc')}
              </p>
            </div>
          )}

          {/* Publisher Name */}
          <div>
            <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider mb-1">
              {t(i18n, 'decks.publish.publisherLabel')}
              <span class="ml-2 opacity-50">({t(i18n, 'decks.publish.publisherHint')})</span>
            </label>
            <input
              type="text"
              value={state.publisherName}
              onInput$={(e: InputEvent) => {
                state.publisherName = (e.target as HTMLInputElement).value;
              }}
              placeholder={t(i18n, 'decks.publish.publisherPlaceholder')}
              class="w-full bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-3 py-2 focus:border-[var(--accent)] focus:outline-none"
              maxLength={50}
            />
          </div>

          {/* Name */}
          <div>
            <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider mb-1">
              {t(i18n, 'decks.publish.nameLabel')}
            </label>
            <input
              type="text"
              value={state.name}
              onInput$={(e: InputEvent) => {
                state.name = (e.target as HTMLInputElement).value;
                state.nameError = false;
              }}
              placeholder={t(i18n, 'decks.publish.namePlaceholder')}
              class={`w-full bg-[rgba(26,26,26,0.4)] border ${state.nameError ? 'border-red-500' : 'border-[var(--border)]'} text-[var(--text)] text-xs font-mono px-3 py-2 focus:border-[var(--accent)] focus:outline-none`}
              maxLength={80}
            />
            {state.nameError && (
              <p class="text-red-400 text-[10px] font-mono mt-1">{t(i18n, 'decks.publish.nameRequired')}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider mb-1">
              {t(i18n, 'decks.publish.descLabel')}
            </label>
            <textarea
              value={state.description}
              onInput$={(e: InputEvent) => {
                state.description = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder={t(i18n, 'decks.publish.descPlaceholder')}
              class="w-full h-20 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-3 py-2 focus:border-[var(--accent)] focus:outline-none resize-none"
              maxLength={500}
            />
          </div>

          {/* Tags */}
          <div>
            <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider mb-1">
              {t(i18n, 'decks.publish.tagsLabel')}
              <span class="ml-2 opacity-50">({t(i18n, 'decks.publish.tagsHint')})</span>
            </label>
            <div class="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {DECK_TAG_GROUPS.map((group) => (
                <div key={group.group}>
                  <p class="text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] opacity-60 mb-1">
                    {t(i18n, group.i18nKey)}
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => {
                      const selected = state.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick$={() => toggleTag(tag)}
                          class={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                            selected
                              ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                              : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]'
                          } ${!selected && state.tags.length >= 5 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={!selected && state.tags.length >= 5}
                        >
                          {t(i18n, DECK_TAG_I18N[tag])}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Challenge */}
          {state.challengeQuestion && (
            <div>
              <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider mb-1">
                {t(i18n, 'decks.publish.challengeLabel')}
              </label>
              <div class="flex items-center gap-2">
                <span class="text-xs text-[var(--text)] font-mono">{state.challengeQuestion}</span>
                <input
                  type="text"
                  value={state.challengeAnswer}
                  onInput$={(e: InputEvent) => {
                    state.challengeAnswer = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t(i18n, 'decks.publish.challengePlaceholder')}
                  class="w-24 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none"
                  maxLength={10}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {state.error && (
            <p class="text-red-400 text-[10px] font-mono">{state.error}</p>
          )}

          {/* Actions */}
          <div class="flex gap-2 justify-end">
            <button
              onClick$={onClose$}
              class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors"
            >
              {t(i18n, 'decks.publish.cancel')}
            </button>
            <button
              onClick$={handleSubmit}
              disabled={state.submitting}
              class="px-3 py-1.5 bg-[var(--accent)] text-white text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.submitting
                ? (state.mode === 'update' && hasPublished
                    ? t(i18n, 'decks.publish.updating')
                    : t(i18n, 'decks.publish.submitting'))
                : (state.mode === 'update' && hasPublished
                    ? t(i18n, 'decks.publish.update')
                    : t(i18n, 'decks.publish.submit'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
