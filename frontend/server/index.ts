import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const API_URL = process.env.API_URL || 'http://localhost:3001/graphql';

/* ── Route-specific metadata ──────────────────────────────────── */

interface PageMeta {
  title: string;
  description: string;
  ogType?: string;
  ogImage?: string | null;
}

/* ── GraphQL helper for SSR ───────────────────────────────────── */

/**
 * Minimal GraphQL query to fetch just the data needed for og tags.
 * Intentionally lightweight — no weapons details, only summary fields.
 */
const UNIT_EMBED_QUERY = `
  query UnitEmbed($id: Int!, $optionIds: [Int!]) {
    unitDetail(id: $id, optionIds: $optionIds) {
      displayName
      totalCost
      unit { Id CategoryType Type PortraitFileName ThumbnailFileName }
      armor {
        ArmorValue MaxHealthPoints
        KinArmorFront HeatArmorFront KinArmorRear HeatArmorRear
      }
      mobility { MaxSpeedRoad MaxCrossCountrySpeed }
      weapons {
        weapon { HUDName Name }
        ammunition { ammunition { GroundRange } }
      }
    }
  }
`;

interface EmbedUnit {
  displayName: string;
  totalCost: number;
  unit: { Id: number; CategoryType: number; Type: number; PortraitFileName: string; ThumbnailFileName: string };
  armor: {
    ArmorValue: number; MaxHealthPoints: number;
    KinArmorFront: number; HeatArmorFront: number;
    KinArmorRear: number; HeatArmorRear: number;
  } | null;
  mobility: { MaxSpeedRoad: number; MaxCrossCountrySpeed: number } | null;
  weapons: Array<{
    weapon: { HUDName: string; Name: string };
    ammunition: Array<{ ammunition: { GroundRange: number } }>;
  }>;
}

async function fetchUnitForEmbed(id: number, optionIds: number[]): Promise<EmbedUnit | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: UNIT_EMBED_QUERY,
        variables: { id, optionIds: optionIds.length ? optionIds : null },
      }),
      signal: AbortSignal.timeout(3000), // 3s timeout — don't block crawlers
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { unitDetail: EmbedUnit } };
    return json.data?.unitDetail ?? null;
  } catch {
    return null; // graceful fallback to static meta
  }
}

/**
 * Build the portrait URL for og:image. Prefers _HOVER, falls back to base (no suffix).
 * Mirrors the logic in frontend/src/lib/iconPaths.ts toPortraitIconPath but uses
 * _HOVER instead of _BASIC.
 */
function buildPortraitUrl(unitData: EmbedUnit): string | null {
  const raw = unitData.unit.PortraitFileName || unitData.unit.ThumbnailFileName;
  if (!raw) return null;
  const split = raw.split('\\');
  const prefix = split.slice(0, -1).join('/').toLowerCase();
  const fileName = split[split.length - 1].toUpperCase();
  const encoded = `/images/unitportraits/${prefix}/${fileName}_HOVER.png`.split(' ').join('%20');
  return encoded;
}

function buildUnitDescription(unit: EmbedUnit): string {
  const parts: string[] = [];
  parts.push(`Cost: ${unit.totalCost}`);

  if (unit.armor) {
    parts.push(`HP: ${unit.armor.MaxHealthPoints}`);
    const hasDirArmor = unit.armor.KinArmorFront > 0 || unit.armor.HeatArmorFront > 0 ||
      unit.armor.KinArmorRear > 0 || unit.armor.HeatArmorRear > 0;
    if (hasDirArmor) {
      parts.push(`Frontal KE: ${unit.armor.KinArmorFront}`);
      parts.push(`Frontal HEAT: ${unit.armor.HeatArmorFront}`);
    } else {
      parts.push(`Armor: ${unit.armor.ArmorValue}`);
    }
  }

  if (unit.mobility) {
    const speed = Math.max(unit.mobility.MaxSpeedRoad || 0, unit.mobility.MaxCrossCountrySpeed || 0);
    if (speed > 0) parts.push(`Speed: ${speed} km/h`);
  }

  // Weapon names (unique, max 4)
  const weaponNames: string[] = [];
  for (const w of unit.weapons) {
    const name = w.weapon.HUDName;
    if (name && !weaponNames.includes(name)) weaponNames.push(name);
    if (weaponNames.length >= 4) break;
  }
  if (weaponNames.length) parts.push(`Weapons: ${weaponNames.join(', ')}`);

  return parts.join(' · ');
}

/* ── Static route metadata ────────────────────────────────────── */

function getStaticRouteMeta(route: string): PageMeta | null {
  if (route === '/') {
    return {
      title: 'BA Hub - Broken Arrow Stats & Deck Builder',
      description: 'Lightweight stats viewer and deck builder for Broken Arrow. Browse 300+ units, weapons, and equipment.',
    };
  }

  if (route === '/arsenal') {
    return {
      title: 'Arsenal Browser - BA Hub',
      description: 'Browse and compare every available unit with tactical overlays, fast filters, and instant cost breakdowns.',
    };
  }

  if (route === '/arsenal/compare') {
    return {
      title: 'Compare Units - BA Hub Arsenal',
      description: 'Compare two Broken Arrow units side-by-side with advantage highlighting for optics, stealth, range, cost, and more.',
    };
  }

  if (route === '/maps') {
    return {
      title: 'Maps - BA Hub',
      description: 'Explore Broken Arrow maps with tactical overlays and strategic analysis.',
    };
  }

  if (route === '/decks') {
    return {
      title: 'Decks - BA Hub',
      description: 'Build your own deployment decks or browse community strategies for Broken Arrow.',
    };
  }

  if (route === '/decks/builder') {
    return {
      title: 'Deck Builder - BA Hub',
      description: 'Create, import, and export custom deployment decks with full modification support.',
    };
  }

  if (route === '/decks/browse') {
    return {
      title: 'Deck Arsenal - BA Hub',
      description: 'Browse community-created decks and popular competitive strategies for Broken Arrow.',
    };
  }

  if (route === '/stats') {
    return {
      title: 'Statistics - BA Hub',
      description: 'View player leaderboards and performance analytics for Broken Arrow.',
    };
  }

  if (route === '/guides') {
    return {
      title: 'Guides - BA Hub',
      description: 'Community guides covering basics to advanced competitive strategies for Broken Arrow.',
    };
  }

  return null;
}

/* ── Resolve metadata (static or dynamic) ─────────────────────── */

async function resolveRouteMeta(path: string): Promise<PageMeta> {
  // Parse path and query string
  const [pathname, queryString] = path.split('?');
  const route = (pathname || '/').replace(/\/$/, '') || '/';
  const params = new URLSearchParams(queryString || '');

  // Check static routes first
  const staticMeta = getStaticRouteMeta(route);
  if (staticMeta) return staticMeta;

  // Dynamic route: /arsenal/{id} — fetch unit data from backend
  const unitMatch = route.match(/^\/arsenal\/(\d+)$/);
  if (unitMatch) {
    const unitId = parseInt(unitMatch[1], 10);
    const modParam = params.get('m');
    const optionIds = modParam
      ? modParam.split('-').map(Number).filter(n => !isNaN(n) && n > 0)
      : [];

    const unit = await fetchUnitForEmbed(unitId, optionIds);
    if (unit) {
      return {
        title: `${unit.displayName} — BA Hub Arsenal`,
        description: buildUnitDescription(unit),
        ogImage: buildPortraitUrl(unit),
      };
    }

    // Fallback if API unreachable
    return {
      title: `Unit ${unitId} - BA Hub Arsenal`,
      description: `Detailed stats, weapons, modifications, and availability for unit ${unitId} in Broken Arrow.`,
    };
  }

  // Fallback
  return {
    title: 'BA Hub - Broken Arrow Stats',
    description: 'Lightweight stats viewer for Broken Arrow. Browse units, build decks, explore maps.',
  };
}

function renderMetaHtml(meta: PageMeta, url: string, siteUrl: string): string {
  const ogType = meta.ogType || 'website';
  const imageMeta = meta.ogImage
    ? `\n  <meta property="og:image" content="${siteUrl}${meta.ogImage}">\n  <meta name="twitter:image" content="${siteUrl}${meta.ogImage}">`
    : '';
  const twitterCard = meta.ogImage ? 'summary_large_image' : 'summary';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${url}">${imageMeta}
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.description}">
  <link rel="canonical" href="${url}">
</head>
<body>
  <h1>${meta.title}</h1>
  <p>${meta.description}</p>
</body>
</html>`;
}

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
      // Serve route-specific metadata for crawlers / social previews
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
