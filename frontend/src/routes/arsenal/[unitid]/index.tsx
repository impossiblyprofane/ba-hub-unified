import { component$, useSignal, useResource$, Resource, $, useVisibleTask$ } from '@builder.io/qwik';
import { useLocation, Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { useI18n, t } from '~/lib/i18n';
import {
  toCountryIconPath, toPortraitIconPath,
  toWeaponIconPath,
  UtilIconPaths,
} from '~/lib/iconPaths';
import { UnitModifications } from '~/components/unit-detail/UnitModifications';
import { UnitArmorDiagram } from '~/components/unit-detail/UnitArmorDiagram';
import { UnitMobilityPanel } from '~/components/unit-detail/UnitMobilityPanel';
import { UnitSensorsPanel } from '~/components/unit-detail/UnitSensorsPanel';
import { UnitAbilitiesPanel } from '~/components/unit-detail/UnitAbilitiesPanel';
import { UnitWeaponsPanel } from '~/components/unit-detail/UnitWeaponsPanel';
import { UnitAvailabilityPanel } from '~/components/unit-detail/UnitAvailabilityPanel';

/* ── Types ──────────────────────────────────────────────────────── */

export type UnitDetailUnit = {
  Id: number; Name: string; HUDName: string; Description: string;
  CountryId: number; Type: number; CategoryType: number; Role: number;
  PortraitFileName: string; ThumbnailFileName: string;
  Weight: number; Stealth: number; InfantrySlots: number; MaxStress: number;
  Length: number; Width: number; Height: number;
  DisplayInArmory: boolean; IsUnitModification: boolean;
  Cost: number;
};

export type UnitDetailArmor = {
  Id: number; Name: string; ArmorValue: number; MaxHealthPoints: number;
  HeatArmorFront: number; HeatArmorRear: number; HeatArmorSides: number; HeatArmorTop: number;
  KinArmorFront: number; KinArmorRear: number; KinArmorSides: number; KinArmorTop: number;
};

export type UnitDetailMobility = {
  Id: number; Name: string; IsAmphibious: boolean; IsAirDroppable: boolean;
  Weight: number; HeavyLiftWeight: number; TurnRate: number; Acceleration: number;
  MaxCrossCountrySpeed: number; MaxSpeedRoad: number; MaxSpeedReverse: number;
  MaxSpeedWater: number; Agility: number; ClimbRate: number;
  IsChangeAltitude: boolean; LoiteringTime: number; IsAfterburner: boolean;
  AfterBurningLoiteringTime: number;
};

export type UnitDetailFlyPreset = {
  Id: number; MaxSpeed: number; AfterburnSpeed: number; CornerSpeed: number;
  MinSpeed: number; Acceleration: number; Deceleration: number;
};

export type UnitDetailSensor = {
  Id: number; Name: string; OpticsGround: number; OpticsHighAltitude: number;
  OpticsLowAltitude: number;
};

export type UnitDetailAbility = {
  Id: number; Name: string; IsDefault: boolean; ECMAccuracyMultiplier: number;
  IsRadar: boolean; RadarLowAltOpticsModifier: number; RadarHighAltOpticsModifier: number;
  IsLaserDesignator: boolean; LaserMaxRange: number; LaserUsableInMove: boolean;
  IsInfantrySprint: boolean; SprintDuration: number; SprintCooldown: number;
  IsSmoke: boolean; SmokeAmmunitionQuantity: number; SmokeCooldown: number;
  IsAPS: boolean; APSQuantity: number; APSCooldown: number; APSHitboxProportion: number;
  IsDecoy: boolean; DecoyQuantity: number; DecoyCooldown: number; DecoyDuration: number;
};

export type UnitDetailAmmo = {
  Id: number; Name: string; HUDName: string; HUDIcon: string;
  Damage: number; StressDamage: number; PenetrationAtMinRange: number; PenetrationAtGroundRange: number;
  GroundRange: number; LowAltRange: number; HighAltRange: number; MinimalRange: number;
  TargetType: number; ArmorTargeted: number; TrajectoryType: number;
  TopArmorAttack: boolean; LaserGuided: boolean; CanBeIntercepted: boolean;
  HealthAOERadius: number; StressAOERadius: number;
  MuzzleVelocity: number; MaxSpeed: number;
  DispersionHorizontalRadius: number; DispersionVerticalRadius: number;
  SupplyCost: number; ResupplyTime: number;
  GenerateSmoke: boolean; Seeker: number; SeekerAngle: number;
  HUDMultiplier: number; CriticMultiplier: number;
};

export type UnitDetailWeapon = {
  weapon: {
    Id: number; Name: string; HUDName: string; Type: number; HUDIcon: string;
    AutoLoaded: boolean; IsVerticalLauncher: boolean; CanShootOnTheMove: boolean;
    MagazineSize: number; MagazineReloadTimeMin: number; MagazineReloadTimeMax: number;
    AimTimeMin: number; AimTimeMax: number;
    ShotsPerBurstMin: number; ShotsPerBurstMax: number;
    TimeBetweenShotsInBurst: number; TimeBetweenBurstsMin: number; TimeBetweenBurstsMax: number;
    MultiTargetTracking: number; SimultaneousTracking: number;
    CanBeMerged: boolean; StabilizerQuality: number;
  };
  turret: {
    Id: number; Name: string; FullRotation: boolean;
    LeftHorizontalAngle: number; RightHorizontalAngle: number; HorizontalRotationSpeed: number;
  } | null;
  ammunition: Array<{
    order: number; quantity: number;
    ammunition: UnitDetailAmmo;
  }>;
};

export type UnitDetailModSlot = {
  modification: { Id: number; Name: string; UIName: string; Type: number; Order: number; ThumbnailFileName: string };
  options: Array<{
    Id: number; Name: string; UIName: string; Cost: number;
    IsDefault: boolean; Order: number;
    ReplaceUnitName: string; ConcatenateWithUnitName: string;
    OptionPicture: string;
  }>;
  selectedOptionId: number;
};

export type UnitDetailSquadMember = {
  Id: number; DeathPriority: number; ModelFileName: string;
  primaryWeapon: { Id: number; Name: string; HUDName: string; Type: number; HUDIcon: string } | null;
  specialWeapon: { Id: number; Name: string; HUDName: string; Type: number; HUDIcon: string } | null;
};

export type UnitDetailAvailability = {
  specialization: { Id: number; Name: string; UIName: string; Icon: string; CountryId: number };
  maxAvailability: number;
  transports: Array<{ Id: number; Name: string; ThumbnailFileName: string }>;
};

export type UnitDetailData = {
  unit: UnitDetailUnit;
  baseUnit: { Id: number; Name: string; Cost: number };
  displayName: string;
  totalCost: number;
  country: { Id: number; Name: string; FlagFileName: string } | null;
  armor: UnitDetailArmor | null;
  mobility: UnitDetailMobility | null;
  flyPreset: UnitDetailFlyPreset | null;
  sensors: UnitDetailSensor[];
  abilities: UnitDetailAbility[];
  weapons: UnitDetailWeapon[];
  modifications: UnitDetailModSlot[];
  squadMembers: UnitDetailSquadMember[];
  availability: UnitDetailAvailability[];
};

/* ── GraphQL Query ──────────────────────────────────────────────── */

const UNIT_DETAIL_QUERY = `
  query UnitDetail($id: Int!, $optionIds: [Int!]) {
    unitDetail(id: $id, optionIds: $optionIds) {
      displayName
      totalCost
      unit {
        Id Name HUDName Description
        CountryId Type CategoryType Role Cost
        PortraitFileName ThumbnailFileName
        Weight Stealth InfantrySlots MaxStress
        Length Width Height
        DisplayInArmory IsUnitModification
      }
      baseUnit { Id Name Cost }
      country { Id Name FlagFileName }
      armor {
        Id Name ArmorValue MaxHealthPoints
        HeatArmorFront HeatArmorRear HeatArmorSides HeatArmorTop
        KinArmorFront KinArmorRear KinArmorSides KinArmorTop
      }
      mobility {
        Id Name IsAmphibious IsAirDroppable Weight HeavyLiftWeight
        TurnRate Acceleration MaxCrossCountrySpeed MaxSpeedRoad
        MaxSpeedReverse MaxSpeedWater Agility ClimbRate
        IsChangeAltitude LoiteringTime IsAfterburner AfterBurningLoiteringTime
      }
      flyPreset {
        Id MaxSpeed AfterburnSpeed CornerSpeed MinSpeed Acceleration Deceleration
      }
      sensors { Id Name OpticsGround OpticsHighAltitude OpticsLowAltitude }
      abilities {
        Id Name IsDefault ECMAccuracyMultiplier
        IsRadar RadarLowAltOpticsModifier RadarHighAltOpticsModifier
        IsLaserDesignator LaserMaxRange LaserUsableInMove
        IsInfantrySprint SprintDuration SprintCooldown
        IsSmoke SmokeAmmunitionQuantity SmokeCooldown
        IsAPS APSQuantity APSCooldown APSHitboxProportion
        IsDecoy DecoyQuantity DecoyCooldown DecoyDuration
      }
      weapons {
        weapon {
          Id Name HUDName Type HUDIcon
          AutoLoaded IsVerticalLauncher CanShootOnTheMove
          MagazineSize MagazineReloadTimeMin MagazineReloadTimeMax
          AimTimeMin AimTimeMax
          ShotsPerBurstMin ShotsPerBurstMax
          TimeBetweenShotsInBurst TimeBetweenBurstsMin TimeBetweenBurstsMax
          MultiTargetTracking SimultaneousTracking
          CanBeMerged StabilizerQuality
        }
        turret {
          Id Name FullRotation
          LeftHorizontalAngle RightHorizontalAngle HorizontalRotationSpeed
        }
        ammunition {
          order quantity
          ammunition {
            Id Name HUDName HUDIcon
            Damage StressDamage PenetrationAtMinRange PenetrationAtGroundRange
            GroundRange LowAltRange HighAltRange MinimalRange
            TargetType ArmorTargeted TrajectoryType
            TopArmorAttack LaserGuided CanBeIntercepted
            HealthAOERadius StressAOERadius
            MuzzleVelocity MaxSpeed
            DispersionHorizontalRadius DispersionVerticalRadius
            SupplyCost ResupplyTime
            GenerateSmoke Seeker SeekerAngle
            HUDMultiplier CriticMultiplier
          }
        }
      }
      modifications {
        selectedOptionId
        modification { Id Name UIName Type Order ThumbnailFileName }
        options { Id Name UIName Cost IsDefault Order ReplaceUnitName ConcatenateWithUnitName OptionPicture }
      }
      squadMembers {
        Id DeathPriority ModelFileName
        primaryWeapon { Id Name HUDName Type HUDIcon }
        specialWeapon { Id Name HUDName Type HUDIcon }
      }
      availability {
        maxAvailability
        specialization { Id Name UIName Icon CountryId }
        transports { Id Name ThumbnailFileName }
      }
    }
  }
`;

/* ── Helpers ────────────────────────────────────────────────────── */

const API_URL = 'http://localhost:3001/graphql';

async function fetchUnitDetail(id: number, optionIds: number[]): Promise<UnitDetailData> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: UNIT_DETAIL_QUERY,
      variables: { id, optionIds: optionIds.length ? optionIds : null },
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json() as { data?: { unitDetail: UnitDetailData }; errors?: Array<{ message: string }> };
  if (!json.data?.unitDetail) {
    throw new Error(json.errors?.map(e => e.message).join(', ') || 'Unit not found');
  }
  return json.data.unitDetail;
}

const CATEGORY_LABELS: Record<number, string> = {
  0: 'REC', 1: 'INF', 2: 'VEH', 3: 'SUP', 5: 'HEL', 6: 'AIR', 7: 'TRN',
};

/* ── Page Component ─────────────────────────────────────────────── */

export default component$(() => {
  const loc = useLocation();
  const unitId = parseInt(loc.params.unitid, 10);
  const i18n = useI18n();

  // Selected option IDs — empty = use server defaults
  const selectedOptionIds = useSignal<number[]>([]);
  const isRefetching = useSignal(false);

  // Reactive data resource
  const unitResource = useResource$<UnitDetailData>(async ({ track, cleanup }) => {
    const optIds = track(() => selectedOptionIds.value);
    const ctrl = new AbortController();
    cleanup(() => ctrl.abort());

    isRefetching.value = optIds.length > 0;
    try {
      const data = await fetchUnitDetail(unitId, optIds);
      return data;
    } finally {
      isRefetching.value = false;
    }
  });

  // URL sync: update search params when options change (for shareability)
  useVisibleTask$(({ track }) => {
    const opts = track(() => selectedOptionIds.value);
    if (opts.length > 0) {
      const url = new URL(window.location.href);
      url.searchParams.set('m', opts.join('-'));
      window.history.replaceState({}, '', url.toString());
    }
  });

  // On mount: read URL params and apply
  useVisibleTask$(() => {
    const url = new URL(window.location.href);
    const m = url.searchParams.get('m');
    if (m) {
      const ids = m.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
      if (ids.length) selectedOptionIds.value = ids;
    }
  });

  // Modification change handler
  const handleOptionChange$ = $((modId: number, newOptionId: number, modifications: UnitDetailModSlot[]) => {
    const newIds = modifications.map(mod => {
      if (mod.modification.Id === modId) return newOptionId;
      // Keep current selection for other mods
      const currentlySelected = selectedOptionIds.value.find(id =>
        mod.options.some(opt => opt.Id === id),
      );
      return currentlySelected ?? mod.selectedOptionId;
    });
    selectedOptionIds.value = newIds;
  });

  return (
    <div class="max-w-[1400px] mx-auto">
      {/* Back link */}
      <Link
        href="/arsenal"
        class="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        ← {t(i18n, 'nav.arsenal')}
      </Link>

      <Resource
        value={unitResource}
        onPending={() => (
          <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-8">
            <div class="text-sm font-mono text-[var(--text-dim)] animate-pulse">Loading unit data…</div>
          </div>
        )}
        onRejected={(err) => (
          <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-8">
            <p class="text-[var(--red)] text-sm font-mono">Error: {(err as Error).message}</p>
            <Link href="/arsenal" class="text-xs text-[var(--accent)] mt-4 inline-block">
              Return to Arsenal
            </Link>
          </div>
        )}
        onResolved={(data) => (
          <UnitDetailView
            data={data}
            isRefetching={isRefetching.value}
            onOptionChange$={handleOptionChange$}
          />
        )}
      />
    </div>
  );
});

/* ── Detail View ────────────────────────────────────────────────── */

type UnitDetailViewProps = {
  data: UnitDetailData;
  isRefetching: boolean;
  onOptionChange$: (modId: number, optionId: number, mods: UnitDetailModSlot[]) => void;
};

const UnitDetailView = component$<UnitDetailViewProps>(({ data, isRefetching, onOptionChange$ }) => {
  const unit = data.unit;
  const catLabel = CATEGORY_LABELS[unit.CategoryType] ?? '???';
  const portraitUrl = toPortraitIconPath(unit.PortraitFileName || unit.ThumbnailFileName);
  const countryFlagUrl = data.country?.FlagFileName ? toCountryIconPath(data.country.FlagFileName) : null;

  // ECM: find the active ECM ability (multiplier between 0 and 1 = accuracy reduction)
  const ecmAbility = data.abilities.find(a => a.ECMAccuracyMultiplier > 0 && a.ECMAccuracyMultiplier < 1);
  const ecmPct = ecmAbility ? Math.round((1 - ecmAbility.ECMAccuracyMultiplier) * 100) : 0;

  return (
    <div class={`relative transition-opacity ${isRefetching ? 'opacity-70' : ''}`}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-5 mb-3">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            {countryFlagUrl && (
              <img src={countryFlagUrl} alt={data.country?.Name} width={32} height={20} class="border border-[var(--border)]" />
            )}
            <div class="min-w-0">
              <p class="text-xs font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-1">
                {catLabel}
              </p>
              <h1 class="text-2xl font-semibold text-[var(--text)] truncate">
                {data.displayName}
              </h1>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <p class="text-xs font-mono tracking-widest uppercase text-[var(--text-dim)]">Cost</p>
              <p class="text-xl font-semibold text-[var(--accent)]">{data.totalCost}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid: 3 columns on desktop ───────────────────── */}
      <div class="grid grid-cols-1 md:grid-cols-[300px_1fr_300px] gap-3">

        {/* Left column: stats panels */}
        <div class="flex flex-col gap-3">
          {data.abilities.length > 0 && (
            <UnitAbilitiesPanel abilities={data.abilities} />
          )}
          {data.mobility && (
            <UnitMobilityPanel
              mobility={data.mobility}
              flyPreset={data.flyPreset}
              unitType={unit.Type}
            />
          )}
          {data.sensors.length > 0 && (
            <UnitSensorsPanel
              sensors={data.sensors}
              abilities={data.abilities}
            />
          )}
        </div>

        {/* Center column: portrait + armor + core stats */}
        <div class="flex flex-col gap-3 max-w-lg mx-auto w-full">
          {/* Portrait with armor + ECM overlay */}
          <div class="border border-[var(--border)] bg-[var(--bg-raised)] relative overflow-hidden">
            <div
              class="aspect-[3/2] bg-[#0b0f14] bg-no-repeat bg-center"
              style={{ backgroundImage: `url(${portraitUrl})`, backgroundSize: '115%' }}
            >
              {data.armor && <UnitArmorDiagram armor={data.armor} />}
              {ecmPct > 0 && (
                <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-[var(--accent)]/40 px-2 py-1">
                  <GameIcon src={UtilIconPaths.TRAIT_ECM} size={18} variant="accent" alt="ECM" />
                  <span class="text-sm font-semibold text-[var(--accent)] font-mono">{ecmPct}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Core stats row */}
          <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-4">
            <div class="flex flex-wrap justify-center gap-3">
              {data.armor && (
                <>
                  <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label="HP" value={data.armor.MaxHealthPoints} />
                  <StatBadge icon={UtilIconPaths.STAT_ARMOR} label="Armor" value={data.armor.ArmorValue} />
                </>
              )}
              <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label="Weight" value={unit.Weight ? `${(unit.Weight / 1000).toFixed(1)}t` : '—'} />
              <StatBadge icon={UtilIconPaths.STAT_STEALTH} label="Stealth" value={unit.Stealth} />
              {unit.InfantrySlots > 0 && (
                <StatBadge icon={UtilIconPaths.STAT_SEATS} label="Seats" value={unit.InfantrySlots} />
              )}
              {data.mobility?.HeavyLiftWeight ? (
                <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label="Lift" value={data.mobility.HeavyLiftWeight} />
              ) : null}
            </div>
          </div>

        </div>

        {/* Right column: modifications + availability */}
        <div class="flex flex-col gap-3">
          {data.modifications.length > 0 && (
            <UnitModifications
              modifications={data.modifications}
              onOptionChange$={onOptionChange$}
            />
          )}
          {data.availability.length > 0 && (
            <UnitAvailabilityPanel availability={data.availability} />
          )}
          {data.squadMembers.length > 0 && (
            <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-4">
              <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-3">Squad Composition</p>
              <div class="grid grid-cols-3 gap-1.5">
                {data.squadMembers.map((member, idx) => {
                  const pw = member.primaryWeapon;
                  const sw = member.specialWeapon;
                  const pwIcon = pw?.HUDIcon ? toWeaponIconPath(pw.HUDIcon) : null;
                  const swIcon = sw?.HUDIcon ? toWeaponIconPath(sw.HUDIcon) : null;
                  const tooltip = [
                    `#${idx + 1} (priority ${member.DeathPriority})`,
                    pw ? `Primary: ${pw.HUDName || pw.Name}` : null,
                    sw ? `Special: ${sw.HUDName || sw.Name}` : null,
                  ].filter(Boolean).join('\n');
                  return (
                    <div
                      key={member.Id}
                      class="flex flex-col items-center gap-1 p-1.5 bg-[var(--bg)]/40"
                      title={tooltip}
                    >
                      <span class="text-[9px] font-mono text-[var(--text-dim)]">#{idx + 1}</span>
                      <div class="flex items-center gap-1">
                        {pwIcon && (
                          <img src={pwIcon} width={16} height={16} class="w-4 h-4 object-contain brightness-0 invert opacity-80" alt={pw?.HUDName || ''} />
                        )}
                        {swIcon && (
                          <img src={swIcon} width={16} height={16} class="w-4 h-4 object-contain opacity-80" alt={sw?.HUDName || ''} style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(170deg)' }} />
                        )}
                        {!pwIcon && !swIcon && (
                          <span class="text-[10px] text-[var(--text-dim)]">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Full-width weapons section below grid ─────────────── */}
      {data.weapons.length > 0 && (
        <div class="mt-3">
          <UnitWeaponsPanel weapons={data.weapons} unitId={unit.Id} />
        </div>
      )}
    </div>
  );
});

/* ── Stat Badge ─────────────────────────────────────────────────── */

const StatBadge = component$<{ icon: string; label: string; value: number | string }>(
  ({ icon, label, value }) => (
    <div class="flex flex-col items-center gap-1 p-2 bg-[var(--bg)]/40" title={label}>
      <GameIcon src={icon} size={22} variant="white" alt={label} />
      <span class="text-sm font-semibold text-[var(--text)] text-center">{value}</span>
    </div>
  ),
);

/* ── Head ────────────────────────────────────────────────────────── */

export const head: DocumentHead = ({ params }) => {
  return {
    title: `Unit ${params.unitid} - BA Hub`,
    meta: [
      { name: 'description', content: `Unit details and configuration for unit ${params.unitid}` },
    ],
  };
};
