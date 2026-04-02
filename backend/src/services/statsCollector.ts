import { StatsClient } from './statsClient.js';

/**
 * Periodic data collection scheduler.
 *
 * Collects leaderboard rankings, map play data, faction win rates,
 * and unit performance data from the external API and pushes
 * snapshots to the database service for historical tracking.
 *
 * Frequency:
 * - Hourly:  leaderboard + map stats + faction stats
 * - Daily:   same + unit performance (aggregated from fight data)
 * - Weekly:  triggered automatically (daily snapshots are sufficient for
 *            the DB to derive weekly rollups via query)
 * - Monthly: same pattern
 *
 * Retention pruning is triggered after each daily collection.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface CollectorConfig {
  statsClient: StatsClient;
  databaseServiceUrl: string;
  /** Set false to disable (e.g. in dev). Default true. */
  enabled?: boolean;
  /** Resolve a unit ID → display name. Falls back to "Unit_{id}" if not provided. */
  resolveUnitName?: (unitId: number) => string | null;
}

export class StatsCollector {
  private statsClient: StatsClient;
  private dbUrl: string;
  private enabled: boolean;
  private resolveUnitName: (unitId: number) => string | null;
  private hourlyTimer: ReturnType<typeof setInterval> | null = null;
  private dailyTimer: ReturnType<typeof setInterval> | null = null;
  private lastHourly: number = 0;
  private lastDaily: number = 0;

  constructor(config: CollectorConfig) {
    this.statsClient = config.statsClient;
    this.dbUrl = config.databaseServiceUrl.replace(/\/$/, '');
    this.enabled = config.enabled ?? true;
    this.resolveUnitName = config.resolveUnitName ?? (() => null);
  }

  /** Start the periodic collection loops. */
  start(): void {
    if (!this.enabled) {
      console.log('[StatsCollector] Disabled — skipping scheduler start.');
      return;
    }

    console.log('[StatsCollector] Starting periodic data collection.');

    // Collect immediately on startup, then every hour
    this.collectHourly().catch((err) =>
      console.error('[StatsCollector] Initial hourly collection failed:', err),
    );

    this.hourlyTimer = setInterval(() => {
      this.collectHourly().catch((err) =>
        console.error('[StatsCollector] Hourly collection failed:', err),
      );
    }, HOUR_MS);

    // Daily collection — offset by 5 minutes to avoid colliding with hourly
    setTimeout(() => {
      this.collectDaily().catch((err) =>
        console.error('[StatsCollector] Initial daily collection failed:', err),
      );
      this.dailyTimer = setInterval(() => {
        this.collectDaily().catch((err) =>
          console.error('[StatsCollector] Daily collection failed:', err),
        );
      }, DAY_MS);
    }, 5 * 60 * 1000);
  }

  /** Stop all timers. */
  stop(): void {
    if (this.hourlyTimer) clearInterval(this.hourlyTimer);
    if (this.dailyTimer) clearInterval(this.dailyTimer);
    this.hourlyTimer = null;
    this.dailyTimer = null;
    console.log('[StatsCollector] Stopped.');
  }

  // ── Hourly collection ──────────────────────────────────────

  private async collectHourly(): Promise<void> {
    const now = Date.now();
    // Guard against rapid re-execution
    if (now - this.lastHourly < HOUR_MS * 0.9) return;
    this.lastHourly = now;

    console.log('[StatsCollector] Running hourly collection…');

    const [leaderboard, mapRatings, countryStats] = await Promise.all([
      this.statsClient.getLeaderboard(0, 100).catch(() => []),
      this.statsClient.getMapRatings().catch(() => []),
      this.statsClient.getCountryStats().catch(() => ({ matchesCount: [], winsCount: [] })),
    ]);

    const body = {
      snapshotType: 'hourly' as const,
      leaderboard: leaderboard.map((e) => ({
        rank: e.rank,
        userId: e.userId,
        steamId: e.steamId,
        name: e.name,
        rating: e.rating,
        elo: e.elo,
        level: e.level,
        winRate: e.winRate,
        kdRatio: e.kdRatio,
      })),
      mapStats: mapRatings
        .filter((m) => m.name && m.count != null)
        .map((m) => ({
          mapName: m.name!,
          playCount: m.count!,
        })),
      factionStats: this.buildFactionStats(countryStats),
    };

    await this.postSnapshot(body);
    console.log(
      `[StatsCollector] Hourly snapshot saved: ${body.leaderboard.length} players, ` +
      `${body.mapStats.length} maps, ${body.factionStats.length} factions.`,
    );
  }

  // ── Daily collection (includes unit stats from fights) ─────

  private async collectDaily(): Promise<void> {
    const now = Date.now();
    if (now - this.lastDaily < DAY_MS * 0.9) return;
    this.lastDaily = now;

    console.log('[StatsCollector] Running daily collection…');

    const [leaderboard, mapRatings, countryStats] = await Promise.all([
      this.statsClient.getLeaderboard(0, 100).catch(() => []),
      this.statsClient.getMapRatings().catch(() => []),
      this.statsClient.getCountryStats().catch(() => ({ matchesCount: [], winsCount: [] })),
    ]);

    // Collect unit stats from recent fights of top players
    const unitStats = await this.collectUnitStats(leaderboard.slice(0, 20));

    const body = {
      snapshotType: 'daily' as const,
      leaderboard: leaderboard.map((e) => ({
        rank: e.rank,
        userId: e.userId,
        steamId: e.steamId,
        name: e.name,
        rating: e.rating,
        elo: e.elo,
        level: e.level,
        winRate: e.winRate,
        kdRatio: e.kdRatio,
      })),
      mapStats: mapRatings
        .filter((m) => m.name && m.count != null)
        .map((m) => ({
          mapName: m.name!,
          playCount: m.count!,
        })),
      factionStats: this.buildFactionStats(countryStats),
      unitStats,
    };

    await this.postSnapshot(body);
    console.log(
      `[StatsCollector] Daily snapshot saved: ${body.leaderboard.length} players, ` +
      `${body.mapStats.length} maps, ${body.factionStats.length} factions, ` +
      `${unitStats.length} units.`,
    );

    // Prune old snapshots
    await this.pruneSnapshots();
  }

  // ── Unit stats aggregation from fight data ─────────────────

  private async collectUnitStats(
    topPlayers: Array<{ userId?: number }>,
  ): Promise<Array<{
    unitName: string;
    timesDeployed: number;
    totalKills: number;
    totalDamageDealt: number;
    totalDamageReceived: number;
    totalSupplyConsumed: number;
    timesRefunded: number;
  }>> {
    // Collect recent fight IDs from the top N players
    const fightIdSet = new Set<string>();

    for (const player of topPlayers) {
      if (!player.userId) continue;
      try {
        const fightIds = await this.statsClient.getRecentFightIds(player.userId);
        for (const id of fightIds.slice(0, 5)) {
          fightIdSet.add(id);
        }
      } catch {
        // Skip players whose fight history can't be fetched
      }
    }

    // Fetch fight data and aggregate unit performance
    const unitMap = new Map<
      string,
      {
        timesDeployed: number;
        totalKills: number;
        totalDamageDealt: number;
        totalDamageReceived: number;
        totalSupplyConsumed: number;
        timesRefunded: number;
      }
    >();

    const fightIds = [...fightIdSet].slice(0, 50); // Limit to 50 fights to avoid overloading the S3 endpoint

    // Process fights in small batches (5 at a time)
    for (let i = 0; i < fightIds.length; i += 5) {
      const batch = fightIds.slice(i, i + 5);
      const results = await Promise.all(
        batch.map((id) => this.statsClient.getFightData(id).catch(() => null)),
      );

      for (const fight of results) {
        if (!fight) continue;
        for (const player of fight.players) {
          for (const unit of player.units) {
              const name = this.resolveUnitName(unit.id) ?? `Unit_${unit.id}`;
            const existing = unitMap.get(name) ?? {
              timesDeployed: 0,
              totalKills: 0,
              totalDamageDealt: 0,
              totalDamageReceived: 0,
              totalSupplyConsumed: 0,
              timesRefunded: 0,
            };
            existing.timesDeployed += 1;
            existing.totalKills += unit.killedCount ?? 0;
            existing.totalDamageDealt += unit.totalDamageDealt ?? 0;
            existing.totalDamageReceived += unit.totalDamageReceived ?? 0;
            existing.totalSupplyConsumed += unit.supplyPointsConsumed ?? 0;
            existing.timesRefunded += unit.wasRefunded ? 1 : 0;
            unitMap.set(name, existing);
          }
        }
      }
    }

    return [...unitMap.entries()].map(([unitName, stats]) => ({
      unitName,
      ...stats,
    }));
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildFactionStats(
    countryStats: { matchesCount: Array<{ name?: string; count?: number }>; winsCount: Array<{ name?: string; count?: number }> },
  ) {
    const winsMap = new Map<string, number>();
    for (const w of countryStats.winsCount) {
      if (w.name && w.count != null) winsMap.set(w.name, w.count);
    }

    return countryStats.matchesCount
      .filter((m) => m.name && m.count != null)
      .map((m) => ({
        factionName: m.name!,
        matchCount: m.count!,
        winCount: winsMap.get(m.name!) ?? 0,
      }));
  }

  private async postSnapshot(body: unknown): Promise<void> {
    const res = await fetch(`${this.dbUrl}/api/snapshots`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Snapshot POST failed: ${res.status} ${text}`);
    }
  }

  private async pruneSnapshots(): Promise<void> {
    try {
      const res = await fetch(`${this.dbUrl}/api/snapshots/prune`, {
        method: 'DELETE',
      });
      if (res.ok) {
        console.log('[StatsCollector] Old snapshots pruned.');
      }
    } catch (err) {
      console.error('[StatsCollector] Prune failed:', err);
    }
  }
}
