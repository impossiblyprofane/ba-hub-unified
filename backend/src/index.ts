import Fastify from 'fastify';
import mercurius from 'mercurius';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { loadStaticData } from './data/loader.js';
import { buildIndexes } from './data/indexes.js';
import { DatabaseClient } from './services/databaseClient.js';

const PORT = process.env.PORT || 3001;
const DATABASE_SERVICE_URL = process.env.DATABASE_SERVICE_URL || 'http://localhost:3002';

async function buildServer() {
  const data = await loadStaticData();
  const indexes = buildIndexes(data);
  const dbClient = new DatabaseClient(DATABASE_SERVICE_URL);

  // Keep mutable references for hot-reloading
  let currentData = data;
  let currentIndexes = indexes;

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Hot-reload endpoint (requires RELOAD_SECRET env var)
  const RELOAD_SECRET = process.env.RELOAD_SECRET;

  fastify.post('/api/reload-data', async (request, reply) => {
    if (!RELOAD_SECRET) {
      fastify.log.warn('RELOAD_SECRET not configured — reload endpoint disabled');
      return reply.status(404).send({ success: false, error: 'Endpoint not available' });
    }

    const auth = request.headers['authorization'];
    if (auth !== `Bearer ${RELOAD_SECRET}`) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      fastify.log.info('Reloading static data...');
      const newData = await loadStaticData();
      const newIndexes = buildIndexes(newData);
      
      currentData = newData;
      currentIndexes = newIndexes;
      
      return { success: true, message: 'Data reloaded successfully' };
    } catch (err) {
      fastify.log.error(err, 'Failed to reload data');
      return reply.status(500).send({ success: false, error: 'Failed to reload data' });
    }
  });

  // CORS for frontend
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // WebSocket support
  await fastify.register(websocket);

  // GraphQL with Mercurius
  await fastify.register(mercurius, {
    schema,
    resolvers,
    context: () => ({ data: currentData, indexes: currentIndexes, dbClient }),
    graphiql: true, // GraphiQL interface at /graphiql
    subscription: true, // Enable subscriptions via WebSocket
  });

  // Cache headers for GraphQL responses — data is static, so cache aggressively
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.url === '/graphql' && request.method === 'POST') {
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    }
    return payload;
  });

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();
    
    await fastify.listen({ port: PORT as number, host: '0.0.0.0' });
    
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`🎮 GraphiQL: http://localhost:${PORT}/graphiql`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
