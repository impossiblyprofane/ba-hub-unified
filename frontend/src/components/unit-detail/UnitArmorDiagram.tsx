import { component$ } from '@builder.io/qwik';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import type { UnitDetailArmor } from '~/lib/graphql-types';

type Props = { armor: UnitDetailArmor };

/**
 * Directional armor diagram — overlays KE/HEAT values at each facing
 * around the unit portrait.  Game-perspective layout:
 *   top = TOP, left = FRONT, right = REAR, bottom = SIDES
 */
export const UnitArmorDiagram = component$<Props>(({ armor }) => {
  const hasDirArmor =
    armor.KinArmorFront > 0 || armor.HeatArmorFront > 0 ||
    armor.KinArmorRear > 0 || armor.HeatArmorRear > 0 ||
    armor.KinArmorSides > 0 || armor.HeatArmorSides > 0 ||
    armor.KinArmorTop > 0 || armor.HeatArmorTop > 0;

  if (!hasDirArmor) return null;

  return (
    <div class="absolute inset-0 pointer-events-none">
      {/* KE / HEAT legend — top-left corner */}
      <div class="absolute top-2 left-2 flex flex-col gap-0.5 pointer-events-auto">
        <SimpleTooltip text="Kinetic Armor">
          <span class="text-[10px] font-mono font-bold text-[#7eb8e0] bg-black/80 px-1.5 py-0.5 leading-none cursor-default">KE</span>
        </SimpleTooltip>
        <SimpleTooltip text="HEAT Armor">
          <span class="text-[10px] font-mono font-bold text-[#e8a050] bg-black/80 px-1.5 py-0.5 leading-none cursor-default">HT</span>
        </SimpleTooltip>
      </div>

      {/* TOP — top edge, centered */}
      <div class="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        <ArmorValue kind="KE" value={armor.KinArmorTop} />
        <ArmorValue kind="HT" value={armor.HeatArmorTop} />
      </div>
      {/* FRONT — left edge */}
      <div class="absolute left-[8%] top-1/2 -translate-y-1/2 flex flex-col gap-1">
        <ArmorValue kind="KE" value={armor.KinArmorFront} />
        <ArmorValue kind="HT" value={armor.HeatArmorFront} />
      </div>
      {/* REAR — right edge */}
      <div class="absolute right-[8%] top-1/2 -translate-y-1/2 flex flex-col gap-1">
        <ArmorValue kind="KE" value={armor.KinArmorRear} />
        <ArmorValue kind="HT" value={armor.HeatArmorRear} />
      </div>
      {/* SIDES — bottom edge */}
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        <ArmorValue kind="KE" value={armor.KinArmorSides} />
        <ArmorValue kind="HT" value={armor.HeatArmorSides} />
      </div>
    </div>
  );
});

const ArmorValue = component$<{ kind: 'KE' | 'HT'; value: number }>(({ kind, value }) => {
  if (value <= 0) return null;
  const color = kind === 'KE' ? 'text-[#7eb8e0]' : 'text-[#e8a050]';
  const tooltip = kind === 'KE' ? 'Kinetic Armor' : 'HEAT Armor';
  return (
    <SimpleTooltip text={tooltip}>
      <span class={`text-xs font-mono font-bold ${color} bg-black/80 px-1.5 py-0.5 pointer-events-auto cursor-default`}>
        {value}
      </span>
    </SimpleTooltip>
  );
});
