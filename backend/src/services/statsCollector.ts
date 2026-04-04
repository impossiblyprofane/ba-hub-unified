import { StatsClient } from './statsClient.js';
import type { MatchCrawler, CrawlerAggregates } from './matchCrawler.js';

/**
 * Periodic data collection scheduler.
 *
 * Collects leaderboard rankings, map play data, faction win rates,
 * and unit performance data from the external API and pushes
 * snapshots to the database service for historical tracking.
 *
 * When a MatchCrawler is provided, also runs incremental match scanning
 * and includes crawler-derived aggregates (faction win rates from actual
 * matches, spec popularity, unit popularity per nation) in snapshots.
 *
 * Frequency:
 * - Hourly:  leaderboard + map stats + faction stats + crawler aggregates
 * - Daily:   same + unit performance (aggregated from fight data) + crawler aggregates
 * - Weekly:  triggered automatically (daily snapshots are sufficient for
 *            the DB to derive weekly rollups via query)
 * - Monthly: same pattern
 *
 * Retention pruning is triggered after each daily collection.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** How often the crawler range-scans when catching up. */
const CRAWL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface CollectorConfig {
  statsClient: StatsClient;
  databaseServiceUrl: string;
  /** Set false to disable (e.g. in dev). Default true. */
  enabled?: boolean;
  /** Optional match crawler for independent fight data collection. */
  matchCrawler?: MatchCrawler;
}

export class StatsCollector {
  private statsClient: StatsClient;
  private dbUrl: string;
  private enabled: boolean;
  private matchCrawler: MatchCrawler | null;
  private hourlyTimer: ReturnType<typeof setInterval> | null = null;
  private dailyTimer: ReturnType<typeof setInterval> | null = null;
  private crawlerTimer: ReturnType<typeof setInterval> | null = null;
  private crawlerRunning = false;
  private lastHourly: number = 0;
  private lastDaily: number = 0;

  constructor(config: CollectorConfig) {
    this.statsClient = config.statsClient;
    this.dbUrl = config.databaseServiceUrl.replace(/\/$/, '');
    this.enabled = config.enabled ?? true;
    this.matchCrawler = config.matchCrawler ?? null;
  }

  /** Start the periodic collection loops. */
  start(): void {
    if (!this.enabled) {
      console.log('[StatsCollector] Disabled — skipping scheduler start.');
      return;
    }

    console.log('[StatsCollector] Starting periodic data collection.');

    // Delay initial collection by 10s to let sibling services (database) start first
    setTimeout(() => {
      this.collectHourly().catch((err) =>
        console.error('[StatsCollector] Initial hourly collection failed:', err),
      );
    }, 10_000);

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

    // Dedicated crawler loop — runs every 2 min, independent of hourly stats
    if (this.matchCrawler) {
      // Start first crawler tick 20s after boot (after initial hourly seeds it)
      setTimeout(() => {
        this.crawlerTick();
        this.crawlerTimer = setInterval(() => this.crawlerTick(), CRAWL_INTERVAL_MS);
      }, 20_000);
    }
  }

  /** Stop all timers. */
  stop(): void {
    if (this.hourlyTimer) clearInterval(this.hourlyTimer);
    if (this.dailyTimer) clearInterval(this.dailyTimer);
    if (this.crawlerTimer) clearInterval(this.crawlerTimer);
    this.hourlyTimer = null;
    this.dailyTimer = null;
    this.crawlerTimer = null;
    console.log('[StatsCollector] Stopped.');
  }

  // ── Crawler tick (independent fast loop) ──────────────────

  private crawlerTick(): void {
    if (this.crawlerRunning || !this.matchCrawler) return;
    this.crawlerRunning = true;
    this.runCrawlerScan().finally(() => { this.crawlerRunning = false; });
  }

  private async runCrawlerScan(): Promise<void> {
    try {
      const result = await this.matchCrawler!.scanRangeChunk();
      const progress = await this.matchCrawler!.getProgress();
      if (result.done) {
        console.log(`[Crawler] Range scan complete — ${progress.position} reached ceiling.`);
        // Stop the fast loop once caught up
        if (this.crawlerTimer) {
          clearInterval(this.crawlerTimer);
          this.crawlerTimer = null;
        }
      } else if (result.scanned > 0) {
        console.log(
          `[Crawler] Scanned ${result.scanned} IDs, found ${result.found} ranked — ${progress.percentDone}% (${progress.position}/${progress.ceiling})`,
        );
      }
    } catch (err) {
      console.error('[Crawler] Scan failed:', err);
    }
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

    // Collect crawler aggregates (scanning handled by dedicated fast loop)
    let crawlerAggregates: Partial<CrawlerAggregates> = {};

    if (this.matchCrawler) {
      try {
        // Player discovery (new fights from leaderboard players)
        const crawlResult = await this.matchCrawler.collectMatches();
        if (crawlResult.newMatches > 0) {
          console.log(`[StatsCollector] Player discovery: +${crawlResult.playerFights} new matches.`);
        }
        const agg = await this.matchCrawler.computeAggregates('hourly');
        if (agg) {
          crawlerAggregates = {
            crawlerFactionStats: agg.crawlerFactionStats,
            specStats: agg.specStats,
            unitPerformance: agg.unitPerformance,
          };
        }
      } catch (err) {
        console.error('[StatsCollector] Crawler hourly run failed:', err);
      }
    }

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
      ...crawlerAggregates,
    };

    await this.postSnapshot(body);
    console.log(
      `[StatsCollector] Hourly snapshot saved: ${body.leaderboard.length} players, ` +
      `${body.mapStats.length} maps, ${body.factionStats.length} factions` +
      (crawlerAggregates.specStats ? `, ${crawlerAggregates.specStats.length} specs (crawler)` : '') + '.',
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

    // Collect crawler aggregates (scanning handled by dedicated fast loop)
    let crawlerAggregates: Partial<CrawlerAggregates> = {};

    if (this.matchCrawler) {
      try {
        const agg = await this.matchCrawler.computeAggregates('daily');
        if (agg) {
          crawlerAggregates = {
            crawlerFactionStats: agg.crawlerFactionStats,
            specStats: agg.specStats,
            unitPerformance: agg.unitPerformance,
          };
        }
      } catch (err) {
        console.error('[StatsCollector] Crawler daily aggregation failed:', err);
      }
    }

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
      ...crawlerAggregates,
    };

    await this.postSnapshot(body);
    console.log(
      `[StatsCollector] Daily snapshot saved: ${body.leaderboard.length} players, ` +
      `${body.mapStats.length} maps, ${body.factionStats.length} factions` +
      (crawlerAggregates.specStats ? `, ${crawlerAggregates.specStats.length} specs (crawler)` : '') + '.',
    );

    // Prune old snapshots + old raw match data
    await this.pruneSnapshots();
    await this.pruneOldMatches();
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

  /** Remove raw match data older than 30 days (cascade deletes child rows). */
  private async pruneOldMatches(): Promise<void> {
    try {
      const res = await fetch(`${this.dbUrl}/api/crawler/matches/prune?olderThanDays=30`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = (await res.json()) as { pruned: number };
        if (data.pruned > 0) {
          console.log(`[StatsCollector] Pruned ${data.pruned} old match records.`);
        }
      }
    } catch (err) {
      console.error('[StatsCollector] Match prune failed:', err);
    }
  }
}
