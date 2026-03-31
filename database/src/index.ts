import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './routes/index.js';
import { db, sql } from './db.js';

const PORT = Number(process.env.PORT ?? 3002);

async function main() {
  const app = Fastify({ logger: true });

  // ── Plugins ──────────────────────────────────────────────────
  await app.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  });

  await app.register(rateLimit as any, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req: any) => {
      // Prefer X-User-Id header for per-user rate limiting,
      // fall back to IP for anonymous visitors.
      return (req.headers['x-user-id'] as string) ?? req.ip;
    },
  });

  // ── Decorate with db ─────────────────────────────────────────
  app.decorate('db', db);

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
