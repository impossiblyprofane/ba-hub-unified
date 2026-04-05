import type { DatabaseClient, StatsFightData, StatsFightPlayerData } from './databaseClient.js';
import type { StaticData } from '../data/loader.js';
import type { StaticIndexes } from '../data/indexes.js';
import { MAP_ID_TO_NAME } from '../data/constants.js';

// ── Types ────────────────────────────────────────────────────────

interface CrawlerConfig {
  dbClient: DatabaseClient;
  databaseServiceUrl: string;
  indexes: StaticIndexes;
  data: StaticData;
  /** Concurrent S3 fetches per batch. Default 5. */
  batchSize?: number;
  /** How many leaderboard players to scan for fights. Default 30. */
  playerCount?: number;
  /** IDs to scan per hourly range-scan chunk. Default 25000. */
  chunkSize?: number;
}

interface CollectResult {
  playerFights: number;
  rangeScan: number;
  newMatches: number;
}

interface MatchInsert {
  fightId: number;
  mapId?: number;
  mapName?: string;
  isRanked: boolean;
  winnerTeam?: number;
  playerCount: number;
  totalPlayTimeSec?: number;
  endTime?: number;
  /** Raw S3 FightData JSON blob — stored in fight_data table. */
  rawFightData?: unknown;
  teams: Array<{
    teamId: number;
    factionName: string;
    isWinner: boolean;
    avgRating?: number;
  }>;
  playerPicks: Array<{
    steamId?: string;
    odId?: number;
    teamId?: number;
    spec1Id?: number;
    spec1Name?: string;
    spec2Id?: number;
    spec2Name?: string;
    factionName: string;
    oldRating?: number;
    newRating?: number;
    destruction?: number;
    losses?: number;
    damageDealt?: number;
    damageReceived?: number;
    objectivesCaptured?: number;
  }>;
  unitDeployments: Array<{
    steamId?: string;
    odId?: number;
    unitId: number;
    unitName: string;
    factionName: string;
    optionIds: string;
    configKey: string;
    playerRating?: number;
    eloBracket: string;
    killedCount: number;
    totalDamageDealt: number;
    totalDamageReceived: number;
    supplyPointsConsumed: number;
    wasRefunded: boolean;
  }>;
}

interface CrawlerState {
  scanFloor: number;
  scanCeiling: number;
  scanPosition: number;
  initialCollectionDone: boolean;
  updatedAt: string | null;
}

/** Derive ELO bracket from a player's rating. Buckets per 500. */
function getEloBracket(rating?: number): string {
  if (rating === undefined || rating === null) return 'unranked';
  const bucket = Math.floor(rating / 500) * 500;
  return `${bucket}-${bucket + 500}`;
}

// ── MatchCrawler ─────────────────────────────────────────────────

export class MatchCrawler {
  private dbClient: DatabaseClient;
  private dbUrl: string;
  private indexes: StaticIndexes;
  private data: StaticData;
  private batchSize: number;
  private playerCount: number;
  private chunkSize: number;

  /** Reverse index: unitId → Set<specId> (built once on first use). */
  private unitIdToSpecIds: Map<number, Set<number>> | null = null;

  constructor(config: CrawlerConfig) {
    this.dbClient = config.dbClient;
    this.dbUrl = config.databaseServiceUrl.replace(/\/$/, '');
    this.indexes = config.indexes;
    this.data = config.data;
    this.batchSize = config.batchSize ?? 20;
    this.playerCount = config.playerCount ?? 30;
    this.chunkSize = config.chunkSize ?? 5000;
  }

  // ── Spec reverse index ─────────────────────────────────────────

  private getUnitIdToSpecIds(): Map<number, Set<number>> {
    if (!this.unitIdToSpecIds) {
      this.unitIdToSpecIds = new Map();
      for (const sa of this.data.specializationAvailabilities) {
        let set = this.unitIdToSpecIds.get(sa.UnitId);
        if (!set) { set = new Set(); this.unitIdToSpecIds.set(sa.UnitId, set); }
        set.add(sa.SpecializationId);
      }
    }
    return this.unitIdToSpecIds;
  }

  // ── DB helpers ─────────────────────────────────────────────────

  private async getState(): Promise<CrawlerState> {
    const res = await fetch(`${this.dbUrl}/api/crawler/state`);
    return res.json() as Promise<CrawlerState>;
  }

  private async updateState(updates: Partial<CrawlerState>): Promise<void> {
    await fetch(`${this.dbUrl}/api/crawler/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  private async checkExisting(ids: number[]): Promise<Set<number>> {
    if (ids.length === 0) return new Set();
    const res = await fetch(`${this.dbUrl}/api/crawler/matches/exists?ids=${ids.join(',')}`);
    const data = (await res.json()) as { existing: number[] };
    return new Set(data.existing);
  }

  private async bulkInsert(matches: MatchInsert[]): Promise<number> {
    if (matches.length === 0) return 0;
    // Diagnostic: log unit deployment counts per match
    for (const m of matches) {
      const unitCount = m.unitDeployments?.length ?? 0;
      const pickCount = m.playerPicks?.length ?? 0;
      console.log(
        `[MatchCrawler] bulkInsert fight=${m.fightId}: ${pickCount} picks, ${unitCount} unitDeploys`,
      );
    }
    try {
      const res = await fetch(`${this.dbUrl}/api/crawler/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matches),
      });
      if (res.status === 413 && matches.length > 1) {
        // Body too large — split in half and retry
        const mid = Math.ceil(matches.length / 2);
        const a = await this.bulkInsert(matches.slice(0, mid));
        const b = await this.bulkInsert(matches.slice(mid));
        return a + b;
      }
      if (!res.ok) {
        console.warn(`[MatchCrawler] bulkInsert failed: ${res.status} (${matches.length} matches)`);
        return 0;
      }
      const result = (await res.json()) as { inserted: number; skipped: number };
      return result.inserted ?? 0;
    } catch (err) {
      console.warn(`[MatchCrawler] bulkInsert error:`, err instanceof Error ? err.message : err);
      return 0;
    }
  }

  // ── Main collection method ─────────────────────────────────────

  /**
   * Collect matches: player-based discovery + range scan chunk.
   * Called by StatsCollector each hourly/daily cycle.
   */
  async collectMatches(): Promise<CollectResult> {
    const state = await this.getState();

    // Phase 1: Initial setup (first run ever)
    if (!state.initialCollectionDone) {
      return this.initialCollection();
    }

    // Phase 2: Ongoing collection
    // Step 1: Collect from player recent fights
    const playerFights = await this.collectFromPlayers();

    // Step 2: Range scan chunk (if not finished)
    let rangeScan = 0;
    if (state.scanPosition < state.scanCeiling) {
      rangeScan = await this.rangeScanChunk(state);
    }

    return {
      playerFights,
      rangeScan,
      newMatches: playerFights + rangeScan,
    };
  }

  /**
   * Run only a range scan chunk — no player discovery.
   * Used by the dedicated fast crawler loop to avoid redundant player lookups.
   */
  async scanRangeChunk(): Promise<{ scanned: number; found: number; done: boolean }> {
    const state = await this.getState();
    if (!state.initialCollectionDone) {
      return { scanned: 0, found: 0, done: false };
    }
    if (state.scanPosition >= state.scanCeiling) {
      return { scanned: 0, found: 0, done: true };
    }
    const found = await this.rangeScanChunk(state);
    const newState = await this.getState();
    return {
      scanned: newState.scanPosition - state.scanPosition,
      found,
      done: newState.scanPosition >= newState.scanCeiling,
    };
  }

  /** Get scan progress for heartbeat/monitoring. */
  async getProgress(): Promise<{
    floor: number;
    ceiling: number;
    position: number;
    percentDone: number;
    initialDone: boolean;
  }> {
    const state = await this.getState();
    const range = state.scanCeiling - state.scanFloor;
    const progress = state.scanPosition - state.scanFloor;
    return {
      floor: state.scanFloor,
      ceiling: state.scanCeiling,
      position: state.scanPosition,
      percentDone: range > 0 ? Math.round((progress / range) * 1000) / 10 : 0,
      initialDone: state.initialCollectionDone,
    };
  }

  // ── Initial collection ─────────────────────────────────────────

  private async initialCollection(): Promise<CollectResult> {
    console.log('[MatchCrawler] Running initial collection...');

    // Step 1: Get fight IDs from leaderboard players
    const fightIds = await this.discoverFightIds();
    if (fightIds.length === 0) {
      console.warn('[MatchCrawler] No fight IDs found from players. Will retry next cycle.');
      return { playerFights: 0, rangeScan: 0, newMatches: 0 };
    }

    const maxId = Math.max(...fightIds);
    console.log(`[MatchCrawler] Discovered ${fightIds.length} fight IDs from players (max=${maxId}).`);

    // Step 2: Binary search for S3 floor
    const floor = await this.findS3Floor(maxId);
    console.log(`[MatchCrawler] S3 floor found at ~${floor}`);

    // Step 3: Store state
    await this.updateState({
      scanFloor: floor,
      scanCeiling: maxId,
      scanPosition: floor,
      initialCollectionDone: true,
    });

    // Step 4: Process discovered player fights
    const newCount = await this.processDiscoveredFights(fightIds);
    console.log(`[MatchCrawler] Initial collection complete: ${newCount} matches stored.`);

    return { playerFights: newCount, rangeScan: 0, newMatches: newCount };
  }

  // ── Player-based discovery ─────────────────────────────────────

  private async discoverFightIds(): Promise<number[]> {
    const fightIdSet = new Set<number>();

    try {
      const leaderboard = await this.dbClient.getLeaderboard(0, 100);
      const playerIds = leaderboard
        .filter((e) => e.userId)
        .slice(0, this.playerCount)
        .map((e) => e.userId!);

      // Fetch fight IDs in batches of 5 players
      for (let i = 0; i < playerIds.length; i += 5) {
        const batch = playerIds.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((userId) =>
            this.dbClient.getRecentFightIds(userId).catch(() => [] as number[]),
          ),
        );
        for (const ids of results) {
          for (const id of ids) {
            const num = typeof id === 'number' ? id : parseInt(String(id), 10);
            if (Number.isFinite(num)) fightIdSet.add(num);
          }
        }
      }
    } catch (err) {
      console.error('[MatchCrawler] Failed to discover fight IDs:', err);
    }

    return [...fightIdSet];
  }

  private async collectFromPlayers(): Promise<number> {
    const fightIds = await this.discoverFightIds();
    if (fightIds.length === 0) return 0;

    // Also update the ceiling if we found higher IDs
    const maxId = Math.max(...fightIds);
    const state = await this.getState();
    if (maxId > state.scanCeiling) {
      await this.updateState({ scanCeiling: maxId });
    }

    return this.processDiscoveredFights(fightIds);
  }

  private async processDiscoveredFights(fightIds: number[]): Promise<number> {
    // Filter out already-processed
    const existing = await this.checkExisting(fightIds);
    const newIds = fightIds.filter((id) => !existing.has(id));
    if (newIds.length === 0) return 0;

    console.log(`[MatchCrawler] Processing ${newIds.length} new fights from player discovery...`);

    // Fetch and process in batches
    let totalInserted = 0;
    for (let i = 0; i < newIds.length; i += this.batchSize) {
      const batch = newIds.slice(i, i + this.batchSize);
      const results = await Promise.all(
        batch.map((id) => this.dbClient.getFightData(String(id)).catch(() => null)),
      );

      const toInsert: MatchInsert[] = [];
      for (let j = 0; j < results.length; j++) {
        if (!results[j]) continue;
        const processed = this.processFight(batch[j], results[j]!);
        if (processed) toInsert.push(processed);
      }

      if (toInsert.length > 0) {
        totalInserted += await this.bulkInsert(toInsert);
      }

      // Small delay between batches
      if (i + this.batchSize < newIds.length) {
        await new Promise((r) => setTimeout(r, MatchCrawler.BATCH_DELAY_MS));
      }
    }

    return totalInserted;
  }

  // ── Binary search for S3 floor ─────────────────────────────────

  private async findS3Floor(maxId: number): Promise<number> {
    let low = 1;
    let high = maxId;

    // Binary search with error tolerance — a failed fetch counts as "no data"
    // but we track failures to avoid infinite loops on network issues.
    let consecutiveFailures = 0;
    const MAX_BINARY_FAILURES = 10;

    while (high - low > 1000) {
      if (consecutiveFailures >= MAX_BINARY_FAILURES) {
        console.warn(`[MatchCrawler] Binary search aborted after ${MAX_BINARY_FAILURES} consecutive failures at low=${low} high=${high}`);
        break;
      }
      const mid = Math.floor((low + high) / 2);
      try {
        const exists = await this.dbClient.getFightData(String(mid));
        consecutiveFailures = 0;
        if (exists) {
          high = mid; // Data exists here, floor might be lower
        } else {
          low = mid; // No data here, floor is higher
        }
      } catch {
        consecutiveFailures++;
        // Treat fetch failure as "no data" — nudge low up
        low = mid;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return high;
  }

  // ── Range scan chunk ───────────────────────────────────────────

  /**
   * How often to save scan position (in IDs processed).
   * Keeps crash-recovery loss to ~SAVE_INTERVAL IDs max.
   */
  private static readonly SAVE_INTERVAL = 1000;
  /** Pause (ms) between concurrent batches to avoid S3 rate-limits. */
  private static readonly BATCH_DELAY_MS = 50;
  /** If this many errors accumulate in one sub-chunk without success, pause the chunk. */
  private static readonly ERROR_BUDGET = 50;

  private async rangeScanChunk(state: CrawlerState): Promise<number> {
    const start = state.scanPosition;
    const end = Math.min(start + this.chunkSize, state.scanCeiling);

    console.log(`[MatchCrawler] Range scan: ${start} → ${end} (ceiling=${state.scanCeiling})`);

    let totalInserted = 0;
    let totalHits = 0;
    let totalMisses = 0;
    let totalErrors = 0;

    // Process in sub-chunks, saving position after each
    for (let subStart = start; subStart < end; subStart += MatchCrawler.SAVE_INTERVAL) {
      const subEnd = Math.min(subStart + MatchCrawler.SAVE_INTERVAL, end);
      const result = await this.scanSubChunk(subStart, subEnd);

      totalInserted += result.inserted;
      totalHits += result.hits;
      totalMisses += result.misses;
      totalErrors += result.errors;

      // Save progress after each sub-chunk — crash-safe
      await this.updateState({ scanPosition: subEnd });

      // If too many errors in this sub-chunk, stop and let the next cycle retry
      if (result.errors > MatchCrawler.ERROR_BUDGET) {
        console.warn(
          `[MatchCrawler] Error budget exceeded in sub-chunk ${subStart}→${subEnd} ` +
          `(${result.errors} errors). Pausing scan — will resume next cycle.`,
        );
        break;
      }
    }

    console.log(
      `[MatchCrawler] Chunk ${start}→${state.scanPosition ?? end}: ` +
      `${totalHits} fights found, ${totalInserted} ranked stored, ` +
      `${totalMisses} empty IDs, ${totalErrors} fetch errors`,
    );

    return totalInserted;
  }

  /**
   * Scan a small range [start, end) of fight IDs, fetching from S3 in concurrent batches.
   * Returns metrics for the sub-chunk.
   */
  private async scanSubChunk(
    start: number,
    end: number,
  ): Promise<{ inserted: number; hits: number; misses: number; errors: number }> {
    let inserted = 0;
    let hits = 0;
    let misses = 0;
    let errors = 0;
    const toInsert: MatchInsert[] = [];

    for (let i = start; i < end; i += this.batchSize) {
      const batch = Array.from(
        { length: Math.min(this.batchSize, end - i) },
        (_, j) => i + j,
      );

      const results = await Promise.all(
        batch.map((id) =>
          this.dbClient.getFightData(String(id)).catch(() => {
            errors++;
            return null;
          }),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        if (!results[j]) {
          misses++;
          continue;
        }
        hits++;
        const processed = this.processFight(batch[j], results[j]!);
        if (processed) toInsert.push(processed);
      }

      // Flush periodically — keep batches small to avoid 413 body-too-large
      if (toInsert.length >= 10) {
        inserted += await this.bulkInsert(toInsert);
        toInsert.length = 0;
      }

      // Small delay between batches to stay under rate limits
      if (MatchCrawler.BATCH_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, MatchCrawler.BATCH_DELAY_MS));
      }
    }

    // Flush remainder
    if (toInsert.length > 0) {
      inserted += await this.bulkInsert(toInsert);
    }

    return { inserted, hits, misses, errors };
  }

  // ── Fight processing ───────────────────────────────────────────

  private processFight(fightId: number, fight: StatsFightData): MatchInsert | null {
    if (!fight.players || fight.players.length === 0) return null;

    // Detect whether the match is ranked (players with rating changes)
    const isRanked = fight.players.some(
      (p) =>
        p.oldRating !== undefined &&
        p.newRating !== undefined &&
        p.oldRating !== p.newRating,
    );

    const mapName = fight.mapId ? MAP_ID_TO_NAME[fight.mapId] ?? fight.mapName ?? null : fight.mapName ?? null;

    // Group players by team
    const teamPlayers = new Map<number, StatsFightPlayerData[]>();
    for (const player of fight.players) {
      const teamId = player.teamId ?? 0;
      const existing = teamPlayers.get(teamId);
      if (existing) existing.push(player);
      else teamPlayers.set(teamId, [player]);
    }

    // Determine winning team from ELO changes (most reliable).
    // Player who gained ELO → winning team. Player who lost ELO → losing team.
    let winningTeamId: number | null = null;

    for (const [teamId, players] of teamPlayers) {
      for (const p of players) {
        if (p.oldRating === undefined || p.newRating === undefined) continue;
        if (p.newRating > p.oldRating) {
          // This player gained ELO — their team won
          winningTeamId = teamId;
        } else if (p.newRating < p.oldRating) {
          // This player lost ELO — the OTHER team won
          // Find the other team ID
          for (const otherTeamId of teamPlayers.keys()) {
            if (otherTeamId !== teamId) {
              winningTeamId = otherTeamId;
              break;
            }
          }
        }
        if (winningTeamId !== null) break;
      }
      if (winningTeamId !== null) break;
    }

    // Fall back to winnerTeam field from S3 if ELO didn't resolve it
    if (winningTeamId === null && fight.winnerTeam !== undefined) {
      winningTeamId = fight.winnerTeam;
    }

    // Build team results
    const teams: MatchInsert['teams'] = [];
    for (const [teamId, players] of teamPlayers) {
      const factionName = this.inferFaction(players);
      const isWinner = winningTeamId !== null ? teamId === winningTeamId : false;
      const ratings = players
        .map((p) => p.oldRating)
        .filter((r): r is number => r !== undefined);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
      teams.push({ teamId, factionName, isWinner, avgRating });
    }

    // Build player picks
    const playerPicks: MatchInsert['playerPicks'] = [];
    for (const player of fight.players) {
      const factionName = this.inferFaction([player]);
      const topSpecs = this.inferPlayerSpecs(player);
      playerPicks.push({
        steamId: player.steamId,
        odId: player.id || undefined,
        teamId: player.teamId,
        spec1Id: topSpecs[0]?.id,
        spec1Name: topSpecs[0]?.name,
        spec2Id: topSpecs[1]?.id,
        spec2Name: topSpecs[1]?.name,
        factionName,
        oldRating: player.oldRating,
        newRating: player.newRating,
        destruction: player.destruction,
        losses: player.losses,
        damageDealt: player.damageDealt,
        damageReceived: player.damageReceived,
        objectivesCaptured: player.objectivesCaptured,
      });
    }

    // Build unit deployments — one row per unit per player
    const unitDeployments: MatchInsert['unitDeployments'] = [];
    for (const player of fight.players) {
      const eloBracket = getEloBracket(player.oldRating);
      const playerUnits = Array.isArray(player.units) ? player.units : [];
      if (playerUnits.length === 0) {
        // Diagnostic: log when a player has no units (helps debug missing deployments)
        const rawKeys = player.units === undefined ? 'undefined' : typeof player.units;
        console.warn(
          `[MatchCrawler] Fight ${fightId}: player ${player.id} has 0 units ` +
          `(units field is ${rawKeys}, keys on player: ${Object.keys(player).join(',')})`,
        );
      }
      for (const unit of playerUnits) {
        const unitData = this.indexes.unitsById.get(unit.id);
        const unitName = unitData?.HUDName ?? unitData?.Name ?? `Unit_${unit.id}`;
        const countryId = unitData?.CountryId;
        const country = countryId ? this.indexes.countriesById?.get(countryId) : undefined;
        const factionName = country?.Name ?? 'Unknown';

        const sortedOpts = [...(unit.optionIds ?? [])].sort((a, b) => a - b);
        const optionIdsStr = sortedOpts.join(',');
        const configKey = `${unit.id}:${optionIdsStr}`;

        unitDeployments.push({
          steamId: player.steamId,
          odId: player.id || undefined,
          unitId: unit.id,
          unitName,
          factionName,
          optionIds: optionIdsStr,
          configKey,
          playerRating: player.oldRating,
          eloBracket,
          killedCount: unit.killedCount ?? 0,
          totalDamageDealt: unit.totalDamageDealt ?? 0,
          totalDamageReceived: unit.totalDamageReceived ?? 0,
          supplyPointsConsumed: unit.supplyPointsConsumed ?? 0,
          wasRefunded: unit.wasRefunded ?? false,
        });
      }
    }

    if (unitDeployments.length === 0 && fight.players.length > 0) {
      console.warn(
        `[MatchCrawler] Fight ${fightId}: 0 unit deployments from ${fight.players.length} players! ` +
        `Sample player keys: ${Object.keys(fight.players[0]).join(',')}`,
      );
    }

    return {
      fightId,
      mapId: fight.mapId,
      mapName: mapName ?? undefined,
      isRanked,
      winnerTeam: fight.winnerTeam,
      playerCount: fight.players.length,
      totalPlayTimeSec: fight.totalPlayTimeSec,
      endTime: fight.endTime,
      rawFightData: fight,
      teams,
      playerPicks,
      unitDeployments,
    };
  }

  /** Determine majority faction from a list of players (team or individual). */
  private inferFaction(players: StatsFightPlayerData[]): string {
    const countryCounts = new Map<number, number>();
    for (const player of players) {
      for (const unit of (player.units ?? [])) {
        const ud = this.indexes.unitsById.get(unit.id);
        if (ud?.CountryId) {
          countryCounts.set(ud.CountryId, (countryCounts.get(ud.CountryId) ?? 0) + 1);
        }
      }
    }
    if (countryCounts.size === 0) return 'Unknown';
    const topCountryId = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return this.indexes.countriesById?.get(topCountryId)?.Name ?? 'Unknown';
  }

  /** Infer top 2 specs for a player from their deployed units. */
  private inferPlayerSpecs(player: StatsFightPlayerData): Array<{ id: number; name: string }> {
    const specMap = this.getUnitIdToSpecIds();
    const specScores = new Map<number, number>();
    for (const unit of (player.units ?? [])) {
      const specs = specMap.get(unit.id);
      if (specs) {
        for (const specId of specs) {
          specScores.set(specId, (specScores.get(specId) ?? 0) + 1);
        }
      }
    }
    return [...specScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => {
        const spec = this.indexes.specializationsById.get(id);
        return { id, name: spec?.Name || spec?.UIName || `Spec_${id}` };
      });
  }
}
