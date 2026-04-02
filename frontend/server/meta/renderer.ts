import type { PageMeta } from './types.js';

export function renderMetaHtml(meta: PageMeta, url: string, siteUrl: string): string {
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
