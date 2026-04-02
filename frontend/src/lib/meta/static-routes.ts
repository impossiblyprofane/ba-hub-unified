import type { PageMeta } from './types';

const STATIC_ROUTES: Record<string, PageMeta> = {
  '/': {
    title: 'BA Hub - Broken Arrow Stats & Deck Builder',
    description: 'Lightweight stats viewer and deck builder for Broken Arrow. Browse 300+ units, weapons, and equipment.',
  },
  '/arsenal': {
    title: 'Arsenal Browser - BA Hub',
    description: 'Browse and compare every available unit with tactical overlays, fast filters, and instant cost breakdowns.',
  },
  '/arsenal/compare': {
    title: 'Compare Units - BA Hub Arsenal',
    description: 'Compare two Broken Arrow units side-by-side with advantage highlighting for optics, stealth, range, cost, and more.',
  },
  '/maps': {
    title: 'Maps - BA Hub',
    description: 'Explore Broken Arrow maps with tactical overlays and strategic analysis.',
  },
  '/decks': {
    title: 'Decks - BA Hub',
    description: 'Build your own deployment decks or browse community strategies for Broken Arrow.',
  },
  '/decks/builder': {
    title: 'Deck Builder - BA Hub',
    description: 'Create, import, and export custom deployment decks with full modification support.',
  },
  '/decks/builder/new': {
    title: 'New Deck - BA Hub',
    description: 'Select your faction and specializations to create a new deployment deck for Broken Arrow.',
  },
  '/decks/browse': {
    title: 'Deck Arsenal - BA Hub',
    description: 'Browse community-created decks and popular competitive strategies for Broken Arrow.',
  },
  '/stats': {
    title: 'Statistics - BA Hub',
    description: 'View player leaderboards and performance analytics for Broken Arrow.',
  },
  '/guides': {
    title: 'Guides - BA Hub',
    description: 'Community guides covering basics to advanced competitive strategies for Broken Arrow.',
  },
};

export function getStaticRouteMeta(route: string): PageMeta | null {
  return STATIC_ROUTES[route] ?? null;
}
