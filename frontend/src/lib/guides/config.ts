/**
 * Guide configuration — video providers and written guide definitions.
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

// ── Video Providers ────────────────────────────────────────

export const GUIDE_PROVIDERS: GuideProvider[] = [
  {
    id: 'lima',
    name: 'LIMA',
    description: 'Active serving British Officer. Broken Arrow Academy courses, deck guides, and in-depth tactical analysis.',
    channelUrl: 'https://www.youtube.com/@Lima_BrokenArrow',
    items: [
      { type: 'video', url: 'https://youtu.be/6vLiReZeHZQ', title: 'What Units do the Pros Use — BA Stats' },
      { type: 'video', url: 'https://youtu.be/AZAphO3wOuk', title: 'Best Baltic DLC Deck Combo — Marines' },
      { type: 'video', url: 'https://youtu.be/wcdCg5oL2lM', title: 'Best Baltic Spec Combinations' },
      { type: 'video', url: 'https://youtu.be/yCeahZ43Yc0', title: 'All Baltic Stats + Best Spec Combos' },
      { type: 'video', url: 'https://youtu.be/dQ2wlqnsH1E', title: 'New Map — Tactical Analysis' },
      { type: 'video', url: 'https://youtu.be/ybhQgD3v7WI', title: 'Exclusive Baltic Units First Look' },
      { type: 'video', url: 'https://youtu.be/KpukGdmSv2c', title: 'Soviet Doctrine — How to Win as Russia' },
      { type: 'video', url: 'https://youtu.be/FVZu6eR0jNk', title: 'Emergency Paradrop — Baltic Airborne' },
      { type: 'playlist', playlistUrl: 'https://www.youtube.com/playlist?list=PL1JXhC8ws2zlhcy9tMy5SSvOy6HBN_PZv', title: 'Broken Academy — 70 Lessons' },
    ],
  },
  {
    id: 'beaglerush',
    name: 'Beaglerush',
    description: 'In-depth match reviews, unit guides, beginner deck tutorials, and tactical tips for competitive play.',
    channelUrl: 'https://www.youtube.com/@Beaglerush',
    items: [
      { type: 'video', url: 'https://youtu.be/X5D_vUfHkMI', title: 'Lithuanian Units Baltic Spec Analysis' },
      { type: 'video', url: 'https://youtu.be/rpA06__AwRI', title: 'How to Understand Infantry — Unit Guide' },
      { type: 'video', url: 'https://youtu.be/rzP7sZtx3U4', title: 'How to Spread Damage by Stacking Infantry' },
      { type: 'video', url: 'https://youtu.be/AhpSCLTgidA', title: 'How to Unload Infantry Faster — Tips' },
      { type: 'video', url: 'https://youtu.be/Dy1NJWZ7PVY', title: 'Your First US Deck: Crayons — Beginner Guide' },
      { type: 'video', url: 'https://youtu.be/rpA06__AwRI', title: 'Using Airborne/Armored on Defense' },
      { type: 'video', url: 'https://youtu.be/AhpSCLTgidA', title: 'Custom Colours — Know When Outnumbered' },
      { type: 'video', url: 'https://youtu.be/rzP7sZtx3U4', title: 'Cruise Missile Meta Analysis' },
    ],
  },
  {
    id: 'koraske',
    name: 'Koraske',
    description: 'Unit guides, threats to armor series, and in-depth Broken Arrow tutorials. 44 video BA playlist.',
    channelUrl: 'https://www.youtube.com/@Koraske_YT',
    items: [
      { type: 'video', url: 'https://youtu.be/g8GnnlHT0jM', title: 'How to use Strykers (All 8 Variants)' },
      { type: 'video', url: 'https://youtu.be/6xCzNW3S8r4', title: 'How to use BMP (All 11 Variants)' },
      { type: 'video', url: 'https://youtu.be/zeZ3MU8YiOY', title: 'How to use T14 / T15' },
      { type: 'video', url: 'https://youtu.be/FVZu6eR0jNk', title: 'Threats to Armor — Against Infantry AT' },
      { type: 'video', url: 'https://youtu.be/KpukGdmSv2c', title: 'Threats to Armor — Against ATGM Units' },
      { type: 'video', url: 'https://youtu.be/wcdCg5oL2lM', title: 'Threats to Armor — Against MBTs' },
      { type: 'video', url: 'https://youtu.be/dQ2wlqnsH1E', title: 'How to use Delta Force' },
      { type: 'video', url: 'https://youtu.be/ybhQgD3v7WI', title: 'T-14 Armata vs M1A2 SEP V3' },
      { type: 'playlist', playlistUrl: 'https://www.youtube.com/playlist?list=PL9t3-mUgzNkweleHqCJFyxlyk7NOVuIwk', title: 'Full Broken Arrow Playlist — 44 Videos' },
    ],
  },
];

// ── Written Guides ─────────────────────────────────────────

export const WRITTEN_GUIDES: Guide[] = [
  {
    title: 'How to Recon',
    description: 'Essential reconnaissance tactics and positioning',
    status: 'ACTIVE',
    available: true,
    slug: 'how-to-recon',
    author: 'PiousShadow',
    filePath: 'getting-started/how-to-recon.md',
  },
];

// ── Utility Functions ──────────────────────────────────────

export function getGuideBySlug(slug: string): Guide | undefined {
  return WRITTEN_GUIDES.find((g) => g.slug === slug);
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
