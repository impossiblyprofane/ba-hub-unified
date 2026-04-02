import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import type { PageMeta } from './meta/types.js';
import { getStaticRouteMeta } from './meta/static-routes.js';
import { renderMetaHtml } from './meta/renderer.js';
import { resolveArsenalMeta } from './meta/resolvers/arsenal.js';
import { resolveDeckMeta } from './meta/resolvers/deck.js';
import { resolvePlayerMeta } from './meta/resolvers/player.js';
import { resolveMatchMeta } from './meta/resolvers/match.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

/* ── Resolve metadata (static or dynamic) ─────────────────────── */

async function resolveRouteMeta(path: string): Promise<PageMeta> {
  const [pathname, queryString] = path.split('?');
  const route = (pathname || '/').replace(/\/$/, '') || '/';
  const params = new URLSearchParams(queryString || '');

  // Check static routes first
  const staticMeta = getStaticRouteMeta(route);
  if (staticMeta) return staticMeta;

  // Dynamic route: /arsenal/{id}
  const unitMatch = route.match(/^\/arsenal\/(\d+)$/);
  if (unitMatch) {
    const unitId = parseInt(unitMatch[1], 10);
    const modParam = params.get('m');
    const optionIds = modParam
      ? modParam.split('-').map(Number).filter(n => !isNaN(n) && n > 0)
      : [];
    return resolveArsenalMeta(unitId, optionIds);
  }

  // Dynamic route: /decks/browse/{uuid}
  const deckMatch = route.match(/^\/decks\/browse\/([a-f0-9-]{36})$/);
  if (deckMatch) {
    return resolveDeckMeta(deckMatch[1]);
  }

  // Dynamic route: /stats/player/{steamId}
  const playerMatch = route.match(/^\/stats\/player\/(\d+)$/);
  if (playerMatch) {
    return resolvePlayerMeta(playerMatch[1]);
  }

  // Dynamic route: /stats/match/{fightId}
  const fightMatch = route.match(/^\/stats\/match\/([a-zA-Z0-9_-]+)$/);
  if (fightMatch) {
    return resolveMatchMeta(fightMatch[1]);
  }

  // Fallback
  return {
    title: 'BA Hub - Broken Arrow Stats',
    description: 'Lightweight stats viewer for Broken Arrow. Browse units, build decks, explore maps.',
  };
}

/* ── Server ───────────────────────────────────────────────────── */

async function start() {
  const fastify = Fastify({
    logger: true,
  });

  // Serve static files from Qwik build
  await fastify.register(fastifyStatic, {
    root: join(__dirname, '../dist'),
    prefix: '/',
  });

  // Custom SSR handler for metadata (Discord/social previews)
  fastify.get('/*', async (request, reply) => {
    const userAgent = request.headers['user-agent'] || '';

    // Check if request is from a bot/crawler
    const isCrawler = /bot|crawler|spider|discord|twitter|facebook|linkedin/i.test(userAgent);

    if (isCrawler) {
      const meta = await resolveRouteMeta(request.url);
      const fullUrl = `${SITE_URL}${request.url}`;
      reply.type('text/html');
      return renderMetaHtml(meta, fullUrl, SITE_URL);
    }

    // For regular users, serve the SPA
    reply.sendFile('index.html');
  });

  await fastify.listen({ port: PORT as number, host: '0.0.0.0' });

  console.log(`🎮 Frontend server running on http://localhost:${PORT}`);
}

start().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
