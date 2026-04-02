/**
 * PublishedDeckCard — summary card for a published deck in the browse grid.
 *
 * Shows: country flag, name, specs, tags, likes/views, date.
 * Links to /decks/browse/{id}.
 */
import { component$ } from '@builder.io/qwik';
import type { PublishedDeckSummary } from '~/lib/graphql-types';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import { DECK_TAG_I18N } from '@ba-hub/shared';
import type { DeckTag } from '@ba-hub/shared';
import { GameIcon } from '~/components/GameIcon';
import { toCountryIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import type { ArsenalCountry, ArsenalSpecialization } from '~/lib/graphql-types';

interface PublishedDeckCardProps {
  deck: PublishedDeckSummary;
  countries: ArsenalCountry[];
  specializations: ArsenalSpecialization[];
}

export const PublishedDeckCard = component$<PublishedDeckCardProps>(
  ({ deck, countries, specializations }) => {
    const i18n = useI18n();
    const country = countries.find((c) => c.Id === deck.countryId);
    const spec1 = specializations.find((s) => s.Id === deck.spec1Id);
    const spec2 = specializations.find((s) => s.Id === deck.spec2Id);

    const countryName = country
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, country.Name, i18n.locale as Locale)
      : '';
    const spec1Name = spec1
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, spec1.UIName, i18n.locale as Locale)
      : '';
    const spec2Name = spec2
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, spec2.UIName, i18n.locale as Locale)
      : '';

    const ago = formatTimeAgo(deck.createdAt);

    return (
      <a
        href={`/decks/browse/${deck.id}`}
        class="block p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)] transition-colors group"
      >
        {/* Header row: country flag + deck name */}
        <div class="flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(51,51,51,0.3)]">
          {country?.FlagFileName && (
            <GameIcon
              src={toCountryIconPath(country.FlagFileName)}
              alt={countryName}
              size={18}
              class="icon-white shrink-0"
            />
          )}
          <span class="text-sm text-[var(--text)] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
            {deck.name}
          </span>
        </div>

        <div class="px-3 py-2.5 space-y-2">
          {/* Publisher */}
          {deck.publisherName && (
            <p class="text-[10px] font-mono text-[var(--text-dim)]">
              {t(i18n, 'decks.detail.by')} <span class="text-[var(--text)]">{deck.publisherName}</span>
            </p>
          )}

          {/* Specs */}
          <div class="flex items-center gap-2">
            {spec1?.Icon && (
              <GameIcon
                src={toSpecializationIconPath(spec1.Icon)}
                alt={spec1Name}
                size={14}
                class="icon-white"
              />
            )}
            <span class="text-[10px] font-mono text-[var(--text-dim)]">{spec1Name}</span>
            <span class="text-[var(--border)] text-[10px]">+</span>
            {spec2?.Icon && (
              <GameIcon
                src={toSpecializationIconPath(spec2.Icon)}
                alt={spec2Name}
                size={14}
                class="icon-white"
              />
            )}
            <span class="text-[10px] font-mono text-[var(--text-dim)]">{spec2Name}</span>
          </div>

          {/* Tags */}
          {deck.tags.length > 0 && (
            <div class="flex flex-wrap gap-1">
              {deck.tags.map((tag) => (
                <span
                  key={tag}
                  class="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)]"
                >
                  {t(i18n, DECK_TAG_I18N[tag as DeckTag])}
                </span>
              ))}
            </div>
          )}

          {/* Description preview */}
          {deck.description && (
            <p class="text-[11px] text-[var(--text-dim)] line-clamp-2 leading-relaxed">
              {deck.description}
            </p>
          )}

          {/* Footer: likes / views / date */}
          <div class="flex items-center gap-3 text-[10px] font-mono text-[var(--text-dim)] pt-1">
            <span>♥ {deck.likeCount}</span>
            <span>👁 {deck.viewCount}</span>
            <span class="ml-auto">{ago}</span>
          </div>
        </div>
      </a>
    );
  },
);

/** Format an ISO date string to a relative time string (e.g. "2d ago"). */
function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
