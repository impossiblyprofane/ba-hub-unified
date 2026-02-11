import { component$, useStore, $, useOnDocument, createContextId, useContext, useContextProvider } from '@builder.io/qwik';
import { useI18n, setLocale, LOCALES, type Locale } from '~/lib/i18n';
import { IconGlobe } from '~/components/icons';

/* ── Shared state between trigger & dropdown ── */
export interface LocaleMenuState {
  open: boolean;
  top: number;
  left: number;
}
export const LocaleMenuCtx = createContextId<LocaleMenuState>('locale-menu');

/** Call once in layout to wire up shared state + outside-click / Escape */
export const useLocaleMenuProvider = () => {
  const state = useStore<LocaleMenuState>({ open: false, top: 0, left: 0 });
  useContextProvider(LocaleMenuCtx, state);

  useOnDocument(
    'click',
    $((e: Event) => {
      if (state.open) {
        const target = e.target as HTMLElement;
        if (!target.closest('.locale-dropdown')) {
          state.open = false;
          document.querySelector('.sidebar-nav')?.classList.remove('locale-open');
        }
      }
    }),
  );
  useOnDocument(
    'keydown',
    $((e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        state.open = false;
        document.querySelector('.sidebar-nav')?.classList.remove('locale-open');
      }
    }),
  );

  return state;
};

/**
 * Trigger button — lives inside the nav sidebar.
 */
export const LanguageSelectorButton = component$(() => {
  const i18n = useI18n();
  const menu = useContext(LocaleMenuCtx);

  return (
    <button
      class="nav-item-row w-full px-3 py-2 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
      onClick$={(e: MouseEvent) => {
        e.stopPropagation();
        const btn = (e.target as HTMLElement).closest('button') as HTMLElement;
        const nav = btn.closest('.sidebar-nav') as HTMLElement;
        const navRect = nav.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        // Align dropdown flush with sidebar right edge
        menu.left = navRect.right + 4;
        menu.top = btnRect.bottom;
        menu.open = !menu.open;
        // Keep sidebar expanded while dropdown is open
        if (menu.open) {
          nav.classList.add('locale-open');
        } else {
          nav.classList.remove('locale-open');
        }
      }}
      aria-label="Select language"
      aria-expanded={menu.open}
      aria-haspopup="listbox"
    >
      <span class="nav-icon"><IconGlobe size={18} /></span>
      <span class="nav-label text-xs tracking-wide uppercase">{i18n.locale}</span>
    </button>
  );
});

/**
 * Floating dropdown — must be rendered OUTSIDE the <nav> in the layout
 * so it escapes transform / backdrop-blur containing blocks.
 */
export const LanguageSelectorDropdown = component$(() => {
  const i18n = useI18n();
  const menu = useContext(LocaleMenuCtx);

  if (!menu.open) return null;

  return (
    <div
      class="locale-dropdown"
      style={{
        top: `${menu.top}px`,
        left: `${menu.left}px`,
      }}
      role="listbox"
      onClick$={async (e: MouseEvent) => {
        const btn = (e.target as HTMLElement).closest('[data-locale]') as HTMLElement | null;
        if (btn) {
          await setLocale(i18n, btn.dataset.locale as Locale);
          menu.open = false;
          document.querySelector('.sidebar-nav')?.classList.remove('locale-open');
        }
        e.stopPropagation();
      }}
    >
      {LOCALES.map((loc) => (
        <button
          key={loc.code}
          data-locale={loc.code}
          role="option"
          aria-selected={loc.code === i18n.locale}
          class={[
            'locale-option',
            loc.code === i18n.locale && 'active',
          ].filter(Boolean).join(' ')}
        >
          <span class="locale-flag">{loc.flag}</span>
          <span class="locale-label">{loc.label}</span>
          <span class="locale-code">{loc.code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
});
