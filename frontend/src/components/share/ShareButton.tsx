/**
 * ShareButton — Copies the current URL and shows an embed preview modal.
 *
 * The preview simulates how Discord/Twitter embeds render the og metadata,
 * using the same summary data that the SSR layer produces.
 */

import { component$, useSignal, $ } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import { IconShare, IconClipboard, IconCheck, IconClose } from '~/components/icons';
import { buildShareSummary } from '~/lib/compare';
import type { UnitDetailData } from '~/lib/graphql-types';

export type ShareButtonProps = {
  unitData: UnitDetailData | null;
};

export const ShareButton = component$<ShareButtonProps>(({ unitData }) => {
  const i18n = useI18n();
  const showPreview = useSignal(false);
  const copied = useSignal(false);

  const handleCopy = $(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    } catch {
      // Fallback for non-HTTPS
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    }
  });

  const handleShare = $(() => {
    showPreview.value = true;
  });

  const handleClose = $(() => {
    showPreview.value = false;
  });

  return (
    <>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)]/40 transition-colors"
        onClick$={handleShare}
      >
        <IconShare size={14} />
        {t(i18n, 'share.button')}
      </button>

      {/* Preview overlay */}
      {showPreview.value && (
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick$={handleClose}
        >
          <div
            class="w-full max-w-lg mx-4 bg-[var(--bg-raised)] border border-[var(--border)] shadow-2xl"
            onClick$={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div class="flex items-center justify-between px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
              <h3 class="text-sm font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">
                {t(i18n, 'share.preview.title')}
              </h3>
              <button type="button" onClick$={handleClose} class="text-[var(--text-dim)] hover:text-[var(--text)]">
                <IconClose size={16} />
              </button>
            </div>

            {/* Embed preview card */}
            <div class="p-4">
              <p class="text-[10px] font-mono text-[var(--text-dim)] mb-2">
                {t(i18n, 'share.preview.subtitle')}
              </p>
              <EmbedPreview unitData={unitData} />
            </div>

            {/* Copy URL bar */}
            <div class="flex items-center gap-2 px-4 py-3 border-t border-[rgba(51,51,51,0.3)]">
              <input
                type="text"
                readOnly
                class="flex-1 bg-[var(--bg)] text-xs font-mono text-[var(--text-dim)] px-3 py-2 border border-[rgba(51,51,51,0.15)] outline-none select-all"
                value={typeof window !== 'undefined' ? window.location.href : ''}
              />
              <button
                type="button"
                class={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors border ${
                  copied.value
                    ? 'text-green-400 border-green-400/40 bg-green-400/10'
                    : 'text-[var(--accent)] border-[var(--accent)]/40 hover:bg-[var(--accent)]/10'
                }`}
                onClick$={handleCopy}
              >
                {copied.value ? (
                  <>
                    <IconCheck size={14} />
                    {t(i18n, 'share.copied')}
                  </>
                ) : (
                  <>
                    <IconClipboard size={14} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

/* ── Embed preview card (simulates Discord embed) ────────────── */

const EmbedPreview = component$<{ unitData: UnitDetailData | null }>(({ unitData }) => {
  const i18n = useI18n();

  if (!unitData) {
    return (
      <div class="border-l-4 border-[var(--accent)] bg-[rgba(26,26,26,0.6)] p-4">
        <p class="text-xs text-[var(--text-dim)] font-mono">{t(i18n, 'common.loading')}</p>
      </div>
    );
  }

  const summary = buildShareSummary(unitData);

  return (
    <div class="border-l-4 border-[var(--accent)] bg-[rgba(26,26,26,0.6)] p-4 space-y-2">
      {/* Site name */}
      <p class="text-[10px] font-mono text-[var(--text-dim)]">BA Hub</p>

      {/* Title */}
      <h4 class="text-sm font-semibold text-[var(--accent)]">
        {summary.displayName} — BA Hub Arsenal
      </h4>

      {/* Description — matches what SSR will produce */}
      <p class="text-xs text-[var(--text)] leading-relaxed">
        {t(i18n, 'unitDetail.stat.cost')}: {summary.cost}
        {summary.hp !== null && ` · ${t(i18n, 'unitDetail.stat.hp')}: ${summary.hp}`}
        {` · ${t(i18n, summary.armorLabel)}: ${summary.armorValue}`}
        {` · ${t(i18n, 'share.preview.speed')}: ${summary.topSpeed}`}
      </p>

      {/* Weapons list */}
      {summary.weapons.length > 0 ? (
        <div class="flex flex-wrap gap-1 pt-1">
          <span class="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest mr-1">
            {t(i18n, 'share.preview.weapons')}:
          </span>
          {summary.weapons.map((name, i) => (
            <span key={i} class="text-[10px] font-mono px-1.5 py-0.5 bg-[rgba(51,51,51,0.3)] text-[var(--text-dim)]">
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p class="text-[10px] text-[var(--text-dim)] font-mono">{t(i18n, 'share.preview.noWeapons')}</p>
      )}
    </div>
  );
});
