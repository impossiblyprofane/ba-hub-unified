import { component$, useSignal, useResource$, Resource, $, useVisibleTask$ } from '@builder.io/qwik';
import { useLocation, Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { useI18n, t } from '~/lib/i18n';
import {
  toCountryIconPath, toPortraitIconPath,
  UtilIconPaths,
} from '~/lib/iconPaths';
import { UnitModifications } from '~/components/unit-detail/UnitModifications';
import { UnitArmorDiagram } from '~/components/unit-detail/UnitArmorDiagram';
import { UnitMobilityPanel } from '~/components/unit-detail/UnitMobilityPanel';
import { UnitSensorsPanel } from '~/components/unit-detail/UnitSensorsPanel';
import { UnitAbilitiesPanel } from '~/components/unit-detail/UnitAbilitiesPanel';
import { UnitWeaponsPanel } from '~/components/unit-detail/UnitWeaponsPanel';
import { UnitAvailabilityPanel } from '~/components/unit-detail/UnitAvailabilityPanel';
import { SquadCompositionPanel } from '~/components/unit-detail/SquadCompositionPanel';

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
  RadarLowAltWeaponRangeModifier: number; RadarHighAltWeaponRangeModifier: number;
  IsRadarStatic: boolean; RadarSwitchCooldown: number;
  IsLaserDesignator: boolean; LaserMaxRange: number; LaserUsableInMove: boolean;
  IsInfantrySprint: boolean; SprintDuration: number; SprintCooldown: number;
  IsSmoke: boolean; SmokeAmmunitionQuantity: number; SmokeCooldown: number;
  IsAPS: boolean; APSQuantity: number; APSCooldown: number; APSHitboxProportion: number;
  APSSupplyCost: number; APSResupplyTime: number;
  IsDecoy: boolean; DecoyQuantity: number; DecoyAccuracyMultiplier: number;
  DecoyCooldown: number; DecoyDuration: number;
  DecoySupplyCost: number; DecoyResupplyTime: number;
};

export type UnitDetailAmmo = {
  Id: number; Name: string; HUDName: string; HUDIcon: string;
  Damage: number; StressDamage: number; PenetrationAtMinRange: number; PenetrationAtGroundRange: number;
  GroundRange: number; LowAltRange: number; HighAltRange: number; MinimalRange: number;
  TargetType: number; ArmorTargeted: number; TrajectoryType: number;
  TopArmorAttack: boolean; LaserGuided: boolean; CanBeIntercepted: boolean;
  NoDamageFalloff: boolean; IgnoreCover: number;
  HealthAOERadius: number; StressAOERadius: number;
  MuzzleVelocity: number; MaxSpeed: number;
  DispersionHorizontalRadius: number; DispersionVerticalRadius: number;
  SupplyCost: number; ResupplyTime: number;
  GenerateSmoke: boolean; Seeker: number; SeekerAngle: number;
  MaxSeekerDistance: number; CanBeTargeted: boolean; CanReaquire: boolean;
  AimStartDelay: number; MainEngineIgnitionDelay: number;
  RotationSpeed: number; BurnTime: number;
  Airburst: boolean;
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
        RadarLowAltWeaponRangeModifier RadarHighAltWeaponRangeModifier
        IsRadarStatic RadarSwitchCooldown
        IsLaserDesignator LaserMaxRange LaserUsableInMove
        IsInfantrySprint SprintDuration SprintCooldown
        IsSmoke SmokeAmmunitionQuantity SmokeCooldown
        IsAPS APSQuantity APSCooldown APSHitboxProportion APSSupplyCost APSResupplyTime
        IsDecoy DecoyQuantity DecoyAccuracyMultiplier DecoyCooldown DecoyDuration DecoySupplyCost DecoyResupplyTime
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
            MaxSeekerDistance CanBeTargeted CanReaquire
            AimStartDelay MainEngineIgnitionDelay
            RotationSpeed BurnTime
            NoDamageFalloff IgnoreCover Airburst
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
  const cachedData = useSignal<UnitDetailData | null>(null);

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
    <div class="w-full max-w-[1600px] mx-auto">
      {/* Back link */}
      <Link
        href="/arsenal"
        class="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        ← {t(i18n, 'nav.arsenal')}
      </Link>

      <Resource
        value={unitResource}
        onPending={() => {
          if (cachedData.value) {
            return (
              <div class="relative">
                <UnitDetailView
                  data={cachedData.value}
                  isRefetching={true}
                  onOptionChange$={handleOptionChange$}
                />
                <div class="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-none" />
              </div>
            );
          }
          return (
            <div class="p-8">
              <div class="text-sm font-mono text-[var(--text-dim)] animate-pulse">Loading unit data…</div>
            </div>
          );
        }}
        onRejected={(err) => (
          <div class="p-8">
            <p class="text-[var(--red)] text-sm font-mono">Error: {(err as Error).message}</p>
            <Link href="/arsenal" class="text-xs text-[var(--accent)] mt-4 inline-block">
              Return to Arsenal
            </Link>
          </div>
        )}
        onResolved={(data) => {
          cachedData.value = data;
          return (
            <UnitDetailView
              data={data}
              isRefetching={isRefetching.value}
              onOptionChange$={handleOptionChange$}
            />
          );
        }}
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

  // Directional armor check — when present, the single ArmorValue is redundant (shown on portrait overlay)
  const hasDirArmor = data.armor
    ? (data.armor.KinArmorFront > 0 || data.armor.HeatArmorFront > 0 ||
       data.armor.KinArmorRear > 0 || data.armor.HeatArmorRear > 0)
    : false;

  return (
    <div class={`relative transition-opacity ${isRefetching ? 'opacity-70' : ''}`}>

      {/* ── Mobile Layout (< md) - Single column stacked ─────────────────────── */}
      <div class="md:hidden flex flex-col gap-4">

        {/* Portrait + Name Inlay + Dimensions */}
        <div class="overflow-hidden">
          <div
            class="unit-portrait-bg aspect-[3/2] bg-no-repeat bg-center relative"
            style={{ backgroundImage: `url(${portraitUrl}), radial-gradient(ellipse, var(--bg) 30%, transparent 80%)` }}
          >
            {data.armor && <UnitArmorDiagram armor={data.armor} />}
            {ecmPct > 0 && (
              <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-[var(--accent)]/40 px-2 py-1">
                <GameIcon src={UtilIconPaths.TRAIT_ECM} size={18} variant="accent" alt="ECM" />
                <span class="text-sm font-semibold text-[var(--accent)] font-mono">{ecmPct}%</span>
              </div>
            )}
          </div>
          <div class="px-3 py-2 border-b border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
            <div class="flex items-center justify-center gap-2">
              <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
              {countryFlagUrl && (
                <img src={countryFlagUrl} alt={data.country?.Name} width={36} height={22} class="border border-[var(--border)]" />
              )}
              <h2 class="text-base font-semibold text-[var(--text)]">{data.displayName}</h2>
            </div>
          </div>
          {(unit.Length > 0 || unit.Width > 0 || unit.Height > 0) && (
            <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)]/70 to-[var(--bg)]/40">
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Length">L <span class="text-[var(--text)]">{unit.Length?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Width">W <span class="text-[var(--text)]">{unit.Width?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Height">H <span class="text-[var(--text)]">{unit.Height?.toFixed(1) ?? '—'}</span>m</span>
            </div>
          )}
        </div>

        {/* Core Stats */}
        <div class="p-3 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
          <div class="flex flex-wrap justify-center gap-2">
            <StatBadge icon={UtilIconPaths.STAT_COST} label="Cost" value={data.totalCost} compact />
            {data.armor && (
              <>
                <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label="HP" value={data.armor.MaxHealthPoints} compact />
                {!hasDirArmor && <StatBadge icon={UtilIconPaths.STAT_ARMOR} label="Armor" value={data.armor.ArmorValue} compact />}
              </>
            )}
            <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label="Weight" value={unit.Weight ? `${unit.Weight}kg` : '—'} compact />
            <StatBadge icon={UtilIconPaths.STAT_STEALTH} label="Stealth" value={unit.Stealth !== undefined ? (1 / Math.max(0.1, unit.Stealth)).toFixed(2) : '—'} compact />
            {unit.InfantrySlots > 0 && (
              <StatBadge icon={UtilIconPaths.STAT_SEATS} label="Seats" value={unit.InfantrySlots} compact />
            )}
            {data.mobility?.HeavyLiftWeight ? (
              <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label="Lift" value={data.mobility.HeavyLiftWeight} compact />
            ) : null}
          </div>
        </div>

        {/* Modifications */}
        {data.modifications.length > 0 && (
          <UnitModifications
            modifications={data.modifications}
            onOptionChange$={onOptionChange$}
            compact
          />
        )}

        {/* Mobility & Sensors (2-col on sm+) */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-4">
            {data.mobility && (
              <UnitMobilityPanel
                mobility={data.mobility}
                flyPreset={data.flyPreset}
                unitType={unit.Type}
                compact
              />
            )}
            {data.sensors.length > 0 && (
              <UnitSensorsPanel
                sensors={data.sensors}
                abilities={data.abilities}
                compact
              />
            )}
          </div>
          <div class="space-y-4">
            {data.abilities.length > 0 && (
              <UnitAbilitiesPanel abilities={data.abilities} compact />
            )}
            {data.availability.length > 0 && (
              <UnitAvailabilityPanel availability={data.availability} compact />
            )}
          </div>
        </div>

        {/* Squad Composition */}
        {data.squadMembers.length > 0 && (
          <SquadCompositionPanel members={data.squadMembers} compact />
        )}

        {/* Weapons */}
        {data.weapons.length > 0 && (
          <div>
            <UnitWeaponsPanel weapons={data.weapons} unitId={unit.Id} abilities={data.abilities} />
          </div>
        )}
      </div>

      {/* ── Tablet Layout (md - lg) - Portrait full width + 2 columns ───────── */}
      <div class="hidden md:flex lg:hidden flex-col gap-4">
        <div class="overflow-hidden">
          <div
            class="unit-portrait-bg aspect-[3/2] bg-no-repeat bg-center relative"
            style={{ backgroundImage: `url(${portraitUrl}), radial-gradient(ellipse, var(--bg) 30%, transparent 80%)` }}
          >
            {data.armor && <UnitArmorDiagram armor={data.armor} />}
            {ecmPct > 0 && (
              <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-[var(--accent)]/40 px-2 py-1">
                <GameIcon src={UtilIconPaths.TRAIT_ECM} size={18} variant="accent" alt="ECM" />
                <span class="text-sm font-semibold text-[var(--accent)] font-mono">{ecmPct}%</span>
              </div>
            )}
          </div>
          <div class="px-3 py-2 border-b border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
            <div class="flex items-center justify-center gap-2">
              <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
              {countryFlagUrl && (
                <img src={countryFlagUrl} alt={data.country?.Name} width={36} height={22} class="border border-[var(--border)]" />
              )}
              <h2 class="text-base font-semibold text-[var(--text)]">{data.displayName}</h2>
            </div>
          </div>
          {(unit.Length > 0 || unit.Width > 0 || unit.Height > 0) && (
            <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)]/70 to-[var(--bg)]/40">
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Length">L <span class="text-[var(--text)]">{unit.Length?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Width">W <span class="text-[var(--text)]">{unit.Width?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Height">H <span class="text-[var(--text)]">{unit.Height?.toFixed(1) ?? '—'}</span>m</span>
            </div>
          )}
        </div>

        <div class="p-3 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
          <div class="flex flex-wrap justify-center gap-2">
            <StatBadge icon={UtilIconPaths.STAT_COST} label="Cost" value={data.totalCost} compact />
            {data.armor && (
              <>
                <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label="HP" value={data.armor.MaxHealthPoints} compact />
                {!hasDirArmor && <StatBadge icon={UtilIconPaths.STAT_ARMOR} label="Armor" value={data.armor.ArmorValue} compact />}
              </>
            )}
            <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label="Weight" value={unit.Weight ? `${unit.Weight}kg` : '—'} compact />
            <StatBadge icon={UtilIconPaths.STAT_STEALTH} label="Stealth" value={unit.Stealth !== undefined ? (1 / Math.max(0.1, unit.Stealth)).toFixed(2) : '—'} compact />
            {unit.InfantrySlots > 0 && (
              <StatBadge icon={UtilIconPaths.STAT_SEATS} label="Seats" value={unit.InfantrySlots} compact />
            )}
            {data.mobility?.HeavyLiftWeight ? (
              <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label="Lift" value={data.mobility.HeavyLiftWeight} compact />
            ) : null}
          </div>
        </div>

        {data.squadMembers.length > 0 && (
          <SquadCompositionPanel members={data.squadMembers} compact />
        )}

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-4">
            {data.abilities.length > 0 && (
              <UnitAbilitiesPanel abilities={data.abilities} compact />
            )}
            {data.mobility && (
              <UnitMobilityPanel
                mobility={data.mobility}
                flyPreset={data.flyPreset}
                unitType={unit.Type}
                compact
              />
            )}
            {data.sensors.length > 0 && (
              <UnitSensorsPanel
                sensors={data.sensors}
                abilities={data.abilities}
                compact
              />
            )}
          </div>

          <div class="flex flex-col gap-4">
            {data.availability.length > 0 && (
              <UnitAvailabilityPanel availability={data.availability} compact />
            )}
            {data.modifications.length > 0 && (
              <UnitModifications
                modifications={data.modifications}
                onOptionChange$={onOptionChange$}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {data.weapons.length > 0 && (
        <div class="hidden md:block lg:hidden mt-4">
          <UnitWeaponsPanel weapons={data.weapons} unitId={unit.Id} abilities={data.abilities} />
        </div>
      )}

      {/* ── Desktop Layout (lg+) - 3-column grid ─────────────────────────────── */}
      <div class="hidden lg:grid lg:grid-cols-[1fr_1.2fr_1fr] gap-4">
        {/* Left Column: Abilities, Mobility, Sensors */}
        <div class="flex flex-col gap-4 justify-between">
          {data.abilities.length > 0 ? (
            <UnitAbilitiesPanel abilities={data.abilities} />
          ) : (
            <EmptyPanel label="Abilities" />
          )}
          {data.mobility ? (
            <UnitMobilityPanel
              mobility={data.mobility}
              flyPreset={data.flyPreset}
              unitType={unit.Type}
            />
          ) : (
            <EmptyPanel label="Mobility" />
          )}
          {data.sensors.length > 0 ? (
            <UnitSensorsPanel
              sensors={data.sensors}
              abilities={data.abilities}
            />
          ) : (
            <EmptyPanel label="Optics" />
          )}
        </div>

        {/* Center Column: Core (Portrait, Name, Stats) */}
        <div class="flex flex-col gap-4">
          <div class="overflow-hidden">
            <div
              class="unit-portrait-bg aspect-[3/2] bg-no-repeat bg-center relative"
              style={{ backgroundImage: `url(${portraitUrl}), radial-gradient(ellipse, var(--bg) 30%, transparent 80%)` }}
            >
              {data.armor && <UnitArmorDiagram armor={data.armor} />}
              {ecmPct > 0 && (
                <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-[var(--accent)]/40 px-2 py-1">
                  <GameIcon src={UtilIconPaths.TRAIT_ECM} size={18} variant="accent" alt="ECM" />
                  <span class="text-sm font-semibold text-[var(--accent)] font-mono">{ecmPct}%</span>
                </div>
              )}
            </div>
            <div class="px-4 py-2 border-b border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
              <div class="flex items-center justify-center gap-2.5">
                <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
                {countryFlagUrl && (
                  <img src={countryFlagUrl} alt={data.country?.Name} width={40} height={25} class="border border-[var(--border)]" />
                )}
                <h2 class="text-lg font-semibold text-[var(--text)]">{data.displayName}</h2>
              </div>
            </div>
            {(unit.Length > 0 || unit.Width > 0 || unit.Height > 0) && (
              <div class="flex items-center justify-center gap-5 px-4 py-1.5 border-t border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)]/70 to-[var(--bg)]/40">
                <span class="text-[10px] font-mono text-[var(--text-dim)]" title="Length">L <span class="text-[var(--text)]">{unit.Length?.toFixed(1) ?? '—'}</span>m</span>
                <span class="text-[10px] font-mono text-[var(--text-dim)]" title="Width">W <span class="text-[var(--text)]">{unit.Width?.toFixed(1) ?? '—'}</span>m</span>
                <span class="text-[10px] font-mono text-[var(--text-dim)]" title="Height">H <span class="text-[var(--text)]">{unit.Height?.toFixed(1) ?? '—'}</span>m</span>
              </div>
            )}
          </div>

          <div class="p-4 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
            <div class="flex flex-wrap justify-center gap-3">
              <StatBadge icon={UtilIconPaths.STAT_COST} label="Cost" value={data.totalCost} />
              {data.armor && (
                <>
                  <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label="HP" value={data.armor.MaxHealthPoints} />
                  {!hasDirArmor && <StatBadge icon={UtilIconPaths.STAT_ARMOR} label="Armor" value={data.armor.ArmorValue} />}
                </>
              )}
              <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label="Weight" value={unit.Weight ? `${unit.Weight}kg` : '—'} />
              <StatBadge icon={UtilIconPaths.STAT_STEALTH} label="Stealth" value={unit.Stealth !== undefined ? (1 / Math.max(0.1, unit.Stealth)).toFixed(2) : '—'} />
              {unit.InfantrySlots > 0 && (
                <StatBadge icon={UtilIconPaths.STAT_SEATS} label="Seats" value={unit.InfantrySlots} />
              )}
              {data.mobility?.HeavyLiftWeight ? (
                <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label="Lift" value={data.mobility.HeavyLiftWeight} />
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Column: Availability, Squad, Modifications */}
        <div class="flex flex-col gap-4 justify-between">
          {data.availability.length > 0 ? (
            <UnitAvailabilityPanel availability={data.availability} />
          ) : (
            <EmptyPanel label="Availability" />
          )}

          {data.squadMembers.length > 0 && (
            <SquadCompositionPanel members={data.squadMembers} />
          )}

          {data.modifications.length > 0 && (
            <UnitModifications
              modifications={data.modifications}
              onOptionChange$={onOptionChange$}
            />
          )}
        </div>
      </div>

      {/* ── Desktop Weapons Section (full width) ─────────────────────────────── */}
      {data.weapons.length > 0 && (
        <div class="hidden lg:block mt-4">
          <UnitWeaponsPanel weapons={data.weapons} unitId={unit.Id} abilities={data.abilities} />
        </div>
      )}

      {/* ── Style Experiments ────────────────────────────────────────────────── */}
      <div class="mt-12 border-t border-[var(--border)]/30 pt-6">
        <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)]/50 mb-4">Style Experiments</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Variant A: Accent top-line */}
          <div class="border-t-2 border-t-[var(--accent)]/60 border border-[var(--border)]/30">
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--border)]/20">
              A — Accent Top Line
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">Panel content here. Border-only with a coloured top accent strip to anchor the eye.</span>
            </div>
          </div>

          {/* Variant B: Gradient fade border */}
          <div class="relative overflow-hidden">
            <div class="absolute inset-0 border border-[var(--border)]/20" />
            <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
            <div class="relative">
              <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--border)]/20">
                B — Gradient Top Edge
              </p>
              <div class="p-3">
                <span class="text-xs font-mono text-[var(--text-dim)]">Panel with a gradient line at top. Subtle fade-in from the edges, no solid background.</span>
              </div>
            </div>
          </div>

          {/* Variant C: Frosted glass */}
          <div class="bg-white/[0.03] backdrop-blur-sm border border-[var(--border)]/20">
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--border)]/20">
              C — Frosted Glass
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">Very subtle white tint with backdrop blur. Gives depth without solid colour.</span>
            </div>
          </div>

          {/* Variant D: Glow border */}
          <div class="border border-[var(--accent)]/15 shadow-[0_0_12px_-3px_var(--accent)]">
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--accent)]/10">
              D — Accent Glow
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">Faint accent-coloured border with outer glow. Draws attention without fill.</span>
            </div>
          </div>

          {/* Variant E: Left accent bar */}
          <div class="border-l-2 border-l-[var(--accent)]/50 border border-[var(--border)]/20">
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--border)]/20">
              E — Left Accent Bar
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">Thick left border in accent colour. Clean military feel, easy to scan vertically.</span>
            </div>
          </div>

          {/* Variant F: Inset shadow */}
          <div class="border border-[var(--border)]/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--border)]/20">
              F — Inner Highlight
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">Barely visible top inset shadow creates depth. Minimal borders, very flat.</span>
            </div>
          </div>

          {/* Variant G: Gradient bg fade */}
          <div class="border border-[var(--border)]/20 bg-gradient-to-b from-[var(--bg-raised)]/40 to-transparent">
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] px-3 py-2 border-b border-[var(--border)]/20">
              G — Top-Down Fade
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">Gradient from subtle raised bg at top fading to transparent. Panel dissolves into page.</span>
            </div>
          </div>

          {/* Variant H: No border, divider only */}
          <div>
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--accent)]/50 px-3 py-2 border-b border-[var(--border)]/30">
              H — Divider Only ★
            </p>
            <div class="p-3">
              <span class="text-xs font-mono text-[var(--text-dim)]">No box borders at all. Just a divider line under the header. Maximum transparency.</span>
            </div>
          </div>

        </div>

        {/* Portrait bottom variations */}
        <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)]/50 mt-8 mb-4">Portrait Bottom Variants</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* PB-1: Current — solid bg */}
          <div>
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--accent)]/50 px-3 py-2 border-b border-[var(--border)]/30">PB-1 — Solid BG (current) ★</p>
            <div class="overflow-hidden">
              <div class="aspect-[3/1] bg-no-repeat bg-center unit-portrait-bg" style={{ backgroundImage: `url(${portraitUrl}), radial-gradient(ellipse, var(--bg) 30%, transparent 80%)` }} />
              <div class="px-3 py-2 border-b border-[var(--border)]/30 bg-[var(--bg)]">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
                  <span class="text-sm font-semibold text-[var(--text)]">{data.displayName}</span>
                </div>
              </div>
              <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[var(--border)]/30 bg-[var(--bg)]">
                <span class="text-[9px] font-mono text-[var(--text-dim)]">Solid var(--bg). Grid fully suppressed.</span>
              </div>
            </div>
          </div>

          {/* PB-2: Gradient fade — slight grid creep */}
          <div>
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--accent)]/50 px-3 py-2 border-b border-[var(--border)]/30">PB-2 — Gradient Fade</p>
            <div class="overflow-hidden">
              <div class="aspect-[3/1] bg-no-repeat bg-center unit-portrait-bg" style={{ backgroundImage: `url(${portraitUrl}), radial-gradient(ellipse, var(--bg) 30%, transparent 80%)` }} />
              <div class="px-3 py-2 border-b border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
                  <span class="text-sm font-semibold text-[var(--text)]">{data.displayName}</span>
                </div>
              </div>
              <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[var(--border)]/30 bg-gradient-to-b from-[var(--bg)]/70 to-[var(--bg)]/40">
                <span class="text-[9px] font-mono text-[var(--text-dim)]">Gradient fade. Slight grid creep at bottom edge.</span>
              </div>
            </div>
          </div>

          {/* PB-3: Transparent — full grid visible */}
          <div>
            <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--accent)]/50 px-3 py-2 border-b border-[var(--border)]/30">PB-3 — Transparent</p>
            <div class="overflow-hidden">
              <div class="aspect-[3/1] bg-no-repeat bg-center unit-portrait-bg" style={{ backgroundImage: `url(${portraitUrl}), radial-gradient(ellipse, var(--bg) 30%, transparent 80%)` }} />
              <div class="px-3 py-2 border-b border-[var(--border)]/30">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
                  <span class="text-sm font-semibold text-[var(--text)]">{data.displayName}</span>
                </div>
              </div>
              <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[var(--border)]/30">
                <span class="text-[9px] font-mono text-[var(--text-dim)]">No bg. Grid fully visible through name/dims.</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
});

/* ── Empty Panel ────────────────────────────────────────────────── */

const EmptyPanel = component$<{ label: string; compact?: boolean; fill?: boolean }>(({ label, compact, fill }) => (
  <div
    class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70 ${fill ? 'h-full flex flex-col' : ''}`}
  >
    <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[var(--border)]/30`}>
      {label}
    </p>
    <div class="flex-1 flex items-center justify-center p-4">
      <span class="text-xs font-mono text-[var(--text-dim)]/50 uppercase tracking-widest">No {label}</span>
    </div>
  </div>
));

/* ── Stat Badge ─────────────────────────────────────────────────── */

const StatBadge = component$<{ icon: string; label: string; value: number | string; compact?: boolean; accent?: boolean }>(
  ({ icon, label, value, compact, accent }) => (
    <div
      class={
        compact
          ? 'flex items-center gap-2 px-2 py-1 bg-[var(--bg)]/40'
          : 'flex flex-col items-center gap-1 p-2 bg-[var(--bg)]/40'
      }
      title={label}
    >
      <GameIcon src={icon} size={compact ? 16 : 22} variant={accent ? 'accent' : 'white'} alt={label} />
      <span class={`${compact ? 'text-xs' : 'text-sm text-center'} font-semibold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
        {value}
      </span>
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
