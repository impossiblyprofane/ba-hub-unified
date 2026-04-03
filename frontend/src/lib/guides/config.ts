/**
 * Guide categories, guide definitions, and video provider configuration.
 * Ported from the legacy project — no React/Lucide dependencies.
 */

// ── Types ──────────────────────────────────────────────────

export interface Guide {
  title: string;
  description: string;
  status: 'ACTIVE' | 'NEEDED' | 'DRAFT' | 'REVIEW';
  available: boolean;
  slug: string;
  author?: string;
  filePath?: string;
  contributors?: string[];
}

export interface GuideCategory {
  title: string;
  status: 'ONLINE' | 'PLANNING' | 'DRAFT' | 'REVIEW';
  guides: Guide[];
}

export interface YouTubeVideoItem {
  type: 'video';
  url: string;
  title?: string;
}

export interface YouTubePlaylistItem {
  type: 'playlist';
  playlistUrl: string;
  title?: string;
}

export type ProviderItem = YouTubeVideoItem | YouTubePlaylistItem;

export interface GuideProvider {
  id: string;
  name: string;
  description?: string;
  channelUrl?: string;
  items: ProviderItem[];
}

// ── Guide Categories ───────────────────────────────────────

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    title: 'GETTING STARTED',
    status: 'ONLINE',
    guides: [
      {
        title: 'How to Recon',
        description: 'Essential reconnaissance tactics and positioning',
        status: 'ACTIVE',
        available: true,
        slug: 'how-to-recon',
        author: 'PiousShadow',
        filePath: 'getting-started/how-to-recon.md',
      },
      {
        title: 'Unit Roles & Types',
        description: 'Understanding different unit categories',
        status: 'NEEDED',
        available: false,
        slug: 'unit-roles-types',
      },
      {
        title: 'Basic Tactics',
        description: 'Fundamental strategic concepts',
        status: 'NEEDED',
        available: false,
        slug: 'basic-tactics',
      },
    ],
  },
  {
    title: 'DECK BUILDING',
    status: 'PLANNING',
    guides: [
      {
        title: 'Deck Composition',
        description: 'Balancing your forces effectively',
        status: 'NEEDED',
        available: false,
        slug: 'deck-composition',
      },
      {
        title: 'Cost Management',
        description: 'Optimizing point allocation',
        status: 'NEEDED',
        available: false,
        slug: 'cost-management',
      },
      {
        title: 'Specialization Focus',
        description: 'Building around strengths',
        status: 'NEEDED',
        available: false,
        slug: 'specialization-focus',
      },
    ],
  },
  {
    title: 'ADVANCED TACTICS',
    status: 'PLANNING',
    guides: [
      {
        title: 'Combined Arms',
        description: 'Coordinating different unit types',
        status: 'NEEDED',
        available: false,
        slug: 'combined-arms',
      },
      {
        title: 'Map Control',
        description: 'Territory and positioning strategies',
        status: 'NEEDED',
        available: false,
        slug: 'map-control',
      },
      {
        title: 'Counter-Play',
        description: 'Adapting to opponent strategies',
        status: 'NEEDED',
        available: false,
        slug: 'counter-play',
      },
    ],
  },
  {
    title: 'COMPETITIVE PLAY',
    status: 'PLANNING',
    guides: [
      {
        title: 'Tournament Prep',
        description: 'Getting ready for competitions',
        status: 'NEEDED',
        available: false,
        slug: 'tournament-prep',
      },
      {
        title: 'Meta Analysis',
        description: 'Understanding current trends',
        status: 'NEEDED',
        available: false,
        slug: 'meta-analysis',
      },
      {
        title: 'Practice Routines',
        description: 'Improving your skills',
        status: 'NEEDED',
        available: false,
        slug: 'practice-routines',
      },
    ],
  },
];

// ── Video Providers ────────────────────────────────────────

export const GUIDE_PROVIDERS: GuideProvider[] = [
  {
    id: 'beagle',
    name: 'Beagle',
    description: 'Community creator with tactical videos for Broken Arrow.',
    items: [
      { type: 'video', url: 'https://youtu.be/X5D_vUfHkMI?si=gZH3XzESkpvUZcBp' },
      { type: 'video', url: 'https://youtu.be/rpA06__AwRI?si=GzKRwOfGGvorN7TX' },
      { type: 'video', url: 'https://youtu.be/rzP7sZtx3U4?si=NyHEV8u7pc_7Yman' },
      { type: 'video', url: 'https://youtu.be/AhpSCLTgidA?si=vV_66taD_GDZa7dI' },
      { type: 'video', url: 'https://youtu.be/Dy1NJWZ7PVY?si=jRdPYeWW7JV9IpZI' },
    ],
  },
  {
    id: 'koraske',
    name: 'Koraske',
    description: 'Extensive Broken Arrow playlist with guides and gameplay.',
    items: [
      { type: 'video', url: 'https://youtu.be/6xCzNW3S8r4?si=Q5r2qvtTjvb13aT6' },
      { type: 'video', url: 'https://youtu.be/zeZ3MU8YiOY?si=07vNilsFGOrn4Oq-' },
      { type: 'video', url: 'https://youtu.be/FVZu6eR0jNk?si=oco8oLo-5A4a10Vo' },
      { type: 'video', url: 'https://youtu.be/KpukGdmSv2c?si=YokYCY9FDF8l8wni' },
      { type: 'video', url: 'https://youtu.be/wcdCg5oL2lM?si=zEkCN0A67oEEHI9Z' },
      { type: 'video', url: 'https://youtu.be/AZAphO3wOuk?si=9clXLcQrEkCWZUX6' },
      { type: 'video', url: 'https://youtu.be/yCeahZ43Yc0?si=jXLHqI7dMgSlKqHt' },
      { type: 'video', url: 'https://youtu.be/dQ2wlqnsH1E?si=HOh6rI-z_d_sSFLa' },
      { type: 'video', url: 'https://youtu.be/ybhQgD3v7WI?si=4UuZYqYgs13S3pK9' },
      { type: 'video', url: 'https://youtu.be/6vLiReZeHZQ?si=07dc6Rh5KIGOPm18' },
      { type: 'playlist', playlistUrl: 'https://www.youtube.com/playlist?list=PL9t3-mUgzNkweleHqCJFyxlyk7NOVuIwk', title: 'Koraske Broken Arrow Playlist' },
    ],
  },
];

// ── Utility Functions ──────────────────────────────────────

export function getTotalGuides(): number {
  return GUIDE_CATEGORIES.reduce((t, c) => t + c.guides.length, 0);
}

export function getAvailableGuides(): number {
  return GUIDE_CATEGORIES.reduce((t, c) => t + c.guides.filter((g) => g.available).length, 0);
}

export function getGuideBySlug(slug: string): Guide | undefined {
  for (const cat of GUIDE_CATEGORIES) {
    const g = cat.guides.find((x) => x.slug === slug);
    if (g) return g;
  }
  return undefined;
}

export function getCategoryByGuideSlug(slug: string): GuideCategory | undefined {
  for (const cat of GUIDE_CATEGORIES) {
    if (cat.guides.some((g) => g.slug === slug)) return cat;
  }
  return undefined;
}

export function getYouTubeVideoId(url: string): string | null {
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (short?.[1]) return short[1];
  const v = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (v?.[1]) return v[1];
  const embed = url.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embed?.[1]) return embed[1];
  return null;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
