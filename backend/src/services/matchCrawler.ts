import type { StatsClient, FightData, FightPlayerData } from './statsClient.js';
import type { StaticData } from '../data/loader.js';
import type { StaticIndexes } from '../data/indexes.js';

/**
 * MapId (numeric, from fight JSON) → human-readable map name.
 * Shared constant also used by resolvers.
 */
export const MAP_ID_TO_NAME: Record<number, string> = {
  1: 'Test_map',
  3: 'Baltiisk',
  4: 'Coast',
  5: 'Airport',
  6: 'River',
  7: 'Dam',
  8: 'Tallinn Harbour',
  9: 'Airbase',
  10: 'Frontiers',
  11: 'Central Village',
  12: 'Oil refinery',
  13: 'Suwalki',
  14: 'Jelgava',
  15: 'Narva',
  16: 'Klaipeda',
  17: 'Ruda',
  20: 'Parnu',
  21: 'Chernyakhovsk',
  22: 'Ignalina Powerplant',
  23: 'Kaliningrad',
  25: 'Kadaga Military Base',
};

// ── Types ────────────────────────────────────────────────────────

interface CrawlerConfig {
  statsClient: StatsClient;
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
  teams: Array<{
    teamId: number;
    factionName: string;
    isWinner: boolean;
    avgRating?: number;
  }>;
  playerPicks: Array<{
    steamId?: string;
    spec1Id?: number;
    spec1Name?: string;
    spec2Id?: number;
    spec2Name?: string;
    factionName: string;
  }>;
  unitDeployments: Array<{
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

export interface CrawlerAggregates {
  crawlerFactionStats: Array<{ factionName: string; matchCount: number; winCount: number }>;
  specStats: Array<{ specName: string; specId?: number; pickCount: number }>;
  mapPopularity: Array<{ mapName: string; playCount: number }>;
  unitPerformance: Array<{
    configKey: string;
    unitId?: number;
    unitName: string;
    factionName: string;
    optionIds: string;
    eloBracket: string;
    deployCount: number;
    totalKills: number;
    totalDamageDealt: number;
    totalDamageReceived: number;
    totalSupplyConsumed: number;
    refundCount: number;
  }>;
}

/** Derive ELO bracket from a player's rating. Buckets per 500. */
function getEloBracket(rating?: number): string {
  if (rating === undefined || rating === null) return 'unranked';
  const bucket = Math.floor(rating / 500) * 500;
  return `${bucket}-${bucket + 500}`;
}

// ── MatchCrawler ─────────────────────────────────────────────────

export class MatchCrawler {
  private statsClient: StatsClient;
  private dbUrl: string;
  private indexes: StaticIndexes;
  private data: StaticData;
  private batchSize: number;
  private playerCount: number;
  private chunkSize: number;

  /** Reverse index: unitId → Set<specId> (built once on first use). */
  private unitIdToSpecIds: Map<number, Set<number>> | null = null;

  constructor(config: CrawlerConfig) {
    this.statsClient = config.statsClient;
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
    try {
      const res = await fetch(`${this.dbUrl}/api/crawler/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matches),
      });
      if (!res.ok) return 0;
      const result = (await res.json()) as { inserted: number; skipped: number };
      return result.inserted ?? 0;
    } catch {
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
      const leaderboard = await this.statsClient.getLeaderboard(0, 100);
      const playerIds = leaderboard
        .filter((e) => e.userId)
        .slice(0, this.playerCount)
        .map((e) => e.userId!);

      // Fetch fight IDs in batches of 5 players
      for (let i = 0; i < playerIds.length; i += 5) {
        const batch = playerIds.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((userId) =>
            this.statsClient.getRecentFightIds(userId).catch(() => [] as string[]),
          ),
        );
        for (const ids of results) {
          for (const id of ids) {
            const num = parseInt(id, 10);
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
        batch.map((id) => this.statsClient.getFightData(String(id)).catch(() => null)),
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
    }

    return totalInserted;
  }

  // ── Binary search for S3 floor ─────────────────────────────────

  private async findS3Floor(maxId: number): Promise<number> {
    let low = 1;
    let high = maxId;

    while (high - low > 1000) {
      const mid = Math.floor((low + high) / 2);
      const exists = await this.statsClient.getFightData(String(mid)).catch(() => null);
      if (exists) {
        high = mid; // Data exists here, floor might be lower
      } else {
        low = mid; // No data here, floor is higher
      }
    }

    return high;
  }

  // ── Range scan chunk ───────────────────────────────────────────

  private async rangeScanChunk(state: CrawlerState): Promise<number> {
    const start = state.scanPosition;
    const end = Math.min(start + this.chunkSize, state.scanCeiling);

    console.log(`[MatchCrawler] Range scan: ${start} → ${end} (ceiling=${state.scanCeiling})`);

    let totalInserted = 0;
    let s3Hits = 0;
    let s3Misses = 0;
    let unrankedSkips = 0;
    const toInsert: MatchInsert[] = [];

    // Scan in batches — just fetch from S3, let ON CONFLICT handle dupes
    for (let i = start; i < end; i += this.batchSize) {
      const batch = Array.from(
        { length: Math.min(this.batchSize, end - i) },
        (_, j) => i + j,
      );

      const results = await Promise.all(
        batch.map((id) => this.statsClient.getFightData(String(id)).catch(() => null)),
      );

      for (let j = 0; j < results.length; j++) {
        if (!results[j]) {
          s3Misses++;
          continue;
        }
        s3Hits++;
        const processed = this.processFight(batch[j], results[j]!);
        if (processed) {
          toInsert.push(processed);
        } else {
          unrankedSkips++;
        }
      }

      // Bulk insert periodically (ON CONFLICT DO NOTHING handles dupes)
      if (toInsert.length >= 50) {
        totalInserted += await this.bulkInsert(toInsert);
        toInsert.length = 0;
      }
    }

    if (toInsert.length > 0) {
      totalInserted += await this.bulkInsert(toInsert);
    }

    await this.updateState({ scanPosition: end });
    console.log(
      `[MatchCrawler] Chunk ${start}→${end}: ` +
      `${s3Hits} fights found, ${unrankedSkips} unranked skipped, ${totalInserted} ranked stored, ${s3Misses} empty IDs`,
    );

    return totalInserted;
  }

  // ── Fight processing ───────────────────────────────────────────

  private processFight(fightId: number, fight: FightData): MatchInsert | null {
    if (!fight.players || fight.players.length === 0) return null;

    // Only process ranked matches (players with rating changes)
    const isRanked = fight.players.some(
      (p) =>
        p.oldRating !== undefined &&
        p.newRating !== undefined &&
        p.oldRating !== p.newRating,
    );

    // Skip unranked matches entirely — no value in storing them
    if (!isRanked) return null;

    const mapName = fight.mapId ? MAP_ID_TO_NAME[fight.mapId] ?? fight.mapName ?? null : fight.mapName ?? null;

    // Group players by team
    const teamPlayers = new Map<number, FightPlayerData[]>();
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
      const factionName = this.inferPlayerFaction(player);
      const topSpecs = this.inferPlayerSpecs(player);
      playerPicks.push({
        steamId: player.steamId,
        spec1Id: topSpecs[0]?.id,
        spec1Name: topSpecs[0]?.name,
        spec2Id: topSpecs[1]?.id,
        spec2Name: topSpecs[1]?.name,
        factionName,
      });
    }

    // Build unit deployments — one row per unit per player
    const unitDeployments: MatchInsert['unitDeployments'] = [];
    for (const player of fight.players) {
      const eloBracket = getEloBracket(player.oldRating);
      for (const unit of player.units) {
        const unitData = this.indexes.unitsById.get(unit.id);
        const unitName = unitData?.HUDName ?? unitData?.Name ?? `Unit_${unit.id}`;
        const countryId = unitData?.CountryId;
        const country = countryId ? this.indexes.countriesById?.get(countryId) : undefined;
        const factionName = country?.Name ?? 'Unknown';

        const sortedOpts = [...unit.optionIds].sort((a, b) => a - b);
        const optionIdsStr = sortedOpts.join(',');
        const configKey = `${unit.id}:${optionIdsStr}`;

        unitDeployments.push({
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

    return {
      fightId,
      mapId: fight.mapId,
      mapName: mapName ?? undefined,
      isRanked,
      winnerTeam: fight.winnerTeam,
      playerCount: fight.players.length,
      totalPlayTimeSec: fight.totalPlayTimeSec,
      endTime: fight.endTime,
      teams,
      playerPicks,
      unitDeployments,
    };
  }

  /** Determine majority faction for a group of players (team). */
  private inferFaction(players: FightPlayerData[]): string {
    const countryCounts = new Map<number, number>();
    for (const player of players) {
      for (const unit of player.units) {
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

  /** Determine faction for a single player. */
  private inferPlayerFaction(player: FightPlayerData): string {
    const countryCounts = new Map<number, number>();
    for (const unit of player.units) {
      const ud = this.indexes.unitsById.get(unit.id);
      if (ud?.CountryId) {
        countryCounts.set(ud.CountryId, (countryCounts.get(ud.CountryId) ?? 0) + 1);
      }
    }
    if (countryCounts.size === 0) return 'Unknown';
    const topCountryId = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return this.indexes.countriesById?.get(topCountryId)?.Name ?? 'Unknown';
  }

  /** Infer top 2 specs for a player from their deployed units. */
  private inferPlayerSpecs(player: FightPlayerData): Array<{ id: number; name: string }> {
    const specMap = this.getUnitIdToSpecIds();
    const specScores = new Map<number, number>();
    for (const unit of player.units) {
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

  // ── Aggregation ────────────────────────────────────────────────

  async computeAggregates(snapshotType: 'hourly' | 'daily'): Promise<CrawlerAggregates | null> {
    const now = Date.now();
    const window = snapshotType === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = new Date(now - window).toISOString();
    const until = new Date(now).toISOString();

    try {
      const res = await fetch(
        `${this.dbUrl}/api/crawler/matches/aggregates?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
      );
      if (!res.ok) return null;

      const data = (await res.json()) as {
        factionWinRates: Array<{ factionName: string; matchCount: number; winCount: number }>;
        specPopularity: Array<{ specName: string; specId?: number; pickCount: number }>;
        mapPopularity: Array<{ mapName: string; playCount: number }>;
        unitPerformance: CrawlerAggregates['unitPerformance'];
      };

      return {
        crawlerFactionStats: data.factionWinRates,
        specStats: data.specPopularity,
        mapPopularity: data.mapPopularity,
        unitPerformance: data.unitPerformance,
      };
    } catch (err) {
      console.error(`[MatchCrawler] Failed to compute ${snapshotType} aggregates:`, err);
      return null;
    }
  }
}
