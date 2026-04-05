import { $, component$, useSignal, useResource$, Resource, Slot } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type {
  StatsOverviewData,
  AnalyticsUserInfo,
  AnalyticsLeaderboardEntry,
  RollingFactionStatsRow,
  RollingMapStatsRow,
  RollingSpecStatsRow,
  UnitPerformanceEntry,
} from '~/lib/graphql-types';
import {
  STATS_OVERVIEW_QUERY,
  STATS_USER_LOOKUP_QUERY,
  ROLLING_FACTION_STATS_QUERY,
  ROLLING_MAP_STATS_QUERY,
  ROLLING_SPEC_STATS_QUERY,
  UNIT_PERFORMANCE_QUERY,
} from '~/lib/queries/stats';
import { ChartCanvas } from '~/components/stats/ChartCanvas';
import type { ChartConfiguration } from 'chart.js';

/* ─── Option name resolution ─────────────────────────────── */

/** Resolve raw option UINames through the game locale system */
function resolveUnitOptionNames(rawNames: string[], locale: string): string[] {
  return rawNames
    .map((n) => {
      const resolved = getGameLocaleValueOrKey(GAME_LOCALES.modopts, n, locale as any);
      if (resolved && resolved !== n) return resolved;
      return n.replace(/^(?:dlc_\d+_)?Custom_Option_/i, '').replace(/_/g, ' ');
    })
    .filter((n) => n !== 'None' && n !== 'Default' && n !== 'Empty');
}

/* ─── Spec name cleanup ──────────────────────────────────── */

/** Spec names that need display overrides (game data has internal codes) */
const SPEC_NAME_OVERRIDES: Record<string, string> = {
  'DLC2 Baltic': 'Baltic Jaegers',
};

/** Hidden spec IDs (Editor, internal) */
const HIDDEN_SPEC_NAMES = new Set(['Editor', 'Spec 12', 'Spec_12']);

/** Clean up a spec name for display */
function resolveSpecName(name: string): string | null {
  if (HIDDEN_SPEC_NAMES.has(name)) return null;
  return SPEC_NAME_OVERRIDES[name] ?? name;
}

/* ─── Faction name formatter ─────────────────────────────── */

/* ─── Route loader: SSR overview + full 100 leaderboard ───── */

/* ─── Skeleton primitives ─────────────────────────────────── */

/** A single pulsing bar — width and height via class or inline style */
const SkeletonBar = component$<{ class?: string; style?: Record<string, string> }>(
  (props) => (
    <div
      class={['bg-[rgba(51,51,51,0.25)] animate-pulse rounded-sm', props.class ?? ''].join(' ')}
      style={props.style}
    />
  ),
);

/** Skeleton for the leaderboard table (10 rows) */
const LeaderboardSkeleton = component$(() => {
  return (
    <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
      <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        <SkeletonBar class="h-3 w-32 inline-block" />
      </p>
      <div class="p-3">
        {/* header row */}
        <div class="flex gap-2 mb-3">
          <SkeletonBar class="h-2 w-8" />
          <SkeletonBar class="h-2 flex-1" />
          <SkeletonBar class="h-2 w-12" />
          <SkeletonBar class="h-2 w-10" />
          <SkeletonBar class="h-2 w-10" />
          <SkeletonBar class="h-2 w-14" />
        </div>
        {/* 10 placeholder rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} class="flex gap-2 py-2 border-b border-[rgba(51,51,51,0.1)]">
            <SkeletonBar class="h-3 w-6" />
            <SkeletonBar class="h-3 flex-1" style={{ maxWidth: `${160 + (i % 3) * 40}px` }} />
            <SkeletonBar class="h-3 w-10" />
            <SkeletonBar class="h-3 w-8" />
            <SkeletonBar class="h-3 w-8" />
            <SkeletonBar class="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
});

/** Skeleton for a chart panel */
const ChartSkeleton = component$<{ height?: number }>(({ height }) => {
  return (
    <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
      <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        <SkeletonBar class="h-3 w-28 inline-block" />
      </p>
      <div class="p-3">
        <div
          class="flex items-end justify-between gap-1"
          style={{ height: `${height ?? 300}px` }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBar
              key={i}
              class="flex-1 rounded-t-sm"
              style={{ height: `${30 + ((i * 37) % 70)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

/** Skeleton for the unit performance table */
const UnitTableSkeleton = component$(() => {
  return (
    <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
      <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        <SkeletonBar class="h-3 w-36 inline-block" />
      </p>
      <div class="p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} class="flex gap-3 py-2 border-b border-[rgba(51,51,51,0.1)]">
            <SkeletonBar class="h-4 w-4 rounded" />
            <SkeletonBar class="h-4 flex-1" style={{ maxWidth: `${120 + (i % 4) * 30}px` }} />
            <SkeletonBar class="h-4 w-16" />
            <SkeletonBar class="h-4 w-12" />
            <SkeletonBar class="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─── Chart config builders ──────────────────────────────── */

/**
 * Resolve map key codes (e.g. "sv_play_map_23") to display names.
 * Falls through to the raw name if no mapping exists.
 */
const MAP_ID_TO_DISPLAY: Record<number, string> = {
  1: 'Test Map', 3: 'Baltiisk', 4: 'Coast', 5: 'Airport',
  6: 'River', 7: 'Dam', 8: 'Tallinn Harbour', 9: 'Airbase',
  10: 'Frontiers', 11: 'Central Village', 12: 'Oil Refinery',
  13: 'Suwalki', 14: 'Jelgava', 15: 'Narva', 16: 'Klaipeda',
  17: 'Ruda', 20: 'Parnu', 21: 'Chernyakhovsk',
  22: 'Ignalina Powerplant', 23: 'Kaliningrad', 25: 'Kadaga Military Base',
};

function resolveMapName(raw: string): string {
  // Handle "sv_play_map_N" format from external API
  const match = raw.match(/^sv_play_map_(\d+)$/);
  if (match) {
    const id = parseInt(match[1], 10);
    return MAP_ID_TO_DISPLAY[id] ?? raw;
  }
  // Handle numeric map IDs or already-resolved names
  return MAP_ID_TO_DISPLAY[parseInt(raw, 10)] ?? raw;
}

const ACCENT = 'rgba(70, 151, 195, 0.8)';
const ACCENT_BORDER = 'rgba(70, 151, 195, 1)';
const CHART_COLORS = [
  'rgba(70, 151, 195, 0.7)',
  'rgba(195, 70, 70, 0.7)',
  'rgba(70, 195, 130, 0.7)',
  'rgba(195, 170, 70, 0.7)',
  'rgba(150, 70, 195, 0.7)',
  'rgba(195, 120, 70, 0.7)',
  'rgba(70, 195, 195, 0.7)',
  'rgba(195, 70, 150, 0.7)',
];

/* ─── Rolling aggregate chart builders ────────────────────── */

function buildRollingFactionChart(
  rows: RollingFactionStatsRow[],
): ChartConfiguration {
  // Filter out "Unknown" faction and show win rates as a horizontal bar chart
  const sorted = [...rows]
    .filter((r) => r.factionName !== 'Unknown')
    .sort((a, b) => b.matchCount - a.matchCount);

  return {
    type: 'bar',
    data: {
      labels: sorted.map((r) => r.factionName),
      datasets: [
        {
          label: 'Win Rate %',
          data: sorted.map((r) =>
            r.matchCount > 0 ? Math.round((r.winCount / r.matchCount) * 1000) / 10 : 0,
          ),
          backgroundColor: sorted.map((r) =>
            r.factionName.startsWith('Russia') ? CHART_COLORS[1] : CHART_COLORS[0],
          ),
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(51,51,51,0.2)' },
          ticks: { font: { size: 9 } },
          title: { display: true, text: 'Win Rate %', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
          min: 0,
          max: 100,
        },
        y: { grid: { display: false } },
      },
    },
  };
}

function buildRollingMapChart(
  rows: RollingMapStatsRow[],
): ChartConfiguration {
  const total = rows.reduce((s, r) => s + r.playCount, 0);
  const sorted = [...rows].sort((a, b) => b.playCount - a.playCount).slice(0, 15);

  return {
    type: 'bar',
    data: {
      labels: sorted.map((r) => resolveMapName(r.mapName)),
      datasets: [
        {
          data: sorted.map((r) =>
            total > 0 ? Math.round((r.playCount / total) * 1000) / 10 : 0,
          ),
          backgroundColor: ACCENT,
          borderColor: ACCENT_BORDER,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(51,51,51,0.2)' }, ticks: { font: { size: 9 } } },
        y: { grid: { display: false } },
      },
    },
  };
}

function buildRollingSpecChart(
  rows: RollingSpecStatsRow[],
): ChartConfiguration {
  // Filter hidden specs and "Unknown" faction, then compute % within each faction
  const filtered = rows.filter(
    (r) => resolveSpecName(r.specName) !== null && r.factionName !== 'Unknown',
  );

  // Get faction totals for percentage calculation
  const factionTotals = new Map<string, number>();
  for (const r of filtered) {
    factionTotals.set(r.factionName, (factionTotals.get(r.factionName) ?? 0) + r.pickCount);
  }

  // Build per-spec aggregation and determine primary faction
  const specAgg = new Map<string, { faction: string; picks: number }>();
  for (const r of filtered) {
    const existing = specAgg.get(r.specName);
    const newPicks = (existing?.picks ?? 0) + r.pickCount;
    // Primary faction = whichever has more picks (specs are faction-exclusive in practice)
    const faction = !existing || r.pickCount > (existing.picks - (existing.picks - r.pickCount))
      ? r.factionName
      : existing.faction;
    specAgg.set(r.specName, { faction, picks: newPicks });
  }

  // Faction color mapping
  const factionColors: Record<string, string> = {
    Russia: CHART_COLORS[1],  // red
    USA: CHART_COLORS[0],     // blue
  };

  // Fixed faction order: Russia first, then USA
  const factionOrder = ['Russia', 'USA'];
  const factions = [...factionTotals.keys()].sort((a, b) => {
    const ai = factionOrder.indexOf(a);
    const bi = factionOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  // Group specs by faction, sorted by % within faction (descending)
  const orderedSpecs: string[] = [];
  for (const faction of factions) {
    const factionSpecs = [...specAgg.entries()]
      .filter(([, agg]) => agg.faction === faction)
      .sort((a, b) => {
        const total = factionTotals.get(faction) ?? 1;
        return (b[1].picks / total) - (a[1].picks / total);
      })
      .map(([spec]) => spec);
    orderedSpecs.push(...factionSpecs);
  }

  // Single dataset with per-bar coloring (each spec belongs to one faction)
  const data = orderedSpecs.map((spec) => {
    const agg = specAgg.get(spec)!;
    const total = factionTotals.get(agg.faction) ?? 1;
    return Math.round((agg.picks / total) * 1000) / 10;
  });

  const colors = orderedSpecs.map((spec) => {
    const faction = specAgg.get(spec)!.faction;
    return factionColors[faction] ?? CHART_COLORS[2];
  });

  return {
    type: 'bar',
    data: {
      labels: orderedSpecs.map((n) => resolveSpecName(n) ?? n),
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51,51,51,0.2)' },
          title: { display: true, text: '% of faction picks', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
        },
        y: { grid: { display: false } },
      },
    },
  };
}

/* ─── Panel wrapper ──────────────────────────────────────── */

const Panel = component$<{ title: string; class?: string; fill?: boolean }>(
  ({ title, fill }) => {
    return (
      <div
        class={[
          'p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]',
          fill ? 'h-full flex flex-col' : '',
        ].join(' ')}
      >
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
          {title}
        </p>
        <div class={fill ? 'flex-1 p-3' : 'p-3'}>
          <Slot />
        </div>
      </div>
    );
  },
);

/* ─── Known ELO brackets (500-wide buckets from matchCrawler) ─ */

const ELO_BRACKETS = [
  '0-500',
  '500-1000',
  '1000-1500',
  '1500-2000',
  '2000-2500',
  '2500-3000',
  '3000-3500',
  '3500-4000',
];

/* ─── Top performing units with filters ───────────────────── */

const TopPerformingUnitsSection = component$<{
  entries: UnitPerformanceEntry[];
  since: string;
}>(({ entries, since }) => {
  const i18n = useI18n();
  const selectedFaction = useSignal('');
  const selectedElo = useSignal('');

  const factionNames = [...new Set(entries.map((e) => e.factionName))].filter(n => n !== 'Unknown').sort();

  const eloResource = useResource$<UnitPerformanceEntry[]>(async ({ track }) => {
    const elo = track(() => selectedElo.value);
    const sinceVal = track(() => since);
    if (!elo && sinceVal === '30d') return entries;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: UNIT_PERFORMANCE_QUERY,
        variables: { since: sinceVal, eloBracket: elo || undefined, limit: 200 },
      }),
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: { unitPerformance: UnitPerformanceEntry[] } };
    return payload.data?.unitPerformance ?? [];
  });

  return (
    <Panel title={t(i18n, 'stats.topUnits.title')}>
      <div class="flex items-center gap-2 mb-3 px-3 pt-2 flex-wrap">
        <select
          class="bg-[rgba(26,26,26,0.6)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] font-mono"
          value={selectedFaction.value}
          onChange$={(e) => { selectedFaction.value = (e.target as HTMLSelectElement).value; }}
        >
          <option value="">{t(i18n, 'stats.unitPopularity.allFactions')}</option>
          {factionNames.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          class="bg-[rgba(26,26,26,0.6)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] font-mono"
          value={selectedElo.value}
          onChange$={(e) => { selectedElo.value = (e.target as HTMLSelectElement).value; }}
        >
          <option value="">{t(i18n, 'stats.unitTable.allElo')}</option>
          {ELO_BRACKETS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <Resource
        value={eloResource}
        onPending={() => (
          <div class="py-6 text-center">
            <p class="text-xs text-[var(--text-dim)] animate-pulse">{t(i18n, 'stats.loading')}</p>
          </div>
        )}
        onResolved={(data) => {
          const filtered = data.filter((e) => {
            if (selectedFaction.value && e.factionName !== selectedFaction.value) return false;
            return true;
          });
          const sorted = [...filtered]
            .sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)
            .slice(0, 50);
          const showEloCol = !!selectedElo.value;
          return (
            <>
              <div class="px-3 mb-2">
                <span class="text-[9px] text-[var(--text-dim)] font-mono">
                  {sorted.length} {t(i18n, 'stats.unitTable.configs')}
                </span>
              </div>
              <div class="max-h-[500px] overflow-y-auto">
                <table class="w-full text-xs border-collapse">
                  <thead class="sticky top-0 bg-[var(--bg)] z-10">
                    <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                      <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.unit')}</th>
                      <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.options')}</th>
                      <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.faction')}</th>
                      {showEloCol && <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.elo')}</th>}
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.deployed')}</th>
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.avgKills')}</th>
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.avgDamage')}</th>
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.match.damageDealt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((u, idx) => {
                      const opts = resolveUnitOptionNames(u.optionNames ?? [], i18n.locale);
                      return (
                        <tr
                          key={`top-${u.configKey}-${u.eloBracket ?? 'all'}-${idx}`}
                          class="border-b border-[rgba(51,51,51,0.15)] hover:bg-[rgba(70,151,195,0.05)]"
                        >
                          <td class="py-1.5 px-2">
                            <a href={`/arsenal/${u.unitId}`} class="text-[var(--accent)] hover:underline">
                              {u.unitName}
                            </a>
                          </td>
                          <td class="py-1.5 px-2 text-[var(--text-dim)] text-[10px]">
                            {opts.length > 0 ? opts.join(' + ') : '-'}
                          </td>
                          <td class="py-1.5 px-2 text-[var(--text-dim)]">{u.factionName}</td>
                          {showEloCol && <td class="py-1.5 px-2 text-[var(--text-dim)] font-mono text-[10px]">{u.eloBracket}</td>}
                          <td class="py-1.5 px-2 text-[var(--text)] font-mono text-right">{u.deployCount}</td>
                          <td class="py-1.5 px-2 text-[var(--text)] font-mono text-right">{u.avgKills.toFixed(1)}</td>
                          <td class="py-1.5 px-2 text-[var(--text)] font-mono text-right">{Math.round(u.avgDamage)}</td>
                          <td class="py-1.5 px-2 text-[var(--text-dim)] font-mono text-right">{Math.round(u.totalDamageDealt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      />
    </Panel>
  );
});

/* ─── Unit performance table with filters ────────────────── */

const UnitPerformanceSection = component$<{
  entries: UnitPerformanceEntry[];
  since: string;
}>(({ entries, since }) => {
  const i18n = useI18n();
  const selectedFaction = useSignal('');
  const selectedElo = useSignal('');

  const factionNames = [...new Set(entries.map((e) => e.factionName))].filter(n => n !== 'Unknown').sort();

  // When an ELO bracket is selected or time range changed, re-fetch from server.
  // When "All Elo" (empty string) and default 30d range, use the initial SSR data.
  const eloResource = useResource$<UnitPerformanceEntry[]>(async ({ track }) => {
    const elo = track(() => selectedElo.value);
    const sinceVal = track(() => since);
    if (!elo && sinceVal === '30d') return entries; // "All" + default → use pre-loaded data

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: UNIT_PERFORMANCE_QUERY,
        variables: { since: sinceVal, eloBracket: elo || undefined, limit: 200 },
      }),
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: { unitPerformance: UnitPerformanceEntry[] } };
    return payload.data?.unitPerformance ?? [];
  });

  return (
    <Panel title={t(i18n, 'stats.unitPopularity.title')}>
      <div class="flex items-center gap-2 mb-3 px-3 pt-2 flex-wrap">
        <select
          class="bg-[rgba(26,26,26,0.6)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] font-mono"
          value={selectedFaction.value}
          onChange$={(e) => { selectedFaction.value = (e.target as HTMLSelectElement).value; }}
        >
          <option value="">{t(i18n, 'stats.unitPopularity.allFactions')}</option>
          {factionNames.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          class="bg-[rgba(26,26,26,0.6)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] font-mono"
          value={selectedElo.value}
          onChange$={(e) => { selectedElo.value = (e.target as HTMLSelectElement).value; }}
        >
          <option value="">{t(i18n, 'stats.unitTable.allElo')}</option>
          {ELO_BRACKETS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <Resource
        value={eloResource}
        onPending={() => (
          <div class="py-6 text-center">
            <p class="text-xs text-[var(--text-dim)] animate-pulse">{t(i18n, 'stats.loading')}</p>
          </div>
        )}
        onResolved={(data) => {
          const filtered = data.filter((e) => {
            if (selectedFaction.value && e.factionName !== selectedFaction.value) return false;
            return true;
          });
          const sorted = [...filtered].sort((a, b) => b.deployCount - a.deployCount);
          const showEloCol = !!selectedElo.value;
          return (
            <>
              <div class="px-3 mb-2">
                <span class="text-[9px] text-[var(--text-dim)] font-mono">
                  {sorted.length} {t(i18n, 'stats.unitTable.configs')}
                </span>
              </div>
              <div class="max-h-[500px] overflow-y-auto">
                <table class="w-full text-xs border-collapse">
                  <thead class="sticky top-0 bg-[var(--bg)] z-10">
                    <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                      <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.unit')}</th>
                      <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.options')}</th>
                      <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.faction')}</th>
                      {showEloCol && <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.elo')}</th>}
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitPopularity.deployed')}</th>
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.avgKills')}</th>
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.avgDamage')}</th>
                      <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.refundPct')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((u, idx) => {
                      const refundPct = u.deployCount > 0 ? ((u.refundCount / u.deployCount) * 100).toFixed(1) : '0.0';
                      const opts = resolveUnitOptionNames(u.optionNames ?? [], i18n.locale);
                      return (
                        <tr
                          key={`${u.configKey}-${u.eloBracket ?? 'all'}-${idx}`}
                          class="border-b border-[rgba(51,51,51,0.15)] hover:bg-[rgba(70,151,195,0.05)]"
                        >
                          <td class="py-1.5 px-2">
                            <a href={`/arsenal/${u.unitId}`} class="text-[var(--accent)] hover:underline">
                              {u.unitName}
                            </a>
                          </td>
                          <td class="py-1.5 px-2 text-[var(--text-dim)] text-[10px]">
                            {opts.length > 0 ? opts.join(' + ') : '-'}
                          </td>
                          <td class="py-1.5 px-2 text-[var(--text-dim)]">{u.factionName}</td>
                          {showEloCol && <td class="py-1.5 px-2 text-[var(--text-dim)] font-mono text-[10px]">{u.eloBracket}</td>}
                          <td class="py-1.5 px-2 text-[var(--text)] font-mono text-right">{u.deployCount}</td>
                          <td class="py-1.5 px-2 text-[var(--text)] font-mono text-right">{u.avgKills.toFixed(1)}</td>
                          <td class="py-1.5 px-2 text-[var(--text)] font-mono text-right">{Math.round(u.avgDamage)}</td>
                          <td class="py-1.5 px-2 text-[var(--text-dim)] font-mono text-right">{refundPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      />
    </Panel>
  );
});

/* ─── Main component ─────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();

  // ── Client-side leaderboard + unit performance fetch (non-blocking) ──
  const overviewData = useResource$<{
    analyticsLeaderboard: AnalyticsLeaderboardEntry[];
    unitPerformance: UnitPerformanceEntry[];
  }>(async () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

    const [overviewRes, unitPerformanceRes] = await Promise.all([
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: STATS_OVERVIEW_QUERY }),
      }),
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: UNIT_PERFORMANCE_QUERY,
          variables: { since: '30d', limit: 100 },
        }),
      }).catch(() => null),
    ]);

    let analyticsLeaderboard: AnalyticsLeaderboardEntry[] = [];
    if (overviewRes.ok) {
      const payload = (await overviewRes.json()) as { data?: StatsOverviewData };
      analyticsLeaderboard = payload.data?.analyticsLeaderboard ?? [];
    }

    let unitPerformance: UnitPerformanceEntry[] = [];
    if (unitPerformanceRes?.ok) {
      const d = (await unitPerformanceRes.json()) as { data?: { unitPerformance: UnitPerformanceEntry[] } };
      unitPerformance = d.data?.unitPerformance ?? [];
    }

    return { analyticsLeaderboard, unitPerformance };
  });

  // ── Player lookup state ──
  const searchSteamId = useSignal('');
  const searchLoading = useSignal(false);
  const searchResult = useSignal<AnalyticsUserInfo | null>(null);
  const searchError = useSignal('');

  const lookupPlayer = $(async () => {
    const steamId = searchSteamId.value.trim();
    if (!steamId) return;
    searchLoading.value = true;
    searchError.value = '';
    searchResult.value = null;
    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: STATS_USER_LOOKUP_QUERY,
          variables: { steamId },
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const payload = (await res.json()) as {
        data?: { analyticsUserLookup: AnalyticsUserInfo | null };
        errors?: Array<{ message: string }>;
      };
      if (payload.data?.analyticsUserLookup) {
        searchResult.value = payload.data.analyticsUserLookup;
      } else {
        searchError.value = t(i18n, 'stats.profile.notFound');
      }
    } catch (err) {
      searchError.value =
        err instanceof Error ? err.message : 'Lookup failed';
    } finally {
      searchLoading.value = false;
    }
  });

  // ── Derived state ──

  const lbExpanded = useSignal(false);

  // ── Rolling data (client-side, reactive to time range + elo) ──
  const rollingRange = useSignal<'7d' | '14d' | '30d'>('30d');
  const rollingElo = useSignal('');

  const rollingData = useResource$<{
    factionRows: RollingFactionStatsRow[];
    mapRows: RollingMapStatsRow[];
    specRows: RollingSpecStatsRow[];
  }>(async ({ track }) => {
    const since = track(() => rollingRange.value);
    const eloBracket = track(() => rollingElo.value) || undefined;
    const apiUrl =
      import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

    const [factionRes, mapRes, specRes] = await Promise.all([
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: ROLLING_FACTION_STATS_QUERY,
          variables: { since, eloBracket },
        }),
      }).catch(() => null),
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: ROLLING_MAP_STATS_QUERY,
          variables: { since, eloBracket },
        }),
      }).catch(() => null),
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: ROLLING_SPEC_STATS_QUERY,
          variables: { since, eloBracket },
        }),
      }).catch(() => null),
    ]);

    const factionRows: RollingFactionStatsRow[] = factionRes?.ok
      ? ((await factionRes.json()) as any).data?.rollingFactionStats?.rows ?? []
      : [];
    const mapRows: RollingMapStatsRow[] = mapRes?.ok
      ? ((await mapRes.json()) as any).data?.rollingMapStats?.rows ?? []
      : [];
    const specRows: RollingSpecStatsRow[] = specRes?.ok
      ? ((await specRes.json()) as any).data?.rollingSpecStats?.rows ?? []
      : [];

    return { factionRows, mapRows, specRows };
  });

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* ═══ Header + Player Search ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.tag')}
        </p>
        <h1 class="text-3xl font-semibold text-[var(--text)] tracking-tight">
          {t(i18n, 'stats.title')}
        </h1>
        <p class="text-sm text-[var(--text-dim)] mt-2 max-w-2xl">
          {t(i18n, 'stats.subtitle')}
        </p>

        {/* Inline player search */}
        <div class="mt-4 flex gap-2 max-w-lg">
          <input
            class="flex-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs px-3 py-2 font-mono focus:outline-none focus:border-[var(--accent)]"
            value={searchSteamId.value}
            onInput$={(ev) => {
              searchSteamId.value = (ev.target as HTMLInputElement).value;
            }}
            onKeyDown$={(ev) => {
              if (ev.key === 'Enter') lookupPlayer();
            }}
            placeholder={t(i18n, 'stats.search.steamIdPlaceholder')}
          />
          <button
            class="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-[var(--accent)] text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] disabled:opacity-30"
            onClick$={lookupPlayer}
            disabled={searchLoading.value}
          >
            {t(i18n, 'stats.search.findPlayer')}
          </button>
        </div>

        {/* Search results */}
        {searchLoading.value && (
          <p class="mt-2 text-xs text-[var(--text-dim)]">{t(i18n, 'common.loading')}</p>
        )}
        {searchError.value && (
          <p class="mt-2 text-xs text-red-400">{searchError.value}</p>
        )}
        {searchResult.value && (
          <div class="mt-2 bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)] p-3 max-w-lg flex items-center justify-between">
            <div class="flex gap-4 text-xs">
              <span class="text-[var(--text)]">
                {searchResult.value.name ?? '-'}
              </span>
              <span class="text-[var(--text-dim)] font-mono">
                ELO {searchResult.value.rating ? Math.round(searchResult.value.rating) : '-'}
              </span>
              <span class="text-[var(--accent)] font-mono">
                #{searchResult.value.rank ?? '-'}
              </span>
            </div>
            <a
              href={`/stats/player/${searchResult.value.steamId}`}
              class="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] hover:underline"
            >
              {t(i18n, 'stats.search.goToProfile')} →
            </a>
          </div>
        )}
      </div>

      {/* ═══ Section 1: Leaderboard ═══ */}
      <div class="mb-6">
        <Resource
          value={overviewData}
          onPending={() => <LeaderboardSkeleton />}
          onRejected={() => (
            <Panel title={t(i18n, 'stats.tab.leaderboard')}>
              <p class="py-4 text-center text-xs text-[var(--text-dim)]">{t(i18n, 'stats.leaderboard.empty')}</p>
            </Panel>
          )}
          onResolved={(data) => {
            const leaderboard = data.analyticsLeaderboard;
            return (
              <Panel title={t(i18n, 'stats.tab.leaderboard')}>
                <div class={lbExpanded.value ? 'max-h-[600px] overflow-y-auto' : ''}>
                  <table class="w-full text-xs border-collapse">
                    <thead class={lbExpanded.value ? 'sticky top-0 bg-[var(--bg)] z-10' : ''}>
                      <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                        <th class="text-left py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                          {t(i18n, 'stats.leaderboard.rank')}
                        </th>
                        <th class="text-left py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                          {t(i18n, 'stats.leaderboard.player')}
                        </th>
                        <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                          ELO
                        </th>
                        <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                          {t(i18n, 'stats.leaderboard.score')}
                        </th>
                        <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                          K/D
                        </th>
                        <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                          {t(i18n, 'stats.leaderboard.winRate')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.slice(0, lbExpanded.value ? 100 : 10).map((e) => (
                        <tr
                          key={`lb-${e.rank}-${e.userId}`}
                          class="border-b border-[rgba(51,51,51,0.15)] hover:bg-[rgba(70,151,195,0.05)]"
                        >
                          <td class="py-1.5 px-1 text-[var(--accent)] font-mono">
                            {e.rank}
                          </td>
                          <td class="py-1.5 px-1 text-[var(--text)]">
                            {e.steamId ? (
                              <a
                                href={`/stats/player/${e.steamId}`}
                                class="hover:text-[var(--accent)] transition-colors"
                              >
                                {e.name ?? `User ${e.userId ?? '-'}`}
                              </a>
                            ) : (
                              e.name ?? `User ${e.userId ?? '-'}`
                            )}
                          </td>
                          <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">
                            {Math.round(e.elo ?? e.rating ?? 0)}
                          </td>
                          <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">
                            Lv.{e.level ?? '-'}
                          </td>
                          <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">
                            {e.kdRatio?.toFixed(2) ?? '-'}
                          </td>
                          <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">
                            {e.winRate != null ? `${(e.winRate * 100).toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={6} class="py-4 text-center text-[var(--text-dim)] text-xs">
                            {t(i18n, 'stats.leaderboard.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {leaderboard.length > 10 && (
                  <button
                    class="w-full mt-2 py-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)] hover:text-[var(--accent)] border border-[rgba(51,51,51,0.2)] hover:border-[rgba(51,51,51,0.4)] transition-colors"
                    onClick$={() => { lbExpanded.value = !lbExpanded.value; }}
                  >
                    {lbExpanded.value ? '▲ Show Top 10' : `▼ Show Top 100`}
                  </button>
                )}
              </Panel>
            );
          }}
        />
      </div>

      {/* ═══ Section 2: All Ranked Match Data ═══ */}
      <div class="mb-6">
        {/* Shared header + controls for all ranked data sections */}
        <div class="flex items-center justify-between mb-1">
          <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase">
            {t(i18n, 'stats.history.title')}
          </p>
          <div class="flex items-center gap-3">
            {/* ELO bracket filter */}
            <select
              class="px-2 py-1 text-[9px] font-mono uppercase tracking-wider border border-[rgba(51,51,51,0.3)] bg-[rgba(26,26,26,0.6)] text-[var(--text-dim)] appearance-none cursor-pointer"
              value={rollingElo.value}
              onChange$={(e) => {
                rollingElo.value = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="">{t(i18n, 'stats.unitPerformance.allElo')}</option>
              {ELO_BRACKETS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Time range selector */}
            <div class="flex gap-1">
              {(['7d', '14d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  class={[
                    'px-3 py-1 text-[9px] font-mono uppercase tracking-wider border transition-colors',
                    rollingRange.value === range
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                      : 'border-[rgba(51,51,51,0.3)] text-[var(--text-dim)] hover:border-[rgba(51,51,51,0.5)] hover:text-[var(--text)]',
                  ].join(' ')}
                  onClick$={() => { rollingRange.value = range; }}
                >
                  {range === '7d'
                    ? t(i18n, 'stats.history.timeRange.week')
                    : range === '14d'
                      ? t(i18n, 'stats.history.timeRange.twoWeeks')
                      : t(i18n, 'stats.history.timeRange.month')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p class="text-[8px] text-[var(--text-dim)] italic mb-4">
          {t(i18n, 'stats.history.subtitle')}
        </p>

        {/* Charts: faction win rate, map popularity, spec picks */}
        <Resource
          value={rollingData}
          onPending={() => (
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <ChartSkeleton key={i} />
              ))}
            </div>
          )}
          onRejected={() => (
            <Panel title={t(i18n, 'stats.history.title')}>
              <div class="py-6 text-center">
                <p class="text-xs text-[var(--text-dim)]">
                  {t(i18n, 'stats.history.comingSoon')}
                </p>
              </div>
            </Panel>
          )}
          onResolved={(data) => {
            const hasData = data.factionRows.length > 0 || data.mapRows.length > 0 || data.specRows.length > 0;
            if (!hasData) {
              return (
                <Panel title={t(i18n, 'stats.history.title')}>
                  <div class="py-6 text-center">
                    <p class="text-xs text-[var(--text-dim)]">
                      {t(i18n, 'stats.history.comingSoon')}
                    </p>
                  </div>
                </Panel>
              );
            }
            return (
              <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
                {data.factionRows.length > 0 && (
                  <Panel title={t(i18n, 'stats.history.factionWinRate')}>
                    <ChartCanvas config={buildRollingFactionChart(data.factionRows)} height={300} />
                  </Panel>
                )}
                {data.mapRows.length > 0 && (
                  <Panel title={t(i18n, 'stats.history.mapPopularity')}>
                    <ChartCanvas config={buildRollingMapChart(data.mapRows)} height={300} />
                  </Panel>
                )}
                {data.specRows.length > 0 && (
                  <Panel title={t(i18n, 'stats.history.specPopularity')}>
                    <div class="flex items-center gap-4 mb-2 text-xs font-mono">
                      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[1] }} /> Russia</span>
                      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[0] }} /> USA</span>
                    </div>
                    <ChartCanvas config={buildRollingSpecChart(data.specRows)} height={300} />
                  </Panel>
                )}
              </div>
            );
          }}
        />

        {/* Top Performing Units */}
        <div class="mt-4">
          <Resource
            value={overviewData}
            onPending={() => <UnitTableSkeleton />}
            onRejected={() => (
              <Panel title={t(i18n, 'stats.topUnits.title')}>
                <div class="py-6 text-center">
                  <p class="text-xs text-[var(--text-dim)]">{t(i18n, 'stats.topUnits.comingSoon')}</p>
                </div>
              </Panel>
            )}
            onResolved={(data) => {
              if (data.unitPerformance.length > 0) {
                return <TopPerformingUnitsSection entries={data.unitPerformance} since={rollingRange.value} />;
              }
              return (
                <Panel title={t(i18n, 'stats.topUnits.title')}>
                  <div class="py-6 text-center">
                    <p class="text-xs text-[var(--text-dim)]">{t(i18n, 'stats.topUnits.comingSoon')}</p>
                  </div>
                </Panel>
              );
            }}
          />
        </div>

        {/* Unit Popularity */}
        <div class="mt-4">
          <Resource
            value={overviewData}
            onPending={() => <UnitTableSkeleton />}
            onRejected={() => (
              <Panel title={t(i18n, 'stats.unitPopularity.title')}>
                <div class="py-6 text-center">
                  <p class="text-xs text-[var(--text-dim)]">{t(i18n, 'stats.unitPopularity.comingSoon')}</p>
                </div>
              </Panel>
            )}
            onResolved={(data) => {
              if (data.unitPerformance.length > 0) {
                return <UnitPerformanceSection entries={data.unitPerformance} since={rollingRange.value} />;
              }
              return (
                <Panel title={t(i18n, 'stats.unitPopularity.title')}>
                  <div class="py-6 text-center">
                    <p class="text-xs text-[var(--text-dim)]">{t(i18n, 'stats.unitPopularity.comingSoon')}</p>
                  </div>
                </Panel>
              );
            }}
          />
        </div>

        <p class="text-[8px] text-[var(--text-dim)] italic mt-3">
          {t(i18n, 'stats.crawler.disclaimer')}
        </p>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'BA HUB - Statistics',
  meta: [
    {
      name: 'description',
      content:
        'View player leaderboards, map analytics, specialization usage, and performance statistics for Broken Arrow.',
    },
  ],
};
