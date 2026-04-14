import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import {
  GUIDE_PROVIDERS,
  WRITTEN_GUIDES,
  getYouTubeVideoId,
  getYouTubeThumbnailUrl,
  type GuideProvider,
} from '~/lib/guides/config';

/* ─── Video thumbnail card ───────────────────────────────── */

const VideoCard = component$<{ url: string; title?: string; providerName: string }>(
  ({ url, title, providerName }) => {
    const videoId = getYouTubeVideoId(url);
    const thumb = videoId ? getYouTubeThumbnailUrl(videoId) : null;

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        class="group relative block border border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.4)] hover:border-[rgba(70,151,195,0.4)] transition-all duration-500 overflow-hidden"
        data-native-link
      >
        {/* Thumbnail — 16:9 aspect ratio to match YouTube */}
        {thumb ? (
          <div class="relative aspect-video">
            <img
              src={thumb}
              alt={title ?? 'Video'}
              class="w-full h-full object-cover"
              width={480}
              height={270}
              loading="lazy"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-10 h-10 bg-[rgba(70,151,195,0.85)] flex items-center justify-center opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div class="aspect-video flex items-center justify-center text-[var(--text-dim)] text-xs font-mono bg-[rgba(26,26,26,0.6)]">
            VIDEO
          </div>
        )}

        {/* Title */}
        <div class="px-2.5 py-2">
          {title ? (
            <p class="text-[11px] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-300 leading-tight line-clamp-2">
              {title}
            </p>
          ) : (
            <p class="text-[10px] text-[var(--text-dim)] font-mono">{providerName}</p>
          )}
        </div>

        {/* Bottom accent line on hover */}
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-full h-px bg-[var(--accent)] transition-all duration-700" />
      </a>
    );
  },
);

/* ─── Provider hero section ──────────────────────────────── */

const ProviderSection = component$<{ provider: GuideProvider }>(({ provider }) => {
  const i18n = useI18n();
  const videos = provider.items.filter((it) => it.type === 'video');
  const playlist = provider.items.find((it) => it.type === 'playlist');
  const MAX = 8;
  const preview = videos.slice(0, MAX);

  return (
    <div class="group/provider relative bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.8)] border border-[rgba(51,51,51,0.15)] overflow-hidden">
      {/* Subtle radial glow */}
      <div
        class="absolute inset-0 opacity-0 group-hover/provider:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(70,151,195,0.04) 0%, transparent 60%)' }}
      />

      {/* Corner brackets */}
      <div class="absolute top-3 left-3 w-4 h-4 border-t border-l border-[rgba(70,151,195,0.15)] group-hover/provider:border-[rgba(70,151,195,0.4)] transition-colors duration-500" />
      <div class="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-[rgba(70,151,195,0.15)] group-hover/provider:border-[rgba(70,151,195,0.4)] transition-colors duration-500" />

      {/* Provider header */}
      <div class="relative z-10 flex items-start justify-between px-5 pt-5 pb-3">
        <div class="flex items-center gap-3">
          {/* YouTube play icon */}
          <div class="w-9 h-9 bg-[rgba(195,70,70,0.12)] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[var(--red)]">
              <polygon points="6,3 20,12 6,21" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-mono tracking-[0.2em] uppercase text-[var(--text)] font-semibold">
              {provider.name}
            </h2>
            {provider.description && (
              <p class="text-[10px] text-[var(--text-dim)] mt-0.5 max-w-lg leading-relaxed">
                {provider.description}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons — larger, more prominent */}
        <div class="flex gap-2 shrink-0 mt-1">
          {provider.channelUrl && (
            <a
              href={provider.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] border border-[rgba(70,151,195,0.3)] hover:bg-[rgba(70,151,195,0.1)] hover:border-[rgba(70,151,195,0.6)] transition-all duration-300 flex items-center gap-1.5"
              data-native-link
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-60">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Channel
            </a>
          )}
          {playlist && 'playlistUrl' in playlist && (
            <a
              href={playlist.playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 text-[10px] font-mono uppercase tracking-wider bg-[rgba(70,151,195,0.1)] text-[var(--accent)] border border-[rgba(70,151,195,0.3)] hover:bg-[rgba(70,151,195,0.2)] hover:border-[rgba(70,151,195,0.6)] transition-all duration-300 flex items-center gap-1.5"
              data-native-link
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-60">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {playlist.title ?? t(i18n, 'guides.viewMore')}
            </a>
          )}
        </div>
      </div>

      {/* Video grid — max-width keeps thumbnails from stretching on wide screens */}
      <div class="relative z-10 px-5 pb-5">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {preview.map((item, i) =>
            item.type === 'video' ? (
              <VideoCard
                key={`${provider.id}-${i}`}
                url={item.url}
                title={item.title}
                providerName={provider.name}
              />
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
});

/* ─── Main page ──────────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Header */}
      <div class="mb-6">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-3">
          {t(i18n, 'guides.tag')}
        </p>
        <h1 class="text-3xl font-semibold text-[var(--text)] tracking-tight">
          {t(i18n, 'guides.title')}
        </h1>
        <p class="text-sm text-[var(--text-dim)] mt-2 max-w-2xl">
          {t(i18n, 'guides.subtitle')}
        </p>
      </div>

      {/* Section label */}
      <div class="flex items-center gap-3 mb-3">
        <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.3em] uppercase">
          {t(i18n, 'guides.videoGuides')}
        </span>
        <div class="flex-1 h-px bg-[rgba(51,51,51,0.3)]" />
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 bg-[var(--green)] opacity-60" />
          <span class="text-[8px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
            {GUIDE_PROVIDERS.length} {t(i18n, 'guides.videoGuides').toLowerCase().includes('video') ? 'creators' : 'sources'}
          </span>
        </div>
      </div>

      {/* Provider sections */}
      <div class="grid grid-cols-1 gap-px mb-6">
        {GUIDE_PROVIDERS.map((provider) => (
          <ProviderSection key={provider.id} provider={provider} />
        ))}
      </div>

      {/* Written guide section */}
      {WRITTEN_GUIDES.length > 0 && (
        <>
          <div class="flex items-center gap-3 mb-3">
            <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.3em] uppercase">
              {t(i18n, 'guides.writtenGuides')}
            </span>
            <div class="flex-1 h-px bg-[rgba(51,51,51,0.3)]" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px mb-6">
            {WRITTEN_GUIDES.map((guide) => (
              <a
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                class="group relative flex flex-col justify-between bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.8)] border border-[rgba(51,51,51,0.15)] hover:border-[rgba(70,151,195,0.4)] transition-all duration-500 overflow-hidden p-5 min-h-[140px]"
              >
                {/* Glow */}
                <div
                  class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(70,151,195,0.06) 0%, transparent 60%)' }}
                />
                {/* Corner brackets */}
                <div class="absolute top-3 left-3 w-4 h-4 border-t border-l border-[rgba(70,151,195,0.15)] group-hover:border-[rgba(70,151,195,0.4)] transition-colors duration-500" />
                <div class="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-[rgba(70,151,195,0.15)] group-hover:border-[rgba(70,151,195,0.4)] transition-colors duration-500" />

                <div class="relative z-10">
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="w-1.5 h-1.5 bg-[var(--green)]" />
                    <span class="text-[8px] font-mono uppercase tracking-wider text-[var(--green)]">
                      {guide.status}
                    </span>
                  </div>
                  <h3 class="text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-300">
                    {guide.title}
                  </h3>
                  <p class="text-[11px] text-[var(--text-dim)] mt-1 leading-relaxed">
                    {guide.description}
                  </p>
                  {guide.author && (
                    <p class="text-[9px] text-[var(--text-dim)] font-mono mt-2">
                      by <span class="text-[var(--accent)]">{guide.author}</span>
                    </p>
                  )}
                </div>

                {/* CTA arrow */}
                <div class="relative z-10 flex items-center gap-1.5 text-[var(--accent)] opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-500 mt-3">
                  <span class="text-[10px] font-mono tracking-[0.2em] uppercase">Read Guide</span>
                  <span class="text-sm">→</span>
                </div>

                {/* Bottom accent line */}
                <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-1/2 h-px bg-[var(--accent)] transition-all duration-700" />
              </a>
            ))}
          </div>
        </>
      )}

      {/* Community CTA */}
      <div class="relative bg-gradient-to-b from-[rgba(26,26,26,0.3)] to-[rgba(26,26,26,0.8)] border border-[rgba(51,51,51,0.15)] overflow-hidden">
        {/* Corner brackets */}
        <div class="absolute top-4 left-4 w-5 h-5 border-t border-l border-[rgba(70,151,195,0.15)]" />
        <div class="absolute bottom-4 right-4 w-5 h-5 border-b border-r border-[rgba(70,151,195,0.15)]" />

        <div class="relative z-10 px-6 py-10 flex flex-col items-center text-center">
          <span class="text-[var(--accent)] text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 mb-3">
            // community_operations
          </span>
          <p class="text-[var(--accent)] text-lg font-mono tracking-[0.2em] uppercase mb-2">
            {t(i18n, 'guides.communityTitle')}
          </p>
          <div class="flex items-center gap-2 mb-4">
            <span class="w-2 h-2 bg-[rgba(195,170,70,1)] animate-pulse" />
            <span class="text-[9px] font-mono tracking-[0.2em] uppercase text-[rgba(195,170,70,1)]">
              {t(i18n, 'guides.contributorsNeeded')}
            </span>
          </div>
          <p class="text-xs text-[var(--text-dim)] max-w-lg mb-6 leading-relaxed">
            {t(i18n, 'guides.communityDesc')}
          </p>
          <div class="flex gap-3">
            <a
              href="https://discord.gg/Z8JqbQmssg"
              target="_blank"
              rel="noopener noreferrer"
              class="px-5 py-2.5 bg-[var(--accent)] text-white text-[10px] font-mono uppercase tracking-wider hover:bg-[rgba(70,151,195,0.8)] transition-colors"
              data-native-link
            >
              {t(i18n, 'guides.joinDiscord')}
            </a>
            <a
              href="https://discord.gg/e9ZVRHBX8V"
              target="_blank"
              rel="noopener noreferrer"
              class="px-5 py-2.5 border border-[rgba(70,151,195,0.4)] text-[var(--accent)] text-[10px] font-mono uppercase tracking-wider hover:bg-[rgba(70,151,195,0.1)] hover:border-[rgba(70,151,195,0.6)] transition-all duration-300"
              data-native-link
            >
              {t(i18n, 'guides.submitGuide')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'BA HUB - Guides',
  meta: [
    {
      name: 'description',
      content: 'Community guides covering basics to advanced competitive strategies for Broken Arrow.',
    },
  ],
};
