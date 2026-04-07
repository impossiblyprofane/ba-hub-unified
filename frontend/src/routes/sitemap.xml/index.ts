import type { RequestHandler } from '@builder.io/qwik-city';
import { buildSitemapXml } from '~/lib/meta/sitemap';

export const onGet: RequestHandler = async ({ send, headers, url }) => {
  const siteUrl = `${url.protocol}//${url.host}`;
  const xml = await buildSitemapXml(siteUrl);
  headers.set('content-type', 'application/xml; charset=utf-8');
  headers.set('cache-control', 'public, max-age=3600');
  send(200, xml);
};
