import Fastify from 'fastify';
import mercurius from 'mercurius';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { loadStaticData } from './data/loader.js';
import { buildIndexes } from './data/indexes.js';
import { DatabaseClient } from './services/databaseClient.js';
import { StatsClient } from './services/statsClient.js';
import { StatsCollector } from './services/statsCollector.js';
import { MatchCrawler } from './services/matchCrawler.js';
import { encryptDek, decryptDek } from './services/dekEncryption.js';
import { isrRelayPlugin } from './routes/isrRelay.js';
import { encryptPayload, decryptPayload, isEncryptionConfigured } from '@ba-hub/shared';

const PORT = process.env.PORT || 3001;
const DATABASE_SERVICE_URL = process.env.DATABASE_SERVICE_URL || 'http://localhost:3002';
const STATS_API_URL = process.env.STATS_API_URL || 'https://api.brokenarrowgame.tech';
const STATS_PARTNER_TOKEN = process.env.STATS_PARTNER_TOKEN || '';
const STATS_COLLECTION_ENABLED = process.env.STATS_COLLECTION_ENABLED !== 'false';

async function buildServer() {
  const data = await loadStaticData();
  const indexes = buildIndexes(data);
  const dbClient = new DatabaseClient(DATABASE_SERVICE_URL);
  const statsClient = new StatsClient(STATS_API_URL, STATS_PARTNER_TOKEN || undefined);

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

  // ── .dek file encrypt/decrypt REST endpoints ──────────────────
  // Binary data is exchanged as base64 to avoid multipart dependencies.
  // Max body 2 MB (deck JSON is typically < 50 KB).

  /** POST /api/dek/encrypt  — { deckJson: string } → { data: base64 } */
  fastify.post<{ Body: { deckJson: string } }>('/api/dek/encrypt', {
    config: { rawBody: false },
    schema: {
      body: {
        type: 'object',
        required: ['deckJson'],
        properties: { deckJson: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    try {
      // Validate it's parseable JSON before encrypting
      JSON.parse(request.body.deckJson);
      const encrypted = encryptDek(request.body.deckJson);
      return { data: encrypted.toString('base64') };
    } catch (err) {
      fastify.log.warn(err, '.dek encrypt failed');
      return reply.status(400).send({ error: 'Encryption failed — invalid deck JSON' });
    }
  });

  /** POST /api/dek/decrypt  — { data: base64 } → { deckJson: string } */
  fastify.post<{ Body: { data: string } }>('/api/dek/decrypt', {
    config: { rawBody: false },
    schema: {
      body: {
        type: 'object',
        required: ['data'],
        properties: { data: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    try {
      const buf = Buffer.from(request.body.data, 'base64');
      const json = decryptDek(buf);
      // Validate the decrypted string is valid JSON
      JSON.parse(json);
      return { deckJson: json };
    } catch (err) {
      fastify.log.warn(err, '.dek decrypt failed');
      return reply.status(400).send({ error: 'Decryption failed — invalid or corrupted .dek file' });
    }
  });

  // WebSocket support
  await fastify.register(websocket);

  // ISR collaborative session relay (must register before Mercurius which also uses WS)
  await fastify.register(isrRelayPlugin);

  // GraphQL with Mercurius
  await fastify.register(mercurius, {
    schema,
    resolvers,
    context: () => ({
      data: currentData,
      indexes: currentIndexes,
      dbClient,
      statsClient,
    }),
    graphiql: true, // GraphiQL interface at /graphiql
    subscription: true, // Enable subscriptions via WebSocket
  });

  // ── API traffic encryption (surface-level anti-scraping) ──────
  const encryptApi = process.env.ENCRYPT_API === 'true' && isEncryptionConfigured();
  if (encryptApi) {
    fastify.log.info('API traffic encryption enabled');
  }

  // Decrypt incoming GraphQL requests if encrypted (body has { e: "..." })
  // Tag request so we know to encrypt the response
  fastify.addHook('preHandler', async (request) => {
    if (request.url !== '/graphql' || request.method !== 'POST') return;
    const body = request.body as Record<string, unknown> | undefined;
    if (body && typeof body.e === 'string' && !body.query) {
      try {
        const decrypted = decryptPayload<Record<string, unknown>>(body.e);
        (request as any).body = decrypted;
        (request as any)._encrypted = true; // tag for response encryption
      } catch {
        // Not encrypted or invalid — pass through for Mercurius to handle
      }
    }
  });

  // Encrypt outgoing GraphQL responses + set cache headers
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.url === '/graphql' && request.method === 'POST') {
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

      // Only encrypt response if the request was encrypted (preserves GraphiQL)
      if ((request as any)._encrypted && typeof payload === 'string') {
        try {
          const parsed = JSON.parse(payload);
          return JSON.stringify({ e: encryptPayload(parsed) });
        } catch {
          return payload;
        }
      }
    }
    return payload;
  });

  return { fastify, data: currentData, indexes: currentIndexes, statsClient };
}

async function start() {
  try {
    const { fastify, data, indexes, statsClient } = await buildServer();

    await fastify.listen({ port: PORT as number, host: '0.0.0.0' });

    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`🎮 GraphiQL: http://localhost:${PORT}/graphiql`);

    // Create match crawler for independent fight data collection
    const matchCrawler = new MatchCrawler({
      statsClient,
      databaseServiceUrl: DATABASE_SERVICE_URL,
      indexes,
      data,
    });

    // Start periodic stats collection
    const collector = new StatsCollector({
      statsClient,
      databaseServiceUrl: DATABASE_SERVICE_URL,
      enabled: STATS_COLLECTION_ENABLED,
      matchCrawler,
    });
    collector.start();

    // Graceful shutdown
    const shutdown = () => {
      collector.stop();
      fastify.close();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
