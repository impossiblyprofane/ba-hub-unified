import { $, component$, useSignal, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import type {
  StatsOverviewData,
  AnalyticsCountryStats,
  AnalyticsUserInfo,
  SnapshotFactionEntry,
  SnapshotMapEntry,
  SnapshotUnitRankings,
} from '~/lib/graphql-types';
import {
  STATS_OVERVIEW_QUERY,
  STATS_USER_LOOKUP_QUERY,
  SNAPSHOT_FACTION_HISTORY_QUERY,
  SNAPSHOT_MAP_HISTORY_QUERY,
  SNAPSHOT_UNIT_RANKINGS_QUERY,
} from '~/lib/queries/stats';
import { ChartCanvas } from '~/components/stats/ChartCanvas';
import type { ChartConfiguration } from 'chart.js';

/* ─── Route loader: SSR overview + full 100 leaderboard ───── */

type OverviewPayload = StatsOverviewData & {
  analyticsCountryStats: AnalyticsCountryStats;
};

export const useStatsOverview = routeLoader$(async () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

  // Fetch main overview + snapshot data in parallel
  const [overviewRes, factionHistoryRes, mapHistoryRes, unitRankingsRes] = await Promise.all([
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
        variables: { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      }),
    }).catch(() => null),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: SNAPSHOT_MAP_HISTORY_QUERY,
        variables: { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      }),
    }).catch(() => null),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: SNAPSHOT_UNIT_RANKINGS_QUERY,
        variables: { limit: 50 },
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
  let unitRankings: SnapshotUnitRankings = { snapshotDate: null, units: [] };

  if (factionHistoryRes?.ok) {
    const d = (await factionHistoryRes.json()) as { data?: { snapshotFactionHistory: SnapshotFactionEntry[] } };
    factionHistory = d.data?.snapshotFactionHistory ?? [];
  }
  if (mapHistoryRes?.ok) {
    const d = (await mapHistoryRes.json()) as { data?: { snapshotMapHistory: SnapshotMapEntry[] } };
    mapHistory = d.data?.snapshotMapHistory ?? [];
  }
  if (unitRankingsRes?.ok) {
    const d = (await unitRankingsRes.json()) as { data?: { snapshotUnitRankings: SnapshotUnitRankings } };
    unitRankings = d.data?.snapshotUnitRankings ?? { snapshotDate: null, units: [] };
  }

  return {
    ...overviewPayload.data,
    factionHistory,
    mapHistory,
    unitRankings,
  };
});

/* ─── Chart config builders ──────────────────────────────── */

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
  const sorted = [...items]
    .filter((i) => i.name && i.count)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 15);

  return {
    type: 'bar',
    data: {
      labels: sorted.map((i) => i.name!),
      datasets: [
        {
          data: sorted.map((i) => i.count!),
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
        x: { grid: { color: 'rgba(51,51,51,0.2)' } },
        y: { grid: { display: false } },
      },
    },
  };
}

function buildSpecChart(
  items: { name: string | null; count: number | null }[],
): ChartConfiguration {
  const sorted = [...items]
    .filter((i) => i.name && i.count)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return {
    type: 'bar',
    data: {
      labels: sorted.map((i) => i.name!),
      datasets: [
        {
          data: sorted.map((i) => i.count!),
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

function buildCountryChart(
  stats: AnalyticsCountryStats,
): ChartConfiguration {
  const matches = stats.matchesCount.filter((i) => i.name && i.count);
  return {
    type: 'doughnut',
    data: {
      labels: matches.map((i) => i.name!),
      datasets: [
        {
          data: matches.map((i) => i.count!),
          backgroundColor: matches.map(
            (_, idx) => CHART_COLORS[idx % CHART_COLORS.length],
          ),
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

function buildFactionWinChart(
  stats: AnalyticsCountryStats,
): ChartConfiguration {
  const wins = stats.winsCount.filter((i) => i.name && i.count);
  return {
    type: 'bar',
    data: {
      labels: wins.map((i) => i.name!),
      datasets: [
        {
          data: wins.map((i) => i.count!),
          backgroundColor: wins.map(
            (_, idx) => CHART_COLORS[idx % CHART_COLORS.length],
          ),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(51,51,51,0.2)' } },
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
    label: faction,
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
      labels: maps.map((m) => m.map!),
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
  // Group by date, then show win rate per faction over time
  const dateMap = new Map<string, Map<string, { matchCount: number; winCount: number }>>();
  for (const e of entries) {
    const dateKey = new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
    const factions = dateMap.get(dateKey)!;
    const existing = factions.get(e.factionName) ?? { matchCount: 0, winCount: 0 };
    existing.matchCount += e.matchCount;
    existing.winCount += e.winCount;
    factions.set(e.factionName, existing);
  }

  const dates = [...dateMap.keys()];
  const factionNames = new Set<string>();
  for (const factions of dateMap.values()) {
    for (const name of factions.keys()) factionNames.add(name);
  }

  const datasets = [...factionNames].map((faction, idx) => ({
    label: faction,
    data: dates.map((date) => {
      const f = dateMap.get(date)?.get(faction);
      if (!f || f.matchCount === 0) return null;
      return Math.round((f.winCount / f.matchCount) * 100);
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
          title: { display: true, text: 'Win Rate %', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
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
  // Show top 6 maps by total play count
  const topMaps = [...mapTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name]) => name);

  const datasets = topMaps.map((mapName, idx) => ({
    label: mapName,
    data: dates.map((date) => dateMap.get(date)?.get(mapName) ?? 0),
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
          title: { display: true, text: 'Play Count', color: 'rgba(192,192,192,0.5)', font: { size: 9 } },
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
  const countryChartConfig = buildCountryChart(
    overview.value.analyticsCountryStats,
  );
  const factionWinConfig = buildFactionWinChart(
    overview.value.analyticsCountryStats,
  );
  const mapTeamSidesConfig = buildMapTeamSidesChart(
    overview.value.analyticsMapTeamSides.data,
  );

  const leaderboard = overview.value.analyticsLeaderboard;

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

      {/* ═══ Section 1: Leaderboard (full 100, scrollable) ═══ */}
      <div class="mb-6">
        <Panel title={t(i18n, 'stats.tab.leaderboard')}>
          <div class="max-h-[600px] overflow-y-auto">
            <table class="w-full text-xs border-collapse">
              <thead class="sticky top-0 bg-[var(--bg)] z-10">
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
                {leaderboard.map((e) => (
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

      {/* ═══ Section 3: Specializations & Factions ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.country.title')}
        </p>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
          <Panel title={t(i18n, 'stats.overview.specUsage')}>
            <ChartCanvas config={specChartConfig} height={320} />
          </Panel>
          <Panel title={t(i18n, 'stats.overview.factionMatchups')}>
            <ChartCanvas config={countryChartConfig} height={320} />
          </Panel>
        </div>
        <Panel title={t(i18n, 'stats.overview.factionWinRates')}>
          <ChartCanvas config={factionWinConfig} height={280} />
        </Panel>
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
                <ChartCanvas config={buildFactionHistoryChart(overview.value.factionHistory)} height={300} />
              </Panel>
            )}
            {overview.value.mapHistory.length > 0 && (
              <Panel title={t(i18n, 'stats.overview.mapPlayFrequency') + ' — ' + t(i18n, 'stats.history.timeRange.month')}>
                <ChartCanvas config={buildMapHistoryChart(overview.value.mapHistory)} height={300} />
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

      {/* ═══ Section 5: Top Performing Units (from snapshots) ═══ */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'stats.topUnits.title')}
        </p>
        <p class="text-xs text-[var(--text-dim)] mb-3">
          {t(i18n, 'stats.topUnits.subtitle')}
        </p>
        {overview.value.unitRankings.units.length > 0 ? (
          <Panel title={`${t(i18n, 'stats.topUnits.title')} (${overview.value.unitRankings.units.length})`}>
            <div class="max-h-[500px] overflow-y-auto">
              <table class="w-full text-xs border-collapse">
                <thead class="sticky top-0 bg-[var(--bg)] z-10">
                  <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                    <th class="text-left py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                      {t(i18n, 'stats.match.unitName')}
                    </th>
                    <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                      {t(i18n, 'stats.topUnits.deployed')}
                    </th>
                    <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                      {t(i18n, 'stats.topUnits.avgKills')}
                    </th>
                    <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                      {t(i18n, 'stats.topUnits.avgDamage')}
                    </th>
                    <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                      {t(i18n, 'stats.match.kills')}
                    </th>
                    <th class="text-right py-1.5 px-1 border-b border-[rgba(51,51,51,0.3)]">
                      {t(i18n, 'stats.match.damageDealt')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.value.unitRankings.units.map((u, idx) => (
                    <tr
                      key={`unit-${u.unitName}-${idx}`}
                      class="border-b border-[rgba(51,51,51,0.15)] hover:bg-[rgba(70,151,195,0.05)]"
                    >
                      <td class="py-1.5 px-1 text-[var(--text)]">{u.unitName}</td>
                      <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">{u.timesDeployed}</td>
                      <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">{u.avgKills.toFixed(1)}</td>
                      <td class="py-1.5 px-1 text-[var(--text)] font-mono text-right">{u.avgDamage.toFixed(0)}</td>
                      <td class="py-1.5 px-1 text-[var(--text-dim)] font-mono text-right">{u.totalKills}</td>
                      <td class="py-1.5 px-1 text-[var(--text-dim)] font-mono text-right">{u.totalDamageDealt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {overview.value.unitRankings.snapshotDate && (
              <p class="text-[8px] text-[var(--text-dim)] mt-2">
                {t(i18n, 'stats.maps.lastUpdated')}: {new Date(overview.value.unitRankings.snapshotDate).toLocaleDateString()}
              </p>
            )}
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
  title: 'Statistics - BA Hub',
  meta: [
    {
      name: 'description',
      content:
        'View player leaderboards, map analytics, specialization usage, and performance statistics for Broken Arrow.',
    },
  ],
};
