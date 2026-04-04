/**
 * Production Fastify entry point for Qwik City SSR.
 *
 * This file is the SSR build target (vite build --ssr).
 * It integrates Qwik City's SSR middleware with our custom
 * metadata handler for social media crawlers (Discord, Twitter, etc.).
 */
import type { PlatformNode } from '@builder.io/qwik-city/middleware/node';
import { createQwikCity } from '@builder.io/qwik-city/middleware/node';
import fastifyStatic from '@fastify/static';
import qwikCityPlan from '@qwik-city-plan';
import Fastify from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import render from './entry.ssr';

// Import metadata system from src/lib/meta (within Vite project scope)
import type { PageMeta } from '~/lib/meta/types';
import { getStaticRouteMeta } from '~/lib/meta/static-routes';
import { renderMetaHtml } from '~/lib/meta/renderer';
import { resolveArsenalMeta } from '~/lib/meta/resolvers/arsenal';
import { resolveDeckMeta } from '~/lib/meta/resolvers/deck';
import { resolvePlayerMeta } from '~/lib/meta/resolvers/player';
import { resolveMatchMeta } from '~/lib/meta/resolvers/match';

declare global {
  type QwikCityPlatform = PlatformNode;
}

// SSR build outputs to dist/server/entry.fastify.js
// Client assets are in dist/ (parent of server/)
const distDir = join(fileURLToPath(import.meta.url), '..', '..');
const buildDir = join(distDir, 'build');
const assetsDir = join(distDir, 'assets');

const PORT = parseInt(process.env.PORT ?? '3000');
const HOST = process.env.HOST ?? '0.0.0.0';
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

/* ── Metadata resolver (same logic as server/index.ts) ──── */

async function resolveRouteMeta(path: string): Promise<PageMeta> {
  const [pathname, queryString] = path.split('?');
  const route = (pathname || '/').replace(/\/$/, '') || '/';
  const params = new URLSearchParams(queryString || '');

  const staticMeta = getStaticRouteMeta(route);
  if (staticMeta) return staticMeta;

  const unitMatch = route.match(/^\/arsenal\/(\d+)$/);
  if (unitMatch) {
    const unitId = parseInt(unitMatch[1], 10);
    const modParam = params.get('m');
    const optionIds = modParam
      ? modParam.split('-').map(Number).filter((n) => !isNaN(n) && n > 0)
      : [];
    return resolveArsenalMeta(unitId, optionIds);
  }

  const deckMatch = route.match(/^\/decks\/browse\/([a-f0-9-]{36})$/);
  if (deckMatch) return resolveDeckMeta(deckMatch[1]);

  const playerMatch = route.match(/^\/stats\/player\/(\d+)$/);
  if (playerMatch) return resolvePlayerMeta(playerMatch[1]);

  const fightMatch = route.match(/^\/stats\/match\/([a-zA-Z0-9_-]+)$/);
  if (fightMatch) return resolveMatchMeta(fightMatch[1]);

  return {
    title: 'BA HUB - Broken Arrow Community Toolkit',
    description:
      'Lightweight stats viewer for Broken Arrow. Browse units, build decks, explore maps.',
  };
}

/* ── Qwik City plugin ─────────────────────────────────────── */

const { router, notFound } = createQwikCity({ render, qwikCityPlan });

const qwikPlugin = fastifyPlugin(
  async (fastify, options: { distDir: string; buildDir: string; assetsDir: string }) => {
    // Static assets — long cache
    fastify.register(fastifyStatic, {
      root: options.buildDir,
      prefix: '/build',
      immutable: true,
      maxAge: '1y',
      decorateReply: false,
    });

    fastify.register(fastifyStatic, {
      root: options.assetsDir,
      prefix: '/assets',
      immutable: true,
      maxAge: '1y',
    });

    // Static files in dist root (images, favicon, etc.)
    fastify.register(fastifyStatic, {
      root: options.distDir,
      redirect: false,
      decorateReply: false,
    });

    fastify.removeAllContentTypeParsers();

    // Intercept crawlers BEFORE Qwik SSR — serve lightweight metadata HTML
    fastify.addHook('onRequest', async (request, reply) => {
      // Skip static assets
      if (request.url.startsWith('/build/') || request.url.startsWith('/assets/') || request.url.startsWith('/images/')) return;

      const userAgent = request.headers['user-agent'] || '';
      const isCrawler = /bot|crawler|spider|discord|twitter|facebook|linkedin|whatsapp|telegram|slack/i.test(userAgent);

      if (isCrawler) {
        const meta = await resolveRouteMeta(request.url);
        const fullUrl = `${SITE_URL}${request.url}`;
        reply.type('text/html').send(renderMetaHtml(meta, fullUrl, SITE_URL));
      }
    });

    // Not-found handler — Qwik City router for normal SSR
    fastify.setNotFoundHandler(async (request, response) => {
      await router(request.raw, response.raw, (err) => fastify.log.error(err));
      await notFound(request.raw, response.raw, (err) => fastify.log.error(err));
    });
  },
  { fastify: '>=4.0.0 <6.0.0' },
);

/* ── Start server ─────────────────────────────────────────── */

const start = async () => {
  const fastify = Fastify({ logger: true });

  await fastify.register(qwikPlugin, { distDir, buildDir, assetsDir });

  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🎮 Frontend server running on http://localhost:${PORT}`);
};

start().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
