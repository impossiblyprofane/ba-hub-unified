import type { RequestHandler } from '@builder.io/qwik-city';
import { buildRobotsTxt } from '~/lib/meta/robots';

export const onGet: RequestHandler = async ({ send, headers, url }) => {
  const siteUrl = `${url.protocol}//${url.host}`;
  headers.set('content-type', 'text/plain; charset=utf-8');
  headers.set('cache-control', 'public, max-age=3600');
  send(200, buildRobotsTxt(siteUrl));
};
