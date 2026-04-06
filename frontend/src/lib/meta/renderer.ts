import type { PageMeta } from './types';

const DEFAULT_OG_IMAGE = '/images/bahub.png';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMetaHtml(meta: PageMeta, url: string, siteUrl: string): string {
  const ogType = meta.ogType || 'website';
  // Default to small twitter card unless caller explicitly opts into the large variant.
  const twitterCard = meta.twitterCard ?? 'summary';
  // Resolvers may return null to mean "no image"; undefined means "use default".
  const imagePath = meta.ogImage === undefined ? DEFAULT_OG_IMAGE : meta.ogImage;
  const imageMeta = imagePath
    ? `\n  <meta property="og:image" content="${escapeHtml(siteUrl + imagePath)}">\n  <meta name="twitter:image" content="${escapeHtml(siteUrl + imagePath)}">`
    : '';

  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:url" content="${safeUrl}">${imageMeta}
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <link rel="canonical" href="${safeUrl}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`;
}
