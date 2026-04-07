/**
 * UnitEditorPanel — dual floating overlay panels for the deck editor.
 *
 * Layout (overlaid on top of content, no space consumed):
 *   LEFT panel  — main unit: identity header → modifications → stats
 *   RIGHT panel — transport (if unit has one): identity → mods → stats
 *                 When "on foot" (no transport), shows a skeleton ON FOOT cover
 *
 * Seamlessly switches when clicking different slots (parent keys component).
 */
import {
  $, component$, useResource$, useSignal, Resource,
} from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { UnitConfig, Set2Key, DeckModification } from '@ba-hub/shared';
import type {
  ArsenalCard, UnitModificationsResponse, BuilderUnitSummary,
} from '~/lib/graphql-types';
import {
  UNIT_MODIFICATIONS_QUERY, BUILDER_UNIT_SUMMARY_QUERY,
} from '~/lib/queries/builder';
import { graphqlFetchRaw } from '~/lib/graphqlClient';
import { toUnitIconPath, toWeaponIconPath, toPortraitIconPath, UtilIconPaths } from '~/lib/iconPaths';
import { GameIcon } from '~/components/GameIcon';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import {
  GAME_LOCALES, getGameLocaleValueOrKey, useI18n, t,
} from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import { UnitType } from '~/lib/unit-types';
import { resolveUnitDisplayName, resolveTransportDisplayName } from '~/lib/deck';

/* ── Target-type bitmask → icon lookup ── */
const TARGET_BITS: Array<{ bit: number; icon: string; alt: string }> = [
  { bit: 1, icon: UtilIconPaths.TARGET_TYPE_INF, alt: 'INF' },
  { bit: 2, icon: UtilIconPaths.TARGET_TYPE_VEH, alt: 'VEH' },
  { bit: 4, icon: UtilIconPaths.TARGET_TYPE_HELI, alt: 'HELI' },
  { bit: 8, icon: UtilIconPaths.TARGET_TYPE_AIRCRAFT, alt: 'AIR' },
  { bit: 16, icon: UtilIconPaths.TARGET_TYPE_MISSILE, alt: 'MSL' },
  { bit: 32, icon: UtilIconPaths.TARGET_TYPE_RDR, alt: 'RDR' },
];

interface UnitEditorPanelProps {
  unit: UnitConfig;
  category: Set2Key;
  slotIndex: number;
  arsenalCard?: ArsenalCard;
  transportCard?: ArsenalCard;
  /** All transport ArsenalCards available for this unit (empty = no transport options). */
  availableTransportCards: ArsenalCard[];
  locale: Locale;
  onModificationChange$: PropFunction<(
    category: Set2Key,
    slotIndex: number,
    modId: number,
    optId: number,
    cost: number,
    run: string | undefined,
    cwun: string | undefined,
    type: number,
    isTransport: boolean,
    thumbnailOverride: string | undefined,
    portraitOverride: string | undefined,
  ) => void>;
  onTransportChange$: PropFunction<(
    category: Set2Key,
    slotIndex: number,
    newTransportId: number | null,
  ) => void>;
  onClose$: PropFunction<() => void>;
}

/* ═══════════════════════ Data fetchers ═══════════════════════ */

async function fetchModifications(
  unitId: number,
  signal: AbortSignal,
): Promise<UnitModificationsResponse[]> {
  const result = await graphqlFetchRaw<{ modifications: UnitModificationsResponse[] }>(
    UNIT_MODIFICATIONS_QUERY,
    { unitId },
    { signal },
  );
  return result.data?.modifications ?? [];
}

async function fetchSummary(
  unitId: number,
  optionIds: number[],
  signal: AbortSignal,
): Promise<BuilderUnitSummary | null> {
  const result = await graphqlFetchRaw<{ unitDetail: BuilderUnitSummary }>(
    BUILDER_UNIT_SUMMARY_QUERY,
    { id: unitId, optionIds },
    { signal },
  );
  return result.data?.unitDetail ?? null;
}

/* ═══════════════════ Shared sub-renderers ═══════════════════ */

/** Render a modification dropdown list */
function renderModDropdowns(
  modsResource: ReturnType<typeof useResource$<UnitModificationsResponse[]>>,
  modList: DeckModification[],
  headerKey: string,
  locale: Locale,
  i18n: ReturnType<typeof useI18n>,
  handleOptionChange: (modId: number, optId: number, mods: UnitModificationsResponse[], modType: number, isTransport: boolean) => void,
  isTransport: boolean,
) {
  const getSelectedOptId = (ml: DeckModification[], modId: number): number | null => {
    const entry = ml.find(m => m.modId === modId);
    return entry ? entry.optId : null;
  };

  return (
    <div class="px-3 py-2">
      <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[9px] mb-2 border-b border-[rgba(51,51,51,0.3)] pb-1">
        {t(i18n, headerKey)}
      </p>
      <Resource
        value={modsResource}
        onPending={() => (
          <p class="text-[var(--text-dim)] text-xs font-mono py-1">{t(i18n, 'builder.unitEditor.loading')}</p>
        )}
        onRejected={(err) => (
          <p class="text-[var(--red)] text-xs py-1">{(err as Error).message}</p>
        )}
        onResolved={(mods) => {
          if (!mods.length) {
            return <p class="text-[var(--text-dim)] text-xs font-mono py-1">{t(i18n, 'builder.unitEditor.noMods')}</p>;
          }
          const sorted = [...mods].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
          return (
            <div class="space-y-2">
              {sorted.map((mod) => {
                const opts = [...mod.options].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
                const selId = getSelectedOptId(modList, mod.Id);
                const label = getGameLocaleValueOrKey(GAME_LOCALES.modopts, mod.UIName || mod.Name, locale) || mod.Name || `Mod ${mod.Id}`;
                return (
                  <div key={mod.Id}>
                    <label class="block text-[9px] font-mono font-semibold text-[var(--text-dim)] mb-0.5 uppercase tracking-wider">
                      {label}
                    </label>
                    <select
                      class="w-full bg-[rgba(26,26,26,0.6)] border border-[var(--border)] text-[var(--text)] text-xs font-mono px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none appearance-none cursor-pointer"
                      value={selId ?? ''}
                      onChange$={(e: Event) => {
                        const v = parseInt((e.target as HTMLSelectElement).value);
                        if (!isNaN(v)) handleOptionChange(mod.Id, v, mods, mod.Type ?? 0, isTransport);
                      }}
                    >
                      {opts.map((o) => {
                        const oLabel = getGameLocaleValueOrKey(GAME_LOCALES.modopts, o.UIName || o.Name, locale) || o.Name || `Option ${o.Id}`;
                        const cost = o.Cost && o.Cost > 0 ? ` (+${o.Cost})` : o.Cost && o.Cost < 0 ? ` (${o.Cost})` : '';
                        const def = o.IsDefault ? ` (${t(i18n, 'builder.unitEditor.default')})` : '';
                        return <option key={o.Id} value={o.Id}>{oLabel + def + cost}</option>;
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          );
        }}
      />
    </div>
  );
}

/** Helper: pick the right speed icon for a unit type */
function speedIcon(unitType: number): string {
  switch (unitType) {
    case UnitType.Infantry: return UtilIconPaths.MOBILITY_FORWARD_INFANTRY;
    case UnitType.Helicopter: return UtilIconPaths.MOBILITY_FORWARD_HELI;
    case UnitType.Aircraft: return UtilIconPaths.MOBILITY_FORWARD_AIR;
    default: return UtilIconPaths.MOBILITY_FORWARD_VEH;
  }
}

/** Helper: pick the right HP icon for a unit type */
function hpIcon(unitType: number): string {
  return unitType === UnitType.Infantry ? UtilIconPaths.STAT_HEALTH_INFANTRY : UtilIconPaths.STAT_HEALTH_VEH;
}

/** Render the stats section from a summary resource */
function renderStats(
  summaryResource: ReturnType<typeof useResource$<BuilderUnitSummary | null>>,
  locale: Locale,
  i18n: ReturnType<typeof useI18n>,
  transportCapacity?: number,
  cargoCapacity?: number,
  weaponView?: { value: 'weapons' | 'loadout' | 'squad' },
) {
  return (
    <Resource
      value={summaryResource}
      onPending={() => (
        <p class="text-[var(--text-dim)] text-xs font-mono p-3">{t(i18n, 'builder.unitEditor.loadingStats')}</p>
      )}
      onRejected={(err) => (
        <p class="text-[var(--red)] text-xs p-3">{(err as Error).message}</p>
      )}
      onResolved={(data) => {
        if (!data) return <p class="text-[var(--text-dim)] text-xs font-mono p-3">{'\u2014'}</p>;

        const uType = data.unit.Type ?? 0;
        const isInfantry = uType === UnitType.Infantry;
        const isHeli = uType === UnitType.Helicopter;
        const isAircraft = uType === UnitType.Aircraft;

        const hp = data.armor?.MaxHealthPoints ?? 0;
        const stealthRaw = data.unit.Stealth ?? 0;
        const stealth = stealthRaw > 0 ? (1 / Math.max(0.1, stealthRaw)).toFixed(1) : '—';
        const squadCount = data.squadMembers?.length ?? 0;
        const weight = isInfantry && squadCount > 0 ? squadCount * 125 : (data.unit.Weight ?? 0);
        const weightTip = isInfantry && squadCount > 0
          ? `Weight: ${weight}kg (${squadCount} members \u00D7 125kg)`
          : `Weight: ${weight}`;
        const seats = data.unit.InfantrySlots ?? 0;
        const armorVal = data.armor?.ArmorValue ?? 0;

        /* ── Optics — doubled to match game display ── */
        const sensorData = data.sensors?.[0];
        const optGround = sensorData ? Math.round(sensorData.OpticsGround * 2) : 0;
        const optLowAlt = sensorData ? Math.round(sensorData.OpticsLowAltitude * 2) : 0;
        const optHighAlt = sensorData ? Math.round(sensorData.OpticsHighAltitude * 2) : 0;
        /* Primary optic: aircraft show air (high alt), everything else shows ground */
        const primaryOptic = isAircraft ? optHighAlt : optGround;
        const opticsTip = `Ground: ${optGround}m | Low Alt: ${optLowAlt}m | High Alt: ${optHighAlt}m`;

        /* ── Speed values by type ── */
        const roadSpeed = Math.round(data.mobility?.MaxSpeedRoad ?? 0);
        const offRoadSpeed = Math.round(data.mobility?.MaxCrossCountrySpeed ?? 0);
        const reverseSpeed = Math.round(data.mobility?.MaxSpeedReverse ?? 0);
        const agility = data.mobility?.Agility ?? 0;
        const turnRate = data.mobility?.TurnRate ?? 0;
        const loiterTime = data.mobility?.LoiteringTime ?? 0;
        const hasAfterburner = data.mobility?.IsAfterburner ?? false;

        /* ── Traits ── */
        const traits: Array<{ icon: string; label: string }> = [];
        const ab = data.abilities?.[0];
        if (ab) {
          if (ab.IsRadar) traits.push({ icon: UtilIconPaths.TRAIT_RADAR, label: 'Radar' });
          if (ab.IsLaserDesignator) traits.push({ icon: UtilIconPaths.TRAIT_LASERDESIGNATOR, label: 'Laser' });
          if (ab.IsSmoke) traits.push({ icon: UtilIconPaths.TRAIT_SMOKE, label: 'Smoke' });
          if (ab.IsAPS) traits.push({ icon: UtilIconPaths.TRAIT_APS, label: 'APS' });
          if (ab.IsDecoy) traits.push({ icon: UtilIconPaths.TRAIT_ECM, label: 'Decoy' });
          if (ab.ECMAccuracyMultiplier && ab.ECMAccuracyMultiplier !== 1) {
            traits.push({ icon: UtilIconPaths.TRAIT_ECM, label: 'ECM ' + Math.round(ab.ECMAccuracyMultiplier * 100) + '%' });
          }
        }
        if (data.mobility?.IsAmphibious) traits.push({ icon: UtilIconPaths.TRAIT_AMPHIBIOUS, label: 'Amphibious' });
        if (data.mobility?.IsAirDroppable) traits.push({ icon: UtilIconPaths.TRAIT_AIRDROP, label: 'Airdrop' });

        /* ── Weapons with first ammo ── */
        const wMap = new Map<string, { w: (typeof data.weapons)[0]; count: number }>();
        for (const w of data.weapons) {
          const existing = wMap.get(w.weapon.HUDName);
          if (existing) existing.count++;
          else wMap.set(w.weapon.HUDName, { w, count: 1 });
        }
        const uniqueWeapons = Array.from(wMap.values());

        /* ── Weapon → ammo lookup for LDT / SQD views ── */
        const weaponAmmoMap = new Map<number, Array<{ name: string; qty: number; icon?: string }>>();
        for (const w of data.weapons) {
          const wId = w.weapon.Id;
          if (weaponAmmoMap.has(wId)) continue;
          const ammoEntries: Array<{ name: string; qty: number; icon?: string }> = [];
          for (const slot of w.ammunition ?? []) {
            const a = slot.ammunition;
            if (!a) continue;
            const aName = getGameLocaleValueOrKey(GAME_LOCALES.specs, a.HUDName, locale) || a.HUDName || '??';
            const displayQty = Math.round((slot.quantity ?? 0) * (a.HUDMultiplier ?? 1));
            ammoEntries.push({ name: aName, qty: displayQty, icon: a.HUDIcon ?? undefined });
          }
          weaponAmmoMap.set(wId, ammoEntries);
        }

        /* ── Section helper ── */
        const statCell = (icon: string, val: string, lbl: string, tooltip?: string) => (
          <SimpleTooltip key={lbl} text={tooltip ?? lbl}>
            <div class="flex items-center gap-1.5 bg-[rgba(26,26,26,0.4)] px-2 py-1.5 border border-[rgba(51,51,51,0.15)] cursor-default">
              <GameIcon src={icon} size={14} alt={lbl} variant="white" />
              <span class="text-[10px] font-mono text-[var(--text)]">{val}</span>
            </div>
          </SimpleTooltip>
        );

        const sectionHeader = (key: string) => (
          <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[9px] mb-2 border-b border-[rgba(51,51,51,0.3)] pb-1">
            {t(i18n, key)}
          </p>
        );

        /* ── Determine directional armor availability ── */
        const hasDirectionalArmor = !isInfantry && data.armor &&
          (data.armor.KinArmorFront || data.armor.HeatArmorFront);

        return (
          <div>
            {/* ═══ 1. STATS (core) ═══ */}
            <div class="px-3 py-2">
              {sectionHeader('builder.unitEditor.quickStats')}
              <div class="grid grid-cols-3 gap-1">
                {statCell(hpIcon(uType), String(hp), 'HP', `Health Points: ${hp}`)}
                {statCell(UtilIconPaths.STAT_STEALTH, '\u00D7' + stealth, 'Stealth', `Stealth multiplier: ×${stealth} (raw: ${stealthRaw})`)}
                {statCell(UtilIconPaths.STAT_OPTICS, primaryOptic + 'm', 'Optics', opticsTip)}
                {statCell(UtilIconPaths.STAT_WEIGHT, String(weight), 'Weight', weightTip)}
                {!hasDirectionalArmor && armorVal > 0 && statCell(UtilIconPaths.STAT_ARMOR, String(armorVal), 'Armor', `Armor value: ${armorVal}`)}
                {seats > 0 && statCell(UtilIconPaths.STAT_SEATS, String(seats), 'Seats', `Infantry slots: ${seats}`)}
                {(transportCapacity ?? 0) > 0 && statCell(UtilIconPaths.STAT_CAPACITY, String(transportCapacity), 'Capacity', `Transport capacity: ${transportCapacity}`)}
                {(cargoCapacity ?? 0) > 0 && statCell(UtilIconPaths.LOAD_CAPACITY, String(cargoCapacity), 'Cargo', `Cargo capacity: ${cargoCapacity}`)}
                {/* Infantry speed goes inline — they only have one speed value */}
                {isInfantry && roadSpeed > 0 && statCell(speedIcon(uType), roadSpeed + ' km/h', 'Speed', `Speed: ${roadSpeed} km/h`)}
              </div>
            </div>

            {/* ═══ 2. SPEED (non-infantry only) ═══ */}
            {!isInfantry && (
            <div class="px-3 py-2">
              {sectionHeader('builder.unitEditor.speed')}
              <div class="grid grid-cols-3 gap-1">
                {(isAircraft || isHeli) ? (
                  /* Aircraft / Helicopter speed layout */
                  <>
                    {statCell(speedIcon(uType), (roadSpeed || offRoadSpeed) + ' km/h', 'Speed', `Max speed: ${roadSpeed || offRoadSpeed} km/h`)}
                    {agility > 0 && statCell(
                      isAircraft ? UtilIconPaths.STAT_AGILITY_AIR : UtilIconPaths.STAT_AGILITY_HELI,
                      String(agility), 'Agility', `Agility: ${agility}`,
                    )}
                    {turnRate > 0 && statCell(
                      isAircraft ? UtilIconPaths.STAT_AGILITY_AIR : UtilIconPaths.STAT_AGILITY_HELI,
                      String(turnRate) + '°/s', 'Turn', `Turn rate: ${turnRate}°/s`,
                    )}
                    {isAircraft && loiterTime > 0 && statCell(UtilIconPaths.MOBILITY_FUEL, Math.round(loiterTime) + 's', 'Loiter', `Loiter time: ${Math.round(loiterTime)}s`)}
                    {hasAfterburner && statCell(UtilIconPaths.TRAIT_AFTERBURNER, 'Yes', 'Afterburner', 'Has afterburner')}
                  </>
                ) : (
                  /* Ground unit speed layout (infantry / vehicle) */
                  <>
                    {roadSpeed > 0 && statCell(speedIcon(uType), roadSpeed + ' km/h', 'Road', `Road speed: ${roadSpeed} km/h`)}
                    {offRoadSpeed > 0 && offRoadSpeed !== roadSpeed && statCell(speedIcon(uType), offRoadSpeed + ' km/h', 'Off-road', `Off-road speed: ${offRoadSpeed} km/h`)}
                    {reverseSpeed > 0 && statCell(UtilIconPaths.MOBILITY_REVERSE_VEH, reverseSpeed + ' km/h', 'Reverse', `Reverse speed: ${reverseSpeed} km/h`)}
                  </>
                )}
              </div>
            </div>
            )}

            {/* ═══ 3. ARMOR (directional only — vehicles) ═══ */}
            {hasDirectionalArmor && (
              <div class="px-3 py-2">
                {sectionHeader('builder.unitEditor.armor')}
                  {/* Vehicles / Helis — directional KE/CE table */}
                  <div class="grid grid-cols-5 gap-px text-center text-[9px] font-mono">
                    <div />
                    <div class="text-[var(--text-dim)] pb-1">Front</div>
                    <div class="text-[var(--text-dim)] pb-1">Side</div>
                    <div class="text-[var(--text-dim)] pb-1">Rear</div>
                    <div class="text-[var(--text-dim)] pb-1">Top</div>
                    <div class="flex items-center gap-1 justify-end pr-1">
                      <GameIcon src={UtilIconPaths.ARMOR_KE} size={12} alt="KE" variant="white" />
                      <span class="text-[var(--text-dim)]">KE</span>
                    </div>
                    <SimpleTooltip text={`KE Front: ${data.armor!.KinArmorFront ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-[var(--text)]">{data.armor!.KinArmorFront ?? 0}</div></SimpleTooltip>
                    <SimpleTooltip text={`KE Side: ${data.armor!.KinArmorSides ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-[var(--text)]">{data.armor!.KinArmorSides ?? 0}</div></SimpleTooltip>
                    <SimpleTooltip text={`KE Rear: ${data.armor!.KinArmorRear ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-[var(--text)]">{data.armor!.KinArmorRear ?? 0}</div></SimpleTooltip>
                    <SimpleTooltip text={`KE Top: ${data.armor!.KinArmorTop ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-[var(--text)]">{data.armor!.KinArmorTop ?? 0}</div></SimpleTooltip>
                    <div class="flex items-center gap-1 justify-end pr-1">
                      <GameIcon src={UtilIconPaths.ARMOR_HEAT} size={12} alt="HEAT" variant="white" />
                      <span class="text-orange-400">HEAT</span>
                    </div>
                    <SimpleTooltip text={`HEAT Front: ${data.armor!.HeatArmorFront ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-orange-400">{data.armor!.HeatArmorFront ?? 0}</div></SimpleTooltip>
                    <SimpleTooltip text={`HEAT Side: ${data.armor!.HeatArmorSides ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-orange-400">{data.armor!.HeatArmorSides ?? 0}</div></SimpleTooltip>
                    <SimpleTooltip text={`HEAT Rear: ${data.armor!.HeatArmorRear ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-orange-400">{data.armor!.HeatArmorRear ?? 0}</div></SimpleTooltip>
                    <SimpleTooltip text={`HEAT Top: ${data.armor!.HeatArmorTop ?? 0}`}><div class="bg-[rgba(26,26,26,0.4)] py-1 text-orange-400">{data.armor!.HeatArmorTop ?? 0}</div></SimpleTooltip>
                  </div>
              </div>
            )}

            {/* ═══ 4. TRAITS ═══ */}
            {traits.length > 0 && (
              <div class="px-3 py-2">
                {sectionHeader('builder.unitEditor.traits')}
                <div class="flex flex-wrap gap-1">
                  {traits.map((tr) => (
                    <SimpleTooltip key={tr.label} text={tr.label}>
                      <div class="flex items-center gap-1 bg-[rgba(26,26,26,0.4)] px-2 py-1 border border-[rgba(51,51,51,0.15)] cursor-default">
                        <GameIcon src={tr.icon} size={12} alt={tr.label} variant="accent" />
                        <span class="text-[9px] font-mono text-[var(--text-dim)]">{tr.label}</span>
                      </div>
                    </SimpleTooltip>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ 5. WEAPONS — weapon + first ammo, compact ═══ */}
            {uniqueWeapons.length > 0 && (
              <div class="px-3 py-2">
                {/* Header with optional 3-way toggle for infantry */}
                <div class="flex items-center justify-between mb-2 border-b border-[rgba(51,51,51,0.3)] pb-1">
                  <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[9px] m-0">
                    {t(i18n, 'builder.unitEditor.weapons')}
                  </p>
                  {isInfantry && squadCount > 0 && weaponView && (() => {
                    const modes: Array<{ key: 'weapons' | 'loadout' | 'squad'; label: string }> = [
                      { key: 'weapons', label: 'WPN' },
                      { key: 'loadout', label: 'LDT' },
                      { key: 'squad', label: 'SQD' },
                    ];
                    return (
                      <div class="flex items-center bg-[var(--bg)] border border-[rgba(51,51,51,0.3)]">
                        {modes.map((m) => (
                          <SimpleTooltip key={m.key} text={m.key === 'weapons' ? 'Weapon stats' : m.key === 'loadout' ? 'Grouped squad loadouts' : 'Individual squad members'}>
                            <button
                              type="button"
                              onClick$={() => { if (weaponView) weaponView.value = m.key; }}
                              class={`px-1.5 py-0.5 text-[7px] font-mono uppercase tracking-wider transition-colors ${
                                weaponView.value === m.key
                                  ? 'bg-[rgba(70,151,195,0.15)] text-[var(--accent)] font-bold'
                                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                              }`}
                            >
                              {m.label}
                            </button>
                          </SimpleTooltip>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Loadout view: grouped by primary+special weapon combo */}
                {weaponView?.value === 'loadout' && isInfantry && squadCount > 0 ? (
                  <div class="space-y-1">
                    {(() => {
                      const groups = new Map<string, { count: number; pw: typeof data.squadMembers[0]['primaryWeapon']; sw: typeof data.squadMembers[0]['specialWeapon'] }>();
                      for (const m of data.squadMembers) {
                        const key = `${m.primaryWeapon?.Id ?? 0}-${m.specialWeapon?.Id ?? 0}`;
                        const existing = groups.get(key);
                        if (existing) existing.count++;
                        else groups.set(key, { count: 1, pw: m.primaryWeapon, sw: m.specialWeapon });
                      }
                      return Array.from(groups.values()).map((g, gi) => {
                        const pwName = g.pw ? (getGameLocaleValueOrKey(GAME_LOCALES.specs, g.pw.HUDName, locale) || g.pw.HUDName) : null;
                        const swName = g.sw ? (getGameLocaleValueOrKey(GAME_LOCALES.specs, g.sw.HUDName, locale) || g.sw.HUDName) : null;
                        const pwAmmo = g.pw ? (weaponAmmoMap.get(g.pw.Id) ?? []) : [];
                        const swAmmo = g.sw ? (weaponAmmoMap.get(g.sw.Id) ?? []) : [];
                        return (
                          <div key={gi} class="bg-[rgba(26,26,26,0.4)] px-2 py-1.5 border border-[rgba(51,51,51,0.15)]">
                            <div class="flex items-center gap-1.5">
                              <span class="text-[10px] font-mono font-bold text-[var(--accent)]">{'\u00D7'}{g.count}</span>
                              {g.pw && (
                                <SimpleTooltip text={`Primary: ${pwName}`}>
                                  <div class="flex items-center gap-1">
                                    {g.pw.HUDIcon && <GameIcon src={toWeaponIconPath(g.pw.HUDIcon)} size={14} alt={pwName ?? ''} />}
                                    <span class="text-[9px] font-mono text-[var(--text)] truncate max-w-[100px]">{pwName}</span>
                                  </div>
                                </SimpleTooltip>
                              )}
                              {g.sw && (
                                <SimpleTooltip text={`Special: ${swName}`}>
                                  <div class="flex items-center gap-1 ml-1 pl-1 border-l border-[rgba(51,51,51,0.15)]">
                                    {g.sw.HUDIcon && <GameIcon src={toWeaponIconPath(g.sw.HUDIcon)} size={14} alt={swName ?? ''} />}
                                    <span class="text-[9px] font-mono text-[var(--text-dim)] truncate max-w-[100px]">{swName}</span>
                                  </div>
                                </SimpleTooltip>
                              )}
                            </div>
                            {/* Ammo details per weapon */}
                            {(pwAmmo.length > 0 || swAmmo.length > 0) && (
                              <div class="mt-1 pt-1 border-t border-[rgba(51,51,51,0.1)] space-y-0.5">
                                {pwAmmo.map((a, ai) => (
                                  <div key={`pw-${ai}`} class="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-dim)]">
                                    <span class="text-[var(--text)] font-bold">{a.qty}x</span>
                                    <span class="truncate font-semibold">{a.name}</span>
                                  </div>
                                ))}
                                {swAmmo.map((a, ai) => (
                                  <div key={`sw-${ai}`} class="flex items-center gap-1.5 text-[9px] font-mono text-[var(--accent)] opacity-70">
                                    <span class="font-bold">{a.qty}x</span>
                                    <span class="truncate font-semibold">{a.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>                ) : weaponView?.value === 'squad' && isInfantry && squadCount > 0 ? (
                  /* Squad view: individual members in death-priority order */
                  <div class="grid grid-cols-6 gap-0.5">
                    {data.squadMembers.map((member, mi) => {
                      const pw = member.primaryWeapon;
                      const sw = member.specialWeapon;
                      const pwIcon = pw?.HUDIcon ? toWeaponIconPath(pw.HUDIcon) : null;
                      const swIcon = sw?.HUDIcon ? toWeaponIconPath(sw.HUDIcon) : null;
                      const pwName = pw ? (getGameLocaleValueOrKey(GAME_LOCALES.specs, pw.HUDName, locale) || pw.HUDName) : null;
                      const swName = sw ? (getGameLocaleValueOrKey(GAME_LOCALES.specs, sw.HUDName, locale) || sw.HUDName) : null;
                      const pwAmmo = pw ? (weaponAmmoMap.get(pw.Id) ?? []) : [];
                      const swAmmo = sw ? (weaponAmmoMap.get(sw.Id) ?? []) : [];
                      const tooltipLines = [
                        `#${mi + 1}`,
                        pw ? `Primary: ${pwName}` : null,
                        ...pwAmmo.map(a => `  ${a.qty}x ${a.name}`),
                        sw ? `Special: ${swName}` : null,
                        ...swAmmo.map(a => `  ${a.qty}x ${a.name}`),
                      ].filter(Boolean).join('\n');
                      return (
                        <SimpleTooltip key={`${member.Id}-${mi}`} text={tooltipLines}>
                          <div
                            class="relative flex flex-col items-center bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.1)]"
                          >
                            <span class="absolute top-0 left-0.5 text-[7px] font-mono text-[var(--text-dim)] z-10">{mi + 1}</span>
                            <div class="flex flex-col items-center gap-0 overflow-hidden py-0.5">
                              {pwIcon && (
                                <img src={pwIcon} width={36} height={36} class="w-9 h-6 object-contain brightness-0 invert opacity-80 -my-0.5" alt={pwName ?? ''} />
                              )}
                              {swIcon && (
                                <img src={swIcon} width={36} height={36} class="w-9 h-6 object-contain opacity-80 -my-0.5" alt={swName ?? ''} style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(170deg)' }} />
                              )}
                            </div>
                          </div>
                        </SimpleTooltip>
                      );
                    })}
                  </div>                ) : (
                  /* Standard weapon+ammo view */
                  <div class="space-y-1">
                  {uniqueWeapons.map(({ w, count }) => {
                    const wName = getGameLocaleValueOrKey(GAME_LOCALES.specs, w.weapon.HUDName, locale) || w.weapon.HUDName;
                    const ammoSlots = (w.ammunition ?? []);
                    const ammoList = ammoSlots.map(a => a.ammunition);
                    /* Target type — union of all ammo target types */
                    const tgtType = ammoList.reduce((acc, a) => acc | (a?.TargetType ?? 0), 0);

                    /* Weapon-level trait (STATIC applies to the weapon, not ammo) */
                    const isStatic = !w.weapon.CanShootOnTheMove;

                    return (
                      <div key={w.weapon.Id} class="bg-[rgba(26,26,26,0.4)] px-2 py-1.5 border border-[rgba(51,51,51,0.15)]">
                        {/* Weapon header: icon + name + target type icons */}
                        <div class="flex items-center gap-2">
                          {w.weapon.HUDIcon && (
                            <GameIcon src={toWeaponIconPath(w.weapon.HUDIcon)} size={16} alt={wName} />
                          )}
                          <SimpleTooltip text={wName}>
                            <p class="flex-1 min-w-0 text-[10px] font-mono text-[var(--text)] truncate">
                              {count > 1 ? count + '\u00D7 ' : ''}{wName}
                            </p>
                          </SimpleTooltip>
                          {isStatic && (
                            <SimpleTooltip text="Cannot shoot on the move">
                              <span
                                class="text-[8px] font-mono font-bold uppercase tracking-wider text-[var(--accent)] bg-[rgba(70,151,195,0.08)] px-1 py-0.5 border border-[rgba(70,151,195,0.15)] flex-shrink-0"
                              >STATIC</span>
                            </SimpleTooltip>
                          )}
                          <div class="flex gap-0.5 flex-shrink-0">
                            {TARGET_BITS.filter((tb) => tgtType & tb.bit).map((tb) => (
                              <GameIcon key={tb.alt} src={tb.icon} size={12} alt={tb.alt} variant="white" />
                            ))}
                          </div>
                        </div>

                        {/* Ammo rows — one per ammunition type */}
                        {ammoSlots.map((slot, ai) => {
                          const ammo = slot.ammunition;
                          if (!ammo) return null;
                          const aName = getGameLocaleValueOrKey(GAME_LOCALES.specs, ammo.HUDName, locale) || ammo.HUDName;
                          const displayQty = Math.round((slot.quantity ?? 0) * (ammo.HUDMultiplier ?? 1));
                          const dmg = ammo.Damage ?? 0;
                          const range = Math.round((ammo.GroundRange ?? 0) * 2);
                          const minRng = Math.round((ammo.MinimalRange ?? 0) * 2);
                          const pMin = ammo.PenetrationAtMinRange ?? 0;
                          const pMax = ammo.PenetrationAtGroundRange ?? 0;
                          const pen = pMin || pMax ? Math.round((pMin + pMax) / 2) : 0;

                          /* Per-ammo trait tags */
                          const aTraits: string[] = [];
                          if (ammo.TopArmorAttack) aTraits.push('TOP ATK');
                          if (ammo.LaserGuided) aTraits.push('LASER');

                          return (
                            <div key={ai} class={ai > 0 ? 'mt-1 pt-1 border-t border-[rgba(51,51,51,0.1)]' : 'mt-0.5'}>
                              {/* Stats row */}
                              <div class="flex items-center gap-2 text-[9px] font-mono text-[var(--text-dim)]">
                                {displayQty > 0 && <SimpleTooltip text={`Quantity: ${displayQty}`}><span class="text-[var(--text)] font-bold">{displayQty}x</span></SimpleTooltip>}
                                <SimpleTooltip text={aName}><span class="truncate max-w-[80px]">{aName}</span></SimpleTooltip>
                                <SimpleTooltip text={`Damage: ${dmg}`}><span>DMG {dmg}</span></SimpleTooltip>
                                {pen > 0 && <SimpleTooltip text={`Penetration (avg): ${pen} | Min-range: ${pMin} | Max-range: ${pMax}`}><span>PEN {pen}</span></SimpleTooltip>}
                                <SimpleTooltip text={`Ground range: ${range}m`}><span>RNG {range}m</span></SimpleTooltip>
                                {minRng > 0 && <SimpleTooltip text={`Minimum range: ${minRng}m`}><span>MIN {minRng}m</span></SimpleTooltip>}
                              </div>
                              {/* Ammo-specific trait pills */}
                              {aTraits.length > 0 && (
                                <div class="flex items-center gap-1.5 mt-0.5">
                                  {aTraits.map((tag) => (
                                    <SimpleTooltip text={tag === 'TOP ATK' ? 'Attacks top armor' : tag === 'LASER' ? 'Laser guided munition' : tag}>
                                      <span
                                        key={tag}
                                        class="text-[8px] font-mono font-bold uppercase tracking-wider text-[var(--accent)] bg-[rgba(70,151,195,0.08)] px-1.5 py-0.5 border border-[rgba(70,151,195,0.15)]"
                                      >
                                        {tag}
                                      </span>
                                    </SimpleTooltip>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}

/* ═════════════════════ Main component ═════════════════════ */

export const UnitEditorPanel = component$<UnitEditorPanelProps>(
  ({ unit, category, slotIndex, arsenalCard, transportCard, availableTransportCards, locale, onModificationChange$, onTransportChange$, onClose$ }) => {
    const i18n = useI18n();
    const hasTransport = !!unit.tranId;
    const hasTransportOptions = availableTransportCards.length > 0;
    const weaponView = useSignal<'weapons' | 'loadout' | 'squad'>('weapons');

    /* ── Main unit resources ── */
    const mainModsResource = useResource$<UnitModificationsResponse[]>(async ({ cleanup }) => {
      if (!unit.unitId) return [];
      const ctrl = new AbortController();
      cleanup(() => ctrl.abort());
      return fetchModifications(unit.unitId!, ctrl.signal);
    });

    const mainSummaryResource = useResource$<BuilderUnitSummary | null>(async ({ cleanup, track }) => {
      track(() => JSON.stringify(unit.modList));
      if (!unit.unitId) return null;
      const ctrl = new AbortController();
      cleanup(() => ctrl.abort());
      const optIds = (unit.modList ?? []).map(m => m.optId);
      return fetchSummary(unit.unitId!, optIds, ctrl.signal);
    });

    /* ── Transport resources ── */
    const tranModsResource = useResource$<UnitModificationsResponse[]>(async ({ cleanup }) => {
      if (!unit.tranId) return [];
      const ctrl = new AbortController();
      cleanup(() => ctrl.abort());
      return fetchModifications(unit.tranId!, ctrl.signal);
    });

    const tranSummaryResource = useResource$<BuilderUnitSummary | null>(async ({ cleanup, track }) => {
      track(() => JSON.stringify(unit.modListTr));
      if (!unit.tranId) return null;
      const ctrl = new AbortController();
      cleanup(() => ctrl.abort());
      const optIds = (unit.modListTr ?? []).map(m => m.optId);
      return fetchSummary(unit.tranId!, optIds, ctrl.signal);
    });

    /* ── Derived display data ── */
    const unitName = arsenalCard
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, arsenalCard.unit.HUDName, locale) || arsenalCard.unit.HUDName
      : `Unit ${unit.unitId}`;
    const displayName = resolveUnitDisplayName(unit, unitName);
    const baseCost = arsenalCard?.unit.Cost ?? 0;
    const modCost = unit.modList.reduce((s, m) => s + (m.cost ?? 0), 0);
    const perUnitCost = baseCost + modCost;           // single unit with mods
    const unitTotal = perUnitCost * (unit.count ?? 1); // all copies

    const tranName = transportCard
      ? getGameLocaleValueOrKey(GAME_LOCALES.specs, transportCard.unit.HUDName, locale) || transportCard.unit.HUDName
      : unit.tranId ? `Transport ${unit.tranId}` : null;
    const tranDisplayName = tranName ? resolveTransportDisplayName(unit, tranName) : null;
    const tranBaseCost = transportCard?.unit.Cost ?? 0;
    const tranModCost = (unit.modListTr ?? []).reduce((s, m) => s + (m.cost ?? 0), 0);
    const perTranCost = tranBaseCost + tranModCost;    // single transport with mods
    const tranTotal = unit.tranId ? perTranCost * (unit.tranCount ?? 1) : 0;

    /* ── Resolve thumbnail / portrait overrides from modList ── */
    const mainThumbOverride = unit.modList.reduce<string | undefined>((acc, m) => m.thumbnailOverride || acc, undefined);
    const mainPortraitOverride = unit.modList.reduce<string | undefined>((acc, m) => m.portraitOverride || acc, undefined);
    const effectiveMainThumb = mainThumbOverride ?? arsenalCard?.unit.ThumbnailFileName;
    const effectiveMainPortrait = mainPortraitOverride ?? arsenalCard?.unit.PortraitFileName;

    const tranThumbOverride = (unit.modListTr ?? []).reduce<string | undefined>((acc, m) => m.thumbnailOverride || acc, undefined);
    const tranPortraitOverride = (unit.modListTr ?? []).reduce<string | undefined>((acc, m) => m.portraitOverride || acc, undefined);
    const effectiveTranThumb = tranThumbOverride ?? transportCard?.unit.ThumbnailFileName;
    const effectiveTranPortrait = tranPortraitOverride ?? transportCard?.unit.PortraitFileName;

    /** Dropdown change handler */
    const handleOptionChange = $((
      modId: number,
      optId: number,
      mods: UnitModificationsResponse[],
      modType: number,
      isTransport: boolean,
    ) => {
      const mod = mods.find(m => m.Id === modId);
      const opt = mod?.options.find(o => o.Id === optId);
      if (!opt) return;
      onModificationChange$(
        category, slotIndex, modId, optId,
        opt.Cost ?? 0,
        opt.ReplaceUnitName ?? undefined,
        opt.ConcatenateWithUnitName ?? undefined,
        modType, isTransport,
        opt.ThumbnailOverride ?? undefined,
        opt.PortraitOverride ?? undefined,
      );
    });

    /* ═══════════════════════════ JSX ═══════════════════════════ */
    return (
      /* Overlay container — pointer-events:none so clicks pass through to grid */
      <div
        class="fixed inset-0 z-40 flex justify-end items-stretch pr-4 pt-16 pb-16 gap-2 pointer-events-none"
      >
        {/* Invisible backdrop — closes panel on click */}
        <div
          class="absolute inset-0 pointer-events-auto"
          onClick$={() => onClose$()}
        />

        {/* ════════════ LEFT PANEL — Main Unit ════════════ */}
        <div class="w-[340px] max-h-[calc(100vh-2rem)] flex flex-col bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] shadow-2xl shadow-[0_0_25px_rgba(70,151,195,0.12)] pointer-events-auto relative overflow-hidden">
          {/* Full-panel portrait background */}
          {effectiveMainPortrait && (
            <div
              class="absolute inset-0 pointer-events-none bg-cover bg-top opacity-[0.12]"
              style={{ backgroundImage: `url(${toPortraitIconPath(effectiveMainPortrait)})` }}
            />
          )}
          {/* Gradient fade so lower content stays readable */}
          {effectiveMainPortrait && (
            <div class="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[rgba(26,26,26,0.5)] to-[rgba(26,26,26,0.9)]" />
          )}

          {/* ── Header ── */}
          <div class="relative z-10 border-b border-[rgba(51,51,51,0.3)]">
            <div class="flex items-center gap-3 px-3 py-4">
              {effectiveMainThumb && (
                <GameIcon src={toUnitIconPath(effectiveMainThumb)} size={40} alt={displayName} />
              )}
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-[var(--text)] truncate">{displayName}</p>
                <p class="text-[10px] font-mono text-[var(--text-dim)]">
                  <span class="text-[var(--accent)] font-bold">{perUnitCost}</span> {t(i18n, 'builder.editor.pts')}{t(i18n, 'builder.unitEditor.eachSuffix')}
                  <span class="ml-2">{'\u00D7'}{unit.count ?? 1}</span>
                  {modCost !== 0 && (
                    <span class="ml-2 text-[var(--accent)]">({modCost > 0 ? '+' : ''}{modCost})</span>
                  )}
                </p>
              </div>
              <button
                onClick$={onClose$}
                class="text-[var(--text-dim)] hover:text-[var(--text)] text-sm transition-colors"
              >
                {'\u2715'}
              </button>
            </div>
          </div>

          {/* ── Scrollable: mods + stats ── */}
          <div class="relative z-10 flex-1 overflow-y-auto">
            {/* Modifications */}
            {renderModDropdowns(
              mainModsResource, unit.modList,
              'builder.unitEditor.modifications',
              locale, i18n, handleOptionChange, false,
            )}

            {/* Stats */}
            <div class="border-t border-[rgba(51,51,51,0.15)]">
              {renderStats(mainSummaryResource, locale, i18n, arsenalCard?.transportCapacity, arsenalCard?.cargoCapacity, weaponView)}
            </div>
          </div>

          {/* ── Footer ── */}
          <div class="relative z-10 flex items-center justify-between px-3 py-2 border-t border-[rgba(51,51,51,0.3)]">
            <div class="text-[10px] font-mono text-[var(--text-dim)]">
              <span class="uppercase tracking-wider">{t(i18n, 'builder.unitEditor.totalCost')}: </span>
              <span class="text-[var(--accent)] font-bold">{unitTotal + tranTotal}</span>
              <span> {t(i18n, 'builder.editor.pts')}</span>
            </div>
            <a
              href={'/arsenal/' + unit.unitId}
              class="text-[10px] font-mono text-[var(--accent)] hover:text-[var(--text)] transition-colors uppercase tracking-wider"
            >
              {t(i18n, 'builder.unitEditor.viewArsenal')} {'\u2192'}
            </a>
          </div>
        </div>

        {/* ════════════ RIGHT PANEL — Transport ════════════ */}
        {hasTransportOptions && hasTransport ? (
          /* Transport with vehicle */
          <div class="w-[320px] max-h-[calc(100vh-2rem)] flex flex-col bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] shadow-2xl shadow-[0_0_25px_rgba(70,151,195,0.12)] pointer-events-auto relative overflow-hidden">
            {/* Full-panel transport portrait background */}
            {effectiveTranPortrait && (
              <div
                class="absolute inset-0 pointer-events-none bg-cover bg-top opacity-[0.1]"
                style={{ backgroundImage: `url(${toPortraitIconPath(effectiveTranPortrait)})` }}
              />
            )}
            {effectiveTranPortrait && (
              <div class="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[rgba(26,26,26,0.5)] to-[rgba(26,26,26,0.9)]" />
            )}

            {/* Header with transport selector */}
            <div class="relative z-10 border-b border-[rgba(51,51,51,0.3)]">
              <div class="px-3 py-4">
              <div class="flex items-center gap-2 mb-1.5">
                {effectiveTranThumb && (
                  <GameIcon src={toUnitIconPath(effectiveTranThumb)} size={28} alt={tranDisplayName ?? ''} />
                )}
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold text-[var(--text)] truncate">
                    {tranDisplayName ?? t(i18n, 'builder.unitEditor.transport')}
                  </p>
                  <p class="text-[10px] font-mono text-[var(--text-dim)]">
                    {'\u00D7'}{unit.tranCount ?? 1}{' \u00B7 '}
                    <span class="text-[var(--accent)]">{perTranCost}</span> {t(i18n, 'builder.editor.pts')}{t(i18n, 'builder.unitEditor.eachSuffix')}
                    {tranModCost !== 0 && (
                      <span class="ml-2 text-[var(--accent)]">({tranModCost > 0 ? '+' : ''}{tranModCost})</span>
                    )}
                  </p>
                </div>
              </div>
              {/* Transport change dropdown */}
              <select
                class="w-full bg-[rgba(26,26,26,0.6)] border border-[var(--border)] text-[var(--text)] text-[10px] font-mono px-2 py-1 focus:border-[var(--accent)] focus:outline-none appearance-none cursor-pointer"
                value={unit.tranId ?? ''}
                onChange$={(e: Event) => {
                  const val = (e.target as HTMLSelectElement).value;
                  const newId = val ? parseInt(val) : null;
                  if (newId !== (unit.tranId ?? null)) {
                    onTransportChange$(category, slotIndex, isNaN(newId as number) ? null : newId);
                  }
                }}
              >
                <option value="">{t(i18n, 'builder.unitEditor.onFoot')}</option>
                {availableTransportCards.map((tc) => {
                  const tName = getGameLocaleValueOrKey(GAME_LOCALES.specs, tc.unit.HUDName, locale) || tc.unit.HUDName || `${tc.unit.Id}`;
                  return (
                    <option key={tc.unit.Id} value={tc.unit.Id}>
                      {`${tName} (${tc.unit.Cost} ${t(i18n, 'builder.editor.pts')})`}
                    </option>
                  );
                })}
              </select>
              </div>
            </div>

            {/* Scrollable: mods + stats */}
            <div class="relative z-10 flex-1 overflow-y-auto">
              {renderModDropdowns(
                tranModsResource, unit.modListTr ?? [],
                'builder.unitEditor.transportMods',
                locale, i18n, handleOptionChange, true,
              )}
              <div class="border-t border-[rgba(51,51,51,0.15)]">
                {renderStats(tranSummaryResource, locale, i18n, transportCard?.transportCapacity, transportCard?.cargoCapacity)}
              </div>
            </div>

            {/* ── Transport Footer ── */}
            <div class="relative z-10 flex items-center justify-end px-3 py-2 border-t border-[rgba(51,51,51,0.3)]">
              <a
                href={'/arsenal/' + unit.tranId}
                class="text-[10px] font-mono text-[var(--accent)] hover:text-[var(--text)] transition-colors uppercase tracking-wider"
              >
                {t(i18n, 'builder.unitEditor.viewArsenal')} {'\u2192'}
              </a>
            </div>
          </div>
        ) : hasTransportOptions ? (
          /* ON FOOT skeleton — unit CAN have transport but currently doesn't */
          <div class="w-[320px] max-h-[calc(100vh-2rem)] flex flex-col bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] shadow-2xl shadow-[0_0_25px_rgba(70,151,195,0.12)] pointer-events-auto relative">
            <div class="px-3 py-2.5 border-b border-[rgba(51,51,51,0.3)]">
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[9px] mb-1.5">
                {t(i18n, 'builder.unitEditor.transport')}
              </p>
              {/* Transport change dropdown */}
              <select
                class="w-full bg-[rgba(26,26,26,0.6)] border border-[var(--border)] text-[var(--text)] text-[10px] font-mono px-2 py-1 focus:border-[var(--accent)] focus:outline-none appearance-none cursor-pointer"
                value=""
                onChange$={(e: Event) => {
                  const val = (e.target as HTMLSelectElement).value;
                  const newId = val ? parseInt(val) : null;
                  if (newId && !isNaN(newId)) {
                    onTransportChange$(category, slotIndex, newId);
                  }
                }}
              >
                <option value="">{t(i18n, 'builder.unitEditor.onFoot')}</option>
                {availableTransportCards.map((tc) => {
                  const tName = getGameLocaleValueOrKey(GAME_LOCALES.specs, tc.unit.HUDName, locale) || tc.unit.HUDName || `${tc.unit.Id}`;
                  return (
                    <option key={tc.unit.Id} value={tc.unit.Id}>
                      {`${tName} (${tc.unit.Cost} ${t(i18n, 'builder.editor.pts')})`}
                    </option>
                  );
                })}
              </select>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center py-10 px-4">
              <div class="text-3xl mb-3 opacity-20">{'\uD83D\uDEB6'}</div>
              <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-sm mb-1">
                {t(i18n, 'builder.unitEditor.onFoot')}
              </p>
              <p class="text-[10px] font-mono text-[rgba(153,153,153,0.5)] text-center">
                {t(i18n, 'builder.unitEditor.noTransport')}
              </p>
            </div>
          </div>
        ) : null}
        {/* No right panel at all when unit has no transport options */}

      </div>  
    );
  },
);