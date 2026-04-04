/**
 * /decks — Deck Hub page.
 *
 * Full-width dual hero navigation: Deck Builder and Browse Decks.
 * Two tall side-by-side panels fill the viewport for an immersive gateway feel.
 */
import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths, encodeIconPath } from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';

export default component$(() => {
  const i18n = useI18n();

  return (
    <div class="w-full">
      {/* Two-column hero layout — fills available height */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-px" style="min-height: calc(100vh - 10rem)">
        {/* ════════════ DECK BUILDER ════════════ */}
        <a
          href="/decks/builder"
          class="group relative flex flex-col items-center justify-center overflow-hidden
                 bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.8)]
                 border border-[rgba(51,51,51,0.15)]
                 hover:border-[rgba(70,151,195,0.4)] transition-all duration-500
                 min-h-[40vh] md:min-h-0"
        >
          {/* Background radial glow on hover */}
          <div
            class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
            style="background: radial-gradient(ellipse at 50% 60%, rgba(70,151,195,0.08) 0%, transparent 60%)"
          />

          {/* Decorative top-left corner bracket */}
          <div class="absolute top-4 left-4 w-5 h-5 border-t border-l border-[rgba(70,151,195,0.2)] group-hover:border-[rgba(70,151,195,0.5)] transition-colors duration-500" />
          {/* Decorative bottom-right corner bracket */}
          <div class="absolute bottom-4 right-4 w-5 h-5 border-b border-r border-[rgba(70,151,195,0.2)] group-hover:border-[rgba(70,151,195,0.5)] transition-colors duration-500" />

          {/* Section tag */}
          <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 group-hover:opacity-100 transition-opacity duration-500 mb-4">
            // {t(i18n, 'decks.hub.tag')}
          </span>

          {/* Icon — large, with glow pulse on hover */}
          <div class="relative mb-5">
            <GameIcon
              src={encodeIconPath(UtilIconPaths.DECK_OUTLINE)}
              size={64}
              alt="Deck Builder"
              variant="white"
              glow
            />
            {/* Soft ring behind icon */}
            <div
              class="absolute inset-0 -m-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style="background: radial-gradient(circle, rgba(70,151,195,0.12) 0%, transparent 70%)"
            />
          </div>

          {/* Title */}
          <h2 class="text-xl md:text-2xl font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-300 mb-2 relative z-10">
            {t(i18n, 'decks.hub.builder.title')}
          </h2>

          {/* Description */}
          <p class="text-[12px] text-[var(--text-dim)] max-w-sm text-center leading-relaxed relative z-10 px-6">
            {t(i18n, 'decks.hub.builder.desc')}
          </p>

          {/* CTA arrow */}
          <div class="mt-5 flex items-center gap-2 text-[var(--accent)] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
            <span class="text-xs font-mono tracking-[0.3em] uppercase">{t(i18n, 'decks.hub.builder.cta')}</span>
            <span class="text-base">{'\u2192'}</span>
          </div>

          {/* Bottom accent line */}
          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-1/2 h-px bg-[var(--accent)] transition-all duration-700" />
        </a>

        {/* ════════════ BROWSE DECKS ════════════ */}
        <a
          href="/decks/browse"
          class="group relative flex flex-col items-center justify-center overflow-hidden
                 bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.8)]
                 border border-[rgba(51,51,51,0.15)]
                 hover:border-[rgba(70,151,195,0.4)] transition-all duration-500
                 min-h-[40vh] md:min-h-0"
        >
          {/* Background radial glow on hover */}
          <div
            class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
            style="background: radial-gradient(ellipse at 50% 60%, rgba(70,151,195,0.08) 0%, transparent 60%)"
          />

          {/* Decorative corner brackets */}
          <div class="absolute top-4 left-4 w-5 h-5 border-t border-l border-[rgba(70,151,195,0.2)] group-hover:border-[rgba(70,151,195,0.5)] transition-colors duration-500" />
          <div class="absolute bottom-4 right-4 w-5 h-5 border-b border-r border-[rgba(70,151,195,0.2)] group-hover:border-[rgba(70,151,195,0.5)] transition-colors duration-500" />

          {/* Section tag */}
          <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 group-hover:opacity-100 transition-opacity duration-500 mb-4">
            // {t(i18n, 'decks.hub.tag')}
          </span>

          {/* Icon with WIP badge */}
          <div class="relative mb-5">
            <GameIcon
              src={encodeIconPath(UtilIconPaths.DECK)}
              size={64}
              alt="Browse Decks"
              variant="white"
              glow
            />
            {/* Soft ring behind icon */}
            <div
              class="absolute inset-0 -m-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style="background: radial-gradient(circle, rgba(70,151,195,0.12) 0%, transparent 70%)"
            />
          </div>

          {/* Title */}
          <h2 class="text-xl md:text-2xl font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-300 mb-2 relative z-10">
            {t(i18n, 'decks.hub.browse.title')}
          </h2>

          {/* Description */}
          <p class="text-[12px] text-[var(--text-dim)] max-w-sm text-center leading-relaxed relative z-10 px-6">
            {t(i18n, 'decks.hub.browse.desc')}
          </p>

          {/* CTA arrow */}
          <div class="mt-5 flex items-center gap-2 text-[var(--accent)] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
            <span class="text-xs font-mono tracking-[0.3em] uppercase">{t(i18n, 'decks.hub.browse.cta')}</span>
            <span class="text-base">{'\u2192'}</span>
          </div>

          {/* Bottom accent line */}
          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-1/2 h-px bg-[var(--accent)] transition-all duration-700" />
        </a>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'BA HUB - Decks',
  meta: [
    {
      name: 'description',
      content: 'Build your own deployment decks or browse community strategies for Broken Arrow.',
    },
  ],
};
