/** Supported locale codes */
export type Locale = 'en' | 'ru' | 'de' | 'fr' | 'zh' | 'es' | 'pt' | 'ko' | 'ja';

/** Locale metadata for display in the selector */
export interface LocaleInfo {
  code: Locale;
  /** Native-language name */
  label: string;
  /** Short flag/emoji for compact display */
  flag: string;
}

/** All supported locales */
export const LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
];

export const DEFAULT_LOCALE: Locale = 'en';

/** Flat translation dictionary — dot-notated keys */
export type TranslationDict = Record<string, string>;
