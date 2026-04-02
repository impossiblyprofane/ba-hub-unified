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

  async getMapHistory(since?: string): Promise<MapHistoryEntry[]> {
    return this.request('GET', '/api/snapshots/map-history', undefined, { since });
  }

  async getFactionHistory(since?: string): Promise<FactionHistoryEntry[]> {
    return this.request('GET', '/api/snapshots/faction-history', undefined, { since });
  }

  async getUnitRankings(limit?: number): Promise<UnitRankingsResult> {
    return this.request('GET', '/api/snapshots/unit-rankings', undefined, { limit });
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

export interface MapHistoryEntry {
  mapName: string;
  playCount: number;
  snapshotType: string;
  createdAt: string;
}

export interface FactionHistoryEntry {
  factionName: string;
  matchCount: number;
  winCount: number;
  snapshotType: string;
  createdAt: string;
}

export interface UnitRankingEntry {
  unitName: string;
  timesDeployed: number;
  totalKills: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalSupplyConsumed: number;
  timesRefunded: number;
  avgKills: number;
  avgDamage: number;
}

export interface UnitRankingsResult {
  snapshotDate: string | null;
  units: UnitRankingEntry[];
}
