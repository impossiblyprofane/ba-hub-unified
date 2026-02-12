import type { Locale } from './types';
import specs from './gameLocales/specs.json';
import maps from './gameLocales/maps.json';
import modopts from './gameLocales/modopts.json';

export type GameLocaleRow = Record<string, string | undefined>;
export type GameLocaleTable = Record<string, GameLocaleRow>;

const LOCALE_COLUMN: Record<Locale, string> = {
  en: 'col_1',
  ru: 'col_2',
  de: 'col_3',
  zh: 'col_4',
  es: 'col_5',
  fr: 'col_6',
  ja: 'col_7',
  pt: 'col_8',
  ko: 'col_10',
};

const FALLBACK_COLUMN = 'col_1';

export const GAME_LOCALES = {
  specs: specs as GameLocaleTable,
  maps: maps as GameLocaleTable,
  modopts: modopts as GameLocaleTable,
} as const;

export const getGameLocaleValue = (
  table: GameLocaleTable,
  key: string,
  locale: Locale,
  fallbackLocale: Locale = 'en',
): string => {
  const row = table[key];
  if (!row) return key;

  const primaryCol = LOCALE_COLUMN[locale] ?? FALLBACK_COLUMN;
  const fallbackCol = LOCALE_COLUMN[fallbackLocale] ?? FALLBACK_COLUMN;

  const primary = row[primaryCol]?.trim();
  if (primary) return primary;

  const fallback = row[fallbackCol]?.trim();
  if (fallback) return fallback;

  return row[FALLBACK_COLUMN]?.trim() || key;
};

export const getGameLocaleValueOrKey = (
  table: GameLocaleTable,
  key: string | null | undefined,
  locale: Locale,
  fallbackLocale: Locale = 'en',
): string => {
  if (!key) return '';
  return getGameLocaleValue(table, key, locale, fallbackLocale);
};