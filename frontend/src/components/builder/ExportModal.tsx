/**
 * ExportModal — displays the encoded deck code for sharing.
 */
import { $, component$, useSignal } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { EditorDeck } from '@ba-hub/shared';
import { useI18n, t } from '~/lib/i18n';
import { encodeDeck } from '~/lib/deck';

interface ExportModalProps {
  deck: EditorDeck;
  onClose$: PropFunction<() => void>;
}

export const ExportModal = component$<ExportModalProps>(({ deck, onClose$ }) => {
  const i18n = useI18n();
  const copied = useSignal(false);
  const code = encodeDeck(deck.deck);

  const handleCopy = $(() => {
    navigator.clipboard.writeText(code).then(() => {
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    });
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
      <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] w-full max-w-md">
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
          {t(i18n, 'builder.export.title')}
        </p>
        <div class="p-4 space-y-3">
          <label class="block text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider">
            {t(i18n, 'builder.export.code')}
          </label>
          <textarea
            class="w-full h-20 bg-[rgba(26,26,26,0.4)] border border-[var(--border)] text-[var(--text)] text-xs font-mono p-2 focus:border-[var(--accent)] focus:outline-none resize-none"
            value={code}
            readOnly
            onClick$={(e: MouseEvent) => {
              (e.target as HTMLTextAreaElement).select();
            }}
          />
          <div class="flex gap-2 justify-end">
            <button
              onClick$={onClose$}
              class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono uppercase tracking-wider hover:border-[var(--accent)] transition-colors"
            >
              {t(i18n, 'builder.export.close')}
            </button>
            <button
              onClick$={handleCopy}
              class="px-3 py-1.5 bg-[var(--accent)] text-white text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--accent-hi)] transition-colors"
            >
              {copied.value ? t(i18n, 'builder.export.copied') : t(i18n, 'builder.export.copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
