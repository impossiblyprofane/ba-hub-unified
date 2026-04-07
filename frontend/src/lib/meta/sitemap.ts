import { fetchGraphQL } from './utils/graphql';
import { WRITTEN_GUIDES } from '~/lib/guides/config';

/** Static routes included in the sitemap with crawl hints. */
export const SITEMAP_ROUTES: Array<{
  path: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}> = [
  { path: '/',                    changefreq: 'weekly',  priority: 1.0 },
  { path: '/arsenal',             changefreq: 'weekly',  priority: 0.9 },
  { path: '/arsenal/compare',     changefreq: 'monthly', priority: 0.5 },
  { path: '/maps',                changefreq: 'monthly', priority: 0.7 },
  { path: '/decks',               changefreq: 'daily',   priority: 0.8 },
  { path: '/decks/builder',       changefreq: 'monthly', priority: 0.5 },
  { path: '/decks/builder/new',   changefreq: 'monthly', priority: 0.3 },
  { path: '/decks/browse',        changefreq: 'daily',   priority: 0.8 },
  { path: '/stats',               changefreq: 'weekly',  priority: 0.6 },
  { path: '/guides',              changefreq: 'weekly',  priority: 0.7 },
];

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

const UNIT_IDS_QUERY = `
  query SitemapUnits {
    units(filter: { displayInArmory: true }, limit: 1000) { Id }
  }
`;

const PUBLISHED_DECKS_QUERY = `
  query SitemapDecks($page: Int!, $pageSize: Int!) {
    browseDecks(filter: { page: $page, pageSize: $pageSize }) {
      decks { id updatedAt }
      totalPages
    }
  }
`;

interface UnitIdRow { Id: number }
interface DeckIdRow { id: string; updatedAt: string }
interface BrowseDecksResult {
  browseDecks: {
    decks: DeckIdRow[];
    totalPages: number;
  };
}

async function fetchUnitIds(): Promise<number[]> {
  const data = await fetchGraphQL<{ units: UnitIdRow[] }>(UNIT_IDS_QUERY, {});
  if (!data?.units) return [];
  return data.units.map((u) => u.Id).filter((id) => Number.isFinite(id) && id > 0);
}

async function fetchAllPublishedDecks(): Promise<DeckIdRow[]> {
  const pageSize = 50;
  const firstPage = await fetchGraphQL<BrowseDecksResult>(PUBLISHED_DECKS_QUERY, {
    page: 1,
    pageSize,
  });
  if (!firstPage?.browseDecks) return [];

  const all: DeckIdRow[] = [...firstPage.browseDecks.decks];
  const totalPages = Math.min(firstPage.browseDecks.totalPages || 1, 200); // hard cap at 10k decks

  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchGraphQL<BrowseDecksResult>(PUBLISHED_DECKS_QUERY, { page, pageSize });
    if (!next?.browseDecks?.decks?.length) break;
    all.push(...next.browseDecks.decks);
  }
  return all;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderUrl(siteUrl: string, u: SitemapUrl): string {
  const parts: string[] = [`  <url>`, `    <loc>${escapeXml(siteUrl + u.loc)}</loc>`];
  if (u.lastmod) parts.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
  if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
  if (u.priority !== undefined) parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
  parts.push(`  </url>`);
  return parts.join('\n');
}

/**
 * Builds a fresh sitemap.xml body. Each section degrades independently —
 * if the backend is down, static routes + guides still ship.
 */
export async function buildSitemapXml(siteUrl: string): Promise<string> {
  const urls: SitemapUrl[] = [];

  // 1. Static routes
  for (const route of SITEMAP_ROUTES) {
    urls.push({
      loc: route.path,
      changefreq: route.changefreq,
      priority: route.priority,
    });
  }

  // 2. Unit pages (from GraphQL — may return [] on failure)
  const unitIds = await fetchUnitIds().catch(() => []);
  for (const id of unitIds) {
    urls.push({
      loc: `/arsenal/${id}`,
      changefreq: 'monthly',
      priority: 0.7,
    });
  }

  // 3. Published decks (paginated, may return [] on failure)
  const decks = await fetchAllPublishedDecks().catch(() => []);
  for (const deck of decks) {
    urls.push({
      loc: `/decks/browse/${deck.id}`,
      lastmod: deck.updatedAt,
      changefreq: 'weekly',
      priority: 0.6,
    });
  }

  // 4. Guide pages
  for (const guide of WRITTEN_GUIDES) {
    if (guide.available && guide.status === 'ACTIVE') {
      urls.push({
        loc: `/guides/${guide.slug}`,
        changefreq: 'monthly',
        priority: 0.6,
      });
    }
  }

  // Spec cap: 50,000 URLs per sitemap. We're nowhere near, but guard anyway.
  const capped = urls.slice(0, 50000);

  const body = capped.map((u) => renderUrl(siteUrl, u)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}
