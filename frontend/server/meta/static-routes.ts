import type { PageMeta } from './types.js';

const STATIC_ROUTES: Record<string, PageMeta> = {
  '/': {
    title: 'BA HUB - Broken Arrow Community Toolkit',
    description: 'Lightweight stats viewer and deck builder for Broken Arrow. Browse 300+ units, weapons, and equipment.',
  },
  '/arsenal': {
    title: 'BA HUB - Arsenal',
    description: 'Browse and compare every available unit with tactical overlays, fast filters, and instant cost breakdowns.',
  },
  '/arsenal/compare': {
    title: 'BA HUB - Compare Units',
    description: 'Compare two Broken Arrow units side-by-side with advantage highlighting for optics, stealth, range, cost, and more.',
  },
  '/maps': {
    title: 'BA HUB - Maps',
    description: 'Explore Broken Arrow maps with tactical overlays and strategic analysis.',
  },
  '/decks': {
    title: 'BA HUB - Decks',
    description: 'Build your own deployment decks or browse community strategies for Broken Arrow.',
  },
  '/decks/builder': {
    title: 'BA HUB - Deck Builder',
    description: 'Create, import, and export custom deployment decks with full modification support.',
  },
  '/decks/builder/new': {
    title: 'BA HUB - New Deck',
    description: 'Select your faction and specializations to create a new deployment deck for Broken Arrow.',
  },
  '/decks/browse': {
    title: 'BA HUB - Browse Decks',
    description: 'Browse community-created decks and popular competitive strategies for Broken Arrow.',
  },
  '/stats': {
    title: 'BA HUB - Statistics',
    description: 'View player leaderboards and performance analytics for Broken Arrow.',
  },
  '/guides': {
    title: 'BA HUB - Guides',
    description: 'Community guides covering basics to advanced competitive strategies for Broken Arrow.',
  },
};

export function getStaticRouteMeta(route: string): PageMeta | null {
  return STATIC_ROUTES[route] ?? null;
}
