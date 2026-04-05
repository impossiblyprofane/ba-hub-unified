import type { FastifyInstance } from 'fastify';
import { registerChallengeRoutes } from './challenges.js';
import { registerUserRoutes } from './users.js';
import { registerDeckRoutes } from './decks.js';
import { registerAdminRoutes } from './admin.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(registerChallengeRoutes, { prefix: '/api/challenges' });
  await app.register(registerUserRoutes, { prefix: '/api/users' });
  await app.register(registerDeckRoutes, { prefix: '/api/decks' });
  await app.register(registerAdminRoutes, { prefix: '/api/admin' });
}
