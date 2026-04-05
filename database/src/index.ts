import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { registerRoutes } from './routes/index.js';
import { db, sql } from './db.js';
import { StatsClient } from './services/statsClient.js';
import { TtlCache } from './services/cache.js';
import type { RestUserInfo, PlayerStats } from './services/statsClient.js';

const PORT = Number(process.env.PORT ?? 3002);

async function runMigrations() {
  const migrationsFolder = new URL('../drizzle', import.meta.url).pathname;
  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');
}

async function main() {
  // Run pending migrations before starting the server
  await runMigrations();
  const app = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50 MB — crawler batches can be large
  });

  // ── Plugins ──────────────────────────────────────────────────
  // CORS: allow internal services + admin viewer origins.
  // DB_ADMIN_ORIGINS can include "null" for file:// protocol access.
  const adminOrigins = (process.env.DB_ADMIN_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      ...adminOrigins,
    ],
    credentials: true,
  });

  await app.register(rateLimit as any, {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (req: any) => {
      // Prefer X-User-Id header for per-user rate limiting,
      // fall back to IP for anonymous visitors.
      return (req.headers['x-user-id'] as string) ?? req.ip;
    },
    allowList: (req: any) => {
      // Internal backend traffic is trusted — exempt from rate limits.
      // Covers localhost (dev) and Docker bridge network (172.x.x.x in prod).
      const ip: string = req.ip ?? '';
      return (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1' ||
        ip.startsWith('172.') ||
        ip.startsWith('::ffff:172.')
      );
    },
  });

  // ── Decorate with db ─────────────────────────────────────────
  app.decorate('db', db);

  // ── Stats client (external game API) ─────────────────────────
  const statsClient = new StatsClient(
    process.env.STATS_API_URL ?? 'https://api.brokenarrowgame.tech',
    process.env.STATS_PARTNER_TOKEN ?? '',
  );
  app.decorate('statsClient', statsClient);

  // ── In-memory TTL caches for external API responses ──────────
  // These absorb repeat requests without touching PostgreSQL.
  const userCache = new TtlCache<RestUserInfo | null>({
    ttlMs: 10 * 60 * 1000,   // 10 minutes
    maxEntries: 200,          // ~40 KB — trivial
  });
  const recentFightsCache = new TtlCache<string[]>({
    ttlMs: 5 * 60 * 1000,    // 5 minutes — list changes as player plays
    maxEntries: 200,          // ~400 KB
  });
  const playerStatsCache = new TtlCache<PlayerStats | null>({
    ttlMs: 10 * 60 * 1000,   // 10 minutes — personal stats change slowly
    maxEntries: 200,          // ~60 KB
  });
  app.decorate('userCache', userCache);
  app.decorate('recentFightsCache', recentFightsCache);
  app.decorate('playerStatsCache', playerStatsCache);

  // ── Routes ───────────────────────────────────────────────────
  await registerRoutes(app);

  // ── Health check ─────────────────────────────────────────────
  app.get('/health', async () => {
    try {
      await sql`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'error', message: 'database unreachable' };
    }
  });

  // ── Start ────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Database service listening on port ${PORT}`);
}

main().catch((err) => {
  console.error('Failed to start database service:', err);
  process.exit(1);
});
