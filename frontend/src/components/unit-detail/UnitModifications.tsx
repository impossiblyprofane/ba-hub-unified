import { component$, type PropFunction } from '@builder.io/qwik';
import { useI18n, getGameLocaleValueOrKey, GAME_LOCALES } from '~/lib/i18n';
import { toOptionPicturePath } from '~/lib/iconPaths';
import type { UnitDetailModSlot } from '~/routes/arsenal/[unitid]';

type Props = {
  modifications: UnitDetailModSlot[];
  onOptionChange$: PropFunction<(modId: number, optionId: number, mods: UnitDetailModSlot[]) => void>;
};

export const UnitModifications = component$<Props>(({ modifications, onOptionChange$ }) => {
  const i18n = useI18n();

  return (
    <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-4">
      <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-3">
        Modifications
      </p>
      <div class="flex flex-col gap-3">
        {modifications.map(slot => {
          const modName = getGameLocaleValueOrKey(
            GAME_LOCALES.modopts, slot.modification.UIName || slot.modification.Name, i18n.locale,
          ) || slot.modification.Name;
          const selectedOpt = slot.options.find(o => o.Id === slot.selectedOptionId);
          const selectedIcon = selectedOpt?.OptionPicture ? toOptionPicturePath(selectedOpt.OptionPicture) : null;
          return (
            <div key={slot.modification.Id}>
              <label class="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1">
                {modName}
              </label>
              <div class="flex items-center gap-2">
                {selectedIcon && (
                  <img
                    src={selectedIcon}
                    width={32} height={32}
                    class="w-8 h-8 object-contain shrink-0 brightness-0 invert opacity-80"
                    alt=""
                  />
                )}
                <select
                  class="flex-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm px-2.5 py-2 font-mono
                         focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
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
