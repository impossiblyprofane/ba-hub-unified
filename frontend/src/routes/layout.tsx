import { component$, Slot, useSignal } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import type { RequestHandler } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths, encodeIconPath } from '~/lib/iconPaths';
import { IconSearch } from '~/components/icons';
import { LanguageSelectorButton, LanguageSelectorDropdown, useLocaleMenuProvider } from '~/components/LanguageSelector';
import { useI18nProvider, useI18n, t } from '~/lib/i18n';

// Metadata for SEO (will be customized per route)
export const onGet: RequestHandler = async ({ headers, url }) => {
  // Metadata-only SSR for link previews
  headers.set('Cache-Control', 'public, max-age=3600');
};

const NAV_ITEMS = [
  { i18nKey: 'nav.home', href: '/', icon: encodeIconPath(UtilIconPaths.ORDER_BACK_TO_BASE) },
  { i18nKey: 'nav.arsenal', href: '/arsenal', icon: encodeIconPath(UtilIconPaths.POINTS) },
  { i18nKey: 'nav.deckArsenal', href: '/decks', icon: encodeIconPath(UtilIconPaths.DECK) },
  { i18nKey: 'nav.deckBuilder', href: '/deck-builder', icon: UtilIconPaths.DECK_OUTLINE },
  { i18nKey: 'nav.maps', href: '/maps', icon: encodeIconPath(UtilIconPaths.LOCATION_MAP) },
  { i18nKey: 'nav.statistics', href: '/stats', icon: encodeIconPath(UtilIconPaths.KILL_DEATH_RATIO) },
  { i18nKey: 'nav.guides', href: '/guides', icon: encodeIconPath(UtilIconPaths.LEAST_FAVORITE_SPEC) },
];

export default component$(() => {
  useI18nProvider();
  useLocaleMenuProvider();
  const i18n = useI18n();
  const searchQuery = useSignal('');
  const nav = useNavigate();

  return (
    <div
      class="min-h-screen bg-[var(--bg)]"
      onClick$={async (e: MouseEvent) => {
        // Intercept internal link clicks for View Transitions
        const link = (e.target as HTMLElement).closest('a[href^="/"]') as HTMLElement | null;
        if (!link) return;
        e.preventDefault();
        const href = link.getAttribute('href')!;
        const doc = document as any;
        if (doc.startViewTransition) {
          doc.startViewTransition(async () => {
            await nav(href);
          });
        } else {
          await nav(href);
        }
      }}
    >
      {/* Animated grid background */}
      <div class="bg-grid" aria-hidden="true" />

      {/* Left Navigation — icon rail, expands on hover */}
      <nav class="sidebar-nav fixed left-4 top-1/2 -translate-y-1/2 z-40 bg-[var(--bg-raised)]/90 backdrop-blur-sm border border-[var(--border)] max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden">
        <div class="py-4 flex flex-col items-center">
          {/* Logo */}
          <div class="nav-item-row justify-center mb-1 px-2">
            <span class="nav-icon"><img src="/images/bahub.svg" alt="BA Hub" width={20} height={20} style={{ width: '20px', height: '20px' }} /></span>
            <span class="nav-label text-xs font-semibold tracking-[0.15em] uppercase text-[var(--text)]" style={{ fontFamily: 'var(--mono)' }}>BA-HUB</span>
          </div>
          <div class="flex items-center justify-center gap-1.5 mb-4">
            <span class="pulse-dot" />
            <span class="nav-label text-[10px] text-[var(--green)] status-blink" style={{ fontFamily: 'var(--mono)' }}>ONLINE</span>
          </div>

          {/* Main nav links */}
          <div class="w-full space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                class="nav-glow nav-item-row px-3 py-2 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span class="nav-icon"><GameIcon src={item.icon} size={18} alt={t(i18n, item.i18nKey)} variant="white" /></span>
                <span class="nav-label text-xs tracking-wide">{t(i18n, item.i18nKey)}</span>
              </a>
            ))}
          </div>

          <hr class="my-3 border-[var(--border)] w-full" />

          {/* Utility links */}
          <div class="w-full space-y-0.5">
            <a
              href="https://discord.gg/Z8JqbQmssg"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-item-row px-3 py-2 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span class="nav-icon"><GameIcon src={encodeIconPath(UtilIconPaths.DISCORD_ICON)} size={18} alt="Discord" variant="white" /></span>
              <span class="nav-label text-xs tracking-wide">{t(i18n, 'nav.discord')}</span>
            </a>
            <a
              href="https://discord.gg/e9ZVRHBX8V"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-item-row px-3 py-2 text-[var(--text-dim)] hover:text-[var(--amber)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span class="nav-icon"><GameIcon src={encodeIconPath(UtilIconPaths.WARNING_ORANGE)} size={18} alt="Bug Report" /></span>
              <span class="nav-label text-xs tracking-wide">{t(i18n, 'nav.bugReport')}</span>
            </a>
            <a
              href="https://ko-fi.com/impossiblyprofane"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-item-row px-3 py-2 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span class="nav-icon"><GameIcon src={encodeIconPath(UtilIconPaths.LIKE_ACTIVE)} size={18} alt="Support" variant="white" /></span>
              <span class="nav-label text-xs tracking-wide">{t(i18n, 'nav.support')}</span>
            </a>
            <LanguageSelectorButton />
          </div>
        </div>
      </nav>

      {/* Locale dropdown — rendered outside <nav> to escape transform/overflow containing block */}
      <LanguageSelectorDropdown />

      {/* Tactical status bar — fixed top-left, offset past sidebar */}
      <div class="fixed top-4 left-20 z-30 flex items-center gap-4 text-[10px] text-[var(--text-dim)]" style={{ fontFamily: 'var(--mono)' }}>
        <span class="flex items-center gap-1.5">
          <span class="pulse-dot" />
          <span class="text-[var(--green)]">{t(i18n, 'home.status.active')}</span>
        </span>
        <span class="border-l border-[var(--border)] pl-4 status-blink">{t(i18n, 'home.status.nodes')}</span>
        <span class="border-l border-[var(--border)] pl-4">v3.0.0</span>
      </div>

      {/* Top Search Bar - Fixed top, horizontally centered */}
      <div class="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div class="w-80 bg-[var(--bg-raised)]/90 backdrop-blur-sm border border-[var(--border)] pointer-events-auto">
          <div class="px-3 py-2 flex items-center gap-2">
            <IconSearch size={14} class="text-[var(--text-dim)] shrink-0" />
            <input
              type="text"
              placeholder={t(i18n, 'nav.search')}
              value={searchQuery.value}
              onInput$={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
              class="w-full bg-transparent text-[var(--text)] text-sm placeholder-[var(--text-dim)] focus:outline-none"
              style={{ fontFamily: 'var(--mono)' }}
              onKeyDown$={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                  e.preventDefault();
                }
              }}
            />
            <kbd class="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1.5 py-0.5 shrink-0" style={{ fontFamily: 'var(--mono)' }}>⌘K</kbd>
          </div>
        </div>
      </div>

      {/* Main Content — offset for collapsed nav width */}
      <div class="pl-20 min-h-screen flex flex-col">
        <main class="flex-1 pt-16 pb-8 flex justify-center">
          <div class="w-full max-w-5xl px-8" style={{ viewTransitionName: 'page-content' }}>
            <Slot />
          </div>
        </main>

        <footer class="border-t border-[var(--border)] py-4 px-6" style={{ fontFamily: 'var(--mono)' }}>
          <div class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] text-[var(--text-dim)]">
            <span class="text-[var(--text)] font-semibold">BA-HUB</span>
            <span class="text-[var(--border)]">/</span>
            <span>{t(i18n, 'footer.community')}</span>
            <span class="text-[var(--border)]">/</span>
            <a href="https://ko-fi.com/impossiblyprofane" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--accent)] transition-colors">{t(i18n, 'footer.support')}</a>
            <span class="text-[var(--border)]">/</span>
            <a href="https://discord.gg/Z8JqbQmssg" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--accent)] transition-colors">{t(i18n, 'footer.discord')}</a>
            <span class="text-[var(--border)]">/</span>
            <a href="https://discord.gg/e9ZVRHBX8V" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--amber)] transition-colors">{t(i18n, 'footer.bugReport')}</a>
          </div>
          <p class="text-center text-[9px] text-[var(--text-dim)] opacity-50 mt-2">
            {t(i18n, 'footer.disclaimer')} {t(i18n, 'footer.rights')}
          </p>
        </footer>
      </div>
    </div>
  );
});
