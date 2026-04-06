import { component$ } from '@builder.io/qwik';
import type { SteamProfile } from '~/lib/graphql-types';

type Size = 'xs' | 'sm' | 'md';

type SteamAvatarProps = {
  steamId?: string | null;
  profile?: SteamProfile | null;
  /** In-game name used as fallback for the tooltip when no persona available. */
  name?: string | null;
  size?: Size;
  /** When true (default), wrap in an <a> pointing at the Steam profile URL. */
  linkToProfile?: boolean;
};

const SIZE_PX: Record<Size, number> = {
  xs: 20,
  sm: 28,
  md: 56,
};

/** Inline placeholder — soldier silhouette on the raised-bg color. */
const PLACEHOLDER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
      `<rect width="32" height="32" fill="#242424"/>` +
      `<circle cx="16" cy="12" r="5" fill="#444"/>` +
      `<path d="M6 28c0-5 4.5-9 10-9s10 4 10 9" fill="#444"/>` +
    `</svg>`,
  );

/**
 * Renders a Steam avatar image at a fixed pixel size.
 * Falls back to a neutral silhouette placeholder while the profile is unresolved
 * or if the player is missing from Steam's response.
 */
export const SteamAvatar = component$<SteamAvatarProps>(
  ({ steamId, profile, name, size = 'sm', linkToProfile = true }) => {
    const px = SIZE_PX[size];
    const src = profile?.avatarMedium ?? profile?.avatarIcon ?? PLACEHOLDER_SVG;
    const tooltip = profile?.personaName ?? name ?? steamId ?? '';

    const img = (
      <img
        src={src}
        width={px}
        height={px}
        alt={tooltip || 'Player avatar'}
        title={tooltip}
        loading="lazy"
        decoding="async"
        class="rounded-sm border border-[rgba(51,51,51,0.3)] object-cover flex-shrink-0"
        style={{ width: `${px}px`, height: `${px}px` }}
      />
    );

    const href = linkToProfile
      ? (profile?.profileUrl ?? (steamId ? `https://steamcommunity.com/profiles/${steamId}` : null))
      : null;

    if (!href) return img;

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-native-link
        class="inline-flex flex-shrink-0 hover:opacity-80 transition-opacity"
        aria-label={tooltip ? `View ${tooltip} on Steam` : 'View Steam profile'}
      >
        {img}
      </a>
    );
  },
);
