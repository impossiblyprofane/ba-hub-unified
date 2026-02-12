import { component$ } from '@builder.io/qwik';
import type { UnitDetailArmor } from '~/routes/arsenal/[unitid]';

type Props = { armor: UnitDetailArmor };

/**
 * Directional armor diagram — overlays KE/HEAT values at each facing
 * around the unit portrait.  Game-perspective layout:
 *   top = TOP, left = FRONT, right = REAR, bottom = SIDES
 */
export const UnitArmorDiagram = component$<Props>(({ armor }) => {
  const hasDirArmor =
    armor.KinArmorFront > 0 || armor.HeatArmorFront > 0 ||
    armor.KinArmorRear > 0 || armor.HeatArmorRear > 0;

  if (!hasDirArmor) return null;

  return (
    <div class="absolute inset-0 pointer-events-none">
      {/* TOP — top edge */}
      <div class="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2">
        <ArmorValue kind="KE" value={armor.KinArmorTop} />
        <ArmorValue kind="HT" value={armor.HeatArmorTop} />
      </div>
      {/* FRONT — left edge */}
      <div class="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
        <ArmorValue kind="KE" value={armor.KinArmorFront} />
        <ArmorValue kind="HT" value={armor.HeatArmorFront} />
      </div>
      {/* REAR — right edge */}
      <div class="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
        <ArmorValue kind="KE" value={armor.KinArmorRear} />
        <ArmorValue kind="HT" value={armor.HeatArmorRear} />
      </div>
      {/* SIDES — bottom edge */}
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        <ArmorValue kind="KE" value={armor.KinArmorSides} />
        <ArmorValue kind="HT" value={armor.HeatArmorSides} />
      </div>
    </div>
  );
});

const ArmorValue = component$<{ kind: 'KE' | 'HT'; value: number }>(({ kind, value }) => {
  if (value <= 0) return null;
  const color = kind === 'KE' ? 'text-[#7eb8e0]' : 'text-[#e8a050]';
  return (
    <span class={`text-xs font-mono font-bold ${color} bg-black/80 px-2 py-0.5`}>
      {value}
    </span>
  );
});
