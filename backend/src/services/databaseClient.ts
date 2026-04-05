/**
 * DatabaseClient — lightweight HTTP client that calls the database
 * microservice REST API from the backend (GraphQL) layer.
 *
 * All methods correspond 1:1 to database service endpoints.
 */

import type {
  RawPublishedDeck,
  RawPublishedDeckSummary,
  PublishDeckInput,
  UpdatePublishedDeckInput,
  DeletePublishedDeckInput,
  BrowseDecksFilter,
  RawBrowseDecksResult,
  ToggleLikeResult,
  RecordViewResult,
  RegisterUserInput,
  RegisterUserResult,
  UserProfile,
  TrivialChallenge,
} from '@ba-hub/shared';

export class DatabaseClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.DATABASE_SERVICE_URL ?? 'http://localhost:3002';
  }

  // ── Internal fetch helper ──────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | string[] | undefined>,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DatabaseClient ${method} ${path} → ${res.status}: ${text}`);
    }

    // 204 No Content (e.g. delete)
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
  }

  // ── Challenges ─────────────────────────────────────────────

  async getChallenge(): Promise<TrivialChallenge> {
    return this.request('GET', '/api/challenges');
  }

  // ── Users ──────────────────────────────────────────────────

  async registerUser(input: RegisterUserInput): Promise<RegisterUserResult> {
    return this.request('POST', '/api/users/register', input);
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.request('GET', `/api/users/${userId}`);
  }

  // ── Decks — CRUD ──────────────────────────────────────────

  async publishDeck(input: PublishDeckInput): Promise<RawPublishedDeck> {
    return this.request('POST', '/api/decks', input);
  }

  async updateDeck(deckId: string, input: UpdatePublishedDeckInput & { authorId: string }): Promise<RawPublishedDeck> {
    return this.request('PUT', `/api/decks/${deckId}`, input);
  }

  async deleteDeck(deckId: string, input: DeletePublishedDeckInput): Promise<void> {
    return this.request('DELETE', `/api/decks/${deckId}`, input);
  }

  async getDeck(deckId: string): Promise<RawPublishedDeck> {
    return this.request('GET', `/api/decks/${deckId}`);
  }

  // ── Decks — Browse ────────────────────────────────────────

  async browseDecks(filter: BrowseDecksFilter): Promise<RawBrowseDecksResult> {
    const query: Record<string, string | number | string[] | undefined> = {
      countryId: filter.countryId,
      spec1Id: filter.spec1Id,
      spec2Id: filter.spec2Id,
      tags: filter.tags,
      search: filter.search,
      authorId: filter.authorId,
      sort: filter.sort,
      page: filter.page,
      pageSize: filter.pageSize,
    };
    return this.request('GET', '/api/decks', undefined, query);
  }

  async getDecksByAuthor(authorId: string): Promise<RawPublishedDeckSummary[]> {
    return this.request('GET', `/api/decks/author/${authorId}`);
  }

  // ── Social ────────────────────────────────────────────────

  async toggleLike(deckId: string, userId: string): Promise<ToggleLikeResult> {
    return this.request('POST', `/api/decks/${deckId}/like`, { userId });
  }

  async checkLikeStatus(deckId: string, userId: string): Promise<{ liked: boolean }> {
    return this.request('GET', `/api/decks/${deckId}/like`, undefined, { userId });
  }

  async recordView(deckId: string, viewerKey?: string): Promise<RecordViewResult> {
    return this.request('POST', `/api/decks/${deckId}/view`, { viewerKey });
  }

  // ── Snapshot data (read) ──────────────────────────────────

  async getLeaderboardHistory(steamId: string, since?: string): Promise<LeaderboardHistoryEntry[]> {
    return this.request('GET', '/api/snapshots/leaderboard-history', undefined, { steamId, since });
  }

  // ── Crawler state ─────────────────────────────────────────

  async getCrawlerState(): Promise<CrawlerStateResult> {
    return this.request('GET', '/api/crawler/state');
  }

  // ── Rolling aggregation data (from raw match data) ────────

  async getRollingFactionStats(since?: string, eloBracket?: string): Promise<RollingFactionStatsResult> {
    return this.request('GET', '/api/crawler/matches/faction-stats', undefined, { since, eloBracket });
  }

  async getRollingMapStats(since?: string, eloBracket?: string): Promise<RollingMapStatsResult> {
    return this.request('GET', '/api/crawler/matches/map-stats', undefined, { since, eloBracket });
  }

  async getRollingSpecStats(since?: string, eloBracket?: string): Promise<RollingSpecStatsResult> {
    return this.request('GET', '/api/crawler/matches/spec-stats', undefined, { since, eloBracket });
  }

  async getUnitPerformanceRolling(since?: string, eloBracket?: string, faction?: string, limit?: number): Promise<UnitPerformanceRollingResult> {
    return this.request('GET', '/api/crawler/matches/unit-performance', undefined, { since, eloBracket, faction, limit });
  }

  async getSpecCombos(since?: string, limit?: number): Promise<SpecComboResult> {
    return this.request('GET', '/api/crawler/matches/spec-combos', undefined, { since, limit });
  }

  // ── Player match history (aggregated from crawled data) ───

  async getPlayerMatchHistory(
    steamId?: string,
    odId?: number,
    limit?: number,
  ): Promise<PlayerMatchHistoryResult> {
    return this.request('GET', '/api/crawler/matches/by-player', undefined, {
      steamId,
      odId,
      limit,
    });
  }

  // ── Stats proxy (external game API via database service) ──

  async getMapRatings(): Promise<StatsStatItem[]> {
    return this.request('GET', '/api/stats/map-ratings');
  }

  async getMapTeamSides(): Promise<StatsMapTeamSides> {
    return this.request('GET', '/api/stats/map-team-sides');
  }

  async getSpecUsage(): Promise<StatsStatItem[]> {
    return this.request('GET', '/api/stats/spec-usage');
  }

  async getCountryStats(): Promise<StatsCountryStats> {
    return this.request('GET', '/api/stats/country-stats');
  }

  async getLeaderboard(start: number, end: number): Promise<StatsLeaderboardEntry[]> {
    return this.request('GET', '/api/stats/leaderboard', undefined, { start, end });
  }

  async getUserById(
    id: string,
    opts?: { steam?: boolean; market?: boolean },
  ): Promise<StatsRestUserInfo | null> {
    return this.request('GET', `/api/stats/user/${encodeURIComponent(id)}`, undefined, {
      steam: opts?.steam ? 'true' : undefined,
      market: opts?.market ? 'true' : undefined,
    });
  }

  async getUsersByIds(ids: number[]): Promise<Map<number, StatsRestUserInfo>> {
    const obj = await this.request<Record<string, StatsRestUserInfo>>(
      'POST', '/api/stats/users-by-ids', { ids },
    );
    const map = new Map<number, StatsRestUserInfo>();
    for (const [k, v] of Object.entries(obj)) {
      map.set(Number(k), v);
    }
    return map;
  }

  async getPlayerStats(marketId: string): Promise<StatsPlayerStats | null> {
    return this.request('GET', `/api/stats/player-stats/${encodeURIComponent(marketId)}`);
  }

  async getPlayerStatsBatch(marketIds: string[]): Promise<Map<string, StatsPlayerStats | null>> {
    const obj = await this.request<Record<string, StatsPlayerStats | null>>(
      'POST', '/api/stats/player-stats-batch', { marketIds },
    );
    const map = new Map<string, StatsPlayerStats | null>();
    for (const [k, v] of Object.entries(obj)) {
      map.set(k, v);
    }
    return map;
  }

  async getRecentFightIds(userId: number): Promise<number[]> {
    return this.request('GET', `/api/stats/recent-fights/${userId}`);
  }

  async getFightData(fightId: string | number): Promise<StatsFightData | null> {
    return this.request('GET', `/api/stats/fight/${fightId}`);
  }
}

// ── Snapshot result types ──────────────────────────────────

export interface LeaderboardHistoryEntry {
  rank: number;
  rating: number | null;
  elo: number | null;
  winRate: number | null;
  kdRatio: number | null;
  snapshotType: string;
  createdAt: string;
}

export interface CrawlerStateResult {
  scanFloor: number;
  scanCeiling: number;
  scanPosition: number;
  initialCollectionDone: boolean;
  updatedAt: string | null;
}

// ── Rolling aggregation result types ───────────────────

export interface RollingFactionStatsRow {
  factionName: string;
  matchCount: number;
  winCount: number;
}

export interface RollingFactionStatsResult {
  rows: RollingFactionStatsRow[];
  since: string;
}

export interface RollingMapStatsRow {
  mapName: string;
  playCount: number;
}

export interface RollingMapStatsResult {
  rows: RollingMapStatsRow[];
  since: string;
}

export interface RollingSpecStatsRow {
  specName: string;
  specId: number | null;
  pickCount: number;
}

export interface RollingSpecStatsResult {
  rows: RollingSpecStatsRow[];
  since: string;
}

export interface SpecComboEntry {
  spec1: string;
  spec2: string;
  faction: string;
  pickCount: number;
}

export interface SpecComboResult {
  rows: SpecComboEntry[];
  since: string;
}

export interface UnitPerformanceEntry {
  configKey: string;
  unitId: number | null;
  unitName: string;
  factionName: string;
  optionIds: string;
  eloBracket: string;
  deployCount: number;
  totalKills: number;
  avgKills: number;
  totalDamageDealt: number;
  avgDamage: number;
  totalDamageReceived: number;
  totalSupplyConsumed: number;
  refundCount: number;
}

export interface UnitPerformanceRollingResult {
  rows: UnitPerformanceEntry[];
  since: string;
}



// ── Player match history types ─────────────────────────────

export interface PlayerMatchRow {
  fightId: number;
  mapId: number | null;
  mapName: string | null;
  isRanked: boolean;
  winnerTeam: number | null;
  playerCount: number;
  totalPlayTimeSec: number | null;
  endTime: number | null;
  // Player's own data from match_player_picks
  playerTeamId: number | null;
  playerFaction: string;
  spec1Name: string | null;
  spec1Id: number | null;
  spec2Name: string | null;
  spec2Id: number | null;
  oldRating: number | null;
  newRating: number | null;
  destruction: number | null;
  playerLosses: number | null;
  damageDealt: number | null;
  damageReceived: number | null;
  objectivesCaptured: number | null;
}

export interface PlayerMatchTeamRow {
  fightId: number;
  teamId: number;
  factionName: string;
  isWinner: boolean;
  avgRating: number | null;
}

export interface PlayerMatchUnitRow {
  fightId: number;
  unitId: number;
  unitName: string;
  factionName: string;
  optionIds: string;
  configKey: string;
  killedCount: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  supplyPointsConsumed: number;
  wasRefunded: boolean;
}

export interface PlayerMatchOtherPlayer {
  fightId: number;
  odId: number | null;
  steamId: string | null;
  teamId: number | null;
  factionName: string;
  spec1Name: string | null;
  spec2Name: string | null;
}

export interface PlayerMatchHistoryResult {
  matches: PlayerMatchRow[];
  teams: PlayerMatchTeamRow[];
  units: PlayerMatchUnitRow[];
  otherPlayers: PlayerMatchOtherPlayer[];
}

// ── Stats proxy types (mirror external game API shapes) ─────

export interface StatsStatItem {
  id?: number;
  name?: string;
  count?: number;
}

export interface StatsMapTeamSide {
  map?: string;
  winData?: StatsStatItem[];
}

export interface StatsMapTeamSides {
  updateDate?: string;
  data?: StatsMapTeamSide[];
}

export interface StatsLeaderboardEntry {
  rank: number;
  userId?: number;
  steamId?: string;
  name?: string;
  rating?: number;
  elo?: number;
  level?: number;
  winRate?: number;
  kdRatio?: number;
}

export interface StatsPlayerStats {
  marketId: string;
  name?: string;
  level?: number;
  kdRatio?: number;
  fightsCount?: number;
  winsCount?: number;
  losesCount?: number;
  killsCount?: number;
  deathsCount?: number;
  totalMatchTimeSec?: number;
  capturedZonesCount?: number;
  supplyPointsConsumed?: number;
  supplyCapturedCount?: number;
  supplyCapturedByEnemyCount?: number;
  mapsPlayCount: StatsStatItem[];
}

export interface StatsCountryStats {
  updateDate?: string;
  matchesCount: StatsStatItem[];
  winsCount: StatsStatItem[];
}

export interface StatsFightUnitData {
  id: number;
  optionIds: number[];
  killedCount?: number;
  totalDamageDealt?: number;
  totalDamageReceived?: number;
  supplyPointsConsumed?: number;
  wasRefunded?: boolean;
}

export interface StatsFightPlayerData {
  id: number;
  teamId?: number;
  name?: string;
  steamId?: string;
  destruction?: number;
  losses?: number;
  oldRating?: number;
  newRating?: number;
  damageDealt?: number;
  damageReceived?: number;
  objectivesCaptured?: number;
  totalSpawnedUnitScore?: number;
  totalRefundedUnitScore?: number;
  supplyPointsConsumed?: number;
  destructionScore?: number;
  lossesScore?: number;
  supplyConsumedByAllies?: number;
  supplyConsumedFromAllies?: number;
  dlRatio?: number;
  medals?: number[];
  units: StatsFightUnitData[];
}

export interface StatsFightData {
  fightId: string;
  mapId?: number;
  mapName?: string;
  totalPlayTimeSec?: number;
  endTime?: number;
  victoryLevel?: number;
  endMatchReason?: number;
  totalObjectiveZonesCount?: number;
  winnerTeam?: number;
  players: StatsFightPlayerData[];
}

export interface StatsRestUserInfo {
  id: number;
  name?: string;
  steamId?: string;
  level?: number;
  rating?: number;
  rank?: number;
  marketId?: string;
  ratedGames?: number;
}
