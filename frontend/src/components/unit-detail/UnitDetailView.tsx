import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import {
  toCountryIconPath, toPortraitIconPath,
  UtilIconPaths,
} from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';
import type { UnitDetailModSlot, UnitDetailData } from '~/lib/graphql-types';
import { UnitModifications } from '~/components/unit-detail/UnitModifications';
import { UnitArmorDiagram } from '~/components/unit-detail/UnitArmorDiagram';
import { UnitMobilityPanel } from '~/components/unit-detail/UnitMobilityPanel';
import { UnitSensorsPanel } from '~/components/unit-detail/UnitSensorsPanel';
import { UnitAbilitiesPanel } from '~/components/unit-detail/UnitAbilitiesPanel';
import { UnitWeaponsPanel } from '~/components/unit-detail/UnitWeaponsPanel';
import { UnitAvailabilityPanel } from '~/components/unit-detail/UnitAvailabilityPanel';
import { SquadCompositionPanel } from '~/components/unit-detail/SquadCompositionPanel';
import { StatBadge } from '~/components/unit-detail/StatBadge';
import { EmptyPanel } from '~/components/unit-detail/EmptyPanel';

const CATEGORY_I18N: Record<number, string> = {
  0: 'unitDetail.category.rec', 1: 'unitDetail.category.inf', 2: 'unitDetail.category.veh',
  3: 'unitDetail.category.sup', 5: 'unitDetail.category.hel', 6: 'unitDetail.category.air', 7: 'unitDetail.category.trn',
};

export type UnitDetailViewProps = {
  data: UnitDetailData;
  isRefetching: boolean;
  onOptionChange$: (modId: number, optionId: number, mods: UnitDetailModSlot[]) => void;
};

export const UnitDetailView = component$<UnitDetailViewProps>(({ data, isRefetching, onOptionChange$ }) => {
  const i18n = useI18n();
  const unit = data.unit;
  const catLabel = t(i18n, CATEGORY_I18N[unit.CategoryType] ?? 'unitDetail.category.rec');
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
          <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)] bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]">
            <div class="flex items-center justify-center gap-2">
              <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
              {countryFlagUrl && (
                <img src={countryFlagUrl} alt={data.country?.Name} width={36} height={22} class="border border-[rgba(51,51,51,0.15)]" />
              )}
              <h2 class="text-base font-semibold text-[var(--text)]">{data.displayName}</h2>
            </div>
          </div>
          {(unit.Length > 0 || unit.Width > 0 || unit.Height > 0) && (
            <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[rgba(51,51,51,0.3)] bg-[rgba(26,26,26,0.4)]">
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Length">L <span class="text-[var(--text)]">{unit.Length?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Width">W <span class="text-[var(--text)]">{unit.Width?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Height">H <span class="text-[var(--text)]">{unit.Height?.toFixed(1) ?? '—'}</span>m</span>
            </div>
          )}
        </div>

        {/* Core Stats */}
        <div class="p-3 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          <div class="flex flex-wrap justify-center gap-2">
            <StatBadge icon={UtilIconPaths.STAT_COST} label={t(i18n, 'unitDetail.stat.cost')} value={data.totalCost} compact />
            {data.armor && (
              <>
                <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label={t(i18n, 'unitDetail.stat.hp')} value={data.armor.MaxHealthPoints} compact />
                {!hasDirArmor && <StatBadge icon={UtilIconPaths.STAT_ARMOR} label={t(i18n, 'unitDetail.stat.armor')} value={data.armor.ArmorValue} compact />}
              </>
            )}
            <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label={t(i18n, 'unitDetail.stat.weight')} value={unit.Weight ? `${unit.Weight}kg` : '—'} compact />
            <StatBadge icon={UtilIconPaths.STAT_STEALTH} label={t(i18n, 'unitDetail.stat.stealth')} value={unit.Stealth !== undefined ? (1 / Math.max(0.1, unit.Stealth)).toFixed(2) : '—'} compact />
            {unit.InfantrySlots > 0 && (
              <StatBadge icon={UtilIconPaths.STAT_SEATS} label={t(i18n, 'unitDetail.stat.seats')} value={unit.InfantrySlots} compact />
            )}
            {data.mobility?.HeavyLiftWeight ? (
              <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label={t(i18n, 'unitDetail.stat.lift')} value={data.mobility.HeavyLiftWeight} compact />
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
          <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)] bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]">
            <div class="flex items-center justify-center gap-2">
              <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
              {countryFlagUrl && (
                <img src={countryFlagUrl} alt={data.country?.Name} width={36} height={22} class="border border-[rgba(51,51,51,0.15)]" />
              )}
              <h2 class="text-base font-semibold text-[var(--text)]">{data.displayName}</h2>
            </div>
          </div>
          {(unit.Length > 0 || unit.Width > 0 || unit.Height > 0) && (
            <div class="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-[rgba(51,51,51,0.3)] bg-[rgba(26,26,26,0.4)]">
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Length">L <span class="text-[var(--text)]">{unit.Length?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Width">W <span class="text-[var(--text)]">{unit.Width?.toFixed(1) ?? '—'}</span>m</span>
              <span class="text-[9px] font-mono text-[var(--text-dim)]" title="Height">H <span class="text-[var(--text)]">{unit.Height?.toFixed(1) ?? '—'}</span>m</span>
            </div>
          )}
        </div>

        <div class="p-3 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          <div class="flex flex-wrap justify-center gap-2">
            <StatBadge icon={UtilIconPaths.STAT_COST} label={t(i18n, 'unitDetail.stat.cost')} value={data.totalCost} compact />
            {data.armor && (
              <>
                <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label={t(i18n, 'unitDetail.stat.hp')} value={data.armor.MaxHealthPoints} compact />
                {!hasDirArmor && <StatBadge icon={UtilIconPaths.STAT_ARMOR} label={t(i18n, 'unitDetail.stat.armor')} value={data.armor.ArmorValue} compact />}
              </>
            )}
            <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label={t(i18n, 'unitDetail.stat.weight')} value={unit.Weight ? `${unit.Weight}kg` : '—'} compact />
            <StatBadge icon={UtilIconPaths.STAT_STEALTH} label={t(i18n, 'unitDetail.stat.stealth')} value={unit.Stealth !== undefined ? (1 / Math.max(0.1, unit.Stealth)).toFixed(2) : '—'} compact />
            {unit.InfantrySlots > 0 && (
              <StatBadge icon={UtilIconPaths.STAT_SEATS} label={t(i18n, 'unitDetail.stat.seats')} value={unit.InfantrySlots} compact />
            )}
            {data.mobility?.HeavyLiftWeight ? (
              <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label={t(i18n, 'unitDetail.stat.lift')} value={data.mobility.HeavyLiftWeight} compact />
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
            <div class="px-4 py-2 border-b border-[rgba(51,51,51,0.3)] bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]">
              <div class="flex items-center justify-center gap-2.5">
                <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--text-dim)]">{catLabel}</span>
                {countryFlagUrl && (
                  <img src={countryFlagUrl} alt={data.country?.Name} width={40} height={25} class="border border-[rgba(51,51,51,0.15)]" />
                )}
                <h2 class="text-lg font-semibold text-[var(--text)]">{data.displayName}</h2>
              </div>
            </div>
            {(unit.Length > 0 || unit.Width > 0 || unit.Height > 0) && (
              <div class="flex items-center justify-center gap-5 px-4 py-1.5 border-t border-[rgba(51,51,51,0.3)] bg-[rgba(26,26,26,0.4)]">
                <span class="text-[10px] font-mono text-[var(--text-dim)]" title="Length">L <span class="text-[var(--text)]">{unit.Length?.toFixed(1) ?? '—'}</span>m</span>
                <span class="text-[10px] font-mono text-[var(--text-dim)]" title="Width">W <span class="text-[var(--text)]">{unit.Width?.toFixed(1) ?? '—'}</span>m</span>
                <span class="text-[10px] font-mono text-[var(--text-dim)]" title="Height">H <span class="text-[var(--text)]">{unit.Height?.toFixed(1) ?? '—'}</span>m</span>
              </div>
            )}
          </div>

          <div class="p-4 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
            <div class="flex flex-wrap justify-center gap-3">
              <StatBadge icon={UtilIconPaths.STAT_COST} label={t(i18n, 'unitDetail.stat.cost')} value={data.totalCost} />
              {data.armor && (
                <>
                  <StatBadge icon={UtilIconPaths.STAT_HEALTH_VEH} label={t(i18n, 'unitDetail.stat.hp')} value={data.armor.MaxHealthPoints} />
                  {!hasDirArmor && <StatBadge icon={UtilIconPaths.STAT_ARMOR} label={t(i18n, 'unitDetail.stat.armor')} value={data.armor.ArmorValue} />}
                </>
              )}
              <StatBadge icon={UtilIconPaths.STAT_WEIGHT} label={t(i18n, 'unitDetail.stat.weight')} value={unit.Weight ? `${unit.Weight}kg` : '—'} />
              <StatBadge icon={UtilIconPaths.STAT_STEALTH} label={t(i18n, 'unitDetail.stat.stealth')} value={unit.Stealth !== undefined ? (1 / Math.max(0.1, unit.Stealth)).toFixed(2) : '—'} />
              {unit.InfantrySlots > 0 && (
                <StatBadge icon={UtilIconPaths.STAT_SEATS} label={t(i18n, 'unitDetail.stat.seats')} value={unit.InfantrySlots} />
              )}
              {data.mobility?.HeavyLiftWeight ? (
                <StatBadge icon={UtilIconPaths.STAT_HEAVYLIFT} label={t(i18n, 'unitDetail.stat.lift')} value={data.mobility.HeavyLiftWeight} />
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


    </div>
  );
});
