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
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import type { DatabaseClient } from '../services/databaseClient.js';
import type { LogBuffer, LogEntry, LogLevelName } from '../services/logBuffer.js';
import { LOG_LEVELS } from '../services/logBuffer.js';
import type { StaticData } from '../data/loader.js';
import type { MatchCrawler } from '../services/matchCrawler.js';
import type { RequestMetrics } from '../services/requestMetrics.js';
import type { OutboundMetrics } from '../services/outboundMetrics.js';
import type { GraphqlMetrics } from '../services/graphqlMetrics.js';

export interface AdminPluginOptions {
  logBuffer: LogBuffer;
  dbClient: DatabaseClient;
  /** Mutable getter so the health endpoint sees hot-reloaded data. */
  getStaticData: () => StaticData;
  startedAt: number;
  /** Exposed so the manual-fire button in /sys can trigger a run. */
  matchCrawler: MatchCrawler;
  requestMetrics: RequestMetrics;
  outboundMetrics: OutboundMetrics;
  graphqlMetrics: GraphqlMetrics;
  slowRequestThresholdMs: number;
  /** Returns the live Fastify instance (for runtime log level adjustment). */
  getFastify: () => FastifyInstance;
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

interface FilesystemEntry {
  mount: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  pctUsed: number;
  error?: string;
}

/**
 * Gather filesystem stats for the interesting mounts the backend process
 * can see. Inside a Docker container this reflects the host's Docker
 * storage area (overlay2), which is what we want when monitoring a VPS
 * whose pgdata volume lives in /var/lib/docker.
 */
async function gatherFilesystemStats(): Promise<FilesystemEntry[]> {
  // Collect a short list of mounts to probe. `/` always; process.cwd() if
  // different (e.g. a separately mounted /app). We dedupe by same stat
  // filesystem id implicitly via mount path string.
  const candidates = new Set<string>(['/']);
  try {
    const cwd = process.cwd();
    if (cwd && cwd !== '/') candidates.add(cwd);
  } catch {
    /* ignore */
  }

  const results: FilesystemEntry[] = [];
  for (const mount of candidates) {
    try {
      const s = await statfs(mount);
      const totalBytes = Number(s.blocks) * Number(s.bsize);
      const freeBytes = Number(s.bavail) * Number(s.bsize);
      const usedBytes = totalBytes - freeBytes;
      const pctUsed = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
      results.push({ mount, totalBytes, freeBytes, usedBytes, pctUsed });
    } catch (err) {
      results.push({
        mount,
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        pctUsed: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If both `/` and cwd resolved to identical numbers, drop the duplicate.
  if (
    results.length === 2 &&
    results[0].totalBytes === results[1].totalBytes &&
    results[0].freeBytes === results[1].freeBytes
  ) {
    return [results[0]];
  }
  return results;
}

/**
 * Snapshot of the host OS / container from Node's perspective. Useful for
 * spotting load spikes, memory pressure, and distinguishing dev vs prod at
 * a glance.
 */
function gatherOsInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemMb: Math.round(totalMem / 1024 / 1024),
    freeMemMb: Math.round(freeMem / 1024 / 1024),
    usedMemPct:
      totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10 : 0,
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
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
  const {
    logBuffer,
    dbClient,
    getStaticData,
    startedAt,
    matchCrawler,
    requestMetrics,
    outboundMetrics,
    graphqlMetrics,
    slowRequestThresholdMs,
    getFastify,
  } = opts;

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
    const [db, filesystem] = await Promise.all([
      probeDatabaseService(),
      gatherFilesystemStats(),
    ]);

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
      logBuffer: {
        size: logBuffer.size(),
        errorSize: logBuffer.errorSize(),
        slowSize: logBuffer.slowSize(),
      },
      os: gatherOsInfo(),
      filesystem,
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
    Querystring: { limit?: string; sinceTs?: string; minLevel?: string; cat?: string };
  }>('/logs', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const sinceTs = req.query.sinceTs ? Number(req.query.sinceTs) : undefined;
    const minLevel = req.query.minLevel ? Number(req.query.minLevel) : undefined;
    const cat = req.query.cat && req.query.cat.length > 0 ? req.query.cat : undefined;
    return {
      entries: logBuffer.getRecent({ limit, sinceTs, minLevel, cat }),
      categories: logBuffer.categories(),
      size: logBuffer.size(),
      errorSize: logBuffer.errorSize(),
      slowSize: logBuffer.slowSize(),
    };
  });

  /** Warn+error+fatal ring, newest-first. */
  app.get<{ Querystring: { limit?: string } }>('/logs/errors', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    return { entries: logBuffer.getErrors(limit) };
  });

  /** Slow-HTTP-request ring, newest-first. */
  app.get<{ Querystring: { limit?: string } }>('/logs/slow', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    return {
      entries: logBuffer.getSlow(limit),
      thresholdMs: slowRequestThresholdMs,
    };
  });

  /**
   * Runtime log level adjustment. Pino supports changing `logger.level` at
   * runtime — subsequent log calls respect the new threshold.
   *
   * This does NOT persist across restarts (by design — prod env var stays
   * authoritative).
   */
  app.post<{ Body: { level?: string } }>('/logs/level', async (req, reply) => {
    const raw = (req.body?.level ?? '').toLowerCase();
    if (!(raw in LOG_LEVELS)) {
      return reply.status(400).send({
        error: `Invalid level. Must be one of: ${Object.keys(LOG_LEVELS).join(', ')}`,
      });
    }
    const fastify = getFastify();
    const prior = fastify.log.level;
    fastify.log.level = raw as LogLevelName;
    fastify.log.info({ cat: 'admin', prior, next: raw }, 'Log level changed');
    return { ok: true, previous: prior, current: fastify.log.level };
  });

  // ── Metrics endpoints ────────────────────────────────────────
  app.get('/metrics/routes', async () => {
    return {
      routes: requestMetrics.snapshot(),
      slowThresholdMs: slowRequestThresholdMs,
    };
  });

  app.get('/metrics/outbound', async () => {
    return { categories: outboundMetrics.snapshot() };
  });

  app.get('/metrics/graphql', async () => {
    return { operations: graphqlMetrics.snapshot() };
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
        config: matchCrawler.getConfig(),
        busy: matchCrawler.isBusy(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        message: 'Crawler tables unavailable or pending stats rework — see docs/stats-rework-handoff.md',
        error: message,
        config: matchCrawler.getConfig(),
        busy: matchCrawler.isBusy(),
      };
    }
  });

  /**
   * Manual fire — kicks off a collection cycle in the background and
   * returns immediately. A full run (player discovery + range-scan chunk)
   * can take 10+ minutes with default tuning, well past any reasonable
   * HTTP timeout, so we do NOT await it here.
   *
   * The frontend polls `/admin/crawler/summary` for `busy` / `config.lastRunResult`
   * to see progress and the final outcome.
   *
   * Returns `202 Accepted` on successful start, `409 Conflict` if a run is
   * already in progress.
   */
  app.post('/crawler/run', async (_req, reply) => {
    const { started } = matchCrawler.startBackgroundRun();
    if (!started) {
      return reply.status(409).send({ error: 'Crawler is already running', busy: true });
    }
    return reply.status(202).send({ ok: true, started: true });
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
