import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';

export default component$(() => {
  const i18n = useI18n();

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">{t(i18n, 'maps.tag')}</p>
        <h1 class="text-3xl font-semibold text-[var(--text)] tracking-tight">{t(i18n, 'maps.title')}</h1>
        <p class="text-sm text-[var(--text-dim)] mt-2 max-w-2xl">{t(i18n, 'maps.subtitle')}</p>
      </div>

      <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
          {t(i18n, 'common.underConstruction')}
        </p>
        <div class="px-4 py-12 flex flex-col items-center justify-center gap-3 text-center">
          <p class="text-[var(--accent)] text-xl font-mono tracking-widest uppercase">{t(i18n, 'common.comingSoon')}</p>
          <p class="text-sm text-[var(--text-dim)] max-w-lg">{t(i18n, 'maps.comingSoon')}</p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Maps & Tactics - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Interactive map viewer with tactical overlays and terrain analysis.',
    },
  ],
};
