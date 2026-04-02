import { component$, useSignal, useStore, Slot } from '@builder.io/qwik';
import { routeLoader$, useLocation } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t, GAME_LOCALES, getGameLocaleValueOrKey } from '~/lib/i18n';
import type {
  AnalyticsUserProfile,
  AnalyticsRecentFight,
  AnalyticsRecentFightsResult,
  FrequentPlayer,
  UnitPerformance,
  FactionCount,
} from '~/lib/graphql-types';
import {
  STATS_USER_PROFILE_QUERY,
  STATS_RECENT_FIGHTS_QUERY,
} from '~/lib/queries/stats';
import { ChartCanvas } from '~/components/stats/ChartCanvas';
import type { ChartConfiguration } from 'chart.js';

/* ─── Route loader: SSR profile data ─────────────────────── */

export const usePlayerProfile = routeLoader$(async (requestEvent) => {
  const steamId = requestEvent.params.steamId;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

  const [profileRes, fightsRes] = await Promise.all([
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: STATS_USER_PROFILE_QUERY,
        variables: { steamId },
      }),
    }),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: STATS_RECENT_FIGHTS_QUERY,
        variables: { steamId },
      }),
    }),
  ]);

  const profilePayload = (await profileRes.json()) as {
    data?: { analyticsUserProfile: AnalyticsUserProfile | null };
  };
  const fightsPayload = (await fightsRes.json()) as {
    data?: { analyticsRecentFights: AnalyticsRecentFightsResult };
  };

  const fightsResult = fightsPayload.data?.analyticsRecentFights ?? {
    fights: [],
    frequentTeammates: [],
    frequentOpponents: [],
    mostUsedUnits: [],
    topKillerUnits: [],
    topDamageUnits: [],
    factionBreakdown: [],
    specUsage: [],
    specCombos: [],
  };

  return {
    profile: profilePayload.data?.analyticsUserProfile ?? null,
    recentFights: fightsResult.fights,
    frequentTeammates: fightsResult.frequentTeammates,
    frequentOpponents: fightsResult.frequentOpponents,
    mostUsedUnits: fightsResult.mostUsedUnits ?? [],
    topKillerUnits: fightsResult.topKillerUnits ?? [],
    topDamageUnits: fightsResult.topDamageUnits ?? [],
    factionBreakdown: fightsResult.factionBreakdown ?? [],
    specUsage: fightsResult.specUsage ?? [],
    specCombos: fightsResult.specCombos ?? [],
  };
});

/* ─── Chart builders ──────────────────────────────────────── */

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

/** Resolve raw option UIName through the game locale system */
function resolveOptionNames(rawNames: string[], locale: string): string[] {
  return rawNames
    .map((n) => {
      const resolved = getGameLocaleValueOrKey(GAME_LOCALES.modopts, n, locale as any);
      if (resolved && resolved !== n) return resolved;
      return n.replace(/^(?:dlc_\d+_)?Custom_Option_/i, '').replace(/_/g, ' ');
    })
    .filter((n) => n !== 'None' && n !== 'Default' && n !== 'Empty');
}

function buildMapPlayChart(
  maps: { name: string | null; count: number | null }[],
): ChartConfiguration {
  const sorted = [...maps]
    .filter((m) => m.name && m.count)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 12);

  return {
    type: 'bar',
    data: {
      labels: sorted.map((m) => m.name!),
      datasets: [
        {
          data: sorted.map((m) => m.count!),
          backgroundColor: sorted.map(
            (_, i) => CHART_COLORS[i % CHART_COLORS.length],
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
        x: { grid: { color: 'rgba(51,51,51,0.2)' } },
        y: { grid: { display: false } },
      },
    },
  };
}

function buildWinLossChart(
  wins: number,
  losses: number,
): ChartConfiguration<'doughnut'> {
  return {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses'],
      datasets: [
        {
          data: [wins, losses],
          backgroundColor: ['rgba(70, 195, 130, 0.7)', 'rgba(195, 70, 70, 0.7)'],
          borderColor: 'rgba(26,26,26,0.8)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyleWidth: 8, padding: 12 },
        },
      },
    },
  };
}

/**
 * Build multi-dataset ELO progression chart.
 * Supports toggling K/D and Damage overlays on a secondary Y axis.
 */
function buildFactionChart(
  factions: FactionCount[],
): ChartConfiguration<'doughnut'> {
  const FACTION_COLORS: Record<string, string> = {
    USA: 'rgba(70, 151, 195, 0.8)',
    Russia: 'rgba(195, 70, 70, 0.8)',
    EU: 'rgba(70, 195, 130, 0.8)',
  };
  const fallbackColors = [
    'rgba(195, 170, 70, 0.8)',
    'rgba(150, 70, 195, 0.8)',
    'rgba(195, 120, 70, 0.8)',
  ];
  return {
    type: 'doughnut',
    data: {
      labels: factions.map((f) => f.name),
      datasets: [
        {
          data: factions.map((f) => f.count),
          backgroundColor: factions.map(
            (f, i) => FACTION_COLORS[f.name] ?? fallbackColors[i % fallbackColors.length],
          ),
          borderColor: 'rgba(26,26,26,0.8)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyleWidth: 8, padding: 12 },
        },
      },
    },
  };
}

function buildEloProgressionChart(
  fights: AnalyticsRecentFight[],
  currentRating: number | null,
  showKD: boolean,
  showDamage: boolean,
  showMatchup: boolean,
): ChartConfiguration<'line'> {
  // Only ranked fights for all chart data
  const ranked = [...fights]
    .filter((f) => f.ratingChange != null && f.ratingChange !== 0)
    .reverse(); // chronological

  if (ranked.length === 0 || currentRating == null) {
    return {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: { responsive: true },
    };
  }

  // Walk backwards from current rating to reconstruct historical values
  let rating = currentRating;
  const ratingPoints: number[] = [rating];
  const labels: string[] = ['Now'];
  const kdPoints: (number | null)[] = [null];
  const dmgPoints: (number | null)[] = [null];
  const allyAvgPoints: (number | null)[] = [null];
  const enemyAvgPoints: (number | null)[] = [null];

  for (let i = ranked.length - 1; i >= 0; i--) {
    rating -= ranked[i].ratingChange!;
    ratingPoints.unshift(Math.round(rating));
    const ts = ranked[i].endTime;
    if (ts) {
      const d = new Date(ts * 1000);
      labels.unshift(`${d.getMonth() + 1}/${d.getDate()}`);
    } else {
      labels.unshift('');
    }
    const dest = ranked[i].destruction;
    const loss = ranked[i].losses;
    kdPoints.unshift(
      dest != null && loss != null && loss > 0
        ? Math.round((dest / loss) * 100) / 100
        : null,
    );
    dmgPoints.unshift(ranked[i].damageDealt ?? null);
    allyAvgPoints.unshift(ranked[i].allyAvgRating ?? null);
    enemyAvgPoints.unshift(ranked[i].enemyAvgRating ?? null);
  }

  // ELO is always shown
  const datasets: any[] = [
    {
      label: 'ELO',
      data: ratingPoints,
      borderColor: 'rgba(70, 151, 195, 0.9)',
      backgroundColor: 'rgba(70, 151, 195, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.3,
      yAxisID: 'y',
    },
  ];

  if (showMatchup) {
    datasets.push(
      {
        label: 'Team Avg',
        data: allyAvgPoints,
        borderColor: 'rgba(70, 195, 130, 0.7)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.3,
        yAxisID: 'y',
        spanGaps: true,
      },
      {
        label: 'Enemy Avg',
        data: enemyAvgPoints,
        borderColor: 'rgba(195, 70, 70, 0.7)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.3,
        yAxisID: 'y',
        spanGaps: true,
      },
    );
  }

  if (showKD) {
    datasets.push({
      label: 'D/L',
      data: kdPoints,
      borderColor: 'rgba(195, 170, 70, 0.8)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      borderDash: [4, 2],
      tension: 0.3,
      yAxisID: 'y1',
      spanGaps: true,
    });
  }

  if (showDamage) {
    datasets.push({
      label: 'Damage',
      data: dmgPoints,
      borderColor: 'rgba(180, 130, 255, 0.8)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      borderDash: [2, 2],
      tension: 0.3,
      yAxisID: 'y2',
      spanGaps: true,
    });
  }

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(51,51,51,0.15)' },
          ticks: { maxTicksLimit: 10, font: { size: 9 } },
        },
        y: {
          grid: { color: 'rgba(51,51,51,0.15)' },
          ticks: { font: { size: 9 } },
          position: 'left',
        },
        y1: {
          display: showKD,
          grid: { display: false },
          ticks: { display: false },
          position: 'right',
        },
        y2: {
          display: showDamage,
          grid: { display: false },
          ticks: { display: false },
          position: 'right',
        },
      },
    },
  };
}

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

/* ─── Panel wrapper ──────────────────────────────────────── */

const Panel = component$<{ title: string; fill?: boolean }>(({ title, fill }) => {
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
});

/* ─── Stat card (enhanced) ───────────────────────────────── */

const StatCard = component$<{
  label: string;
  value: string | number;
  accent?: 'green' | 'red' | 'blue' | 'default';
  subtitle?: string;
}>(({ label, value, accent, subtitle }) => {
  const accentColors: Record<string, string> = {
    green: 'text-[var(--green)]',
    red: 'text-[var(--red)]',
    blue: 'text-[var(--accent)]',
    default: 'text-[var(--text)]',
  };
  const borderColors: Record<string, string> = {
    green: 'border-t-[var(--green)]',
    red: 'border-t-[var(--red)]',
    blue: 'border-t-[var(--accent)]',
    default: 'border-t-transparent',
  };
  const color = accentColors[accent ?? 'default'];
  const border = borderColors[accent ?? 'default'];

  return (
    <div class={`bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)] border-t-2 ${border} p-2`}>
      <p class="text-[8px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)]">
        {label}
      </p>
      <p class={`text-lg font-mono mt-0.5 ${color}`}>{value}</p>
      {subtitle && (
        <p class="text-[9px] font-mono text-[var(--text-dim)] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
});

/* ─── Stat row helper ────────────────────────────────────── */

const StatRow = component$<{
  label: string;
  value: string | number;
  accent?: 'green' | 'red';
}>(({ label, value, accent }) => {
  const color = accent === 'green'
    ? 'text-[var(--green)]'
    : accent === 'red'
      ? 'text-[var(--red)]'
      : 'text-[var(--text)]';
  return (
    <div class="flex justify-between items-baseline py-0.5">
      <span class="text-[var(--text-dim)] text-xs">{label}</span>
      <span class={`font-mono text-xs ${color}`}>{value}</span>
    </div>
  );
});

/* ─── Recent form dots (ranked only) ─────────────────────── */

const RecentFormDots = component$<{ fights: AnalyticsRecentFight[] }>((props) => {
  // Only show ranked matches (those with ELO change)
  const ranked = props.fights.filter((f) => f.ratingChange != null && f.ratingChange !== 0);
  const recent = ranked.slice(0, 10);
  if (recent.length === 0) return null;

  return (
    <div class="flex gap-0.5 items-center">
      {recent.map((f, i) => {
        const isWin = f.result === 'win';
        const isLoss = f.result === 'loss';
        const bg = isWin
          ? 'bg-[var(--green)]'
          : isLoss
            ? 'bg-[var(--red)]'
            : 'bg-[rgba(51,51,51,0.5)]';
        const label = isWin ? 'W' : isLoss ? 'L' : '-';
        const elo = f.ratingChange != null ? `${f.ratingChange >= 0 ? '+' : ''}${f.ratingChange.toFixed(0)}` : '';
        return (
          <div
            key={`form-${i}`}
            class={`w-4 h-4 ${bg} flex items-center justify-center`}
            title={`${f.mapName ?? 'Unknown'} — ${label} ${elo}`}
          >
            <span class="text-[7px] font-mono font-bold text-white opacity-80">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/* ─── Frequent players list ──────────────────────────────── */

const FrequentPlayersList = component$<{
  players: FrequentPlayer[];
  title: string;
}>(({ players, title }) => {
  if (players.length === 0) return null;
  return (
    <Panel title={title} fill>
      <div class="flex flex-col gap-0.5">
        {players.slice(0, 5).map((p, i) => (
          <div
            key={`fp-${i}`}
            class="flex items-center justify-between py-1 border-b border-[rgba(51,51,51,0.1)] last:border-0"
          >
            {p.steamId ? (
              <a
                href={`/stats/player/${p.steamId}/`}
                class="text-xs text-[var(--accent)] hover:underline truncate max-w-[160px]"
              >
                {p.name ?? 'Unknown'}
              </a>
            ) : (
              <span class="text-xs text-[var(--text)] truncate max-w-[160px]">
                {p.name ?? 'Unknown'}
              </span>
            )}
            <div class="flex gap-2 text-[10px] font-mono">
              <span class="text-[var(--text-dim)]">×{p.count}</span>
              <span class="text-[var(--green)]">{p.wins}W</span>
              <span class="text-[var(--red)]">{p.losses}L</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
});

/* ─── Unit performance table ─────────────────────────────── */

const UnitRankingPanel = component$<{
  units: UnitPerformance[];
  title: string;
  category: 'count' | 'kills' | 'damage';
  totalGames?: number;
}>(({ units, title, category, totalGames }) => {
  if (units.length === 0) return null;
  const i18n = useI18n();
  // Toggleable sort mode for kills/damage panels
  const sortMode = useSignal<'total' | 'avg'>('total');

  // Re-sort based on current mode
  const sorted = [...units];
  if (category === 'kills') {
    sorted.sort((a, b) =>
      sortMode.value === 'avg' ? b.avgKills - a.avgKills : b.totalKills - a.totalKills,
    );
  } else if (category === 'damage') {
    sorted.sort((a, b) =>
      sortMode.value === 'avg' ? b.avgDamage - a.avgDamage : b.totalDamageDealt - a.totalDamageDealt,
    );
  }

  const showToggle = category === 'kills' || category === 'damage';

  return (
    <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] h-full flex flex-col">
      <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px]">
          {title}
        </p>
        {showToggle && (
          <div class="flex gap-1">
            <button
              class={[
                'px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider border transition-colors',
                sortMode.value === 'total'
                  ? 'text-[var(--accent)] border-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                  : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => { sortMode.value = 'total'; }}
            >
              Total
            </button>
            <button
              class={[
                'px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider border transition-colors',
                sortMode.value === 'avg'
                  ? 'text-[var(--accent)] border-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                  : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => { sortMode.value = 'avg'; }}
            >
              Avg/G
            </button>
          </div>
        )}
      </div>
      <div class="flex-1 p-3">
        <div class="flex flex-col gap-0">
          {sorted.slice(0, 5).map((u, i) => {
            const resolvedOpts = resolveOptionNames(u.optionNames, i18n.locale);
            const configLabel = resolvedOpts.length > 0
              ? resolvedOpts.join(' + ')
              : null;
            return (
              <div
                key={`u-${i}`}
                class="flex items-start justify-between py-1.5 border-b border-[rgba(51,51,51,0.1)] last:border-0 gap-2"
              >
                <div class="flex-1 min-w-0">
                  <a
                    href={`/arsenal/${u.unitId}`}
                    class="text-xs text-[var(--accent)] hover:underline truncate block"
                  >
                    {u.unitName ?? `Unit ${u.unitId}`}
                  </a>
                  {configLabel && (
                    <p class="text-[9px] text-[var(--text-dim)] truncate mt-0.5">
                      {configLabel}
                    </p>
                  )}
                </div>
                <div class="flex gap-3 text-[10px] font-mono shrink-0">
                  {category === 'count' && (() => {
                    const perGame = totalGames && totalGames > 0
                      ? (u.count / totalGames).toFixed(1)
                      : null;
                    return (
                      <div class="flex flex-col items-end gap-0.5">
                        <div class="flex gap-2 items-baseline">
                          <span class="text-[var(--text)]">×{u.count}</span>
                          {perGame != null && (
                            <span class="text-[var(--text-dim)] text-[9px]">
                              {perGame}/g
                            </span>
                          )}
                        </div>
                        <div class="flex gap-2">
                          <span class="text-[var(--text-dim)]">{u.avgKills} k/g</span>
                          <span class="text-[var(--text-dim)]">{Math.round(u.avgDamage)} d/g</span>
                        </div>
                      </div>
                    );
                  })()}
                  {category === 'kills' && (
                    <>
                      <span class="text-[var(--green)]">
                        {sortMode.value === 'avg' ? u.avgKills : u.totalKills}
                        {sortMode.value === 'avg' ? '/g' : ''} {t(i18n, 'stats.match.kills').toLowerCase()}
                      </span>
                      <span class="text-[var(--text-dim)]">×{u.count}</span>
                    </>
                  )}
                  {category === 'damage' && (
                    <>
                      <span class="text-[var(--accent)]">
                        {sortMode.value === 'avg'
                          ? Math.round(u.avgDamage)
                          : u.totalDamageDealt.toLocaleString()}
                        {sortMode.value === 'avg' ? '/g' : ''} {t(i18n, 'stats.profile.dmgDealt').toLowerCase()}
                      </span>
                      <span class="text-[var(--text-dim)]">×{u.count}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ─── Main component ─────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();
  const loc = useLocation();
  const data = usePlayerProfile();
  const profile = data.value.profile;
  const fights = data.value.recentFights;
  const frequentTeammates = data.value.frequentTeammates;
  const frequentOpponents = data.value.frequentOpponents;
  const mostUsedUnits = data.value.mostUsedUnits;
  const topKillerUnits = data.value.topKillerUnits;
  const topDamageUnits = data.value.topDamageUnits;
  const factionBreakdown = data.value.factionBreakdown;
  const specUsage = data.value.specUsage;
  const specCombos = data.value.specCombos;
  const activeSection = useSignal<'overview' | 'matches'>('overview');

  // Chart overlay toggles
  const chartToggles = useStore({ showKD: false, showDamage: false, showMatchup: false });
  const showRankedOnly = useSignal(true);

  if (!profile) {
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
            {t(i18n, 'stats.profile.notFound')}
          </p>
        </div>
      </div>
    );
  }

  const user = profile.user;
  const stats = profile.stats;
  const winRate =
    stats && stats.winsCount && stats.fightsCount && stats.fightsCount > 0
      ? ((stats.winsCount / stats.fightsCount) * 100).toFixed(1)
      : null;

  // Derived stats
  const killsPerMatch =
    stats?.killsCount != null && stats?.fightsCount && stats.fightsCount > 0
      ? (stats.killsCount / stats.fightsCount).toFixed(1)
      : null;
  const deathsPerMatch =
    stats?.deathsCount != null && stats?.fightsCount && stats.fightsCount > 0
      ? (stats.deathsCount / stats.fightsCount).toFixed(1)
      : null;
  const avgMatchDuration =
    stats?.totalMatchTimeSec != null && stats?.fightsCount && stats.fightsCount > 0
      ? Math.round(stats.totalMatchTimeSec / stats.fightsCount)
      : null;
  const supplyPerMatch =
    stats?.supplyPointsConsumed != null && stats?.fightsCount && stats.fightsCount > 0
      ? Math.round(stats.supplyPointsConsumed / stats.fightsCount)
      : null;

  // Recent fight stats (from match history data)
  const rankedFights = fights.filter((f) => f.ratingChange != null && f.ratingChange !== 0);
  const recentWithResult = fights.filter((f) => f.result != null);
  const recentWins = recentWithResult.filter((f) => f.result === 'win').length;
  const recentWinRate =
    recentWithResult.length > 0
      ? ((recentWins / recentWithResult.length) * 100).toFixed(1)
      : null;
  const totalEloChange = fights.reduce(
    (sum, f) => sum + (f.ratingChange ?? 0),
    0,
  );

  // Most played map from recent fights
  const mapCounts = new Map<string, number>();
  for (const f of fights) {
    if (f.mapName) mapCounts.set(f.mapName, (mapCounts.get(f.mapName) ?? 0) + 1);
  }
  const topRecentMap = [...mapCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Back link */}
      <a
        href="/stats"
        class="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
      >
        ← {t(i18n, 'stats.player.backToStats')}
      </a>

      {/* Player header */}
      <div class="mb-4">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-2">
          {t(i18n, 'stats.profile.title')}
        </p>
        <div class="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
          <div>
            <h1 class="text-2xl font-semibold text-[var(--text)] tracking-tight">
              {user.name ?? `Player ${loc.params.steamId}`}
            </h1>
            <p class="text-xs text-[var(--text-dim)] font-mono mt-1">
              Steam ID: {user.steamId ?? loc.params.steamId}
            </p>
          </div>
          {/* Recent form dots (ranked only) */}
          {rankedFights.length > 0 && (
            <div class="flex flex-col gap-1">
              <p class="text-[8px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)]">
                {t(i18n, 'stats.profile.recentForm')}
              </p>
              <RecentFormDots fights={fights} />
            </div>
          )}
        </div>
      </div>

      {/* Section toggle */}
      <div class="flex gap-0 mb-4 border-b border-[rgba(51,51,51,0.3)]">
        <button
          class={[
            'px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] transition-colors',
            activeSection.value === 'overview'
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
              : 'text-[var(--text-dim)] hover:text-[var(--text)]',
          ].join(' ')}
          onClick$={() => {
            activeSection.value = 'overview';
          }}
        >
          {t(i18n, 'stats.player.overview')}
        </button>
        <button
          class={[
            'px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] transition-colors',
            activeSection.value === 'matches'
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
              : 'text-[var(--text-dim)] hover:text-[var(--text)]',
          ].join(' ')}
          onClick$={() => {
            activeSection.value = 'matches';
          }}
        >
          {t(i18n, 'stats.player.matchHistory')} ({fights.length})
        </button>
      </div>

      {/* ═══ Overview section ═══ */}
      {activeSection.value === 'overview' && (
        <div class="flex flex-col gap-3">
          {/* Top stat cards */}
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatCard
              label={t(i18n, 'stats.profile.elo')}
              value={user.rating ? Math.round(user.rating) : '-'}
              accent="blue"
              subtitle={
                totalEloChange !== 0
                  ? `${totalEloChange >= 0 ? '+' : ''}${totalEloChange.toFixed(0)} recent`
                  : undefined
              }
            />
            <StatCard
              label={t(i18n, 'stats.profile.rank')}
              value={user.rank ? `#${user.rank}` : '-'}
              accent={user.rank != null && user.rank <= 10 ? 'green' : 'default'}
            />
            <StatCard
              label={t(i18n, 'stats.playerLabel.level')}
              value={user.level ?? '-'}
            />
            <StatCard
              label={t(i18n, 'stats.profile.ratedGames')}
              value={user.ratedGames ?? '-'}
            />
            <StatCard
              label={t(i18n, 'stats.profile.kd')}
              value={stats?.kdRatio?.toFixed(2) ?? '-'}
              accent={
                stats?.kdRatio != null
                  ? stats.kdRatio >= 1.0 ? 'green' : 'red'
                  : 'default'
              }
            />
            <StatCard
              label={t(i18n, 'stats.profile.winRate')}
              value={winRate != null ? `${winRate}%` : '-'}
              accent={
                winRate != null
                  ? parseFloat(winRate) >= 50 ? 'green' : 'red'
                  : 'default'
              }
            />
          </div>

          {/* Row 2: ELO Progression chart + Win/Loss doughnut */}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* ELO Progression — spans 2 cols */}
            {rankedFights.length > 0 && (
              <div class="lg:col-span-2">
                <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
                  {/* Header with toggle buttons */}
                  <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
                    <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px]">
                      {t(i18n, 'stats.profile.eloProgression')}
                    </p>
                    <div class="flex gap-1">
                      <button
                        class={[
                          'px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border transition-colors',
                          chartToggles.showMatchup
                            ? 'text-[var(--green)] border-[var(--green)] bg-[rgba(70,195,130,0.1)]'
                            : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
                        ].join(' ')}
                        onClick$={() => {
                          chartToggles.showMatchup = !chartToggles.showMatchup;
                        }}
                      >
                        VS
                      </button>
                      <button
                        class={[
                          'px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border transition-colors',
                          chartToggles.showKD
                            ? 'text-[rgba(195,170,70,1)] border-[rgba(195,170,70,0.6)] bg-[rgba(195,170,70,0.1)]'
                            : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
                        ].join(' ')}
                        onClick$={() => {
                          chartToggles.showKD = !chartToggles.showKD;
                        }}
                      >
                        D/L
                      </button>
                      <button
                        class={[
                          'px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border transition-colors',
                          chartToggles.showDamage
                            ? 'text-[rgba(180,130,255,1)] border-[rgba(180,130,255,0.6)] bg-[rgba(180,130,255,0.1)]'
                            : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
                        ].join(' ')}
                        onClick$={() => {
                          chartToggles.showDamage = !chartToggles.showDamage;
                        }}
                      >
                        DMG
                      </button>
                    </div>
                  </div>
                  <div class="p-3" key={`elo-${chartToggles.showKD}-${chartToggles.showDamage}-${chartToggles.showMatchup}`}>
                    <ChartCanvas
                      config={buildEloProgressionChart(
                        fights,
                        user.rating,
                        chartToggles.showKD,
                        chartToggles.showDamage,
                        chartToggles.showMatchup,
                      )}
                      height={220}
                      crosshair
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Win/Loss doughnut */}
            {stats && stats.winsCount != null && stats.losesCount != null && (
              <Panel title={t(i18n, 'stats.profile.winRate')}>
                <ChartCanvas
                  config={buildWinLossChart(stats.winsCount ?? 0, stats.losesCount ?? 0)}
                  height={200}
                />
              </Panel>
            )}
          </div>

          {/* Row 3: Combat Stats + Per-Match Averages + Supply */}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Panel title={t(i18n, 'stats.profile.combatStats')} fill>
              <div class="flex flex-col gap-1">
                <StatRow label={t(i18n, 'stats.profile.totalMatches')} value={stats?.fightsCount ?? '-'} />
                <StatRow label={t(i18n, 'stats.profile.wins')} value={stats?.winsCount ?? '-'} accent="green" />
                <StatRow label={t(i18n, 'stats.profile.losses')} value={stats?.losesCount ?? '-'} accent="red" />
                <div class="border-t border-[rgba(51,51,51,0.2)] my-1" />
                <StatRow label={t(i18n, 'stats.profile.kills')} value={stats?.killsCount?.toLocaleString() ?? '-'} />
                <StatRow label={t(i18n, 'stats.profile.deaths')} value={stats?.deathsCount?.toLocaleString() ?? '-'} />
                <StatRow label={t(i18n, 'stats.profile.playtime')} value={formatPlaytime(stats?.totalMatchTimeSec ?? null)} />
                <StatRow label={t(i18n, 'stats.profile.zonesCaptured')} value={stats?.capturedZonesCount?.toLocaleString() ?? '-'} />
              </div>
            </Panel>

            <Panel title={t(i18n, 'stats.profile.recentPerformance')} fill>
              <div class="flex flex-col gap-1">
                <StatRow label={t(i18n, 'stats.profile.killsPerMatch')} value={killsPerMatch ?? '-'} />
                <StatRow label={t(i18n, 'stats.profile.deathsPerMatch')} value={deathsPerMatch ?? '-'} />
                <StatRow label={t(i18n, 'stats.profile.avgMatchDuration')} value={avgMatchDuration != null ? formatPlaytime(avgMatchDuration) : '-'} />
                <StatRow label={t(i18n, 'stats.profile.supplyPerMatch')} value={supplyPerMatch?.toLocaleString() ?? '-'} />
                <div class="border-t border-[rgba(51,51,51,0.2)] my-1" />
                {recentWinRate != null && winRate != null && (
                  <>
                    <div class="flex justify-between items-baseline py-0.5">
                      <span class="text-[var(--text-dim)] text-xs">
                        {t(i18n, 'stats.profile.recentWinRate')}
                      </span>
                      <span
                        class={`font-mono text-xs ${
                          parseFloat(recentWinRate) >= parseFloat(winRate)
                            ? 'text-[var(--green)]'
                            : 'text-[var(--red)]'
                        }`}
                      >
                        {recentWinRate}%
                      </span>
                    </div>
                    <div class="flex justify-between items-baseline py-0.5">
                      <span class="text-[var(--text-dim)] text-xs">
                        {t(i18n, 'stats.profile.lifetime')} {t(i18n, 'stats.profile.winRate').toLowerCase()}
                      </span>
                      <span class="font-mono text-xs text-[var(--text)]">{winRate}%</span>
                    </div>
                  </>
                )}
                {topRecentMap && (
                  <div class="flex justify-between items-baseline py-0.5">
                    <span class="text-[var(--text-dim)] text-xs">
                      {t(i18n, 'stats.player.matchMap')} ({t(i18n, 'stats.profile.recent').toLowerCase()})
                    </span>
                    <span class="font-mono text-xs text-[var(--text)]">
                      {topRecentMap[0]} <span class="text-[var(--text-dim)]">×{topRecentMap[1]}</span>
                    </span>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title={t(i18n, 'stats.profile.supplyStats')} fill>
              <div class="flex flex-col gap-1">
                <StatRow label={t(i18n, 'stats.profile.supplyConsumed')} value={stats?.supplyPointsConsumed?.toLocaleString() ?? '-'} />
                <StatRow label={t(i18n, 'stats.profile.supplyCaptured')} value={stats?.supplyCapturedCount?.toLocaleString() ?? '-'} accent="green" />
                <StatRow label={t(i18n, 'stats.profile.supplyLost')} value={stats?.supplyCapturedByEnemyCount?.toLocaleString() ?? '-'} accent="red" />
                {stats?.supplyCapturedCount != null &&
                  stats?.supplyCapturedByEnemyCount != null &&
                  stats.supplyCapturedByEnemyCount > 0 && (
                    <>
                      <div class="border-t border-[rgba(51,51,51,0.2)] my-1" />
                      <StatRow
                        label="Supply Net"
                        value={
                          (stats.supplyCapturedCount - stats.supplyCapturedByEnemyCount) >= 0
                            ? `+${(stats.supplyCapturedCount - stats.supplyCapturedByEnemyCount).toLocaleString()}`
                            : (stats.supplyCapturedCount - stats.supplyCapturedByEnemyCount).toLocaleString()
                        }
                        accent={stats.supplyCapturedCount >= stats.supplyCapturedByEnemyCount ? 'green' : 'red'}
                      />
                    </>
                  )}
              </div>
            </Panel>
          </div>

          {/* Row 4: Specs + Spec Combos + Faction */}
          {(factionBreakdown.length > 0 || specUsage.length > 0 || specCombos.length > 0) && (
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              {specUsage.length > 0 && (
                <Panel title={t(i18n, 'stats.profile.specUsage')} fill>
                  <div class="flex flex-col gap-0.5">
                    {specUsage.slice(0, 6).map((s, i) => (
                      <div
                        key={`sp-${i}`}
                        class="flex items-center justify-between py-1 border-b border-[rgba(51,51,51,0.1)] last:border-0"
                      >
                        <span class="text-xs text-[var(--text)]">{s.name}</span>
                        <span class="text-[10px] font-mono text-[var(--text-dim)]">×{s.count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
              {specCombos.length > 0 && (
                <Panel title={t(i18n, 'stats.profile.specCombos')} fill>
                  <div class="flex flex-col gap-0.5">
                    {specCombos.slice(0, 6).map((c, i) => (
                      <div
                        key={`sc-${i}`}
                        class="flex items-center justify-between py-1 border-b border-[rgba(51,51,51,0.1)] last:border-0"
                      >
                        <span class="text-xs text-[var(--text)]">
                          {c.names.join(' + ')}
                        </span>
                        <span class="text-[10px] font-mono text-[var(--text-dim)]">×{c.count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
              {factionBreakdown.length > 0 && (
                <Panel title={t(i18n, 'stats.profile.factionBreakdown')}>
                  <ChartCanvas
                    config={buildFactionChart(factionBreakdown)}
                    height={180}
                  />
                </Panel>
              )}
            </div>
          )}

          {/* Row 5: Frequent Teammates + Opponents */}
          {(frequentTeammates.length > 0 || frequentOpponents.length > 0) && (
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FrequentPlayersList
                players={frequentTeammates}
                title={t(i18n, 'stats.profile.frequentTeammates')}
              />
              <FrequentPlayersList
                players={frequentOpponents}
                title={t(i18n, 'stats.profile.frequentOpponents')}
              />
            </div>
          )}

          {/* Row 5: Unit Rankings */}
          {(mostUsedUnits.length > 0 || topKillerUnits.length > 0 || topDamageUnits.length > 0) && (
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <UnitRankingPanel
                units={mostUsedUnits}
                title={t(i18n, 'stats.profile.mostUsedUnits')}
                category="count"
                totalGames={rankedFights.length}
              />
              <UnitRankingPanel
                units={topKillerUnits}
                title={t(i18n, 'stats.profile.topKillers')}
                category="kills"
              />
              <UnitRankingPanel
                units={topDamageUnits}
                title={t(i18n, 'stats.profile.topDamage')}
                category="damage"
              />
            </div>
          )}

          {/* Map breakdown chart */}
          {stats && stats.mapsPlayCount.length > 0 && (
            <Panel title={t(i18n, 'stats.profile.mapBreakdown')}>
              <ChartCanvas
                config={buildMapPlayChart(stats.mapsPlayCount)}
                height={300}
              />
            </Panel>
          )}
        </div>
      )}

      {/* ═══ Matches section ═══ */}
      {activeSection.value === 'matches' && (() => {
        const filteredFights = showRankedOnly.value
          ? fights.filter((f) => f.ratingChange != null && f.ratingChange !== 0)
          : fights;
        const filteredEloChange = filteredFights.reduce(
          (sum, f) => sum + (f.ratingChange ?? 0), 0,
        );
        return (
        <div class="flex flex-col gap-3">
          {/* Match history summary + ranked filter toggle */}
          <div class="flex items-center justify-between">
            {filteredFights.length > 0 && (
              <div class="flex gap-4 text-xs font-mono">
                <span class="text-[var(--text-dim)]">
                  {filteredFights.length} {t(i18n, 'stats.profile.recentMatches').toLowerCase()}
                </span>
                <span class="text-[var(--green)]">
                  {filteredFights.filter((f) => f.result === 'win').length}W
                </span>
                <span class="text-[var(--red)]">
                  {filteredFights.filter((f) => f.result === 'loss').length}L
                </span>
                {filteredFights.some((f) => f.ratingChange != null) && (
                  <span
                    class={filteredEloChange >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}
                  >
                    {filteredEloChange >= 0 ? '+' : ''}
                    {filteredEloChange.toFixed(0)} ELO
                  </span>
                )}
              </div>
            )}
            <button
              class={[
                'px-2 py-1 text-[9px] font-mono uppercase tracking-wider border transition-colors',
                showRankedOnly.value
                  ? 'text-[var(--accent)] border-[var(--accent)] bg-[rgba(70,151,195,0.1)]'
                  : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => {
                showRankedOnly.value = !showRankedOnly.value;
              }}
            >
              {showRankedOnly.value
                ? t(i18n, 'stats.profile.rankedOnly')
                : t(i18n, 'stats.profile.allMatches')}
            </button>
          </div>

          <Panel title={t(i18n, 'stats.profile.recentMatches')} fill>
            {filteredFights.length === 0 ? (
              <p class="text-xs text-[var(--text-dim)]">
                {t(i18n, 'stats.player.noMatches')}
              </p>
            ) : (
              <div class="overflow-x-auto">
                <table class="w-full text-xs border-collapse">
                  <thead>
                    <tr class="text-[var(--text-dim)] uppercase tracking-[0.2em] text-[8px]">
                      <th class="text-center py-1 border-b border-[rgba(51,51,51,0.3)] w-14">
                        {t(i18n, 'stats.match.result')}
                      </th>
                      <th class="text-left py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.player.matchMap')}
                      </th>
                      <th class="text-center py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.profile.matchType')}
                      </th>
                      <th class="text-left py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.match.duration')}
                      </th>
                      <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.profile.destruction')}
                      </th>
                      <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.profile.playerLosses')}
                      </th>
                      <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.profile.dmgDealt')}
                      </th>
                      <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.profile.zones')}
                      </th>
                      <th class="text-center py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.profile.matchmaking')}
                      </th>
                      <th class="text-right py-1 border-b border-[rgba(51,51,51,0.3)]">
                        ELO
                      </th>
                      <th class="text-left py-1 border-b border-[rgba(51,51,51,0.3)]">
                        {t(i18n, 'stats.player.matchDate')}
                      </th>
                      <th class="text-left py-1 border-b border-[rgba(51,51,51,0.3)]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFights.map((fight) => {
                      const isWin = fight.result === 'win';
                      const isLoss = fight.result === 'loss';
                      const ratingDelta = fight.ratingChange;
                      const borderColor = isWin
                        ? 'border-l-2 border-l-[var(--green)]'
                        : isLoss
                          ? 'border-l-2 border-l-[var(--red)]'
                          : 'border-l-2 border-l-transparent';

                      return (
                        <tr
                          key={fight.fightId}
                          class={`border-b border-[rgba(51,51,51,0.15)] hover:bg-[rgba(70,151,195,0.05)] ${borderColor}`}
                        >
                          <td class="py-1.5 text-center">
                            {isWin && (
                              <span class="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--green)]">
                                WIN
                              </span>
                            )}
                            {isLoss && (
                              <span class="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--red)]">
                                LOSS
                              </span>
                            )}
                            {!isWin && !isLoss && (
                              <span class="text-[9px] font-mono text-[var(--text-dim)]">-</span>
                            )}
                          </td>
                          <td class="py-1.5 text-[var(--text)]">
                            {fight.mapName ?? `Map ${fight.mapId ?? '?'}`}
                          </td>
                          <td class="py-1.5 text-center font-mono text-[var(--text-dim)]">
                            {fight.teamSize ?? '-'}
                          </td>
                          <td class="py-1.5 text-[var(--text)] font-mono">
                            {formatPlaytime(fight.totalPlayTimeSec)}
                          </td>
                          <td class="py-1.5 text-right font-mono text-[var(--green)]">
                            {fight.destruction ?? '-'}
                          </td>
                          <td class="py-1.5 text-right font-mono text-[var(--red)]">
                            {fight.losses ?? '-'}
                          </td>
                          <td class="py-1.5 text-right font-mono text-[var(--text)]">
                            {fight.damageDealt?.toLocaleString() ?? '-'}
                          </td>
                          <td class="py-1.5 text-right font-mono text-[var(--text)]">
                            {fight.objectivesCaptured ?? '-'}
                          </td>
                          <td class="py-1.5 text-center font-mono text-[10px]">
                            {fight.allyAvgRating != null && fight.enemyAvgRating != null ? (
                              <span>
                                <span class="text-[var(--accent)]">{fight.allyAvgRating}</span>
                                <span class="text-[var(--text-dim)]"> vs </span>
                                <span class="text-[var(--red)]">{fight.enemyAvgRating}</span>
                              </span>
                            ) : (
                              <span class="text-[var(--text-dim)]">-</span>
                            )}
                          </td>
                          <td class="py-1.5 text-right font-mono text-[10px]">
                            {fight.oldRating != null && ratingDelta != null ? (
                              <span>
                                <span class="text-[var(--text-dim)]">{Math.round(fight.oldRating)}</span>
                                {' '}
                                <span
                                  class={ratingDelta >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}
                                >
                                  {ratingDelta >= 0 ? '+' : ''}{ratingDelta.toFixed(0)}
                                </span>
                              </span>
                            ) : (
                              <span class="text-[var(--text-dim)]">-</span>
                            )}
                          </td>
                          <td class="py-1.5 text-[var(--text-dim)] text-[10px]">
                            {formatTimestamp(fight.endTime)}
                          </td>
                          <td class="py-1.5">
                            <a
                              href={`/stats/match/${fight.fightId}?from=${loc.params.steamId}`}
                              class="text-[10px] font-mono text-[var(--accent)] hover:underline"
                            >
                              {t(i18n, 'stats.profile.viewMatch')} →
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
        );
      })()}
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(usePlayerProfile);
  const user = data?.profile?.user;
  const stats = data?.profile?.stats;
  const name = user?.name ?? 'Player';

  const parts: string[] = [];
  if (user?.rank) parts.push(`#${user.rank}`);
  if (user?.rating) parts.push(`${Math.round(user.rating)} ELO`);
  if (stats?.fightsCount && stats?.winsCount) {
    parts.push(`${Math.round((stats.winsCount / stats.fightsCount) * 100)}% Win Rate`);
  }
  if (stats?.kdRatio) parts.push(`${stats.kdRatio.toFixed(2)} K/D`);
  if (stats?.fightsCount) parts.push(`${stats.fightsCount} Matches`);
  const description = parts.length
    ? `${name} — ${parts.join(' · ')}`
    : `View ${name}'s Broken Arrow statistics, match history, and performance data.`;

  const title = `${name} — BA Hub Player Stats`;

  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'profile' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
  };
};
