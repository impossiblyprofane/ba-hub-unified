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
import { SteamProfileClient } from './services/steamProfileClient.js';
import { StatsCollector } from './services/statsCollector.js';
import { MatchCrawler } from './services/matchCrawler.js';
import { encryptDek, decryptDek } from './services/dekEncryption.js';
import { isrRelayPlugin } from './routes/isrRelay.js';
import { adminRoutesPlugin } from './routes/admin.js';
import { createLogBuffer } from './services/logBuffer.js';
import { createRequestMetrics } from './services/requestMetrics.js';
import { createOutboundMetrics } from './services/outboundMetrics.js';
import { createGraphqlMetrics } from './services/graphqlMetrics.js';
import { encryptPayload, decryptPayload, isEncryptionConfigured } from '@ba-hub/shared';

const PORT = process.env.PORT || 3001;
const DATABASE_SERVICE_URL = process.env.DATABASE_SERVICE_URL || 'http://localhost:3002';
const STATS_API_URL = process.env.STATS_API_URL || 'https://api.brokenarrowgame.tech';
const STATS_PARTNER_TOKEN = process.env.STATS_PARTNER_TOKEN || '';
const STATS_COLLECTION_ENABLED = process.env.STATS_COLLECTION_ENABLED !== 'false';

/** Parse an integer env var, returning `undefined` if unset/invalid. */
function envInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const CRAWLER_BATCH_SIZE = envInt('CRAWLER_BATCH_SIZE');
const CRAWLER_PLAYER_COUNT = envInt('CRAWLER_PLAYER_COUNT');
const CRAWLER_CHUNK_SIZE = envInt('CRAWLER_CHUNK_SIZE');
const CRAWLER_BATCH_DELAY_MS = envInt('CRAWLER_BATCH_DELAY_MS');
const CRAWLER_INTERVAL_MS = envInt('CRAWLER_INTERVAL_MS');

/** Threshold (ms) above which a request is recorded in the slow-request ring. */
const SLOW_REQUEST_THRESHOLD_MS = envInt('SLOW_REQUEST_THRESHOLD_MS') ?? 500;

async function buildServer() {
  const data = await loadStaticData();
  const indexes = buildIndexes(data);

  // ── Metrics services (in-memory, reset on restart) ─────────
  const requestMetrics = createRequestMetrics();
  const outboundMetrics = createOutboundMetrics();
  const graphqlMetrics = createGraphqlMetrics();

  const dbClient = new DatabaseClient(DATABASE_SERVICE_URL, outboundMetrics);
  const statsClient = new StatsClient(
    STATS_API_URL,
    STATS_PARTNER_TOKEN || undefined,
    outboundMetrics,
  );
  const steamProfileClient = new SteamProfileClient(process.env.STEAM_API_KEY);

  // Keep mutable references for hot-reloading
  let currentData = data;
  let currentIndexes = indexes;

  // NOTE: matchCrawler is constructed AFTER `fastify` is created below so
  // we can pass `fastify.log` as its logger. See the block just after the
  // Fastify instance is built.
  let matchCrawler!: MatchCrawler;

  // In-memory log ring buffer — feeds the admin /sys panel.
  // The tee Writable forwards every Pino NDJSON line to both stdout and the
  // ring buffer so normal logging is preserved unchanged.
  const logBuffer = createLogBuffer(1000);
  const startedAt = Date.now();

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      stream: logBuffer.stream,
    },
  });

  // Build the crawler now that we have a real Fastify logger to pass in.
  // The logger is wrapped with `child({ cat: 'crawler' })` inside MatchCrawler
  // so its entries land tagged in the admin panel log buffer.
  matchCrawler = new MatchCrawler({
    statsClient,
    databaseServiceUrl: DATABASE_SERVICE_URL,
    indexes: currentIndexes,
    data: currentData,
    batchSize: CRAWLER_BATCH_SIZE,
    playerCount: CRAWLER_PLAYER_COUNT,
    chunkSize: CRAWLER_CHUNK_SIZE,
    batchDelayMs: CRAWLER_BATCH_DELAY_MS,
    logger: fastify.log,
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

  // ── Request metrics + slow-request hook ─────────────────────
  // Feeds the /admin/metrics/routes endpoint and the slow-request ring.
  // Hooked here (before Mercurius) so GraphQL and admin REST both count.
  fastify.addHook('onResponse', async (request, reply) => {
    // Prefer the matched route path over the raw URL so /decks/:id collapses
    // all concrete ids into one metric row. Fall back to request.url if the
    // route didn't match (404 etc).
    const routeOpts = (request as unknown as { routeOptions?: { url?: string } }).routeOptions;
    const route = routeOpts?.url ?? request.url.split('?')[0] ?? request.url;
    const durationMs = reply.elapsedTime ?? 0;
    const status = reply.statusCode;

    requestMetrics.record(request.method, route, status, durationMs);

    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      logBuffer.recordSlow({
        ts: Date.now(),
        method: request.method,
        url: request.url,
        status,
        durationMs,
        reqId: typeof request.id === 'string' ? request.id : String(request.id ?? ''),
      });
    }
  });

  // ── Admin REST plugin (hidden /sys panel backend) ────────────
  // Mounted under /admin/*. All routes return 503 unless ADMIN_TOKEN is set.
  // The plugin proxies the database service's read-only admin API and tails
  // the in-memory log buffer.
  await fastify.register(adminRoutesPlugin, {
    prefix: '/admin',
    logBuffer,
    dbClient,
    getStaticData: () => currentData,
    startedAt,
    matchCrawler,
    requestMetrics,
    outboundMetrics,
    graphqlMetrics,
    slowRequestThresholdMs: SLOW_REQUEST_THRESHOLD_MS,
    getFastify: () => fastify,
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
      steamProfileClient,
    }),
    graphiql: true, // GraphiQL interface at /graphiql
    subscription: true, // Enable subscriptions via WebSocket
  });

  // ── GraphQL operation metrics ────────────────────────────────
  // Mercurius application-level hooks. `preExecution` fires once the query
  // has been parsed and validated, so `document` is guaranteed to have the
  // operation definition. We stash the begin-token on the reply so the
  // matching `onResolution` can close it out with error info.
  const fastifyWithGraphql = fastify as unknown as {
    graphql: {
      addHook: (
        name: 'preExecution' | 'onResolution',
        handler: (...args: unknown[]) => Promise<void>,
      ) => void;
    };
  };
  fastifyWithGraphql.graphql.addHook('preExecution', async (...args: unknown[]) => {
    // Mercurius signature: (schema, document, context)
    const document = args[1] as {
      definitions?: Array<{ kind?: string; name?: { value?: string } }>;
    };
    const context = args[2] as { reply?: { _gqlOpToken?: unknown } };
    const opDef = document?.definitions?.find((d) => d.kind === 'OperationDefinition');
    const name = opDef?.name?.value ?? '(anonymous)';
    if (context?.reply) {
      (context.reply as { _gqlOpToken?: unknown })._gqlOpToken = graphqlMetrics.begin(name);
    }
  });
  fastifyWithGraphql.graphql.addHook('onResolution', async (...args: unknown[]) => {
    // Mercurius signature: (execution, context)
    const execution = args[0] as { errors?: readonly unknown[] };
    const context = args[1] as { reply?: { _gqlOpToken?: unknown } };
    const token = context?.reply?._gqlOpToken as
      | { name: string; t0: number }
      | undefined;
    if (token) {
      graphqlMetrics.end(token, { errors: execution?.errors ?? null });
    }
  });

  // ── API traffic encryption (surface-level anti-scraping) ──────
  // Both hooks below are registered unconditionally and short-circuit on
  // plaintext requests, so GraphiQL and any non-envelope client keep working
  // even when ENCRYPTION_KEY/IV are configured. The frontend opts in by
  // sending `{ e: ciphertext }` envelopes via `lib/graphqlClient.ts` when
  // VITE_ENCRYPTION_KEY/IV are set at build time.
  if (isEncryptionConfigured()) {
    fastify.log.info('API traffic encryption keys detected — envelope mode active');
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

  return { fastify, data: currentData, indexes: currentIndexes, statsClient, matchCrawler };
}

async function start() {
  try {
    const { fastify, statsClient, matchCrawler } = await buildServer();

    await fastify.listen({ port: PORT as number, host: '0.0.0.0' });

    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`🎮 GraphiQL: http://localhost:${PORT}/graphiql`);

    // Start periodic stats collection. The MatchCrawler instance was built
    // in buildServer() so the admin plugin could receive it too.
    const collector = new StatsCollector({
      statsClient,
      databaseServiceUrl: DATABASE_SERVICE_URL,
      enabled: STATS_COLLECTION_ENABLED,
      matchCrawler,
      crawlIntervalMs: CRAWLER_INTERVAL_MS,
      logger: fastify.log,
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
