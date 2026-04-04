import { component$, useSignal, Slot, type PropFunction } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type { Locale } from '~/lib/i18n';
import type { AnalyticsFightData, AnalyticsFightPlayer, AnalyticsFightUnit } from '~/lib/graphql-types';
import { STATS_FIGHT_DATA_QUERY } from '~/lib/queries/stats';
import { toCountryIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { ReadonlyUnitPanel } from '~/components/decks/ReadonlyUnitPanel';
import { getMapBackgroundByName } from '~/lib/maps/mapData';
import type { UnitConfig } from '@ba-hub/shared';

/** Resolve raw option UIName through the game locale system, with fallback cleanup */
function resolveOptionName(uiName: string, locale: string): string {
  const resolved = getGameLocaleValueOrKey(GAME_LOCALES.modopts, uiName, locale as any);
  if (resolved && resolved !== uiName) return resolved;
  // Fallback: strip known prefixes and humanize underscores
  return uiName
    .replace(/^(?:dlc_\d+_)?Custom_Option_/i, '')
    .replace(/_/g, ' ');
}

/** Filter out default/empty options and resolve names */
function resolveOptionNames(rawNames: string[], locale: string): string[] {
  return rawNames
    .map((n) => resolveOptionName(n, locale))
    .filter((n) => n !== 'None' && n !== 'Default' && n !== 'Empty');
}

/* ─── Route loader: SSR match data ────────────────────────── */

export const useFightData = routeLoader$(async (requestEvent) => {
  const fightId = requestEvent.params.fightId;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: STATS_FIGHT_DATA_QUERY,
      variables: { fightId },
    }),
  });

  const payload = (await response.json()) as {
    data?: { analyticsFightData: AnalyticsFightData | null };
  };

  const fromPlayer = requestEvent.url.searchParams.get('from') ?? null;
  return { fight: payload.data?.analyticsFightData ?? null, fromPlayer };
});

/* ─── Helpers ─────────────────────────────────────────────── */

function formatPlaytime(seconds: number | null): string {
  if (seconds == null || seconds === 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatTimestamp(epoch: number | null): string {
  if (epoch == null) return '-';
  const date = new Date(epoch * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function teamTotals(players: AnalyticsFightPlayer[]) {
  let destruction = 0;
  let losses = 0;
  let damageDealt = 0;
  let supply = 0;
  let unitCount = 0;
  for (const p of players) {
    destruction += p.destruction ?? 0;
    losses += p.losses ?? 0;
    damageDealt += p.damageDealt ?? 0;
    supply += p.supplyPointsConsumed ?? 0;
    unitCount += p.units.length;
  }
  return { destruction, losses, damageDealt, supply, unitCount };
}

/**
 * Detect transport→infantry grouping in spawn order.
 * Type 2 = infantry, Type 4 = vehicle, Type 8 = helicopter.
 * After a vehicle/helo, all consecutive infantry are "transported".
 * Exception: Pilots (CategoryType 4 / Logistics) are not transported — they
 * spawn when an aircraft is shot down, not called in via transport.
 */
function markTransported(units: AnalyticsFightUnit[]): boolean[] {
  const result = new Array(units.length).fill(false);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const isTransport = u.unitType === 4 || u.unitType === 8; // vehicle or helo
    if (isTransport) {
      // Mark all consecutive regular infantry following this transport
      let j = i + 1;
      while (j < units.length) {
        const next = units[j];
        const isRegularInfantry = next.unitType === 2 && next.categoryType !== 4; // exclude Pilots (logistics cat)
        if (!isRegularInfantry) break;
        result[j] = true;
        j++;
      }
    }
  }

  return result;
}

/**
 * Mark units that form the opening lineup (first units whose cumulative
 * cost stays at or under 1000 points — the starting budget).
 * Transported infantry cost is attributed to the group but the transport
 * itself is what "spends" the budget, so we accumulate continuously.
 */
function markOpeningLineup(units: AnalyticsFightUnit[]): { isOpener: boolean[]; lastOpenerIdx: number } {
  const isOpener = new Array(units.length).fill(false);
  let cumulative = 0;
  let lastOpenerIdx = -1;

  for (let i = 0; i < units.length; i++) {
    const cost = units[i].totalCost ?? 0;
    if (cumulative + cost > 1000) break;
    cumulative += cost;
    isOpener[i] = true;
    lastOpenerIdx = i;
  }

  return { isOpener, lastOpenerIdx };
}

/* ─── Panel wrapper ──────────────────────────────────────── */

const Panel = component$<{ title: string }>(({ title }) => {
  return (
    <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
      <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        {title}
      </p>
      <div class="p-3">
        <Slot />
      </div>
    </div>
  );
});

/* ─── Team summary stat ──────────────────────────────────── */

const TeamStat = component$<{ label: string; value: string | number }>(
  ({ label, value }) => (
    <div class="text-center">
      <p class="text-[8px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)]">
        {label}
      </p>
      <p class="text-sm font-mono text-[var(--text)] mt-0.5">{value}</p>
    </div>
  ),
);

/* ─── Unit roster table (with sort + transport detection) ── */

const PlayerUnitsTable = component$<{
  units: AnalyticsFightUnit[];
  onInspect$?: PropFunction<(key: string) => void>;
}>(({ units, onInspect$ }) => {
  const i18n = useI18n();
  const sortMode = useSignal<'spawn' | 'kills' | 'damage'>('spawn');

  if (units.length === 0) {
    return <p class="text-[var(--text-dim)] text-xs">-</p>;
  }

  const sorted = [...units];
  if (sortMode.value === 'kills') {
    sorted.sort((a, b) => (b.killedCount ?? 0) - (a.killedCount ?? 0));
  } else if (sortMode.value === 'damage') {
    sorted.sort((a, b) => (b.totalDamageDealt ?? 0) - (a.totalDamageDealt ?? 0));
  }

  // Only detect transport grouping and opening lineup in spawn order
  const transported = sortMode.value === 'spawn' ? markTransported(sorted) : new Array(sorted.length).fill(false);
  const opener = sortMode.value === 'spawn' ? markOpeningLineup(sorted) : { isOpener: new Array(sorted.length).fill(false), lastOpenerIdx: -1 };

  return (
    <div>
      <div class="flex items-center gap-1 mb-2">
        {(['spawn', 'kills', 'damage'] as const).map((mode) => (
          <button
            key={mode}
            class={[
              'px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider border transition-colors',
              sortMode.value === mode
                ? 'text-[var(--accent)] border-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
            ].join(' ')}
            onClick$={() => { sortMode.value = mode; }}
          >
            {t(i18n, `stats.match.sort${mode.charAt(0).toUpperCase() + mode.slice(1)}` as any)}
          </button>
        ))}
        {sortMode.value === 'spawn' && transported.some(Boolean) && (
          <span class="text-[8px] text-[var(--text-dim)] italic opacity-50 ml-2">
            {t(i18n, 'stats.match.transportNote')}
          </span>
        )}
      </div>

      <table class="w-full text-[10px] border-collapse">
        <thead>
          <tr class="text-[var(--text-dim)] uppercase tracking-[0.15em] text-[8px]">
            <th class="text-left py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.unitName')}
            </th>
            <th class="text-right py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.unitCost')}
            </th>
            <th class="text-right py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.kills')}
            </th>
            <th class="text-right py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.damageDealt')}
            </th>
            <th class="text-right py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.damageReceived')}
            </th>
            <th class="text-right py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.supplyCost')}
            </th>
            <th class="text-right py-1 px-1 border-b border-[rgba(51,51,51,0.3)]">
              {t(i18n, 'stats.match.refunded')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((u, idx) => {
            const isTransported = transported[idx];
            const isOpenerUnit = opener.isOpener[idx];
            const isLastOpener = idx === opener.lastOpenerIdx;
            const resolvedOpts = resolveOptionNames(u.optionNames ?? [], i18n.locale);
            const hasOptions = resolvedOpts.length > 0;
            return (
              <>
              {isOpenerUnit && idx === 0 && (
                <tr key="opener-label">
                  <td colSpan={7} class="py-1 px-1">
                    <span class="text-[8px] font-mono uppercase tracking-[0.2em] text-[var(--accent)] opacity-60">
                      {t(i18n, 'stats.match.openingLineup')}
                    </span>
                  </td>
                </tr>
              )}
              <tr
                key={`u-${u.id}-${idx}`}
                class={[
                  'hover:bg-[rgba(70,151,195,0.04)] transition-colors',
                  isOpenerUnit
                    ? 'bg-[rgba(70,151,195,0.06)] border-b border-[rgba(51,51,51,0.1)]'
                    : 'border-b border-[rgba(51,51,51,0.1)]',
                  isLastOpener ? 'border-b-[rgba(70,151,195,0.25)]' : '',
                ].join(' ')}
              >
                <td class={`py-1 px-1 ${isTransported ? 'pl-5' : ''}`}>
                  <div>
                    <span>
                      {isTransported && (
                        <span class="text-[var(--text-dim)] opacity-30 mr-1">└</span>
                      )}
                      <button
                        class="text-[var(--text)] hover:text-[var(--accent)] transition-colors text-left"
                        onClick$={() => {
                          const mods = (u.modList ?? []).map((m) => `${m.modId}:${m.optId}:${m.cost}`).join(';');
                          const name = encodeURIComponent(u.unitName ?? '');
                          const thumb = encodeURIComponent(u.thumbnailFileName ?? '');
                          const portrait = encodeURIComponent(u.portraitFileName ?? '');
                          onInspect$?.(`${u.id}|${u.categoryType ?? 0}|${mods}|${name}|${u.totalCost ?? 0}|${thumb}|${portrait}`);
                        }}
                      >
                        {u.unitName ?? `Unit #${u.id}`}
                      </button>
                    </span>
                    {hasOptions && (
                      <span class="text-[8px] text-[var(--text-dim)] ml-1.5">
                        {resolvedOpts.join(' · ')}
                      </span>
                    )}
                  </div>
                </td>
                <td class="py-1 px-1 text-[var(--text-dim)] font-mono text-right">
                  {u.totalCost ?? '-'}
                </td>
                <td class="py-1 px-1 text-[var(--text)] font-mono text-right">
                  {u.killedCount ?? 0}
                </td>
                <td class="py-1 px-1 text-[var(--text)] font-mono text-right">
                  {u.totalDamageDealt != null ? Math.round(u.totalDamageDealt).toLocaleString() : '-'}
                </td>
                <td class="py-1 px-1 text-[var(--text)] font-mono text-right">
                  {u.totalDamageReceived != null ? Math.round(u.totalDamageReceived).toLocaleString() : '-'}
                </td>
                <td class="py-1 px-1 text-[var(--text)] font-mono text-right">
                  {u.supplyPointsConsumed?.toLocaleString() ?? '-'}
                </td>
                <td class="py-1 px-1 text-[var(--text-dim)] font-mono text-right">
                  {u.wasRefunded ? t(i18n, 'stats.match.yes') : t(i18n, 'stats.match.no')}
                </td>
              </tr>
              {isLastOpener && idx < sorted.length - 1 && (
                <tr key="opener-sep">
                  <td colSpan={7} class="py-0">
                    <div class="border-b border-[rgba(70,151,195,0.2)]" />
                  </td>
                </tr>
              )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

/* ─── Unit inspect panel wrapper ─────────────────────────── */

const UnitInspectPanel = component$<{
  unitKey: string;
  locale: Locale;
  onClose$: PropFunction<() => void>;
}>(({ unitKey, locale, onClose$ }) => {
  const parts = unitKey.split('|');
  const unitId = parseInt(parts[0], 10);
  const cat = parseInt(parts[1] ?? '0', 10);
  const modEntries = (parts[2] ?? '').split(';').filter(Boolean);
  const modList = modEntries.map((e) => {
    const [modId, optId, cost] = e.split(':').map(Number);
    return { modId, optId, cost, type: 0 };
  });
  const unitName = decodeURIComponent(parts[3] ?? '');
  const totalCost = parseInt(parts[4] ?? '0', 10);
  const thumbnailFileName = decodeURIComponent(parts[5] ?? '');
  const portraitFileName = decodeURIComponent(parts[6] ?? '');
  const unitConfig: UnitConfig = { unitId, cat, slot: 0, modList, count: 1 };

  // Build a minimal ArsenalCard so the panel can show name, cost, icon, and portrait
  const minimalCard = {
    unit: {
      Id: unitId,
      Name: unitName,
      HUDName: unitName,
      CountryId: 0,
      CategoryType: cat,
      Type: 0,
      Cost: totalCost - modList.reduce((s, m) => s + (m.cost ?? 0), 0),
      ThumbnailFileName: thumbnailFileName || '',
      PortraitFileName: portraitFileName || '',
      IsUnitModification: false,
      DisplayInArmory: true,
    },
    isTransport: false,
    specializationIds: [],
    transportCapacity: 0,
    cargoCapacity: 0,
    availableTransports: [],
    defaultModificationOptions: [],
  };

  return (
    <ReadonlyUnitPanel
      unit={unitConfig}
      arsenalCard={minimalCard as any}
      locale={locale}
      onClose$={onClose$}
    />
  );
});

/* ─── Main component ─────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();
  const data = useFightData();
  const fight = data.value.fight;
  const fromPlayer = data.value.fromPlayer;

  // Compute default selected player (top scorer from first team, or first player)
  const defaultPlayerId = (() => {
    if (!fight || fight.players.length === 0) return null;
    const sorted = [...fight.players].sort((a, b) => (b.destruction ?? 0) - (a.destruction ?? 0));
    return sorted[0]?.id ?? null;
  })();
  const selectedPlayerId = useSignal<number | null>(defaultPlayerId);

  // Unit detail panel — store a serializable key to trigger the overlay
  const inspectUnitKey = useSignal('');

  if (!fight) {
    return (
      <div class="w-full max-w-[2000px] mx-auto">
        <a
          href="/stats"
          class="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
        >
          ← {t(i18n, 'stats.player.backToStats')}
        </a>
        <div class="p-6 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          <p class="text-sm text-[var(--text-dim)]">
            {t(i18n, 'stats.match.notFound')}
          </p>
        </div>
      </div>
    );
  }

  const f = fight;

  // Group players by team
  const teams = new Map<number | string, AnalyticsFightPlayer[]>();
  for (const p of f.players) {
    const teamKey = p.teamId ?? 'unknown';
    if (!teams.has(teamKey)) teams.set(teamKey, []);
    teams.get(teamKey)!.push(p);
  }
  const teamEntries = [...teams.entries()].sort(
    ([a], [b]) => (typeof a === 'number' ? a : 99) - (typeof b === 'number' ? b : 99),
  );

  // Determine winner by average rating change
  let winnerTeam: number | string | null = null;
  let bestDelta = -Infinity;
  for (const [teamKey, players] of teamEntries) {
    const validPlayers = players.filter(
      (p) => p.newRating != null && p.oldRating != null,
    );
    if (validPlayers.length === 0) continue;
    const avgDelta =
      validPlayers.reduce(
        (sum, p) => sum + ((p.newRating ?? 0) - (p.oldRating ?? 0)),
        0,
      ) / validPlayers.length;
    if (avgDelta > bestDelta) {
      bestDelta = avgDelta;
      winnerTeam = avgDelta > 0 ? teamKey : null;
    }
  }

  const backHref = fromPlayer ? `/stats/player/${fromPlayer}/` : null;

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Back link */}
      {backHref ? (
        <a
          href={backHref}
          class="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
        >
          ← {t(i18n, 'stats.match.backToMatch')}
        </a>
      ) : (
        <button
          class="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
          onClick$={() => { history.back(); }}
        >
          ← {t(i18n, 'stats.match.backToMatch')}
        </button>
      )}

      {/* Match header with map portrait background */}
      {(() => {
        const mapImg = getMapBackgroundByName(f.mapName);
        return (
          <>
            <div class="mb-4 relative overflow-hidden border border-[rgba(51,51,51,0.15)]">
              {mapImg && (
                <>
                  <div class="absolute inset-[-15%] pointer-events-none map-pan-anim">
                    <img
                      src={mapImg}
                      alt={f.mapName ?? ''}
                      class="w-full h-full object-cover opacity-[0.55]"
                      width={848}
                      height={480}
                    />
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-b from-[rgba(26,26,26,0.15)] via-[rgba(26,26,26,0.45)] to-[rgba(26,26,26,0.95)] pointer-events-none" />
                  <div class="absolute inset-0 bg-gradient-to-r from-[rgba(26,26,26,0.5)] to-transparent pointer-events-none" />
                </>
              )}
              {!mapImg && <div class="absolute inset-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]" />}
              <div class="relative z-10 p-6 py-8">
                <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-2">
                  {t(i18n, 'stats.match.title')}
                </p>
                <h1 class="text-2xl font-semibold text-[var(--text)] tracking-tight">
                  {f.mapName ?? `Map ${f.mapId ?? '?'}`}
                </h1>
                <div class="flex flex-wrap gap-4 mt-2 text-xs text-[var(--text-dim)]">
                  <span>
                    {t(i18n, 'stats.match.duration')}: {formatPlaytime(f.totalPlayTimeSec)}
                  </span>
                  <span>
                    {t(i18n, 'stats.match.players')}: {f.players.length}
                  </span>
                  {f.victoryLevel != null && (
                    <span>
                      {t(i18n, 'stats.match.victoryLevel')}: {f.victoryLevel}
                    </span>
                  )}
                  {f.totalObjectiveZonesCount != null && (
                    <span>
                      {t(i18n, 'stats.match.objectives')}: {f.totalObjectiveZonesCount}
                    </span>
                  )}
                  <span>{formatTimestamp(f.endTime)}</span>
                </div>
              </div>
            </div>

            {/* Team panels */}
            <div class="flex flex-col gap-3 mb-3">
        {teamEntries.map(([teamKey, players]) => {
          const isWinner = teamKey === winnerTeam;
          const headerLabel = isWinner ? '★ VICTORY' : '⊘ DEFEAT';
          const headerColor = isWinner ? 'text-[var(--green)]' : 'text-[var(--red)]';
          const totals = teamTotals(players);
          const sortedPlayers = [...players].sort(
            (a, b) => (b.destruction ?? 0) - (a.destruction ?? 0),
          );

          return (
            <div key={`team-${teamKey}`}>
              <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
                {/* Header with Victory/Defeat + combatant count */}
                <div class="flex items-center gap-2 px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
                  <span class={`font-mono tracking-[0.3em] uppercase text-[12px] font-bold ${headerColor}`}>
                    {headerLabel}
                  </span>
                  <span class="font-mono text-[var(--text-dim)] text-[10px]">
                    {players.length} {t(i18n, 'stats.match.combatants')}
                  </span>
                </div>
                <div class="p-3">
                  {/* Team summary bar */}
                  <div class="flex flex-wrap gap-4 justify-around mb-3 pb-3 border-b border-[rgba(51,51,51,0.15)]">
                    <TeamStat label={t(i18n, 'stats.match.destruction')} value={totals.destruction.toLocaleString()} />
                    <TeamStat label={t(i18n, 'stats.match.losses')} value={totals.losses.toLocaleString()} />
                    <TeamStat label={t(i18n, 'stats.match.damageDealt')} value={totals.damageDealt.toLocaleString()} />
                    <TeamStat label={t(i18n, 'stats.match.supply')} value={totals.supply.toLocaleString()} />
                    <TeamStat label={t(i18n, 'stats.match.units')} value={totals.unitCount} />
                  </div>

                  {/* Player scoreboard */}
                  <div class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse table-fixed">
                      <colgroup>
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead>
                        <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                          <th class="text-left py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.leaderboard.player')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.kills')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.losses')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.damageDealt')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            Dmg Recv
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.objectives')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.supply')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.dScore')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.lScore')}
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            D/L
                          </th>
                          <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                            {t(i18n, 'stats.match.ratingChange')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPlayers.map((p) => {
                          const ratingDelta =
                            p.newRating != null && p.oldRating != null
                              ? Math.round(p.newRating - p.oldRating)
                              : null;
                          const isSelected = selectedPlayerId.value === p.id;

                          // Badge styling
                          const BADGE_STYLES: Record<string, string> = {
                            'MVP': 'text-[rgba(255,200,50,1)] border-[rgba(255,200,50,0.4)] bg-[rgba(255,200,50,0.1)]',
                            'Top Fragger': 'text-[var(--red)] border-[rgba(195,70,70,0.4)] bg-[rgba(195,70,70,0.1)]',
                            'Objective Hero': 'text-[var(--green)] border-[rgba(70,195,130,0.4)] bg-[rgba(70,195,130,0.1)]',
                            'Supply Master': 'text-[rgba(180,130,255,1)] border-[rgba(180,130,255,0.4)] bg-[rgba(180,130,255,0.1)]',
                            'Damage Dealer': 'text-[rgba(195,170,70,1)] border-[rgba(195,170,70,0.4)] bg-[rgba(195,170,70,0.1)]',
                          };

                          return (
                            <tr
                              key={`p-${p.id}`}
                              class={[
                                'border-b border-[rgba(51,51,51,0.15)] cursor-pointer transition-colors',
                                isSelected
                                  ? 'bg-[rgba(70,151,195,0.1)] border-l-2 border-l-[var(--accent)]'
                                  : 'hover:bg-[rgba(70,151,195,0.05)]',
                              ].join(' ')}
                              onClick$={() => {
                                selectedPlayerId.value = p.id;
                              }}
                            >
                              <td class="py-1.5">
                                <div class="flex items-center gap-1.5">
                                  {/* Country flag icon */}
                                  {p.countryFlag && (
                                    <img
                                      src={toCountryIconPath(p.countryFlag)}
                                      alt={p.countryName ?? ''}
                                      class="w-4 h-3 object-contain opacity-80"
                                      width={16}
                                      height={12}
                                    />
                                  )}
                                  {/* Spec icons */}
                                  {p.specIcons.map((icon, si) => (
                                    <img
                                      key={`si-${si}`}
                                      src={toSpecializationIconPath(icon)}
                                      alt={p.specNames[si] ?? ''}
                                      title={p.specNames[si] ?? ''}
                                      class="w-4 h-4 object-contain opacity-70"
                                      width={16}
                                      height={16}
                                    />
                                  ))}
                                  {/* Player name + badges */}
                                  <div class="flex items-center gap-1 min-w-0">
                                    {p.steamId ? (
                                      <a
                                        href={`/stats/player/${p.steamId}`}
                                        class="text-[var(--accent)] hover:underline truncate"
                                        data-native-link
                                        onClick$={(e: any) => { e.stopPropagation(); }}
                                      >
                                        {p.name ?? `Player ${p.id}`}
                                      </a>
                                    ) : (
                                      <span class="text-[var(--text)] truncate">
                                        {p.name ?? `Player ${p.id}`}
                                      </span>
                                    )}
                                    {p.badges.map((badge, bi) => (
                                      <span
                                        key={`b-${bi}`}
                                        class={`text-[7px] font-mono uppercase px-1 py-0.5 border whitespace-nowrap ${BADGE_STYLES[badge] ?? 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)]'}`}
                                      >
                                        {badge}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </td>
                              <td class="py-1.5 text-[var(--text)] font-mono text-right">
                                {p.destruction ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--text)] font-mono text-right">
                                {p.losses ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--text)] font-mono text-right">
                                {p.damageDealt?.toLocaleString() ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--text-dim)] font-mono text-right">
                                {p.damageReceived?.toLocaleString() ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--text)] font-mono text-right">
                                {p.objectivesCaptured ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--text)] font-mono text-right">
                                {p.supplyPointsConsumed?.toLocaleString() ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--green)] font-mono text-right text-[10px]">
                                {p.destructionScore?.toLocaleString() ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--red)] font-mono text-right text-[10px]">
                                {p.lossesScore?.toLocaleString() ?? '-'}
                              </td>
                              <td class="py-1.5 text-[var(--text)] font-mono text-right">
                                {p.dlRatio?.toFixed(2) ?? '-'}
                              </td>
                              <td class="py-1.5 font-mono text-right text-[10px]">
                                {p.oldRating != null && ratingDelta != null ? (
                                  <span>
                                    <span class="text-[var(--text-dim)]">{Math.round(p.oldRating)}</span>
                                    {' '}
                                    <span class={ratingDelta >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                                      {ratingDelta >= 0 ? '+' : ''}{ratingDelta}
                                    </span>
                                  </span>
                                ) : (
                                  <span class="text-[var(--text-dim)]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
            </div>
          </>
        );
      })()}

      {/* Shared unit roster — renders for each player, visibility controlled by signal */}
      {f.players.map((sp) => (
        <div
          key={`roster-${sp.id}`}
          style={{ display: selectedPlayerId.value === sp.id ? 'block' : 'none' }}
        >
          <Panel
            title={`${t(i18n, 'stats.match.unitRoster')} — ${sp.name ?? `Player ${sp.id}`}`}
          >
            {selectedPlayerId.value === sp.id && (
              <PlayerUnitsTable
                units={sp.units}
                onInspect$={(key: string) => {
                  inspectUnitKey.value = key;
                }}
              />
            )}
          </Panel>
        </div>
      ))}

      {/* ReadonlyUnitPanel — has its own fixed overlay + backdrop */}
      {inspectUnitKey.value && (
        <UnitInspectPanel
          unitKey={inspectUnitKey.value}
          locale={i18n.locale as Locale}
          onClose$={() => { inspectUnitKey.value = ''; }}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useFightData);
  const fight = data?.fight;
  const mapName = fight?.mapName ?? 'Match';
  const pc = fight?.players?.length ?? 0;
  const teamSize = pc >= 2 ? `${Math.ceil(pc / 2)}v${Math.floor(pc / 2)}` : '';
  const duration = fight?.totalPlayTimeSec ? `${Math.floor(fight.totalPlayTimeSec / 60)}m` : '';
  const descParts = [mapName, teamSize, duration].filter(Boolean);
  const description = descParts.length > 1
    ? descParts.join(' · ')
    : `View detailed match statistics for ${mapName} in Broken Arrow.`;
  const title = `BA HUB - Match on ${mapName}`;

  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
  };
};
