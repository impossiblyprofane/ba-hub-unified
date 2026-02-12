/**
 * GameIcon — renders a game-sourced PNG icon with consistent sizing,
 * optional fallback, and CSS-filter variants for visual consistency.
 *
 *  variant="original"  — render as-is (default)
 *  variant="white"     — force white via brightness + invert
 *  variant="accent"    — tint to accent blue
 *  glow                — adds a soft drop-shadow halo
 */
import { component$ } from '@builder.io/qwik';
import { UtilIconPaths } from '~/lib/iconPaths';

export type IconVariant = 'original' | 'white' | 'accent';

interface GameIconProps {
  /** Path to the icon image (use UtilIconPaths or path builders) */
  src: string;
  /** Display size in px (square) */
  size?: number;
  /** Additional CSS classes */
  class?: string;
  /** Alt text */
  alt?: string;
  /** Color variant — controls CSS filter applied to the image */
  variant?: IconVariant;
  /** Adds a soft glow halo behind the icon */
  glow?: boolean;
}

const variantClass: Record<IconVariant, string> = {
  original: '',
  white: 'icon-white',
  accent: 'icon-accent',
};

export const GameIcon = component$<GameIconProps>(
  ({ src, size = 20, class: cls, alt = '', variant = 'original', glow = false }) => {
    const resolvedSize = Math.max(1, Math.round(size));
    const inlineSize = `${resolvedSize}px`;
    const classes = [
      'game-icon',
      variantClass[variant],
      glow && 'icon-glow',
      cls,
    ].filter(Boolean).join(' ');

    return (
      <img
        src={src}
        alt={alt}
        width={resolvedSize}
        height={resolvedSize}
        loading="lazy"
        class={classes}
        style={{ width: inlineSize, height: inlineSize }}
        onError$={(e) => {
          const img = e.target as HTMLImageElement;
          if (!img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = UtilIconPaths.PLACEHOLDER;
          }
        }}
      />
    );
  },
);
