// ══════════════════════════════════════════════════════════════
// UnitSelectionBar — shows selected unit info when unit tool is active
// ══════════════════════════════════════════════════════════════

import { component$, type Signal, type QRL } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import { toUnitIconPath } from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';

export interface SelectedUnit {
  unitId: number;
  unitName: string;
  thumbnailPath: string;
}

export interface UnitSelectionBarProps {
  selectedUnit: Signal<SelectedUnit | null>;
  visible: boolean;
  onOpenLookup$: QRL<() => void>;
  onClearUnit$: QRL<() => void>;
}

export const UnitSelectionBar = component$<UnitSelectionBarProps>(
  ({ selectedUnit, visible, onOpenLookup$, onClearUnit$ }) => {
    const i18n = useI18n();

    if (!visible) return null;

    const unit = selectedUnit.value;

    return (
      <div class="flex items-center gap-2 px-2 py-1.5 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)] border-t-0">
        {/* Label */}
        <span class="text-[8px] font-mono text-[var(--text-dim)] uppercase tracking-wider shrink-0">
          {t(i18n, 'maps.tools.unit')}
        </span>

        {unit ? (
          <>
            {/* Selected unit preview */}
            <div class="flex items-center gap-2 px-2 py-0.5 border border-[var(--accent)] bg-[rgba(70,151,195,0.08)]">
              <div class="shrink-0 w-6 h-6 flex items-center justify-center">
                <GameIcon
                  src={toUnitIconPath(unit.thumbnailPath)}
                  size={22}
                  alt={unit.unitName}
                />
              </div>
              <span class="text-xs font-mono text-[var(--text)] truncate max-w-[200px]">
                {unit.unitName}
              </span>
            </div>

            {/* Change button */}
            <button
              class="px-2 py-1 text-[8px] font-mono uppercase tracking-wider text-[var(--text-dim)] border border-[rgba(51,51,51,0.3)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              onClick$={() => onOpenLookup$()}
            >
              {t(i18n, 'maps.unit.change')}
            </button>

            {/* Clear button */}
            <button
              class="px-2 py-1 text-[8px] font-mono uppercase tracking-wider text-[var(--text-dim)] border border-[rgba(51,51,51,0.3)] hover:border-red-400 hover:text-red-400 transition-colors"
              onClick$={() => onClearUnit$()}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Placement hint */}
            <span class="text-[8px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">
              {t(i18n, 'maps.unit.clickToPlace')}
            </span>
          </>
        ) : (
          <>
            {/* No unit selected — show select button */}
            <button
              class="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] transition-colors"
              onClick$={() => onOpenLookup$()}
            >
              {t(i18n, 'maps.unit.selectUnit')}
            </button>
            <span class="text-[8px] font-mono text-[var(--text-dim)] opacity-60">
              {t(i18n, 'maps.unit.noUnit')}
            </span>
          </>
        )}
      </div>
    );
  },
);
