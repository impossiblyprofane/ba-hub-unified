import { $, component$, useSignal, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type {
  StatsOverviewData,
  AnalyticsCountryStats,
  AnalyticsUserInfo,
  SnapshotFactionEntry,
  SnapshotMapEntry,
  CrawlerFactionEntry,
  SnapshotSpecEntry,
  UnitPerformanceEntry,
} from '~/lib/graphql-types';
import {
  STATS_OVERVIEW_QUERY,
  STATS_USER_LOOKUP_QUERY,
  SNAPSHOT_FACTION_HISTORY_QUERY,
  SNAPSHOT_MAP_HISTORY_QUERY,
  CRAWLER_FACTION_HISTORY_QUERY,
  SNAPSHOT_SPEC_HISTORY_QUERY,
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

/** Format raw faction matchup codes like "Russia_USA" → "Russia vs USA" */
function formatFactionName(name: string): string {
  if (name.includes('_')) {
    return name.split('_').join(' vs ');
  }
  return name;
}

/* ─── Route loader: SSR overview + full 1000 leaderboard ───── */

type OverviewPayload = StatsOverviewData & {
  analyticsCountryStats: AnalyticsCountryStats;
};

export const useStatsOverview = routeLoader$(async () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch main overview + snapshot data + crawler data in parallel
  const [
    overviewRes, factionHistoryRes, mapHistoryRes,
    crawlerFactionRes, specHistoryRes, unitPerformanceRes,
  ] = await Promise.all([
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: STATS_OVERVIEW_QUERY }),
    }),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: SNAPSHOT_FACTION_HISTORY_QUERY,
        variables: { since: since30d },
      }),
    }).catch(() => null),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: SNAPSHOT_MAP_HISTORY_QUERY,
        variables: { since: since30d },
      }),
    }).catch(() => null),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: CRAWLER_FACTION_HISTORY_QUERY,
        variables: { since: since30d },
      }),
    }).catch(() => null),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: SNAPSHOT_SPEC_HISTORY_QUERY,
        variables: { since: since30d },
      }),
    }).catch(() => null),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: UNIT_PERFORMANCE_QUERY,
        variables: { since: '30d', limit: 100 },
      }),
    }).catch(() => null),
  ]);

  if (!overviewRes.ok) {
    throw new Error(`Failed to load stats overview: ${overviewRes.status}`);
  }

  const overviewPayload = (await overviewRes.json()) as {
    data?: OverviewPayload;
    errors?: Array<{ message: string }>;
  };

  if (!overviewPayload.data) {
    const msg = overviewPayload.errors?.map((e) => e.message).join(', ') || 'Unknown error';
    throw new Error(`Failed to load stats overview: ${msg}`);
  }

  // Parse snapshot data (graceful — empty arrays if unavailable)
  let factionHistory: SnapshotFactionEntry[] = [];
  let mapHistory: SnapshotMapEntry[] = [];
  let crawlerFactionHistory: CrawlerFactionEntry[] = [];
  let specHistory: SnapshotSpecEntry[] = [];
  let unitPerformance: UnitPerformanceEntry[] = [];

  if (factionHistoryRes?.ok) {
    const d = (await factionHistoryRes.json()) as { data?: { snapshotFactionHistory: SnapshotFactionEntry[] } };
    factionHistory = d.data?.snapshotFactionHistory ?? [];
  }
  if (mapHistoryRes?.ok) {
    const d = (await mapHistoryRes.json()) as { data?: { snapshotMapHistory: SnapshotMapEntry[] } };
    mapHistory = d.data?.snapshotMapHistory ?? [];
  }
  if (crawlerFactionRes?.ok) {
    const d = (await crawlerFactionRes.json()) as { data?: { crawlerFactionHistory: CrawlerFactionEntry[] } };
    crawlerFactionHistory = d.data?.crawlerFactionHistory ?? [];
  }
  if (specHistoryRes?.ok) {
    const d = (await specHistoryRes.json()) as { data?: { snapshotSpecHistory: SnapshotSpecEntry[] } };
    specHistory = d.data?.snapshotSpecHistory ?? [];
  }
  if (unitPerformanceRes?.ok) {
    const d = (await unitPerformanceRes.json()) as { data?: { unitPerformance: UnitPerformanceEntry[] } };
    unitPerformance = d.data?.unitPerformance ?? [];
  }

  return {
    ...overviewPayload.data,
    factionHistory,
    mapHistory,
    crawlerFactionHistory,
    specHistory,
    unitPerformance,
  };
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

function buildMapChart(
  items: { name: string | null; count: number | null }[],
): ChartConfiguration {
  const filtered = items.filter((i) => i.name && i.count);
  const total = filtered.reduce((s, i) => s + (i.count ?? 0), 0);
  const sorted = [...filtered]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 15);

  return {
    type: 'bar',
    data: {
      labels: sorted.map((i) => resolveMapName(i.name!)),
      datasets: [
        {
          data: sorted.map((i) => total > 0 ? Math.round(((i.count ?? 0) / total) * 1000) / 10 : 0),
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

function buildSpecChart(
  items: { name: string | null; count: number | null }[],
): ChartConfiguration {
  const filtered = items
    .filter((i) => i.name && i.count && resolveSpecName(i.name!) !== null);
  const total = filtered.reduce((s, i) => s + (i.count ?? 0), 0);
  const sorted = [...filtered]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return {
    type: 'bar',
    data: {
      labels: sorted.map((i) => resolveSpecName(i.name!) ?? i.name!),
      datasets: [
        {
          data: sorted.map((i) => total > 0 ? Math.round(((i.count ?? 0) / total) * 1000) / 10 : 0),
          backgroundColor: sorted.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
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
        x: { grid: { color: 'rgba(51,51,51,0.2)' } },
        y: { grid: { display: false } },
      },
    },
  };
}

/**
 * Faction win rate doughnut — Russia vs USA from the Russia_USA matchup.
 * Russia_USA.winCount = Russia wins, remainder = USA wins.
 */
function buildFactionWinRateChart(
  stats: AnalyticsCountryStats,
): ChartConfiguration {
  // Find the Russia_USA entry — its winCount is Russia's wins, matchCount is total RU vs US games
  const ruVsUs = stats.winsCount.find((w) => w.name === 'Russia_USA');
  const totalRuUs = stats.matchesCount.find((m) => m.name === 'Russia_USA');

  const russiaWins = ruVsUs?.count ?? 0;
  const totalMatches = totalRuUs?.count ?? 0;
  const usaWins = totalMatches - russiaWins;

  return {
    type: 'doughnut',
    data: {
      labels: ['Russia', 'USA'],
      datasets: [
        {
          data: [russiaWins, usaWins],
          backgroundColor: [CHART_COLORS[1], CHART_COLORS[0]], // Red for Russia, Blue for USA
          borderColor: 'rgba(26,26,26,0.8)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8 },
        },
      },
    },
  };
}

function buildMapTeamSidesChart(
  data: { map: string | null; winData: { name: string | null; count: number | null }[] }[],
): ChartConfiguration {
  const maps = data.filter((d) => d.map).slice(0, 10);

  const factionSet = new Set<string>();
  for (const m of maps) {
    for (const w of m.winData) {
      if (w.name) factionSet.add(w.name);
    }
  }
  const factions = [...factionSet];

  const datasets = factions.map((faction, idx) => ({
    label: formatFactionName(faction),
    data: maps.map((m) => {
      const match = m.winData.find((w) => w.name === faction);
      return match?.count ?? 0;
    }),
    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
    borderWidth: 0,
  }));

  return {
    type: 'bar',
    data: {
      labels: maps.map((m) => resolveMapName(m.map!)),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { usePointStyle: true, pointStyleWidth: 8 },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: 'rgba(51,51,51,0.2)' } },
      },
    },
  };
}

/* ─── Snapshot history chart builders ────────────────────── */

function buildFactionHistoryChart(
  entries: SnapshotFactionEntry[],
): ChartConfiguration {
  // Only use Russia_USA (Russia wins vs USA) — ignore mirror matches
  // (Russia_Russia, USA_USA, Random_Random).
  // Russia win rate = Russia_USA.winCount / Russia_USA.matchCount
  // USA win rate = (Russia_USA.matchCount - Russia_USA.winCount) / Russia_USA.matchCount
  const dateMap = new Map<string, { matchCount: number; russiaWins: number }>();

  for (const e of entries) {
    if (e.factionName !== 'Russia_USA') continue; // Only the RU vs US matchup
    const dateKey = new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const existing = dateMap.get(dateKey) ?? { matchCount: 0, russiaWins: 0 };
    existing.matchCount += e.matchCount;
    existing.russiaWins += e.winCount;
    dateMap.set(dateKey, existing);
  }

  const dates = [...dateMap.keys()];

  return {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Russia',
          data: dates.map((date) => {
            const d = dateMap.get(date);
            if (!d || d.matchCount === 0) return null;
            return Math.round((d.russiaWins / d.matchCount) * 100);
          }),
          borderColor: CHART_COLORS[1], // Red for Russia
          backgroundColor: CHART_COLORS[1],
          fill: false,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'USA',
          data: dates.map((date) => {
            const d = dateMap.get(date);
            if (!d || d.matchCount === 0) return null;
            return 100 - Math.round((d.russiaWins / d.matchCount) * 100);
          }),
          borderColor: CHART_COLORS[0], // Blue for USA
          backgroundColor: CHART_COLORS[0],
          fill: false,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyleWidth: 8 } },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(51,51,51,0.2)' },
          title: { display: true, text: 'Win Rate %', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
          min: 30,
          max: 70,
        },
      },
    },
  } as ChartConfiguration;
}

function buildMapHistoryChart(
  entries: SnapshotMapEntry[],
): ChartConfiguration {
  // Group by date, show play count trends for top maps
  const dateMap = new Map<string, Map<string, number>>();
  const mapTotals = new Map<string, number>();

  for (const e of entries) {
    const dateKey = new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
    dateMap.get(dateKey)!.set(e.mapName, (dateMap.get(dateKey)!.get(e.mapName) ?? 0) + e.playCount);
    mapTotals.set(e.mapName, (mapTotals.get(e.mapName) ?? 0) + e.playCount);
  }

  const dates = [...dateMap.keys()];
  // Show top 10 maps by total play count
  const topMaps = [...mapTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name]) => name);

  // Convert to percentage of total plays per date
  const datasets = topMaps.map((mapName, idx) => ({
    label: resolveMapName(mapName),
    data: dates.map((date) => {
      const dayData = dateMap.get(date);
      if (!dayData) return 0;
      const total = [...dayData.values()].reduce((s, v) => s + v, 0);
      const mapCount = dayData.get(mapName) ?? 0;
      return total > 0 ? Math.round((mapCount / total) * 100) : 0;
    }),
    borderColor: CHART_COLORS[idx % CHART_COLORS.length],
    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
    fill: false,
    tension: 0.3,
    pointRadius: 2,
  }));

  return {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyleWidth: 8 } },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(51,51,51,0.2)' },
          title: { display: true, text: 'Play Rate %', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
        },
      },
    },
  } as ChartConfiguration;
}

/* ─── Crawler-derived chart builders ────────────────────── */

function buildSpecPopularityChart(
  entries: SnapshotSpecEntry[],
): ChartConfiguration {
  const dateMap = new Map<string, Map<string, number>>();
  for (const e of entries) {
    const dateKey = new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
    dateMap.get(dateKey)!.set(e.specName, (dateMap.get(dateKey)!.get(e.specName) ?? 0) + e.pickCount);
  }

  const dates = [...dateMap.keys()];
  const specNames = new Set<string>();
  for (const specs of dateMap.values()) {
    for (const name of specs.keys()) specNames.add(name);
  }

  // Filter out hidden specs and resolve display names
  const filteredSpecs = [...specNames].filter((name) => resolveSpecName(name) !== null);

  const datasets = filteredSpecs.map((spec, idx) => ({
    label: resolveSpecName(spec) ?? spec,
    data: dates.map((date) => {
      const dayData = dateMap.get(date);
      if (!dayData) return 0;
      const total = [...dayData.values()].reduce((s, v) => s + v, 0);
      const count = dayData.get(spec) ?? 0;
      return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    }),
    borderColor: CHART_COLORS[idx % CHART_COLORS.length],
    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
    fill: false,
    tension: 0.3,
    pointRadius: 2,
  }));

  return {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyleWidth: 8 } },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(51,51,51,0.2)' },
          title: { display: true, text: 'Pick Rate %', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
        },
      },
    },
  } as ChartConfiguration;
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

/* ─── Unit performance table with filters ────────────────── */

const UnitPerformanceSection = component$<{
  entries: UnitPerformanceEntry[];
}>(({ entries }) => {
  const i18n = useI18n();
  const selectedFaction = useSignal('');
  const selectedElo = useSignal('');

  const factionNames = [...new Set(entries.map((e) => e.factionName))].filter(n => n !== 'Unknown').sort();
  const eloBrackets = [...new Set(entries.map((e) => e.eloBracket))].sort((a, b) => {
    const aNum = parseInt(a) || 0;
    const bNum = parseInt(b) || 0;
    return aNum - bNum;
  });

  const filtered = entries.filter((e) => {
    if (selectedFaction.value && e.factionName !== selectedFaction.value) return false;
    if (selectedElo.value && e.eloBracket !== selectedElo.value) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.deployCount - a.deployCount);

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
          {eloBrackets.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
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
              <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.elo')}</th>
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
                  key={`${u.configKey}-${u.eloBracket}-${idx}`}
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
                  <td class="py-1.5 px-2 text-[var(--text-dim)] font-mono text-[10px]">{u.eloBracket}</td>
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
    </Panel>
  );
});

/* ─── Main component ─────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();
  const overview = useStatsOverview();

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

  // ── Derived chart configs ──
  const mapChartConfig = buildMapChart(overview.value.analyticsMapRatings);
  const specChartConfig = buildSpecChart(overview.value.analyticsSpecUsage);
  const factionWinRateConfig = buildFactionWinRateChart(overview.value.analyticsCountryStats);
  const mapTeamSidesConfig = buildMapTeamSidesChart(
    overview.value.analyticsMapTeamSides.data,
  );

  const leaderboard = overview.value.analyticsLeaderboard;
  const lbExpanded = useSignal(false);

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
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, lbExpanded.value ? leaderboard.length : 10).map((e) => (
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
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={4} class="py-4 text-center text-[var(--text-dim)] text-xs">
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
              {lbExpanded.value ? '▲ Show Top 10' : `▼ Show Top ${leaderboard.length}`}
            </button>
          )}
        </Panel>
      </div>

      {/* ═══ Section 2: Maps ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.maps.title')}
        </p>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Panel title={t(i18n, 'stats.overview.mapPlayFrequency')}>
            <ChartCanvas config={mapChartConfig} height={380} />
          </Panel>
          <Panel title={t(i18n, 'stats.mapAnalytics.factionBreakdown')}>
            <ChartCanvas config={mapTeamSidesConfig} height={380} />
          </Panel>
        </div>
      </div>

      {/* ═══ Section 3: Specializations & Faction Win Rates ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.country.title')}
        </p>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
          <Panel title={t(i18n, 'stats.overview.specUsage')}>
            <ChartCanvas config={specChartConfig} height={320} />
          </Panel>
          <Panel title={t(i18n, 'stats.overview.factionWinRates')}>
            <ChartCanvas config={factionWinRateConfig} height={320} />
          </Panel>
        </div>
      </div>

      {/* ═══ Section 4: Game History (from periodic snapshots) ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.history.title')}
        </p>
        <p class="text-xs text-[var(--text-dim)] mb-3">
          {t(i18n, 'stats.history.subtitle')}
        </p>
        {overview.value.factionHistory.length > 0 || overview.value.mapHistory.length > 0 ? (
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {overview.value.factionHistory.length > 0 && (
              <Panel title={t(i18n, 'stats.overview.factionWinRates') + ' — ' + t(i18n, 'stats.history.timeRange.month')}>
                <ChartCanvas config={buildFactionHistoryChart(overview.value.factionHistory)} height={300} crosshair />
              </Panel>
            )}
            {overview.value.mapHistory.length > 0 && (
              <Panel title={t(i18n, 'stats.overview.mapPlayFrequency') + ' — ' + t(i18n, 'stats.history.timeRange.month')}>
                <ChartCanvas config={buildMapHistoryChart(overview.value.mapHistory)} height={300} crosshair />
              </Panel>
            )}
          </div>
        ) : (
          <Panel title={t(i18n, 'stats.history.title')}>
            <div class="py-6 text-center">
              <p class="text-xs text-[var(--text-dim)]">
                {t(i18n, 'stats.history.comingSoon')}
              </p>
            </div>
          </Panel>
        )}
      </div>

      {/* ═══ Section 5: Top Performing Units (from crawler match data) ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.topUnits.title')}
        </p>
        <p class="text-xs text-[var(--text-dim)] mb-3">
          {t(i18n, 'stats.topUnits.subtitle')}
        </p>
        {overview.value.unitPerformance.length > 0 ? (
          <Panel title={t(i18n, 'stats.topUnits.title')}>
            <div class="max-h-[500px] overflow-y-auto">
              <table class="w-full text-xs border-collapse">
                <thead class="sticky top-0 bg-[var(--bg)] z-10">
                  <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                    <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.unit')}</th>
                    <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.options')}</th>
                    <th class="text-left py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.unitTable.faction')}</th>
                    <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.deployed')}</th>
                    <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.avgKills')}</th>
                    <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.topUnits.avgDamage')}</th>
                    <th class="text-right py-1.5 px-2 border-b border-[rgba(51,51,51,0.3)]">{t(i18n, 'stats.match.damageDealt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...overview.value.unitPerformance]
                    .sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)
                    .slice(0, 50)
                    .map((u, idx) => {
                      const opts = resolveUnitOptionNames(u.optionNames ?? [], i18n.locale);
                      return (
                        <tr
                          key={`top-${u.configKey}-${idx}`}
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
          </Panel>
        ) : (
          <Panel title={t(i18n, 'stats.topUnits.title')}>
            <div class="py-6 text-center">
              <p class="text-xs text-[var(--text-dim)]">
                {t(i18n, 'stats.topUnits.comingSoon')}
              </p>
            </div>
          </Panel>
        )}
      </div>

      {/* ═══ Section 6: Crawler-Derived Stats (from ranked match data) ═══ */}
      <p class="text-[8px] text-[var(--text-dim)] italic mb-4">
        {t(i18n, 'stats.crawler.disclaimer')}
      </p>

      {/* Spec Popularity (Ranked) */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.specPopularity.title')}
        </p>
        <p class="text-xs text-[var(--text-dim)] mb-3">
          {t(i18n, 'stats.specPopularity.subtitle')}
        </p>
        {overview.value.specHistory.length > 0 ? (
          <Panel title={t(i18n, 'stats.specPopularity.title')}>
            <ChartCanvas config={buildSpecPopularityChart(overview.value.specHistory)} height={300} crosshair />
          </Panel>
        ) : (
          <Panel title={t(i18n, 'stats.specPopularity.title')}>
            <div class="py-6 text-center">
              <p class="text-xs text-[var(--text-dim)]">
                {t(i18n, 'stats.specPopularity.comingSoon')}
              </p>
            </div>
          </Panel>
        )}
      </div>

      {/* Unit Popularity */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.unitPopularity.title')}
        </p>
        <p class="text-xs text-[var(--text-dim)] mb-3">
          {t(i18n, 'stats.unitPopularity.subtitle')}
        </p>
        {overview.value.unitPerformance.length > 0 ? (
          <UnitPerformanceSection entries={overview.value.unitPerformance} />
        ) : (
          <Panel title={t(i18n, 'stats.unitPopularity.title')}>
            <div class="py-6 text-center">
              <p class="text-xs text-[var(--text-dim)]">
                {t(i18n, 'stats.unitPopularity.comingSoon')}
              </p>
            </div>
          </Panel>
        )}
      </div>

      {/* Footer timestamp */}
      <p class="text-[10px] text-[var(--text-dim)]">
        {t(i18n, 'stats.maps.lastUpdated')}:{' '}
        {overview.value.analyticsMapTeamSides.updateDate ??
          t(i18n, 'stats.unknown')}
      </p>
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
