/**
 * JSON-LD structured data builders.
 *
 * Output is a serialized JSON string suitable for embedding inside
 * <script type="application/ld+json">. The `<` → `\u003c` escape is
 * the standard JSON-LD trick to prevent an accidental `</script>` in
 * a user-supplied string from breaking out of the tag.
 */

const DISCORD_LINKS = [
  'https://discord.gg/Z8JqbQmssg',
  'https://discord.gg/e9ZVRHBX8V',
];

/** Escape JSON for safe embedding inside a <script> element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Home-page level: WebSite + Organization. One combined array @graph. */
export function buildSiteSchema(siteUrl: string): string {
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: 'BA HUB',
        alternateName: 'Broken Arrow Hub',
        url: `${siteUrl}/`,
        description:
          'Community toolkit for Broken Arrow — browse units, build decks, analyze maps, track competitive performance.',
        inLanguage: 'en',
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'BA HUB',
        url: `${siteUrl}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/images/bahub.png`,
        },
        sameAs: DISCORD_LINKS,
      },
    ],
  });
}

export interface UnitSchemaInput {
  unitId: number;
  name: string;
  description: string;
  pageUrl: string;
  imageUrl: string | null;
  siteUrl: string;
}

/**
 * Unit detail page: WebPage + nested Thing `about`. This is the most
 * conservative schema that Google Rich Results accepts — it avoids
 * claiming the page is a VideoGame (it's not — the game is Broken Arrow).
 */
export function buildUnitSchema(input: UnitSchemaInput): string {
  const about: Record<string, unknown> = {
    '@type': 'Thing',
    name: input.name,
    description: input.description,
  };
  if (input.imageUrl) about.image = input.siteUrl + input.imageUrl;

  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${input.pageUrl}#webpage`,
    url: input.pageUrl,
    name: `${input.name} — BA HUB Arsenal`,
    description: input.description,
    inLanguage: 'en',
    isPartOf: { '@id': `${input.siteUrl}/#website` },
    about,
    ...(input.imageUrl ? { primaryImageOfPage: { '@type': 'ImageObject', url: input.siteUrl + input.imageUrl } } : {}),
  });
}
