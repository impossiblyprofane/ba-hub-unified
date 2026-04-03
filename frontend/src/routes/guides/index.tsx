import { component$, Slot } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import {
  GUIDE_CATEGORIES,
  GUIDE_PROVIDERS,
  getTotalGuides,
  getAvailableGuides,
  getYouTubeVideoId,
  getYouTubeThumbnailUrl,
  type GuideProvider,
  type Guide,
} from '~/lib/guides/config';

/* ─── Panel wrapper ──────────────────────────────────────── */

const Panel = component$<{ title: string }>(({ title }) => (
  <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
      {title}
    </p>
    <div class="p-3">
      <Slot />
    </div>
  </div>
));

/* ─── Video card ─────────────────────────────────────────── */

const VideoCard = component$<{ url: string; providerName: string }>(({ url, providerName }) => {
  const videoId = getYouTubeVideoId(url);
  const thumb = videoId ? getYouTubeThumbnailUrl(videoId) : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      class="group block border border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.4)] hover:bg-[rgba(70,151,195,0.05)] hover:border-[rgba(70,151,195,0.3)] transition-all overflow-hidden"
      data-native-link
    >
      {thumb ? (
        <div class="relative">
          <img
            src={thumb}
            alt="Video thumbnail"
            class="w-full h-36 object-cover"
            width={320}
            height={180}
            loading="lazy"
          />
          <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div class="w-10 h-10 bg-[rgba(70,151,195,0.9)] flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div class="h-36 flex items-center justify-center text-[var(--text-dim)]">Video</div>
      )}
      <div class="p-2">
        <p class="text-[10px] text-[var(--text-dim)] font-mono">{providerName}</p>
      </div>
    </a>
  );
});

/* ─── Main component ─────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();
  const availableGuides = getAvailableGuides();
  const totalGuides = getTotalGuides();
  const MAX_PREVIEW_VIDEOS = 8;

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

      <div class="flex flex-col gap-4">
        {/* ═══ Video Providers ═══ */}
        <Panel title={t(i18n, 'guides.videoGuides')}>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {GUIDE_PROVIDERS.map((provider: GuideProvider) => {
              const videos = provider.items.filter((it) => it.type === 'video');
              const preview = videos.slice(0, MAX_PREVIEW_VIDEOS);
              const playlist = provider.items.find((it) => it.type === 'playlist');

              return (
                <div
                  key={provider.id}
                  class="border border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.3)] p-3"
                >
                  {/* Provider header */}
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <p class="text-sm font-mono tracking-[0.2em] uppercase text-[var(--accent)]">
                        {provider.name}
                      </p>
                      {provider.description && (
                        <p class="text-[10px] text-[var(--text-dim)] mt-0.5">{provider.description}</p>
                      )}
                    </div>
                    {provider.channelUrl && (
                      <a
                        href={provider.channelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-[9px] font-mono uppercase text-[var(--accent)] hover:underline"
                        data-native-link
                      >
                        Channel →
                      </a>
                    )}
                  </div>

                  {/* Video grid */}
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {preview.map((item, i) =>
                      item.type === 'video' ? (
                        <VideoCard key={`${provider.id}-${i}`} url={item.url} providerName={provider.name} />
                      ) : null,
                    )}
                  </div>

                  {/* Playlist / more link */}
                  {(videos.length > MAX_PREVIEW_VIDEOS || playlist) && (
                    <div class="mt-3 flex justify-end">
                      <a
                        href={
                          playlist && 'playlistUrl' in playlist
                            ? playlist.playlistUrl
                            : provider.channelUrl ?? '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] border border-[rgba(70,151,195,0.3)] px-2 py-1 hover:bg-[rgba(70,151,195,0.1)] transition-colors"
                        data-native-link
                      >
                        {t(i18n, 'guides.viewMore')} →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ═══ Written Guides ═══ */}
        <Panel title={t(i18n, 'guides.writtenGuides')}>
          <div class="flex flex-col gap-3">
            {GUIDE_CATEGORIES.map((cat) => (
              <div key={cat.title}>
                <div class="flex items-center gap-2 mb-2">
                  <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)]">
                    {cat.title}
                  </p>
                  <span
                    class={`text-[8px] font-mono uppercase ${
                      cat.status === 'ONLINE' ? 'text-[var(--green)]' : 'text-[rgba(195,170,70,1)]'
                    }`}
                  >
                    {cat.status}
                  </span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cat.guides.map((guide: Guide) => (
                    <div key={guide.slug}>
                      {guide.available && guide.filePath ? (
                        <a
                          href={`/guides/${guide.slug}`}
                          class="group block p-3 border border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.3)] hover:border-[rgba(70,151,195,0.3)] hover:bg-[rgba(70,151,195,0.05)] transition-all"
                        >
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs text-[var(--text)] group-hover:text-[var(--accent)] transition-colors font-medium">
                              {guide.title}
                            </span>
                            <span class="w-1.5 h-1.5 bg-[var(--green)] opacity-60" />
                          </div>
                          <p class="text-[10px] text-[var(--text-dim)]">{guide.description}</p>
                          {guide.author && (
                            <p class="text-[9px] text-[var(--text-dim)] mt-1 font-mono">
                              by {guide.author}
                            </p>
                          )}
                        </a>
                      ) : (
                        <div class="p-3 border border-[rgba(51,51,51,0.1)] bg-[rgba(26,26,26,0.2)] opacity-50">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs text-[var(--text-dim)]">{guide.title}</span>
                            <span class="text-[8px] font-mono uppercase text-[rgba(195,170,70,0.7)]">
                              {guide.status}
                            </span>
                          </div>
                          <p class="text-[10px] text-[var(--text-dim)]">{guide.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ═══ Community CTA ═══ */}
        <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          <div class="px-6 py-10 flex flex-col items-center text-center">
            <p class="text-[var(--accent)] text-lg font-mono tracking-[0.3em] uppercase mb-2">
              {t(i18n, 'guides.communityTitle')}
            </p>
            <div class="flex items-center gap-2 mb-4">
              <span class="w-2 h-2 bg-[rgba(195,170,70,1)] animate-pulse" />
              <span class="text-[10px] font-mono tracking-[0.2em] uppercase text-[rgba(195,170,70,1)]">
                {t(i18n, 'guides.contributorsNeeded')}
              </span>
            </div>
            <p class="text-sm text-[var(--text-dim)] max-w-xl mb-6">
              {availableGuides} {t(i18n, 'guides.availableOf')} {totalGuides} {t(i18n, 'guides.guidesCreated')}
            </p>
            <div class="flex gap-3">
              <a
                href="https://discord.gg/Z8JqbQmssg"
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-2 bg-[var(--accent)] text-white text-xs font-mono uppercase tracking-wider hover:bg-[rgba(70,151,195,0.8)] transition-colors"
                data-native-link
              >
                {t(i18n, 'guides.joinDiscord')}
              </a>
              <a
                href="https://discord.gg/e9ZVRHBX8V"
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-2 border border-[var(--accent)] text-[var(--accent)] text-xs font-mono uppercase tracking-wider hover:bg-[rgba(70,151,195,0.1)] transition-colors"
                data-native-link
              >
                {t(i18n, 'guides.submitGuide')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Guides - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Community guides covering basics to advanced competitive strategies for Broken Arrow.',
    },
  ],
};
