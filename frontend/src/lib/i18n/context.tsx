import {
  createContextId,
  useContext,
  useContextProvider,
  useStore,
  useVisibleTask$,
} from '@builder.io/qwik';
import type { Locale, TranslationDict } from './types';
import { DEFAULT_LOCALE } from './types';
import en from './locales/en';

/* ── Context shape ─────────────────────────────── */

export interface I18nStore {
  locale: Locale;
  dict: TranslationDict;
}

export const I18nContext = createContextId<I18nStore>('ba-hub.i18n');

/* ── Dynamic loader ────────────────────────────── */

const loadDict = async (locale: Locale): Promise<TranslationDict> => {
  switch (locale) {
    case 'ru': return (await import('./locales/ru')).default;
    case 'de': return (await import('./locales/de')).default;
    case 'fr': return (await import('./locales/fr')).default;
    case 'es': return (await import('./locales/es')).default;
    case 'pt': return (await import('./locales/pt')).default;
    case 'zh': return (await import('./locales/zh')).default;
    case 'ko': return (await import('./locales/ko')).default;
    case 'ja': return (await import('./locales/ja')).default;
    default:   return en;
  }
};

/* ── Provider hook (call once in layout) ───────── */

export const useI18nProvider = () => {
  const store = useStore<I18nStore>({
    locale: DEFAULT_LOCALE,
    dict: en,
  });

  // Hydrate from localStorage on client
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const saved = window.localStorage.getItem('ba-hub-locale') as Locale | null;
    if (saved && saved !== store.locale) {
      loadDict(saved).then((d) => {
        store.locale = saved;
        store.dict = d;
      });
    }
  });

  useContextProvider(I18nContext, store);
  return store;
};

/* ── Consumer hooks ────────────────────────────── */

/** Returns the reactive i18n store */
export const useI18n = () => useContext(I18nContext);

/** Translation lookup — falls back to EN, then to raw key */
export const t = (store: I18nStore, key: string): string => {
  return store.dict[key] ?? en[key] ?? key;
};

/** Switch locale (persist + load dict) — plain function, call inside $() handlers */
export const setLocale = async (store: I18nStore, locale: Locale) => {
  if (locale === store.locale) return;
  const dict = await loadDict(locale);
  store.locale = locale;
  store.dict = dict;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('ba-hub-locale', locale);
  }
};
