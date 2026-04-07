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
/** Default for how often the crawler range-scans when catching up. */
const DEFAULT_CRAWL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface CollectorLogger {
  info(obj: Record<string, unknown> | string, msg?: string): void;
  warn(obj: Record<string, unknown> | string, msg?: string): void;
  error(obj: Record<string, unknown> | string, msg?: string): void;
  child?(bindings: Record<string, unknown>): CollectorLogger;
}

interface CollectorConfig {
  statsClient: StatsClient;
  databaseServiceUrl: string;
  /** Set false to disable (e.g. in dev). Default true. */
  enabled?: boolean;
  /** Optional match crawler for independent fight data collection. */
  matchCrawler?: MatchCrawler;
  /** How often the crawler range-scans when catching up. Default 2 minutes. */
  crawlIntervalMs?: number;
  /** Optional structured logger — tags entries as `cat: 'collector'`. */
  logger?: CollectorLogger;
}

export class StatsCollector {
  private statsClient: StatsClient;
  private dbUrl: string;
  private enabled: boolean;
  private matchCrawler: MatchCrawler | null;
  private crawlIntervalMs: number;
  private log: CollectorLogger;
  private hourlyTimer: ReturnType<typeof setInterval> | null = null;
  private dailyTimer: ReturnType<typeof setInterval> | null = null;
  private crawlerTimer: ReturnType<typeof setInterval> | null = null;
  private lastHourly: number = 0;
  private lastDaily: number = 0;

  constructor(config: CollectorConfig) {
    this.statsClient = config.statsClient;
    this.dbUrl = config.databaseServiceUrl.replace(/\/$/, '');
    this.enabled = config.enabled ?? true;
    this.matchCrawler = config.matchCrawler ?? null;
    this.crawlIntervalMs = config.crawlIntervalMs ?? DEFAULT_CRAWL_INTERVAL_MS;
    const fallback: CollectorLogger = {
      info: (obj, msg) => console.log('[StatsCollector]', msg ?? obj),
      warn: (obj, msg) => console.warn('[StatsCollector]', msg ?? obj),
      error: (obj, msg) => console.error('[StatsCollector]', msg ?? obj),
    };
    const base = config.logger ?? fallback;
    this.log = base.child ? base.child({ cat: 'collector' }) : base;
  }

  /** Start the periodic collection loops. */
  start(): void {
    if (!this.enabled) {
      this.log.info('Disabled — skipping scheduler start');
      return;
    }

    this.log.info('Starting periodic data collection');

    // Delay initial collection by 10s to let sibling services (database) start first
    setTimeout(() => {
      this.collectHourly().catch((err) =>
        this.log.error({ err }, 'Initial hourly collection failed'),
      );
    }, 10_000);

    this.hourlyTimer = setInterval(() => {
      this.collectHourly().catch((err) =>
        this.log.error({ err }, 'Hourly collection failed'),
      );
    }, HOUR_MS);

    // Daily collection — offset by 5 minutes to avoid colliding with hourly
    setTimeout(() => {
      this.collectDaily().catch((err) =>
        this.log.error({ err }, 'Initial daily collection failed'),
      );
      this.dailyTimer = setInterval(() => {
        this.collectDaily().catch((err) =>
          this.log.error({ err }, 'Daily collection failed'),
        );
      }, DAY_MS);
    }, 5 * 60 * 1000);

    // Dedicated crawler loop — runs on `crawlIntervalMs`, independent of hourly stats
    if (this.matchCrawler) {
      // Start first crawler tick 20s after boot (after initial hourly seeds it)
      setTimeout(() => {
        this.crawlerTick();
        this.crawlerTimer = setInterval(() => this.crawlerTick(), this.crawlIntervalMs);
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
    this.log.info('Stopped');
  }

  // ── Crawler tick (independent fast loop) ──────────────────

  private crawlerTick(): void {
    if (!this.matchCrawler || this.matchCrawler.isBusy()) return;
    this.runCrawlerScan().catch(() => { /* swallowed by runCrawlerScan */ });
  }

  private async runCrawlerScan(): Promise<void> {
    try {
      const result = await this.matchCrawler!.scanRangeChunk();
      const progress = await this.matchCrawler!.getProgress();
      if (result.done) {
        this.log.info({ position: progress.position }, 'Range scan complete');
        // Stop the fast loop once caught up
        if (this.crawlerTimer) {
          clearInterval(this.crawlerTimer);
          this.crawlerTimer = null;
        }
      } else if (result.scanned > 0) {
        this.log.info(
          {
            scanned: result.scanned,
            found: result.found,
            percent: progress.percentDone,
            position: progress.position,
            ceiling: progress.ceiling,
          },
          'Scan tick',
        );
      }
    } catch (err) {
      // CrawlerBusyError is expected if a manual fire raced us — swallow quietly.
      const name = err instanceof Error ? err.name : '';
      if (name !== 'CrawlerBusyError') {
        this.log.error({ err }, 'Scan failed');
      }
    }
  }

  // ── Hourly collection ──────────────────────────────────────

  private async collectHourly(): Promise<void> {
    const now = Date.now();
    // Guard against rapid re-execution
    if (now - this.lastHourly < HOUR_MS * 0.9) return;
    this.lastHourly = now;

    this.log.info('Running hourly collection');

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
          this.log.info({ newMatches: crawlResult.playerFights }, 'Player discovery completed');
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
        this.log.error({ err }, 'Crawler hourly run failed');
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
    this.log.info(
      {
        players: body.leaderboard.length,
        maps: body.mapStats.length,
        factions: body.factionStats.length,
        specs: crawlerAggregates.specStats?.length ?? 0,
      },
      'Hourly snapshot saved',
    );
  }

  // ── Daily collection (includes unit stats from fights) ─────

  private async collectDaily(): Promise<void> {
    const now = Date.now();
    if (now - this.lastDaily < DAY_MS * 0.9) return;
    this.lastDaily = now;

    this.log.info('Running daily collection');

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
        this.log.error({ err }, 'Crawler daily aggregation failed');
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
    this.log.info(
      {
        players: body.leaderboard.length,
        maps: body.mapStats.length,
        factions: body.factionStats.length,
        specs: crawlerAggregates.specStats?.length ?? 0,
      },
      'Daily snapshot saved',
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
        this.log.info('Old snapshots pruned');
      }
    } catch (err) {
      this.log.error({ err }, 'Prune failed');
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
          this.log.info({ pruned: data.pruned }, 'Pruned old match records');
        }
      }
    } catch (err) {
      this.log.error({ err }, 'Match prune failed');
    }
  }
}
