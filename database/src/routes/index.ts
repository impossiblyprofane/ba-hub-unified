import type { FastifyInstance } from 'fastify';
import { registerChallengeRoutes } from './challenges.js';
import { registerUserRoutes } from './users.js';
import { registerDeckRoutes } from './decks.js';
import { registerSnapshotRoutes } from './snapshots.js';
import { registerCrawlerRoutes } from './crawler.js';
import { registerAdminRoutes } from './admin.js';
import { registerStatsRoutes } from './stats.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(registerChallengeRoutes, { prefix: '/api/challenges' });
  await app.register(registerUserRoutes, { prefix: '/api/users' });
  await app.register(registerDeckRoutes, { prefix: '/api/decks' });
  await app.register(registerSnapshotRoutes, { prefix: '/api/snapshots' });
  await app.register(registerCrawlerRoutes, { prefix: '/api/crawler' });
  await app.register(registerAdminRoutes, { prefix: '/api/admin' });
  await app.register(registerStatsRoutes, { prefix: '/api/stats' });
}
