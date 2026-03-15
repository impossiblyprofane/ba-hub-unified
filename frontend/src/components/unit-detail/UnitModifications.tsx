import { component$, type PropFunction } from '@builder.io/qwik';
import { useI18n, t, getGameLocaleValueOrKey, GAME_LOCALES } from '~/lib/i18n';
import { toOptionPicturePath } from '~/lib/iconPaths';
import type { UnitDetailModSlot } from '~/lib/graphql-types';

type Props = {
  modifications: UnitDetailModSlot[];
  onOptionChange$: PropFunction<(modId: number, optionId: number, mods: UnitDetailModSlot[]) => void>;
  compact?: boolean;
  fill?: boolean;
};

export const UnitModifications = component$<Props>(({ modifications, onOptionChange$, compact, fill }) => {
  const i18n = useI18n();

  return (
    <div
      class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] ${fill ? 'h-full flex flex-col' : ''}`}
    >
      <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[rgba(51,51,51,0.3)]`}>
        {t(i18n, 'unitDetail.panel.modifications')}
      </p>
      <div class={`flex flex-col ${compact ? 'gap-2 p-3' : 'gap-3 p-4'} ${fill ? 'flex-1' : ''}`}>
        {modifications.map(slot => {
          const modName = getGameLocaleValueOrKey(
            GAME_LOCALES.modopts, slot.modification.UIName || slot.modification.Name, i18n.locale,
          ) || slot.modification.Name;
          const selectedOpt = slot.options.find(o => o.Id === slot.selectedOptionId);
          const selectedIcon = selectedOpt?.OptionPicture ? toOptionPicturePath(selectedOpt.OptionPicture) : null;
          return (
            <div key={slot.modification.Id}>
              <label class={`${compact ? 'text-[9px]' : 'text-[10px]'} block font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1 truncate`}>
                {modName}
              </label>
              <div class="flex items-center gap-2 min-w-0">
                {selectedIcon && (
                  <img
                    src={selectedIcon}
                    width={32} height={32}
                    class={`${compact ? 'w-7 h-7' : 'w-8 h-8'} object-contain shrink-0 brightness-0 invert opacity-80`}
                    alt=""
                  />
                )}
                <select
                  class={`flex-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] ${compact ? 'text-xs px-2 py-1.5' : 'text-sm px-2.5 py-2'} font-mono min-w-0
                         focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer truncate`}
                  value={slot.selectedOptionId}
                  onChange$={(e) => {
                    const newId = parseInt((e.target as HTMLSelectElement).value, 10);
                    onOptionChange$(slot.modification.Id, newId, modifications);
                  }}
                >
                  {slot.options.map(opt => {
                    const optName = getGameLocaleValueOrKey(
                      GAME_LOCALES.modopts, opt.UIName || opt.Name, i18n.locale,
                    ) || opt.Name;
                    const costStr = opt.Cost > 0 ? ` (+${opt.Cost})` : opt.Cost < 0 ? ` (${opt.Cost})` : '';
                    const defaultStr = opt.IsDefault ? ' ●' : '';
                    return (
                      <option key={opt.Id} value={opt.Id}>
                        {`${optName}${costStr}${defaultStr}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
