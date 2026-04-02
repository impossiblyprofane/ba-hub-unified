type StatItem = {
  id?: number;
  name?: string;
  count?: number;
};

type MapTeamSide = {
  map?: string;
  winData?: StatItem[];
};

type MapTeamSides = {
  updateDate?: string;
  data?: MapTeamSide[];
};

type LeaderboardEntry = {
  rank: number;
  userId?: number;
  steamId?: string;
  name?: string;
  rating?: number;
  elo?: number;
  level?: number;
  winRate?: number;
  kdRatio?: number;
};

type PlayerStats = {
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
  mapsPlayCount: StatItem[];
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const normalizeStatItem = (value: unknown): StatItem | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const count = toNumber(item.count);
  return {
    id: toNumber(item.id),
    name: toString(item.name),
    count,
  };
};

const normalizeStatItems = (value: unknown): StatItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeStatItem)
    .filter((item): item is StatItem => item !== null);
};

/**
 * Unwrap { value: [...] } or { data: [...] } wrappers returned by various
 * analytics endpoints, then normalize to StatItem[].
 */
const unwrapStatItems = (payload: unknown): StatItem[] => {
  if (Array.isArray(payload)) return normalizeStatItems(payload);
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.value)) return normalizeStatItems(obj.value);
    if (Array.isArray(obj.data)) return normalizeStatItems(obj.data);
  }
  return [];
};

/** Unwrap { value: [...] } or return raw array. */
const unwrapArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.value)) return obj.value;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
};

type CountryStats = {
  updateDate?: string;
  matchesCount: StatItem[];
  winsCount: StatItem[];
};

type FightUnitData = {
  id: number;
  optionIds: number[];
  killedCount?: number;
  totalDamageDealt?: number;
  totalDamageReceived?: number;
  supplyPointsConsumed?: number;
  wasRefunded?: boolean;
};

type FightPlayerData = {
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
  units: FightUnitData[];
};

type FightData = {
  fightId: string;
  mapId?: number;
  mapName?: string;
  totalPlayTimeSec?: number;
  endTime?: number;
  victoryLevel?: number;
  endMatchReason?: number;
  totalObjectiveZonesCount?: number;
  winnerTeam?: number;
  players: FightPlayerData[];
};

type RestUserInfo = {
  id: number;
  name?: string;
  steamId?: string;
  level?: number;
  rating?: number;
  rank?: number;
  marketId?: string;
  ratedGames?: number;
};

export class StatsClient {
  private readonly headers: Record<string, string>;

  constructor(
    private readonly baseUrl: string,
    partnerToken?: string,
  ) {
    this.headers = { Accept: 'application/json' };
    if (partnerToken) {
      this.headers.partnerToken = partnerToken;
    }
  }

  private async fetchJson(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`Stats API request failed (${response.status}) for ${path}`);
    }
    return response.json() as Promise<unknown>;
  }

  private async fetchWithFallback(paths: string[]): Promise<unknown> {
    let lastError: unknown;
    for (const path of paths) {
      try {
        return await this.fetchJson(path);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Stats API request failed with unknown error');
  }

  async getMapRatings(): Promise<StatItem[]> {
    const payload = await this.fetchWithFallback([
      '/statistic/mapsrating',
      '/statistic/mapdata',
    ]);

    return unwrapStatItems(payload);
  }

  async getSpecUsage(): Promise<StatItem[]> {
    const payload = await this.fetchWithFallback([
      '/statistic/matches/specs',
      '/statistic/specs',
    ]);

    return unwrapStatItems(payload);
  }

  async getMapTeamSides(): Promise<MapTeamSides> {
    const payload = await this.fetchWithFallback([
      '/statistic/matches/teamsides',
      '/statistic/mapdata',
    ]);

    if (!payload || typeof payload !== 'object') {
      return { updateDate: undefined, data: [] };
    }

    const obj = payload as Record<string, unknown>;
    const entries = Array.isArray(obj.data) ? obj.data : [];
    const data = entries
      .map((entry): MapTeamSide | null => {
        if (!entry || typeof entry !== 'object') return null;
        const mapObj = entry as Record<string, unknown>;
        return {
          map: toString(mapObj.map),
          winData: normalizeStatItems(mapObj.winData),
        };
      })
      .filter((entry): entry is MapTeamSide => entry !== null);

    return {
      updateDate: toString(obj.updateDate),
      data,
    };
  }

  async getLeaderboard(start: number, end: number): Promise<LeaderboardEntry[]> {
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart + 1, end);
    const count = safeEnd - safeStart;

    const payload = await this.fetchWithFallback([
      `/statistic/topshort/${safeStart}/${safeEnd}`,
      `/statistic/leaderboard/${count}`,
      `/statistic/getRatingLeaderboard?limit=${count}&offset=${safeStart}`,
    ]);

    // topshort wraps in { value: [...], Count: N }
    const entries = unwrapArray(payload);

    return entries.map((entry, index): LeaderboardEntry => {
      const item = entry && typeof entry === 'object'
        ? entry as Record<string, unknown>
        : {};

      return {
        rank: toNumber(item.rank) ?? (safeStart + index + 1),
        userId: toNumber(item.userId) ?? toNumber(item.id),
        steamId: toString(item.steamId),
        name: toString(item.userName) ?? toString(item.name) ?? toString(item.username),
        rating: toNumber(item.rating),
        elo: toNumber(item.elo),
        level: toNumber(item.level),
        winRate: toNumber(item.winRate),
        kdRatio: toNumber(item.kdRatio),
      };
    });
  }

  /**
   * Batch-resolve user IDs to user info objects.
   * Uses GET /user?ids=1,2,3 — returns { value: [...], Count }.
   */
  async getUsersByIds(ids: number[]): Promise<Map<number, RestUserInfo>> {
    const result = new Map<number, RestUserInfo>();
    if (ids.length === 0) return result;

    // External API rejects large batch requests (403 over ~20 IDs).
    // Chunk into batches of 20 and resolve in parallel.
    const BATCH_SIZE = 20;
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      chunks.push(ids.slice(i, i + BATCH_SIZE));
    }

    const parseEntries = (payload: unknown) => {
      const entries = unwrapArray(payload);
      for (const raw of entries) {
        if (!raw || typeof raw !== 'object') continue;
        const obj = raw as Record<string, unknown>;
        const id = toNumber(obj.id);
        if (id == null) continue;
        result.set(id, {
          id,
          name: toString(obj.name),
          steamId: toString(obj.steamId),
          level: toNumber(obj.lvl) ?? toNumber(obj.level),
          rating: toNumber(obj.rt) ?? toNumber(obj.rating),
          rank: toNumber(obj.rk) ?? toNumber(obj.rank),
          marketId: toString(obj.marketId),
          ratedGames: toNumber(obj.rtgms),
        });
      }
    };

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const idsParam = chunk.join(',');
          const payload = await this.fetchJson(`/user?ids=${idsParam}`);
          parseEntries(payload);
        } catch {
          // Non-critical — leaderboard still works without names for this chunk
        }
      })
    );

    return result;
  }

  async getPlayerStats(marketId: string): Promise<PlayerStats | null> {
    const payload = await this.fetchWithFallback([
      `/statistic/personal/${encodeURIComponent(marketId)}`,
      `/statistic/individualPlayerStats/${encodeURIComponent(marketId)}`,
    ]);

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const obj = payload as Record<string, unknown>;
    const lobbyContainer = obj.statisticByLobbyType;
    const lobbyStats = lobbyContainer && typeof lobbyContainer === 'object'
      ? (lobbyContainer as Record<string, unknown>).Rating as Record<string, unknown> | undefined
      : undefined;

    const mapsContainer = obj.mapsPlayCount;
    const mapsPlayCount = mapsContainer && typeof mapsContainer === 'object'
      ? normalizeStatItems((mapsContainer as Record<string, unknown>).data)
      : [];

    return {
      marketId,
      name: toString(obj.name),
      level: toNumber(obj.level),
      kdRatio: lobbyStats ? toNumber(lobbyStats.kdRatio) : undefined,
      fightsCount: lobbyStats ? toNumber(lobbyStats.fightsCount) : undefined,
      winsCount: lobbyStats ? toNumber(lobbyStats.winsCount) : undefined,
      losesCount: lobbyStats ? toNumber(lobbyStats.losesCount) : undefined,
      killsCount: lobbyStats ? toNumber(lobbyStats.killsCount) : undefined,
      deathsCount: lobbyStats ? toNumber(lobbyStats.deathsCount) : undefined,
      totalMatchTimeSec: lobbyStats ? toNumber(lobbyStats.totalMatchTimeSec) : undefined,
      capturedZonesCount: toNumber(obj.capturedZonesCount),
      supplyPointsConsumed: toNumber(obj.supplyPointsConsumed),
      supplyCapturedCount: toNumber(obj.supplyCapturedCount),
      supplyCapturedByEnemyCount: toNumber(obj.supplyCapturedByEnemyCount),
      mapsPlayCount,
    };
  }

  /**
   * Look up a single user by internal ID, Steam ID, or market ID.
   * GET /user/{id}  — internal ID
   * GET /user/{steamId}?steam=true
   * GET /user/{marketId}?market=true
   */
  async getUserById(
    id: string | number,
    opts?: { steam?: boolean; market?: boolean },
  ): Promise<RestUserInfo | null> {
    let path = `/user/${encodeURIComponent(id)}`;
    if (opts?.steam) path += '?steam=true';
    else if (opts?.market) path += '?market=true';

    try {
      const payload = await this.fetchJson(path);
      if (!payload || typeof payload !== 'object') return null;
      const obj = payload as Record<string, unknown>;
      const resolvedId = toNumber(obj.id);
      if (resolvedId == null) return null;
      return {
        id: resolvedId,
        name: toString(obj.name),
        steamId: toString(obj.steamId),
        level: toNumber(obj.lvl) ?? toNumber(obj.level),
        rating: toNumber(obj.rt) ?? toNumber(obj.rating),
        rank: toNumber(obj.rk) ?? toNumber(obj.rank),
        marketId: toString(obj.marketId),
        ratedGames: toNumber(obj.rtgms),
      };
    } catch {
      return null;
    }
  }

  /**
   * Country-level match & win counts.
   * GET /statistic/matches/countries
   */
  async getCountryStats(): Promise<CountryStats> {
    const payload = await this.fetchWithFallback([
      '/statistic/matches/countries',
    ]);

    if (!payload || typeof payload !== 'object') {
      return { matchesCount: [], winsCount: [] };
    }

    const obj = payload as Record<string, unknown>;
    return {
      updateDate: toString(obj.updateDate),
      matchesCount: normalizeStatItems(obj.matchesCount),
      winsCount: normalizeStatItems(obj.winsCount),
    };
  }

  /**
   * Get recent fight IDs for a user.
   * GET /user/{userId}/last_fights → string[]
   */
  async getRecentFightIds(userId: number): Promise<string[]> {
    const payload = await this.fetchJson(`/user/${userId}/last_fights`);
    if (!Array.isArray(payload)) return [];
    return payload.map(String);
  }

  /**
   * Fetch fight (match) data from S3.
   * https://s3.brokenarrowgame.tech/fights/fight_{id}.json
   */
  async getFightData(fightId: string): Promise<FightData | null> {
    const S3_BASE = 'https://s3.brokenarrowgame.tech';
    try {
      const response = await fetch(
        `${S3_BASE}/fights/fight_${encodeURIComponent(fightId)}.json`,
        { headers: this.headers },
      );
      if (!response.ok) return null;
      const raw = (await response.json()) as Record<string, unknown>;

      // Parse players from Data dict
      const dataObj = (raw.Data ?? raw.data) as Record<string, unknown> | undefined;
      const players: FightPlayerData[] = [];

      if (dataObj && typeof dataObj === 'object') {
        for (const value of Object.values(dataObj)) {
          if (!value || typeof value !== 'object') continue;
          const p = value as Record<string, unknown>;

          // Parse units
          const unitDataObj = p.UnitData as Record<string, unknown> | undefined;
          const units: FightUnitData[] = [];
          if (unitDataObj && typeof unitDataObj === 'object') {
            for (const uv of Object.values(unitDataObj)) {
              if (!uv || typeof uv !== 'object') continue;
              const u = uv as Record<string, unknown>;
              units.push({
                id: toNumber(u.Id) ?? 0,
                optionIds: Array.isArray(u.OptionIds) ? u.OptionIds.map(Number).filter(Number.isFinite) : [],
                killedCount: toNumber(u.KilledCount),
                totalDamageDealt: toNumber(u.TotalDamageDealt),
                totalDamageReceived: toNumber(u.TotalDamageReceived),
                supplyPointsConsumed: toNumber(u.SupplyPointsConsumed),
                wasRefunded: typeof u.WasRefunded === 'boolean' ? u.WasRefunded : undefined,
              });
            }
          }

          players.push({
            id: toNumber(p.Id) ?? 0,
            teamId: toNumber(p.TeamId),
            name: toString(p.Name),
            destruction: toNumber(p.Destruction),
            losses: toNumber(p.Losses),
            oldRating: toNumber(p.OldRating),
            newRating: toNumber(p.NewRating),
            damageDealt: toNumber(p.DamageDealt),
            damageReceived: toNumber(p.DamageReceived),
            objectivesCaptured: toNumber(p.ObjectivesCaptured),
            totalSpawnedUnitScore: toNumber(p.TotalSpawnedUnitScore),
            totalRefundedUnitScore: toNumber(p.TotalRefundedUnitScore),
            supplyPointsConsumed: toNumber(p.SupplyPointsConsumed),
            destructionScore: toNumber(p.DestructionScore),
            lossesScore: toNumber(p.LossesScore),
            supplyConsumedByAllies: toNumber(p.SupplyPointsConsumedByAllies),
            supplyConsumedFromAllies: toNumber(p.SupplyPointsConsumedFromAllies),
            dlRatio: toNumber(p.DLRatio),
            medals: Array.isArray(p.Medals) ? p.Medals.map(Number).filter(Number.isFinite) : undefined,
            units,
          });
        }
      }

      return {
        fightId,
        mapId: toNumber(raw.MapId),
        totalPlayTimeSec: toNumber(raw.TotalPlayTimeInSec),
        endTime: toNumber(raw.EndTime),
        victoryLevel: toNumber(raw.VictoryLevel),
        endMatchReason: toNumber(raw.EndMatchReason),
        totalObjectiveZonesCount: toNumber(raw.TotalObjectiveZonesCount),
        winnerTeam: toNumber(raw.WinnerTeam),
        players,
      };
    } catch {
      return null;
    }
  }
}

export type {
  StatItem,
  MapTeamSide,
  MapTeamSides,
  LeaderboardEntry,
  PlayerStats,
  RestUserInfo,
  CountryStats,
  FightData,
  FightPlayerData,
  FightUnitData,
};