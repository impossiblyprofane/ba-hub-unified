import Fastify from 'fastify';
import mercurius from 'mercurius';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { loadStaticData } from './data/loader.js';
import { buildIndexes } from './data/indexes.js';

const PORT = process.env.PORT || 3001;

async function buildServer() {
  const data = await loadStaticData();
  const indexes = buildIndexes(data);

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
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
    context: () => ({ data, indexes }),
    graphiql: true, // GraphiQL interface at /graphiql
    subscription: true, // Enable subscriptions via WebSocket
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
