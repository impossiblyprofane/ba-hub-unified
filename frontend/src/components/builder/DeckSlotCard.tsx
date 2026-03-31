/**
 * DeckSlotCard — renders a single unit slot in the deck editor grid.
 *
 * V16 "Edge Rails" design:
 * - Full-height −/+ columns flanking a wide info center
 * - Unit icon + name + count/cost in main row
 * - Transport sub-row with icon when present
 * - Left rail = all decrement buttons, right rail = all increment buttons
 * - Delete column on far right
 * - Right-click context menu for all actions
 */
import { component$, useSignal, $ } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { UnitConfig, Set2Key } from '@ba-hub/shared';
import type { ArsenalCard } from '~/lib/graphql-types';
import { toUnitIconPath, toPortraitIconPath } from '~/lib/iconPaths';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import { GAME_LOCALES, getGameLocaleValueOrKey, useI18n, t } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import { resolveUnitDisplayName, resolveTransportDisplayName } from '~/lib/deck';

interface DeckSlotCardProps {
  unit: UnitConfig;
  slotIndex: number;
  maxSlots: number;
  category: Set2Key;
  arsenalCard?: ArsenalCard;
  transportCard?: ArsenalCard;
  locale: Locale;
  onSlotClick$: PropFunction<(category: Set2Key, slotIndex: number) => void>;
  onRemoveUnit$: PropFunction<(category: Set2Key, slotIndex: number) => void>;
  onSwapSlot$: PropFunction<(category: Set2Key, fromIndex: number, toIndex: number) => void>;
  onChangeCount$: PropFunction<(category: Set2Key, slotIndex: number, delta: number) => void>;
  onChangeTransportCount$: PropFunction<(category: Set2Key, slotIndex: number, delta: number) => void>;
}

export const DeckSlotCard = component$<DeckSlotCardProps>(
  ({ unit, slotIndex, maxSlots, category, arsenalCard, transportCard, locale,
     onSlotClick$, onRemoveUnit$, onSwapSlot$, onChangeCount$, onChangeTransportCount$ }) => {
    const i18n = useI18n();
    const isEmpty = !unit.unitId;

    /* ── Empty slot ── */
    if (isEmpty) {
      return (
        <button
          onClick$={() => onSlotClick$(category, slotIndex)}
          class="flex items-center justify-center bg-[rgba(26,26,26,0.25)] hover:bg-[rgba(26,26,26,0.45)] transition-colors cursor-pointer group min-h-[76px] border border-[rgba(51,51,51,0.1)]"
        >
          <span class="text-[var(--text-dim)] text-lg group-hover:text-[var(--accent)] transition-colors leading-none mr-1">+</span>
          <span class="text-[10px] font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider group-hover:text-[var(--accent)] transition-colors">
            {t(i18n, 'builder.editor.addUnit')}
          </span>
        </button>
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

    const canMoveUp = slotIndex > 0;
    const canMoveDown = slotIndex < maxSlots - 1;
    const hasTransport = !!(unit.tranId && tranDisplayName);

    /* ── Context-menu state ── */
    const ctxOpen = useSignal(false);
    const ctxX = useSignal(0);
    const ctxY = useSignal(0);

    const openCtx = $((e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      ctxX.value = e.clientX - rect.left;
      ctxY.value = e.clientY - rect.top;
      ctxOpen.value = true;
    });

    const closeCtx = $(() => { ctxOpen.value = false; });

    return (
      <div class="relative flex flex-col border border-[rgba(51,51,51,0.15)] hover:border-[rgba(70,151,195,0.25)] transition-colors" onContextMenu$={openCtx}>
        {/* ═══ MAIN CARD BODY ═══ */}
        <div class="flex items-stretch bg-[rgba(26,26,26,0.35)]">
          {/* ── LEFT RAIL — swap-left / decrement ── */}
          <div class="flex flex-col w-6 border-r border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
            <button
              onClick$={(e: MouseEvent) => { e.stopPropagation(); if (canMoveUp) onSwapSlot$(category, slotIndex, slotIndex - 1); }}
              class={[
                'h-5 flex items-center justify-center text-[9px] font-black border-b border-[rgba(51,51,51,0.1)] transition-colors',
                canMoveUp ? 'text-[var(--text)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)]' : 'text-[rgba(153,153,153,0.2)] cursor-default',
              ].join(' ')}
            >
              ◀
            </button>
            <button
              onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeCount$(category, slotIndex, -1); }}
              class="flex-1 flex items-center justify-center text-[12px] font-black text-[var(--text)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] transition-colors"
            >
              −
            </button>
          </div>

          {/* ── CENTER — V4b Full-Bleed layout ── */}
          <div
            class="flex-1 min-w-0 flex flex-col cursor-pointer"
            onClick$={() => { ctxOpen.value = false; onSlotClick$(category, slotIndex); }}
          >
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

          {/* ── RIGHT RAIL — swap-right / increment ── */}
          <div class="flex flex-col w-6 border-l border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
            <button
              onClick$={(e: MouseEvent) => { e.stopPropagation(); if (canMoveDown) onSwapSlot$(category, slotIndex, slotIndex + 1); }}
              class={[
                'h-5 flex items-center justify-center text-[9px] font-black border-b border-[rgba(51,51,51,0.1)] transition-colors',
                canMoveDown ? 'text-[var(--text)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)]' : 'text-[rgba(153,153,153,0.2)] cursor-default',
              ].join(' ')}
            >
              ▶
            </button>
            <button
              onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeCount$(category, slotIndex, 1); }}
              class="flex-1 flex items-center justify-center text-[12px] font-black text-[var(--text)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] transition-colors"
            >
              +
            </button>
          </div>

          {/* ── DELETE column ── */}
          <div class="flex items-center justify-center w-5 bg-[rgba(200,50,50,0.05)] border-l border-[rgba(51,51,51,0.15)] flex-shrink-0">
            <SimpleTooltip text={t(i18n, 'builder.editor.removeUnit')}>
              <button
                onClick$={(e: MouseEvent) => { e.stopPropagation(); onRemoveUnit$(category, slotIndex); }}
                class="text-sm font-black text-[var(--text-dim)] hover:text-[var(--red)] transition-colors"
              >
                ✕
              </button>
            </SimpleTooltip>
          </div>
        </div>

        {/* ═══ DETACHED TRANSPORT BAR — floats below main card body ═══ */}
        {hasTransport && (
          <div class="flex items-stretch border-t border-[rgba(51,51,51,0.15)]">
            <div class="w-6 flex items-center justify-center border-r border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
              <button
                onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeTransportCount$(category, slotIndex, -1); }}
                class="text-[11px] font-black text-[var(--text)] hover:text-[var(--accent)] transition-colors"
              >
                −
              </button>
            </div>
            <div
              class="relative flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 bg-[rgba(70,151,195,0.05)] cursor-pointer overflow-hidden group/tran"
              onClick$={() => { ctxOpen.value = false; onSlotClick$(category, slotIndex); }}
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
            <div class="w-6 flex items-center justify-center border-l border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
              <button
                onClick$={(e: MouseEvent) => { e.stopPropagation(); if ((unit.tranCount ?? 1) < (unit.count ?? 1)) onChangeTransportCount$(category, slotIndex, 1); }}
                class={[
                  'text-[11px] font-black transition-colors',
                  (unit.tranCount ?? 1) >= (unit.count ?? 1)
                    ? 'text-[rgba(153,153,153,0.2)] cursor-default'
                    : 'text-[var(--text)] hover:text-[var(--accent)]',
                ].join(' ')}
              >
                +
              </button>
            </div>
            <div class="w-5 flex-shrink-0" />
          </div>
        )}

        {/* ═══ Right-click context menu ═══ */}
        {ctxOpen.value && (
          <>
            <div
              class="fixed inset-0 z-40"
              onClick$={(e: MouseEvent) => { e.stopPropagation(); closeCtx(); }}
              onContextMenu$={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); closeCtx(); }}
            />
            <div
              class="absolute z-50 bg-[rgba(20,20,20,0.97)] border border-[rgba(51,51,51,0.3)] shadow-lg min-w-[130px] py-1 text-[11px] font-mono"
              style={{ left: `${ctxX.value}px`, top: `${ctxY.value}px` }}
            >
              <button
                class="w-full text-left px-3 py-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] transition-colors flex items-center gap-2"
                onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeCount$(category, slotIndex, 1); closeCtx(); }}
              >
                <span class="w-3 text-center">+</span> {t(i18n, 'builder.editor.count')}
              </button>
              <button
                class="w-full text-left px-3 py-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] transition-colors flex items-center gap-2"
                onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeCount$(category, slotIndex, -1); closeCtx(); }}
              >
                <span class="w-3 text-center">−</span> {t(i18n, 'builder.editor.count')}
              </button>
              {hasTransport && (
                <>
                  <div class="my-1 border-t border-[rgba(51,51,51,0.3)]" />
                  <button
                    class="w-full text-left px-3 py-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] transition-colors flex items-center gap-2"
                    onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeTransportCount$(category, slotIndex, 1); closeCtx(); }}
                  >
                    <span class="w-3 text-center">+</span> {t(i18n, 'builder.editor.addTransport')}
                  </button>
                  <button
                    class="w-full text-left px-3 py-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] transition-colors flex items-center gap-2"
                    onClick$={(e: MouseEvent) => { e.stopPropagation(); onChangeTransportCount$(category, slotIndex, -1); closeCtx(); }}
                  >
                    <span class="w-3 text-center">−</span> {t(i18n, 'builder.editor.removeTransport')}
                  </button>
                </>
              )}
              <div class="my-1 border-t border-[rgba(51,51,51,0.3)]" />
              <button
                class={[
                  'w-full text-left px-3 py-1.5 transition-colors flex items-center gap-2',
                  canMoveUp ? 'text-[var(--text)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)]' : 'text-[rgba(153,153,153,0.2)] cursor-default',
                ].join(' ')}
                onClick$={(e: MouseEvent) => { e.stopPropagation(); if (canMoveUp) { onSwapSlot$(category, slotIndex, slotIndex - 1); closeCtx(); } }}
              >
                <span class="w-3 text-center">◄</span> {t(i18n, 'builder.editor.swapUp')}
              </button>
              <button
                class={[
                  'w-full text-left px-3 py-1.5 transition-colors flex items-center gap-2',
                  canMoveDown ? 'text-[var(--text)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)]' : 'text-[rgba(153,153,153,0.2)] cursor-default',
                ].join(' ')}
                onClick$={(e: MouseEvent) => { e.stopPropagation(); if (canMoveDown) { onSwapSlot$(category, slotIndex, slotIndex + 1); closeCtx(); } }}
              >
                <span class="w-3 text-center">►</span> {t(i18n, 'builder.editor.swapDown')}
              </button>
              <div class="my-1 border-t border-[rgba(51,51,51,0.3)]" />
              <button
                class="w-full text-left px-3 py-1.5 text-[var(--text-dim)] hover:text-[var(--red)] hover:bg-[rgba(200,50,50,0.08)] transition-colors flex items-center gap-2"
                onClick$={(e: MouseEvent) => { e.stopPropagation(); onRemoveUnit$(category, slotIndex); closeCtx(); }}
              >
                <span class="w-3 text-center">✕</span> {t(i18n, 'builder.editor.removeUnit')}
              </button>
            </div>
          </>
        )}
      </div>
    );
  },
);
