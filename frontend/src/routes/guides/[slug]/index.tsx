import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import { getGuideBySlug, getCategoryByGuideSlug } from '~/lib/guides/config';

/* ─── Route loader ───────────────────────────────────────── */

export const useGuideContent = routeLoader$(async (requestEvent) => {
  const slug = requestEvent.params.slug;
  const guide = getGuideBySlug(slug);

  if (!guide || !guide.available || !guide.filePath) {
    throw requestEvent.redirect(302, '/guides');
  }

  // Fetch the markdown file content at build/SSR time
  try {
    const baseUrl = requestEvent.url.origin;
    const res = await fetch(`${baseUrl}/guides/${guide.filePath}`);
    if (!res.ok) return { guide, category: getCategoryByGuideSlug(slug) ?? null, content: null };
    const content = await res.text();
    return { guide, category: getCategoryByGuideSlug(slug) ?? null, content };
  } catch {
    return { guide, category: getCategoryByGuideSlug(slug) ?? null, content: null };
  }
});

/* ─── Markdown renderer (client-side) ────────────────────── */

const MarkdownContent = component$<{ content: string }>(({ content }) => {
  const htmlRef = useSignal<string>('');

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    // Simple markdown to HTML conversion for headings, paragraphs, lists, code, links
    // This is lightweight — no external markdown library needed for basic guide content
    let html = content;

    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Headers — add IDs for TOC anchoring
    html = html.replace(/^######\s+(.+)$/gm, '<h6 id="$1" class="text-xs font-mono text-[var(--text-dim)] mt-4 mb-1">$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5 id="$1" class="text-xs font-mono text-[var(--text)] mt-4 mb-1">$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4 id="$1" class="text-sm font-semibold text-[var(--text)] mt-5 mb-2">$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3 id="$1" class="text-base font-semibold text-[var(--accent)] mt-6 mb-2">$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2 id="$1" class="text-lg font-bold text-[var(--accent)] mt-8 mb-3 pb-2 border-b border-[rgba(51,51,51,0.3)]">$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1 id="$1" class="text-xl font-bold text-[var(--text)] mt-6 mb-4">$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text)]">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-[rgba(26,26,26,0.6)] text-[var(--accent)] px-1 py-0.5 text-[11px] font-mono">$1</code>');

    // Links
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[var(--accent)] hover:underline">$1</a>',
    );

    // Images
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="max-w-full my-4 border border-[rgba(51,51,51,0.2)]" loading="lazy" />',
    );

    // Unordered lists
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 text-sm text-[var(--text-dim)] py-0.5">• $1</li>');

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 text-sm text-[var(--text-dim)] py-0.5 list-decimal">$1</li>');

    // Blockquotes
    html = html.replace(
      /^&gt;\s+(.+)$/gm,
      '<blockquote class="border-l-2 border-[var(--accent)] pl-3 my-3 text-sm text-[var(--text-dim)] italic">$1</blockquote>',
    );

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr class="my-6 border-[rgba(51,51,51,0.3)]" />');

    // Paragraphs (wrap remaining lines)
    html = html
      .split('\n\n')
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr') || trimmed.startsWith('<img')) {
          return trimmed;
        }
        return `<p class="text-sm text-[var(--text-dim)] leading-relaxed my-2">${trimmed.replace(/\n/g, '<br />')}</p>`;
      })
      .join('\n');

    htmlRef.value = html;
  });

  return (
    <div
      class="guide-content"
      dangerouslySetInnerHTML={htmlRef.value || '<p class="text-[var(--text-dim)] text-sm">Loading...</p>'}
    />
  );
});

/* ─── Main component ─────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();
  const data = useGuideContent();
  const guide = data.value.guide;
  const category = data.value.category;
  const content = data.value.content;

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Back link */}
      <a
        href="/guides"
        class="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
      >
        ← {t(i18n, 'guides.backToGuides')}
      </a>

      {/* Header */}
      <div class="mb-4">
        <p class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase mb-2">
          {category?.title ?? t(i18n, 'guides.title')}
        </p>
        <h1 class="text-2xl font-semibold text-[var(--text)] tracking-tight">
          {guide.title}
        </h1>
        <p class="text-sm text-[var(--text-dim)] mt-1">{guide.description}</p>
        {guide.author && (
          <p class="text-xs text-[var(--text-dim)] font-mono mt-2">
            by <span class="text-[var(--accent)]">{guide.author}</span>
          </p>
        )}
      </div>

      {/* Content */}
      <div class="p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
        <div class="p-6 md:p-8">
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <p class="text-sm text-[var(--text-dim)]">{t(i18n, 'guides.loadError')}</p>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useGuideContent);
  const title = data?.guide?.title ?? 'Guide';
  return {
    title: `${title} - Guides - BA Hub`,
    meta: [
      {
        name: 'description',
        content: data?.guide?.description ?? 'Community guide for Broken Arrow.',
      },
    ],
  };
};
