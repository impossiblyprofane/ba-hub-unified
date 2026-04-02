/**
 * ReadonlyDeckSlotCard — readonly version of DeckSlotCard for the published
 * deck detail page. Same visual design (portrait, icon, name, count, cost,
 * transport bar) but no edit controls (no rails, no delete, no context menu).
 *
 * Clicking the card calls onSlotClick$ to open the readonly unit panel.
 */
import { component$ } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { UnitConfig, Set2Key } from '@ba-hub/shared';
import type { ArsenalCard } from '~/lib/graphql-types';
import { toUnitIconPath, toPortraitIconPath } from '~/lib/iconPaths';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import { GAME_LOCALES, getGameLocaleValueOrKey, useI18n, t } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import { resolveUnitDisplayName, resolveTransportDisplayName } from '~/lib/deck';

interface ReadonlyDeckSlotCardProps {
  unit: UnitConfig;
  slotIndex: number;
  category: Set2Key;
  arsenalCard?: ArsenalCard;
  transportCard?: ArsenalCard;
  locale: Locale;
  onSlotClick$: PropFunction<(category: Set2Key, slotIndex: number) => void>;
}

export const ReadonlyDeckSlotCard = component$<ReadonlyDeckSlotCardProps>(
  ({ unit, slotIndex, category, arsenalCard, transportCard, locale, onSlotClick$ }) => {
    const i18n = useI18n();
    const isEmpty = !unit.unitId;

    /* ── Empty slot ── */
    if (isEmpty) {
      return (
        <div class="flex items-center justify-center bg-[rgba(26,26,26,0.15)] min-h-[76px] border border-[rgba(51,51,51,0.1)]" />
      );
    }

    /* ── Filled slot — resolve display data ── */
    const unitName = arsenalCard
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, arsenalCard.unit.HUDName, locale) || arsenalCard.unit.HUDName
      : `Unit ${unit.unitId}`;
    const displayName = resolveUnitDisplayName(unit, unitName);
    const cost = arsenalCard?.unit.Cost ?? 0;
    const modCost = unit.modList.reduce((s, m) => s + (m.cost ?? 0), 0);
    const totalUnitCost = (cost + modCost) * (unit.count ?? 1);

    /* Resolve thumbnail / portrait overrides from modifications */
    const mainThumbOverride = unit.modList.reduce<string | undefined>((acc, m) => m.thumbnailOverride || acc, undefined);
    const mainPortraitOverride = unit.modList.reduce<string | undefined>((acc, m) => m.portraitOverride || acc, undefined);
    const thumbnail = mainThumbOverride ?? arsenalCard?.unit.ThumbnailFileName;
    const portrait = mainPortraitOverride ?? arsenalCard?.unit.PortraitFileName;

    const tranName = transportCard
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, transportCard.unit.HUDName, locale) || transportCard.unit.HUDName
      : unit.tranId ? `Transport ${unit.tranId}` : null;
    const tranDisplayName = tranName ? resolveTransportDisplayName(unit, tranName) : null;
    const tranModCost = (unit.modListTr ?? []).reduce((s, m) => s + (m.cost ?? 0), 0);
    const tranCost = transportCard ? (transportCard.unit.Cost + tranModCost) * (unit.tranCount ?? 1) : 0;

    const tranThumbOverride = (unit.modListTr ?? []).reduce<string | undefined>((acc, m) => m.thumbnailOverride || acc, undefined);
    const tranPortraitOverride = (unit.modListTr ?? []).reduce<string | undefined>((acc, m) => m.portraitOverride || acc, undefined);
    const tranThumbnail = tranThumbOverride ?? transportCard?.unit.ThumbnailFileName;
    const tranPortrait = tranPortraitOverride ?? transportCard?.unit.PortraitFileName;

    const hasTransport = !!(unit.tranId && tranDisplayName);

    return (
      <div class="relative flex flex-col border border-[rgba(51,51,51,0.15)] hover:border-[rgba(70,151,195,0.25)] transition-colors">
        {/* ═══ MAIN CARD BODY ═══ */}
        <div
          class="flex items-stretch bg-[rgba(26,26,26,0.35)] cursor-pointer"
          onClick$={() => onSlotClick$(category, slotIndex)}
        >
          {/* ── CENTER — layout matches editor card ── */}
          <div class="flex-1 min-w-0 flex flex-col">
            <div class="relative flex-1 min-h-[76px] overflow-hidden group/card">
              {/* Portrait — fades in on hover */}
              {portrait && (
                <div
                  class="absolute inset-0 pointer-events-none bg-cover bg-center opacity-0 group-hover/card:opacity-[0.35] transition-opacity duration-500"
                  style={{ backgroundImage: `url(${toPortraitIconPath(portrait)})` }}
                />
              )}
              {/* Unit icon */}
              {thumbnail && (
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <img
                    src={toUnitIconPath(thumbnail)}
                    alt=""
                    width={80}
                    height={80}
                    class="w-20 h-20 object-contain opacity-[0.35] group-hover/card:opacity-[0.15] transition-opacity duration-500"
                  />
                </div>
              )}
              {/* Content overlay — header strip + count/cost row */}
              <div class="relative z-10 flex flex-col justify-between h-full">
                <SimpleTooltip text={displayName} class="px-2 py-1.5 border-b border-[rgba(51,51,51,0.1)]">
                  <p class="text-[11px] font-bold text-[var(--text)] leading-tight line-clamp-2 break-words">{displayName}</p>
                </SimpleTooltip>
                <div class="flex items-center gap-3 px-2 py-1.5">
                  <span class="text-[11px] font-mono font-black text-[var(--text)] tabular-nums">×{unit.count ?? 1}</span>
                  <span class="text-[11px] font-mono font-bold text-[var(--accent)] tabular-nums">
                    {totalUnitCost} {t(i18n, 'builder.editor.pts')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ DETACHED TRANSPORT BAR ═══ */}
        {hasTransport && (
          <div
            class="flex items-stretch border-t border-[rgba(51,51,51,0.15)] cursor-pointer"
            onClick$={() => onSlotClick$(category, slotIndex)}
          >
            <div
              class="relative flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 bg-[rgba(70,151,195,0.05)] overflow-hidden group/tran"
            >
              {/* Transport portrait — fades in on hover */}
              {tranPortrait && (
                <div
                  class="absolute inset-0 pointer-events-none bg-cover bg-center opacity-0 group-hover/tran:opacity-[0.25] transition-opacity duration-500"
                  style={{ backgroundImage: `url(${toPortraitIconPath(tranPortrait)})` }}
                />
              )}
              {/* Transport icon */}
              {tranThumbnail && (
                <div class="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                  <img
                    src={toUnitIconPath(tranThumbnail)}
                    alt=""
                    width={40}
                    height={40}
                    class="w-10 h-10 object-contain opacity-[0.25] group-hover/tran:opacity-[0.1] transition-opacity duration-500"
                  />
                </div>
              )}
              {/* Content overlay */}
              <div class="relative z-10 flex-1 min-w-0 flex flex-col gap-0">
                <SimpleTooltip text={tranDisplayName ?? ''} class="min-w-0">
                  <span class="text-[10px] font-mono font-semibold text-[var(--text-dim)] truncate block">{tranDisplayName}</span>
                </SimpleTooltip>
                <div class="flex items-center gap-1.5">
                  <span class="text-[9px] font-mono font-black text-[var(--text-dim)] tabular-nums">×{unit.tranCount ?? 1}</span>
                  {tranCost > 0 && (
                    <span class="text-[9px] font-mono font-bold text-[var(--accent)] tabular-nums">+{tranCost}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
