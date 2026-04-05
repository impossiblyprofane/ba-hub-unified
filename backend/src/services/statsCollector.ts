import type { DatabaseClient } from './databaseClient.js';
import type { MatchCrawler } from './matchCrawler.js';

/**
 * Periodic data collection scheduler.
 *
 * Collects leaderboard snapshots for historical rating-over-time tracking
 * and runs the match crawler for independent fight data collection.
 *
 * All other stats (faction win rates, map popularity, spec usage, unit
 * performance) are now derived at query time from raw match data with
 * configurable time windows (7d/14d/30d).
 *
 * Frequency:
 * - Hourly:  leaderboard snapshot + match pruning (>30d)
 * - Crawler: every 2 min (range scan for new matches)
 */

const HOUR_MS = 60 * 60 * 1000;
/** How often the crawler range-scans when catching up. */
const CRAWL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface CollectorConfig {
  dbClient: DatabaseClient;
  databaseServiceUrl: string;
  /** Set false to disable (e.g. in dev). Default true. */
  enabled?: boolean;
  /** Optional match crawler for independent fight data collection. */
  matchCrawler?: MatchCrawler;
}

export class StatsCollector {
  private dbClient: DatabaseClient;
  private dbUrl: string;
  private enabled: boolean;
  private matchCrawler: MatchCrawler | null;
  private hourlyTimer: ReturnType<typeof setInterval> | null = null;
  private crawlerTimer: ReturnType<typeof setInterval> | null = null;
  private crawlerRunning = false;
  private lastHourly: number = 0;

  constructor(config: CollectorConfig) {
    this.dbClient = config.dbClient;
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
    if (this.crawlerTimer) clearInterval(this.crawlerTimer);
    this.hourlyTimer = null;
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

    // Fetch leaderboard for snapshot tracking
    const leaderboard = await this.dbClient.getLeaderboard(0, 100).catch(() => []);

    // Run crawler player discovery (new fights from leaderboard players)
    if (this.matchCrawler) {
      try {
        const crawlResult = await this.matchCrawler.collectMatches();
        if (crawlResult.newMatches > 0) {
          console.log(`[StatsCollector] Player discovery: +${crawlResult.playerFights} new matches.`);
        }
      } catch (err) {
        console.error('[StatsCollector] Crawler hourly run failed:', err);
      }
    }

    // Save leaderboard-only snapshot (for rating-over-time tracking)
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
    };

    await this.postSnapshot(body);
    console.log(
      `[StatsCollector] Hourly snapshot saved: ${body.leaderboard.length} players.`,
    );

    // Prune old snapshots + old raw match data (>30 days)
    await this.pruneSnapshots();
    await this.pruneOldMatches();
  }

  // ── Helpers ────────────────────────────────────────────────

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
