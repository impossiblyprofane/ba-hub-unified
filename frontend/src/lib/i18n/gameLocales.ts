import type { Locale } from './types';
import allLocales from './gameLocales/all_locales.json';

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

const ALL = allLocales as GameLocaleTable;

/**
 * All three aliases point to the single unified locale table.
 * Backward-compatible: consumers still access GAME_LOCALES.specs / .maps / .modopts.
 */
export const GAME_LOCALES = {
  specs: ALL,
  maps: ALL,
  modopts: ALL,
} as const;

/** Lower-case key → original key map for case-insensitive fallback. */
const CI_INDEX: Map<string, string> = new Map(
  Object.keys(ALL).map((k) => [k.toLowerCase(), k]),
);

/** Resolve a row from a locale table with case-insensitive fallback. */
function resolveRow(table: GameLocaleTable, key: string): GameLocaleRow | undefined {
  const row = table[key];
  if (row) return row;
  const canon = CI_INDEX.get(key.toLowerCase());
  return canon ? table[canon] : undefined;
}

export const getGameLocaleValue = (
  table: GameLocaleTable,
  key: string,
  locale: Locale,
  fallbackLocale: Locale = 'en',
): string => {
  const row = resolveRow(table, key);
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