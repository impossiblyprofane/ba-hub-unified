import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import type { IconVariant } from '~/components/GameIcon';
import { UtilIconPaths, encodeIconPath } from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';

const FEATURES: {
  key: string;
  href: string;
  icon: string;
  variant: IconVariant;
  /** When true, card is placed in the 3-wide primary row */
  primary?: boolean;
}[] = [
  { key: 'arsenal',     href: '/arsenal',    icon: encodeIconPath(UtilIconPaths.POINTS),             variant: 'white', primary: true },
  { key: 'decks',       href: '/decks',      icon: encodeIconPath(UtilIconPaths.DECK),               variant: 'white', primary: true },
  { key: 'maps',        href: '/maps',       icon: encodeIconPath(UtilIconPaths.LOCATION_MAP),       variant: 'white', primary: true },
  { key: 'playerStats', href: '/stats',      icon: encodeIconPath(UtilIconPaths.KILL_DEATH_RATIO),   variant: 'white' },
  { key: 'mapStats',    href: '/stats/maps', icon: encodeIconPath(UtilIconPaths.TASK_MARKER_TASK),    variant: 'white' },
  { key: 'guides',      href: '/guides',     icon: encodeIconPath(UtilIconPaths.LEAST_FAVORITE_SPEC), variant: 'white' },
];

/** Reusable hero nav card — matches /decks hub pattern */
function HeroCard(props: {
  href: string;
  icon: string;
  variant: IconVariant;
  title: string;
  tag: string;
  desc: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <a
      href={props.href}
      class={`group relative flex flex-col items-center justify-center overflow-hidden
              bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.8)]
              border border-[rgba(51,51,51,0.15)]
              hover:border-[rgba(70,151,195,0.4)] transition-all duration-500
              ${props.primary ? 'min-h-[28vh]' : 'min-h-[20vh]'} py-6`}
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
      <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.4em] uppercase opacity-40 group-hover:opacity-100 transition-opacity duration-500 mb-3">
        {props.tag}
      </span>

      {/* Icon with glow ring */}
      <div class="relative mb-4">
        <GameIcon
          src={props.icon}
          size={props.primary ? 56 : 44}
          alt={props.title}
          variant={props.variant}
          glow
        />
        <div
          class="absolute inset-0 -m-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style="background: radial-gradient(circle, rgba(70,151,195,0.12) 0%, transparent 70%)"
        />
      </div>

      {/* Title */}
      <h2 class={`font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-300 mb-1.5 relative z-10 ${
        props.primary ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'
      }`}>
        {props.title}
      </h2>

      {/* Description */}
      <p class="text-[12px] text-[var(--text-dim)] max-w-xs text-center leading-relaxed relative z-10 px-6">
        {props.desc}
      </p>

      {/* CTA arrow */}
      <div class="mt-4 flex items-center gap-2 text-[var(--accent)] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
        <span class="text-xs font-mono tracking-[0.3em] uppercase">{props.cta}</span>
        <span class="text-base">{"\u2192"}</span>
      </div>

      {/* Bottom accent line */}
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-1/2 h-px bg-[var(--accent)] transition-all duration-700" />
    </a>
  );
}

export default component$(() => {
  const i18n = useI18n();
  const primary = FEATURES.filter(f => f.primary);
  const secondary = FEATURES.filter(f => !f.primary);

  return (
    <div class="w-full">
      {/* ── Hero banner — compact identity strip ── */}
      <div class="relative mb-px py-5 flex flex-col items-center justify-center border border-[rgba(51,51,51,0.15)] bg-gradient-to-b from-[rgba(26,26,26,0.5)] to-[rgba(26,26,26,0.8)] overflow-hidden">
        {/* Soft background glow */}
        <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse at 50% 80%, rgba(70,151,195,0.05) 0%, transparent 50%)" />
        <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.5em] uppercase opacity-50 mb-2 relative z-10">
          {t(i18n, 'home.tag')}
        </span>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text)] flex items-center gap-3 relative z-10">
          <img src="/images/bahub.svg" alt="BA Hub" width={32} height={32} style="width: 32px; height: 32px" />
          {t(i18n, 'home.title')}{' '}—{' '}<span class="text-[var(--accent)]">{t(i18n, 'home.titleAccent')}</span>
        </h1>
        <p class="text-[12px] text-[var(--text-dim)] mt-2 max-w-lg text-center leading-relaxed relative z-10">
          {t(i18n, 'home.subtitle')}
        </p>
      </div>

      {/* ── Primary features — 3-wide row ── */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-px">
        {primary.map(f => (
          <HeroCard
            key={f.href}
            href={f.href}
            icon={f.icon}
            variant={f.variant}
            title={t(i18n, `home.feature.${f.key}`)}
            tag={t(i18n, `home.feature.${f.key}.tag`)}
            desc={t(i18n, `home.feature.${f.key}.desc`)}
            cta={t(i18n, `home.feature.${f.key}.cta`)}
            primary
          />
        ))}
      </div>

      {/* ── Secondary features — 3-wide row, slightly shorter ── */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-px mt-px">
        {secondary.map(f => (
          <HeroCard
            key={f.href}
            href={f.href}
            icon={f.icon}
            variant={f.variant}
            title={t(i18n, `home.feature.${f.key}`)}
            tag={t(i18n, `home.feature.${f.key}.tag`)}
            desc={t(i18n, `home.feature.${f.key}.desc`)}
            cta={t(i18n, `home.feature.${f.key}.cta`)}
          />
        ))}
      </div>

      {/* ── Community callout strip ── */}
      <div class="mt-px flex items-center justify-between gap-4 px-6 py-4 border border-[rgba(51,51,51,0.15)] bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.7)]">
        <span class="text-[var(--text-dim)] text-[11px] font-mono">
          {t(i18n, 'home.community.body')}
        </span>
        <div class="flex items-center gap-3 shrink-0">
          <a
            href="https://ko-fi.com/impossiblyprofane"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 bg-[var(--accent)] text-[var(--bg)] text-[10px] font-mono font-semibold tracking-wide uppercase hover:bg-[var(--accent-hi)] transition-colors"
          >
            {t(i18n, 'home.community.cta')}
          </a>
          <a
            href="https://discord.gg/Z8JqbQmssg"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono tracking-wide uppercase hover:text-[var(--text)] hover:border-[var(--text-dim)] transition-colors"
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
