import { renderToStream, RenderToStreamOptions } from '@builder.io/qwik/server';
import Root from './root';

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    ...opts,
    // Ensure the root <html> element gets lang="en" for SEO.
    // Locales in the app are localStorage-driven, so there's no per-locale URL
    // to key off; we always serve the default document in English.
    containerAttributes: {
      lang: 'en',
      ...opts.containerAttributes,
    },
  });
}
