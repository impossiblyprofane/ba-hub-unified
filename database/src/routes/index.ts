import type { FastifyInstance } from 'fastify';
import { registerChallengeRoutes } from './challenges.js';
import { registerUserRoutes } from './users.js';
import { registerDeckRoutes } from './decks.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(registerChallengeRoutes, { prefix: '/api/challenges' });
  await app.register(registerUserRoutes, { prefix: '/api/users' });
  await app.register(registerDeckRoutes, { prefix: '/api/decks' });
}
