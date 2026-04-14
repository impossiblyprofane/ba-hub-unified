/**
 * robots.txt body builder. Kept as a function so the `Sitemap:` line
 * always points at the live SITE_URL regardless of deploy target.
 */
export function buildRobotsTxt(siteUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /decks/builder/edit/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}
