import type { PageMeta } from '../types';
import { getGuideBySlug } from '~/lib/guides/config';

export async function resolveGuideMeta(slug: string): Promise<PageMeta> {
  const guide = getGuideBySlug(slug);

  if (guide) {
    const author = guide.author ? ` by ${guide.author}` : '';
    return {
      title: `BA HUB - ${guide.title}`,
      description: `${guide.description}${author}.`,
      ogType: 'article',
    };
  }

  return {
    title: 'BA HUB - Guide',
    description: 'Community guide for Broken Arrow.',
    ogType: 'article',
  };
}
