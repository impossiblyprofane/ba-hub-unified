import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import type { IconVariant } from '~/components/GameIcon';
import { UtilIconPaths, encodeIconPath } from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';

const FEATURES: {
  i18nKey: string;
  tagKey: string;
  href: string;
  icon: string;
  variant: IconVariant;
}[] = [
  {
    i18nKey: 'home.feature.arsenal',
    tagKey: 'home.feature.arsenal.tag',
    href: '/arsenal',
    icon: encodeIconPath(UtilIconPaths.POINTS),
    variant: 'white',
  },
  {
    i18nKey: 'home.feature.deckBuilder',
    tagKey: 'home.feature.deckBuilder.tag',
    href: '/deck-builder',
    icon: encodeIconPath(UtilIconPaths.DECK),
    variant: 'white',
  },
  {
    i18nKey: 'home.feature.maps',
    tagKey: 'home.feature.maps.tag',
    href: '/maps',
    icon: encodeIconPath(UtilIconPaths.LOCATION_MAP),
    variant: 'white',
  },
  {
    i18nKey: 'home.feature.playerStats',
    tagKey: 'home.feature.playerStats.tag',
    href: '/stats',
    icon: encodeIconPath(UtilIconPaths.KILL_DEATH_RATIO),
    variant: 'white',
  },
  {
    i18nKey: 'home.feature.mapStats',
    tagKey: 'home.feature.mapStats.tag',
    href: '/stats/maps',
    icon: encodeIconPath(UtilIconPaths.TASK_MARKER_TASK),
    variant: 'white',
  },
  {
    i18nKey: 'home.feature.guides',
    tagKey: 'home.feature.guides.tag',
    href: '/guides',
    icon: encodeIconPath(UtilIconPaths.LEAST_FAVORITE_SPEC),
    variant: 'white',
  },
];

export default component$(() => {
  const i18n = useI18n();

  return (
    <div class="max-w-6xl relative">
      {/* Hero Section */}
      <div class="mb-16 relative">
        <div class="hero-glow" />

        <div class="corner-brackets p-6 border border-[var(--border)] bg-[var(--bg-raised)]/50 relative z-10">
          <p class="text-[var(--accent)] text-xs tracking-[0.2em] uppercase mb-3 opacity-60" style="font-family: var(--mono)">{t(i18n, 'home.tag')}</p>
          <h1 class="text-3xl font-bold tracking-tight mb-4 text-[var(--text)] flex items-center gap-3">
            <img src="/images/bahub.svg" alt="BA Hub" width={36} height={36} style="width: 36px; height: 36px" />
            {t(i18n, 'home.title')} — <span class="text-[var(--accent)]">{t(i18n, 'home.titleAccent')}</span>
          </h1>
          <p class="text-[var(--text-dim)] text-sm leading-relaxed max-w-xl">
            {t(i18n, 'home.subtitle')}
          </p>
        </div>
      </div>

      {/* Features Grid — hero icon tiles */}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        {FEATURES.map((feature) => (
          <a
            key={feature.href}
            href={feature.href}
            class="feature-card group"
          >
            <GameIcon
              src={feature.icon}
              size={44}
              alt={t(i18n, feature.i18nKey)}
              variant={feature.variant}
              glow
            />
            <span class="fc-label">{t(i18n, feature.i18nKey)}</span>
            <span class="fc-tag">{t(i18n, feature.tagKey)}</span>
          </a>
        ))}
      </div>

      {/* Community callout */}
      <div class="mt-16 flex items-center justify-between gap-4 px-5 py-3 border border-[var(--border)] bg-[var(--bg-raised)]/50 text-[11px]" style="font-family: var(--mono)">
        <span class="text-[var(--text-dim)]">
          {t(i18n, 'home.community.body')}
        </span>
        <div class="flex items-center gap-3 shrink-0">
          <a
            href="https://ko-fi.com/impossiblyprofane"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 bg-[var(--accent)] text-[var(--bg)] text-[10px] font-semibold tracking-wide uppercase hover:bg-[var(--accent-hi)] transition-colors"
          >
            {t(i18n, 'home.community.cta')}
          </a>
          <a
            href="https://discord.gg/Z8JqbQmssg"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] tracking-wide uppercase hover:text-[var(--text)] hover:border-[var(--text-dim)] transition-colors"
          >
            Discord
          </a>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'BA Hub - Broken Arrow Stats Viewer',
  meta: [
    {
      name: 'description',
      content: 'Comprehensive Broken Arrow toolkit. Browse units, build decks, analyze maps, and track competitive performance.',
    },
    {
      property: 'og:title',
      content: 'BA Hub - Broken Arrow Toolkit',
    },
    {
      property: 'og:description',
      content: 'Browse units, build decks, analyze maps, and track competitive performance.',
    },
  ],
};
