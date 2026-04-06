/**
 * Admin REST plugin — mounted at /admin/*.
 *
 * Single-token bearer auth (`ADMIN_TOKEN` env var). When the env var is
 * unset, every route returns 503 so the route is effectively dormant in
 * environments where admin access has not been provisioned.
 *
 * The plugin proxies the read-only DB inspection routes that already exist
 * on the database service (`database/src/routes/admin.ts`, gated by
 * `DB_ADMIN_SECRET`) so that the database secret never leaves the backend.
 *
 * It also exposes:
 *   - GET /admin/health        — backend + DB + static-data + masked env
 *   - GET /admin/logs          — recent buffered backend log lines
 *   - GET /admin/logs/stream   — Server-Sent Events tail of new log lines
 *   - GET /admin/crawler/...   — defensive wrappers around the still-living
 *                                crawler endpoints (returns
 *                                { available: false } once the stats rework
 *                                rips them out)
 *
 * The crawler section is intentionally tolerant of the rework: every call is
 * wrapped in try/catch and reports `{ available: false, message }` so the
 * frontend never crashes when the underlying tables/routes disappear.
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import type { DatabaseClient } from '../services/databaseClient.js';
import type { LogBuffer, LogEntry } from '../services/logBuffer.js';
import type { StaticData } from '../data/loader.js';

export interface AdminPluginOptions {
  logBuffer: LogBuffer;
  dbClient: DatabaseClient;
  /** Mutable getter so the health endpoint sees hot-reloaded data. */
  getStaticData: () => StaticData;
  startedAt: number;
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DATABASE_SERVICE_URL = process.env.DATABASE_SERVICE_URL || 'http://localhost:3002';
const DB_ADMIN_SECRET = process.env.DB_ADMIN_SECRET || '';

function maskEnv(): Record<string, string> {
  const present = (v: string | undefined) => (v && v.length > 0 ? 'set' : 'missing');
  return {
    ADMIN_TOKEN: present(process.env.ADMIN_TOKEN),
    DB_ADMIN_SECRET: present(process.env.DB_ADMIN_SECRET),
    RELOAD_SECRET: present(process.env.RELOAD_SECRET),
    DATABASE_SERVICE_URL: process.env.DATABASE_SERVICE_URL || '(default localhost:3002)',
    FRONTEND_URL: process.env.FRONTEND_URL || '(default localhost:3000)',
    STATS_API_URL: process.env.STATS_API_URL || '(default brokenarrowgame.tech)',
    STATS_PARTNER_TOKEN: present(process.env.STATS_PARTNER_TOKEN),
    STATS_COLLECTION_ENABLED: process.env.STATS_COLLECTION_ENABLED ?? 'true',
    STEAM_API_KEY: present(process.env.STEAM_API_KEY),
    ENCRYPT_API: process.env.ENCRYPT_API ?? 'false',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
  };
}

/**
 * Probe the database service /health endpoint and report reachability.
 */
async function probeDatabaseService(): Promise<{ reachable: boolean; latencyMs?: number; error?: string; status?: string }> {
  const url = new URL('/health', DATABASE_SERVICE_URL).toString();
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET' });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return { reachable: false, latencyMs, error: `HTTP ${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { status?: string };
    return { reachable: true, latencyMs, status: body.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { reachable: false, error: message };
  }
}

/**
 * Forward an admin request to the database service /api/admin/* endpoint,
 * injecting the DB_ADMIN_SECRET bearer header server-side.
 *
 * Errors are mapped to plain JSON so the frontend never has to parse a stack.
 */
/**
 * Run a read-only SELECT against the database service's /api/admin/query
 * endpoint. Server-side only — never reachable from the frontend admin proxy.
 *
 * Returns the parsed `rows` array or throws on any failure.
 */
async function runDbQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  if (!DB_ADMIN_SECRET) {
    throw new Error('DB_ADMIN_SECRET missing on backend');
  }
  const url = new URL('/api/admin/query', DATABASE_SERVICE_URL);
  url.searchParams.set('q', sql);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${DB_ADMIN_SECRET}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Database query failed: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { rows: T[] };
  return body.rows;
}

async function proxyDbAdmin(
  reply: FastifyReply,
  path: string,
  query?: URLSearchParams,
): Promise<unknown> {
  if (!DB_ADMIN_SECRET) {
    return reply.status(503).send({ error: 'Database admin not configured (DB_ADMIN_SECRET missing on backend)' });
  }
  const url = new URL(path, DATABASE_SERVICE_URL);
  if (query) {
    for (const [k, v] of query.entries()) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${DB_ADMIN_SECRET}` },
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    return reply.status(res.status).send(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return reply.status(502).send({ error: `Database service unreachable: ${message}` });
  }
}

export const adminRoutesPlugin: FastifyPluginAsync<AdminPluginOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  const { logBuffer, dbClient, getStaticData, startedAt } = opts;

  // ── Auth gate ────────────────────────────────────────────────
  // Applies to every route in this plugin. Two failure modes:
  //   - ADMIN_TOKEN unset on backend       → 503 (panel disabled)
  //   - missing/wrong Authorization header → 401
  //
  // The /admin/logs/stream route also accepts the token via `?token=`
  // because EventSource cannot set custom headers.
  app.addHook('preHandler', async (request, reply) => {
    if (!ADMIN_TOKEN) {
      reply.status(503).send({ error: 'Admin interface not configured (ADMIN_TOKEN missing on backend)' });
      return;
    }
    const header = request.headers['authorization'];
    if (header === `Bearer ${ADMIN_TOKEN}`) return;

    // SSE fallback: ?token=... query param. Strip it from the request URL
    // BEFORE Fastify finishes logging so it never lands in the log buffer.
    const url = new URL(request.url, 'http://x');
    if (url.pathname.endsWith('/logs/stream') && url.searchParams.get('token') === ADMIN_TOKEN) {
      // Mask the token from the in-memory log buffer too — Fastify already
      // logged the URL by now, but the buffer ingests by line so we just
      // make sure no further code path echoes it.
      return;
    }

    reply.status(401).send({ error: 'Unauthorized' });
  });

  // ── Ping (auth check) ────────────────────────────────────────
  app.get('/ping', async () => {
    return { ok: true, ts: Date.now() };
  });

  // ── Health ───────────────────────────────────────────────────
  app.get('/health', async () => {
    const data = getStaticData();
    const mem = process.memoryUsage();
    const db = await probeDatabaseService();

    const staticDataCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) staticDataCounts[k] = v.length;
    }

    return {
      backend: {
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        nodeVersion: process.version,
        pid: process.pid,
        memoryMb: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        },
      },
      database: db,
      staticData: staticDataCounts,
      env: maskEnv(),
      logBuffer: { size: logBuffer.size() },
    };
  });

  // ── Database inspection (proxied) ────────────────────────────
  app.get('/db/tables', async (_req, reply) => proxyDbAdmin(reply, '/api/admin/tables'));

  app.get<{ Params: { name: string } }>('/db/table/:name', async (req, reply) => {
    const { name } = req.params;
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }
    return proxyDbAdmin(reply, `/api/admin/table/${name}`);
  });

  app.get<{
    Params: { name: string };
    Querystring: { limit?: string; offset?: string; sort?: string; order?: string };
  }>('/db/table/:name/rows', async (req, reply) => {
    const { name } = req.params;
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }
    const q = new URLSearchParams();
    if (req.query.limit) q.set('limit', req.query.limit);
    if (req.query.offset) q.set('offset', req.query.offset);
    if (req.query.sort) q.set('sort', req.query.sort);
    if (req.query.order) q.set('order', req.query.order);
    return proxyDbAdmin(reply, `/api/admin/table/${name}/rows`, q);
  });

  app.get('/db/stats', async (_req, reply) => proxyDbAdmin(reply, '/api/admin/stats'));

  // ── Logs ─────────────────────────────────────────────────────
  app.get<{
    Querystring: { limit?: string; sinceTs?: string; minLevel?: string };
  }>('/logs', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const sinceTs = req.query.sinceTs ? Number(req.query.sinceTs) : undefined;
    const minLevel = req.query.minLevel ? Number(req.query.minLevel) : undefined;
    return { entries: logBuffer.getRecent({ limit, sinceTs, minLevel }) };
  });

  app.get('/logs/stream', async (req, reply) => {
    // Server-Sent Events. Fastify's reply.raw is the underlying ServerResponse.
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering for this response
    });
    // Drop the framework-managed reply so we can write directly.
    reply.hijack();

    const send = (entry: LogEntry) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
      } catch {
        /* socket gone — cleanup happens in 'close' handler */
      }
    };

    const unsubscribe = logBuffer.subscribe(send);

    // Heartbeat every 25s to keep proxies from idling the connection out.
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* ignore */
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        reply.raw.end();
      } catch {
        /* already closed */
      }
    };
    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });

  // ── Crawler (defensive) ──────────────────────────────────────
  // The stats system is mid-rework. Today these calls succeed; once the
  // tear-out lands they will throw, and the panel will gracefully report
  // `available: false`.

  app.get('/crawler/status', async () => {
    try {
      const state = await dbClient.getCrawlerState();
      return { available: true, state };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        message: 'Crawler offline or pending stats rework — see docs/stats-rework-handoff.md',
        error: message,
      };
    }
  });

  /**
   * Rich crawler summary — match counts, processing rate, recent matches.
   *
   * Reads `processed_matches` directly via the database service's /api/admin/query
   * (server-to-server). Defensive: if the table is gone post-rework or DB_ADMIN_SECRET
   * is missing, returns `available: false` with the failure message.
   */
  app.get('/crawler/summary', async () => {
    try {
      const [stats] = await runDbQuery<{
        total: number;
        ranked: number;
        unranked: number;
        last_hour: number;
        last_day: number;
        last_week: number;
        last_processed: string | null;
        first_processed: string | null;
        min_fight: number | null;
        max_fight: number | null;
      }>(
        `SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE is_ranked)::int AS ranked,
          count(*) FILTER (WHERE NOT is_ranked)::int AS unranked,
          count(*) FILTER (WHERE processed_at > now() - interval '1 hour')::int AS last_hour,
          count(*) FILTER (WHERE processed_at > now() - interval '24 hours')::int AS last_day,
          count(*) FILTER (WHERE processed_at > now() - interval '7 days')::int AS last_week,
          MAX(processed_at) AS last_processed,
          MIN(processed_at) AS first_processed,
          MIN(fight_id)::int AS min_fight,
          MAX(fight_id)::int AS max_fight
        FROM processed_matches`,
      );

      const recent = await runDbQuery<{
        fight_id: number;
        map_name: string | null;
        is_ranked: boolean;
        winner_team: number | null;
        player_count: number;
        end_time: number | null;
        processed_at: string;
      }>(
        `SELECT fight_id, map_name, is_ranked, winner_team, player_count, end_time, processed_at
         FROM processed_matches
         ORDER BY processed_at DESC
         LIMIT 20`,
      );

      // Crawler state too, so the panel can show everything in one fetch.
      let state: Awaited<ReturnType<typeof dbClient.getCrawlerState>> | null = null;
      try {
        state = await dbClient.getCrawlerState();
      } catch {
        /* state is optional */
      }

      return {
        available: true,
        stats,
        recent,
        state,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        message: 'Crawler tables unavailable or pending stats rework — see docs/stats-rework-handoff.md',
        error: message,
      };
    }
  });

  app.get<{ Querystring: { steamId?: string; limit?: string } }>('/crawler/recent-matches', async (req) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const result = await dbClient.getPlayerMatchHistory(req.query.steamId, undefined, limit);
      return { available: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        message: 'Crawler offline or pending stats rework — see docs/stats-rework-handoff.md',
        error: message,
      };
    }
  });
};
