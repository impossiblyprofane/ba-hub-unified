/**
 * SteamProfileClient
 *
 * Resolves Steam profile data (avatar URLs, persona name, profile URL) for a set
 * of SteamID64s using the official Steam Web API GetPlayerSummaries endpoint.
 *
 * - Batches up to 100 ids per request (Steam's hard limit).
 * - Hand-rolled concurrency semaphore limits outbound fan-out to 5 parallel calls.
 * - In-memory TTL cache: 24h for hits, 1h negative cache for misses (deleted/private).
 * - Gracefully no-ops when no API key is configured.
 *
 * This client intentionally does not take a dependency on node-cache / p-limit —
 * the hand-rolled versions are small, match existing StatsClient conventions,
 * and keep the backend dependency graph lean.
 */

export type SteamProfile = {
  steamId: string;
  personaName: string | null;
  avatarIcon: string | null;
  avatarMedium: string | null;
  avatarFull: string | null;
  profileUrl: string | null;
};

type CacheEntry = {
  value: SteamProfile;
  expiresAt: number;
};

/** Legacy key from ba-hub/ba-hub-backend — intentionally reused per user request. */
const DEFAULT_STEAM_API_KEY = '70BDB9FCF35E3B8A7BCB84FE20E4DD57';

const STEAM_API_BASE = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/';
const CACHE_HIT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_NEGATIVE_TTL_MS = 60 * 60 * 1000; // 1h
const BATCH_SIZE = 100; // Steam hard limit
const MAX_PARALLEL_BATCHES = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const STEAM_ID_REGEX = /^\d{17}$/;

type SteamApiPlayer = {
  steamid?: string;
  personaname?: string;
  profileurl?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
};

type SteamApiResponse = {
  response?: {
    players?: SteamApiPlayer[];
  };
};

function emptyProfile(steamId: string): SteamProfile {
  return {
    steamId,
    personaName: null,
    avatarIcon: null,
    avatarMedium: null,
    avatarFull: null,
    profileUrl: null,
  };
}

export class SteamProfileClient {
  private readonly apiKey: string;
  private readonly cache = new Map<string, CacheEntry>();
  private warnedAboutMissingKey = false;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey && apiKey.trim().length > 0) ? apiKey : DEFAULT_STEAM_API_KEY;
  }

  /**
   * Resolve Steam profile data for a set of SteamID64 strings.
   * Results are keyed by steamId. IDs that fail validation, are missing from
   * Steam's response, or error out will still appear in the result map with
   * all-null fields so callers always get a deterministic shape.
   */
  async getProfiles(steamIds: string[]): Promise<Map<string, SteamProfile>> {
    const result = new Map<string, SteamProfile>();

    if (!this.apiKey) {
      if (!this.warnedAboutMissingKey) {
        console.warn('[SteamProfileClient] No STEAM_API_KEY set — avatars will be empty');
        this.warnedAboutMissingKey = true;
      }
      for (const id of steamIds) result.set(id, emptyProfile(id));
      return result;
    }

    // Dedupe + validate locally. Invalid IDs get a negative row immediately.
    const unique = Array.from(new Set(steamIds));
    const valid: string[] = [];
    for (const id of unique) {
      if (!STEAM_ID_REGEX.test(id)) {
        result.set(id, emptyProfile(id));
        continue;
      }
      valid.push(id);
    }

    const now = Date.now();
    const misses: string[] = [];
    for (const id of valid) {
      const entry = this.cache.get(id);
      if (entry && entry.expiresAt > now) {
        result.set(id, entry.value);
      } else {
        misses.push(id);
      }
    }

    if (misses.length === 0) return result;

    // Chunk misses into batches of 100
    const batches: string[][] = [];
    for (let i = 0; i < misses.length; i += BATCH_SIZE) {
      batches.push(misses.slice(i, i + BATCH_SIZE));
    }

    const fetched = await this.runWithConcurrency(batches, MAX_PARALLEL_BATCHES, (batch) =>
      this.fetchBatch(batch),
    );

    // Merge into result + cache. Anything missing from Steam's response gets negative-cached.
    const fetchedMap = new Map<string, SteamProfile>();
    for (const profile of fetched) fetchedMap.set(profile.steamId, profile);

    for (const id of misses) {
      const profile = fetchedMap.get(id) ?? emptyProfile(id);
      const hit = profile.personaName != null || profile.avatarMedium != null;
      this.cache.set(id, {
        value: profile,
        expiresAt: now + (hit ? CACHE_HIT_TTL_MS : CACHE_NEGATIVE_TTL_MS),
      });
      result.set(id, profile);
    }

    return result;
  }

  private async fetchBatch(steamIds: string[]): Promise<SteamProfile[]> {
    const url = `${STEAM_API_BASE}?key=${encodeURIComponent(this.apiKey)}&steamids=${steamIds.join(',')}`;

    try {
      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        console.warn(`[SteamProfileClient] batch failed (${response.status}) for ${steamIds.length} ids`);
        return [];
      }
      const payload = (await response.json()) as SteamApiResponse;
      const players = payload.response?.players ?? [];
      return players
        .filter((p): p is SteamApiPlayer & { steamid: string } => typeof p.steamid === 'string')
        .map((p) => ({
          steamId: p.steamid,
          personaName: p.personaname ?? null,
          avatarIcon: p.avatar ?? null,
          avatarMedium: p.avatarmedium ?? null,
          avatarFull: p.avatarfull ?? null,
          profileUrl: p.profileurl ?? null,
        }));
    } catch (err) {
      console.warn(`[SteamProfileClient] batch error for ${steamIds.length} ids:`, err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * fetch() with retry/backoff on 429/5xx and an AbortController timeout.
   * Matches the shape of StatsClient.fetchWithRetry (backend/src/services/statsClient.ts).
   */
  private async fetchWithRetry(url: string, maxRetries = 2): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
          return response;
        }

        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 2000;
          console.warn(`[SteamProfileClient] ${response.status}, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        return response;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;

        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 2000;
          const reason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'fetch failed';
          console.warn(`[SteamProfileClient] ${reason}, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Steam API fetch failed');
  }

  /**
   * Hand-rolled bounded-concurrency runner.
   * Executes tasks with at most `limit` running in parallel, returning a flat array of results.
   */
  private async runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R[]>,
  ): Promise<R[]> {
    const results: R[] = [];
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        const chunk = await worker(items[index]!);
        results.push(...chunk);
      }
    });

    await Promise.all(runners);
    return results;
  }
}
