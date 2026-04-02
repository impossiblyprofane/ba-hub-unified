// ══════════════════════════════════════════════════════════════
// UnitContextPanel — floating panel for a selected unit shape
//
// Features:
//   • Range category toggles (Weapons / Optics / Laser)
//   • Icon size slider with preset sizes
//   • Modification controls (dropdown selects per mod slot)
//   • Re-fetches unit detail when modification options change
//
// Architecture:
//   Renders as a fixed panel in the bottom-left of the canvas area.
//   Controlled entirely by signals from the route page.
// ══════════════════════════════════════════════════════════════

import { $, component$, type QRL, type Signal } from '@builder.io/qwik';
import { useI18n, t, getGameLocaleValueOrKey, GAME_LOCALES } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import type { UnitRangeFilter, OpticsStealthConfig, TerrainCover, StealthPreset } from '~/lib/maps/types';
import { STEALTH_PRESETS } from '~/lib/maps/types';
import type { UnitDetailModSlot } from '~/lib/graphql-types';
import { toOptionPicturePath } from '~/lib/iconPaths';

// ── Size presets ──

const SIZE_PRESETS = [
  { label: 'maps.unit.sizePin', value: 0 },
  { label: 'S', value: 10 },
  { label: 'M', value: 16 },
  { label: 'L', value: 24 },
  { label: 'XL', value: 32 },
] as const;

/** Terrain cover presets — i18n key + value */
const TERRAIN_PRESETS: { labelKey: string; value: TerrainCover }[] = [
  { labelKey: 'maps.unit.terrainNone', value: 'none' },
  { labelKey: 'maps.unit.terrainForest', value: 'forest' },
  { labelKey: 'maps.unit.terrainBuilding', value: 'building' },
];

// ── Props ──

export interface UnitContextPanelProps {
  /** Name of the selected unit (for header) */
  unitName: string;
  /** Current icon size (from the UnitShape.size) */
  currentSize: number;
  /** Range filter state for this unit */
  rangeFilter: Signal<UnitRangeFilter>;
  /** Global optics stealth config */
  opticsStealthConfig: Signal<OpticsStealthConfig>;
  /** Modification slots loaded from unit detail (empty if not yet fetched) */
  modifications: UnitDetailModSlot[];
  /** Callback: user changed the icon size */
  onSizeChange$: QRL<(newSize: number) => void>;
  /** Callback: user changed a modification option */
  onModOptionChange$: QRL<(modId: number, optionId: number) => void>;
  /** Whether unit detail data is still loading */
  isLoading: boolean;
  /** Unique weapon names from the range cache (for per-weapon toggles) */
  weaponNames: string[];
  /** Per-weapon altitude types (only weapons with ≥2 altitudes). Key = weaponName, value = sorted altitude types. */
  weaponAltitudes: Record<string, string[]>;
  /** Whether optics have multiple bands with different ranges (show optics toggle) */
  hasMultiOptics: boolean;
}

export const UnitContextPanel = component$<UnitContextPanelProps>((props) => {
  const i18n = useI18n();
  const filter = props.rangeFilter;
  const stealthCfg = props.opticsStealthConfig;

  // ── Toggle handlers ──
  const toggleWeapons = $(() => {
    filter.value = { ...filter.value, weapons: !filter.value.weapons };
  });
  const toggleOptics = $(() => {
    filter.value = { ...filter.value, optics: !filter.value.optics };
  });
  const toggleLaser = $(() => {
    filter.value = { ...filter.value, laser: !filter.value.laser };
  });

  return (
    <div class="flex flex-col gap-0 w-64 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)] select-none overflow-hidden">
      {/* ── Header ── */}
      <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        <p class="font-mono tracking-[0.3em] uppercase text-[9px] text-[var(--text-dim)]">
          {t(i18n, 'maps.unit.contextPanel')}
        </p>
        <p class="text-xs font-mono text-[var(--text)] truncate mt-0.5">
          {props.unitName}
        </p>
      </div>

      {/* ── Range category toggles ── */}
      <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.15)]">
        <p class="font-mono tracking-[0.2em] uppercase text-[8px] text-[var(--text-dim)] mb-1.5">
          {t(i18n, 'maps.unit.rangeCategories')}
        </p>
        <div class="flex gap-1.5">
          <ToggleChip
            label={t(i18n, 'maps.unit.filterWeapons')}
            active={filter.value.weapons}
            color="#f97316"
            onClick$={toggleWeapons}
          />
          <ToggleChip
            label={t(i18n, 'maps.unit.filterOptics')}
            active={filter.value.optics}
            color="#16a34a"
            onClick$={toggleOptics}
          />
          <ToggleChip
            label={t(i18n, 'maps.unit.filterLaser')}
            active={filter.value.laser}
            color="#ef4444"
            onClick$={toggleLaser}
          />
        </div>
      </div>

      {/* ── Optics vs Stealth simulation ── */}
      {filter.value.optics && (
        <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.15)]">
          <p class="font-mono tracking-[0.2em] uppercase text-[8px] text-[var(--text-dim)] mb-1.5">
            {t(i18n, 'maps.unit.opticsVsStealth')}
          </p>

          {/* Show all optics bands toggle */}
          {props.hasMultiOptics && (
            <button
              class={[
                'mb-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-[8px] font-mono uppercase tracking-wider border transition-all',
                filter.value.showAllOptics
                  ? 'border-[#16a34a] text-[#16a34a] bg-[rgba(22,163,74,0.1)]'
                  : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.5)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => {
                filter.value = { ...filter.value, showAllOptics: !filter.value.showAllOptics };
              }}
            >
              {t(i18n, 'maps.unit.showAllOptics')}
            </button>
          )}

          {/* Stealth preset selector */}
          <p class="text-[7px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1 opacity-70">
            {t(i18n, 'maps.unit.stealthTarget')}
          </p>
          <div class="flex flex-wrap gap-0.5 mb-2">
            {STEALTH_PRESETS.map(preset => (
              <button
                key={preset}
                class={[
                  'px-1.5 py-0.5 text-[8px] font-mono border transition-colors',
                  stealthCfg.value.stealth === preset
                    ? 'border-[#16a34a] text-[#16a34a] bg-[rgba(22,163,74,0.1)]'
                    : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.5)] hover:text-[var(--text)]',
                ].join(' ')}
                onClick$={() => {
                  stealthCfg.value = { ...stealthCfg.value, stealth: preset as StealthPreset };
                }}
              >
                ×{preset}
              </button>
            ))}
          </div>

          {/* Terrain cover selector */}
          <p class="text-[7px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1 opacity-70">
            {t(i18n, 'maps.unit.terrainCover')}
          </p>
          <div class="flex gap-1">
            {TERRAIN_PRESETS.map(tp => (
              <button
                key={tp.value}
                class={[
                  'flex-1 py-1 text-[8px] font-mono uppercase tracking-wider border transition-colors text-center',
                  stealthCfg.value.terrain === tp.value
                    ? 'border-[#16a34a] text-[#16a34a] bg-[rgba(22,163,74,0.1)]'
                    : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.5)] hover:text-[var(--text)]',
                ].join(' ')}
                onClick$={() => {
                  stealthCfg.value = { ...stealthCfg.value, terrain: tp.value as TerrainCover };
                }}
              >
                {t(i18n, tp.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-weapon range toggles ── */}
      {filter.value.weapons && props.weaponNames.length > 0 && (
        <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.15)]">
          <p class="font-mono tracking-[0.2em] uppercase text-[8px] text-[var(--text-dim)] mb-1.5">
            {t(i18n, 'maps.unit.weaponToggles')}
          </p>
          <div class="flex flex-col gap-1">
            {props.weaponNames.map(name => {
              const disabled = filter.value.disabledWeapons ?? [];
              const isActive = !disabled.includes(name);
              const altTypes = props.weaponAltitudes[name];
              return (
                <div key={name} class="flex items-center gap-1 min-w-0">
                  <button
                    class={[
                      'flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-mono border transition-all text-left truncate flex-1 min-w-0',
                      isActive
                        ? 'border-[rgba(51,51,51,0.5)] text-[var(--text)]'
                        : 'border-[rgba(51,51,51,0.15)] text-[var(--text-dim)] opacity-40 line-through',
                    ].join(' ')}
                    onClick$={() => {
                      const current = filter.value.disabledWeapons ?? [];
                      const next = isActive
                        ? [...current, name]
                        : current.filter(w => w !== name);
                      filter.value = { ...filter.value, disabledWeapons: next };
                    }}
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: isActive ? '#f97316' : 'transparent', border: '1px solid #f97316' }}
                    />
                    <span class="truncate">{name}</span>
                  </button>
                  {/* Per-altitude sub-toggles inline (only for weapons with ≥2 altitude types) */}
                  {isActive && altTypes && altTypes.length >= 2 && (
                    <div class="flex gap-0.5 shrink-0">
                      {altTypes.map(alt => {
                        const disabledAlts = filter.value.disabledWeaponAltitudes?.[name] ?? [];
                        const isAltActive = !disabledAlts.includes(alt);
                        const altLabel = alt === 'ground' ? 'G' : alt === 'lowAlt' ? 'L' : 'H';
                        return (
                          <button
                            key={alt}
                            class={[
                              'px-1 py-0.5 text-[7px] font-mono uppercase border transition-colors',
                              isAltActive
                                ? 'border-[rgba(249,115,22,0.5)] text-[#f97316] bg-[rgba(249,115,22,0.08)]'
                                : 'border-[rgba(51,51,51,0.2)] text-[var(--text-dim)] opacity-40',
                            ].join(' ')}
                            onClick$={() => {
                              const current = { ...(filter.value.disabledWeaponAltitudes ?? {}) };
                              const currentAlts = current[name] ?? [];
                              if (isAltActive) {
                                current[name] = [...currentAlts, alt];
                              } else {
                                current[name] = currentAlts.filter(a => a !== alt);
                                if (current[name].length === 0) delete current[name];
                              }
                              filter.value = { ...filter.value, disabledWeaponAltitudes: current };
                            }}
                          >
                            {altLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ── Size control ── */}
      <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.15)]">
        <p class="font-mono tracking-[0.2em] uppercase text-[8px] text-[var(--text-dim)] mb-1.5">
          {t(i18n, 'maps.unit.iconSize')}
        </p>
        <div class="flex gap-1">
          {SIZE_PRESETS.map(preset => (
            <button
              key={preset.label}
              class={[
                'flex-1 py-1 text-[9px] font-mono uppercase tracking-wider border transition-colors text-center',
                props.currentSize === preset.value
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                  : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.5)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => props.onSizeChange$(preset.value)}
            >
              {preset.label.startsWith('maps.') ? t(i18n, preset.label) : preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Modifications ── */}
      {props.isLoading ? (
        <div class="px-3 py-3 flex items-center justify-center">
          <p class="text-[9px] font-mono text-[var(--text-dim)]">{t(i18n, 'maps.unit.loading')}</p>
        </div>
      ) : props.modifications.length > 0 ? (
        <div class="px-3 py-2 flex flex-col gap-2">
          <p class="font-mono tracking-[0.2em] uppercase text-[8px] text-[var(--text-dim)]">
            {t(i18n, 'maps.unit.modifications')}
          </p>
          {props.modifications.map(slot => {
            const locale = i18n.locale as Locale;
            const modName = getGameLocaleValueOrKey(
              GAME_LOCALES.modopts, slot.modification.UIName || slot.modification.Name, locale,
            ) || slot.modification.Name;

            const selectedOpt = slot.options.find(o => o.Id === slot.selectedOptionId);
            const selectedIcon = selectedOpt?.OptionPicture ? toOptionPicturePath(selectedOpt.OptionPicture) : null;

            return (
              <div key={slot.modification.Id}>
                <label class="text-[8px] block font-mono uppercase tracking-widest text-[var(--text-dim)] mb-0.5 truncate">
                  {modName}
                </label>
                <div class="flex items-center gap-1.5 min-w-0">
                  {selectedIcon && (
                    <img
                      src={selectedIcon}
                      width={24} height={24}
                      class="w-6 h-6 object-contain shrink-0 brightness-0 invert opacity-80"
                      alt=""
                    />
                  )}
                  <select
                    class="flex-1 bg-[var(--bg)] border border-[rgba(51,51,51,0.3)] text-[var(--text)] text-[10px] px-1.5 py-1 font-mono min-w-0 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer truncate"
                    value={slot.selectedOptionId}
                    onChange$={(e) => {
                      const newId = parseInt((e.target as HTMLSelectElement).value, 10);
                      props.onModOptionChange$(slot.modification.Id, newId);
                    }}
                  >
                    {slot.options.map(opt => {
                      const optName = getGameLocaleValueOrKey(
                        GAME_LOCALES.modopts, opt.UIName || opt.Name, locale,
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
      ) : null}
    </div>
  );
});

// ── Helper: range category toggle chip ──

interface ToggleChipProps {
  label: string;
  active: boolean;
  color: string;
  onClick$: QRL<() => void>;
}

const ToggleChip = component$<ToggleChipProps>((props) => {
  return (
    <button
      class={[
        'flex items-center gap-1 px-2 py-1 text-[8px] font-mono uppercase tracking-wider border transition-all',
        props.active
          ? 'border-[rgba(51,51,51,0.5)] text-[var(--text)]'
          : 'border-[rgba(51,51,51,0.15)] text-[var(--text-dim)] opacity-50',
      ].join(' ')}
      onClick$={props.onClick$}
    >
      <span
        class="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: props.active ? props.color : 'transparent', border: `1px solid ${props.color}` }}
      />
      {props.label}
    </button>
  );
});
