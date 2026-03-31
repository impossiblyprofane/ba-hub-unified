import { component$, useSignal } from '@builder.io/qwik';
import type { UnitDetailSquadMember } from '~/lib/graphql-types';
import { toWeaponIconPath } from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';

type Props = {
  members: UnitDetailSquadMember[];
  compact?: boolean;
};

type SquadGroup = {
  key: string;
  count: number;
  primaryWeapon: UnitDetailSquadMember['primaryWeapon'];
  specialWeapon: UnitDetailSquadMember['specialWeapon'];
};

function groupMembers(members: UnitDetailSquadMember[]): SquadGroup[] {
  const groups = new Map<string, SquadGroup>();
  for (const member of members) {
    const pw = member.primaryWeapon;
    const sw = member.specialWeapon;
    const key = `${pw?.Id ?? 0}-${sw?.Id ?? 0}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { key, count: 1, primaryWeapon: pw, specialWeapon: sw });
    }
  }
  return Array.from(groups.values());
}

export const SquadCompositionPanel = component$<Props>(({ members, compact }) => {
  const i18n = useI18n();
  const showSquad = useSignal(false);
  const groups = groupMembers(members);

  return (
    <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
      {/* Header with toggle */}
      <div class="flex items-center justify-between px-2 py-1.5 border-b border-[rgba(51,51,51,0.3)]">
        <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] m-0 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {t(i18n, 'unitDetail.panel.squad')}
        </p>
        <SimpleTooltip text={showSquad.value ? 'Show grouped loadouts' : 'Show individual members'}>
          <button
            type="button"
            onClick$={() => (showSquad.value = !showSquad.value)}
            class="flex items-center gap-1.5 group cursor-pointer bg-transparent border-none p-0"
          >
          <span class="text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] group-hover:text-[var(--text)]">
            {showSquad.value ? 'Squad' : 'Loadout'}
          </span>
          <div class="relative w-7 h-3.5 bg-[var(--bg)] border border-[var(--border)] group-hover:border-[var(--accent)]/50 transition-colors">
            <div
              class={`absolute top-0.5 w-2 h-2 bg-[var(--text-dim)] group-hover:bg-[var(--accent)] transition-all ${showSquad.value ? 'left-[calc(100%-10px)]' : 'left-0.5'}`}
            />
          </div>
          </button>
        </SimpleTooltip>
      </div>

      {/* Loadout view — grouped by weapon combo */}
      {!showSquad.value && (
        <div class="grid grid-cols-4 gap-1">
          {groups.map((group) => {
            const pw = group.primaryWeapon;
            const sw = group.specialWeapon;
            const pwIcon = pw?.HUDIcon ? toWeaponIconPath(pw.HUDIcon) : null;
            const swIcon = sw?.HUDIcon ? toWeaponIconPath(sw.HUDIcon) : null;
            const tooltip = [
              `x${group.count}`,
              pw ? `Primary: ${pw.HUDName}` : null,
              sw ? `Special: ${sw.HUDName}` : null,
            ].filter(Boolean).join('\n');
            return (
              <SimpleTooltip key={group.key} text={tooltip}>
                <div
                  class="relative flex flex-col items-center gap-1 p-0 bg-[rgba(26,26,26,0.4)]"
                >
                <span class="absolute top-1 left-1 right-1 text-[10px] font-mono text-[var(--accent)] text-center">x{group.count}</span>
                <div class="mt-5 flex flex-col items-center gap-0 overflow-hidden">
                  {pwIcon && (
                    <img src={pwIcon} width={56} height={56} class="w-14 h-10 object-contain brightness-0 invert opacity-80 -my-0.5" alt={pw?.HUDName || ''} />
                  )}
                  {swIcon && (
                    <img src={swIcon} width={56} height={56} class="w-14 h-10 object-contain opacity-80 -my-0.5" alt={sw?.HUDName || ''} style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(170deg)' }} />
                  )}
                </div>
              </div>
            </SimpleTooltip>
            );
          })}
        </div>
      )}

      {/* Squad view — individual members, icon-only grid in death-priority order */}
      {showSquad.value && (
        <div class="grid grid-cols-6 gap-0.5 p-0.5">
          {members.map((member, i) => {
            const pw = member.primaryWeapon;
            const sw = member.specialWeapon;
            const pwIcon = pw?.HUDIcon ? toWeaponIconPath(pw.HUDIcon) : null;
            const swIcon = sw?.HUDIcon ? toWeaponIconPath(sw.HUDIcon) : null;
            const tooltip = [
              `#${i + 1}`,
              pw ? `Primary: ${pw.HUDName || pw.Name}` : null,
              sw ? `Special: ${sw.HUDName || sw.Name}` : null,
            ].filter(Boolean).join('\n');
            return (
              <SimpleTooltip key={`${member.Id}-${i}`} text={tooltip}>
                <div
                  class="relative flex flex-col items-center bg-[rgba(26,26,26,0.4)]"
                >
                <span class="absolute top-0 left-0.5 text-[8px] font-mono text-[var(--text-dim)] z-10">{i + 1}</span>
                <div class="flex flex-col items-center gap-0 overflow-hidden">
                  {pwIcon && (
                    <img src={pwIcon} width={40} height={40} class="w-10 h-7 object-contain brightness-0 invert opacity-80 -my-0.5" alt="" />
                  )}
                  {swIcon && (
                    <img src={swIcon} width={40} height={40} class="w-10 h-7 object-contain opacity-80 -my-0.5" alt="" style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(170deg)' }} />
                  )}
                </div>
              </div>
            </SimpleTooltip>
            );
          })}
        </div>
      )}
    </div>
  );
});
