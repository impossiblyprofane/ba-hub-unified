import { component$, type PropFunction } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';

/**
 * Shared error view for client-side data fetch failures.
 * Used by routes converted from routeLoader$ to useResource$.
 *
 * Pass a `retry$` callback to show a retry button. Pass `backHref` / `backLabelKey`
 * to show a "back to X" link.
 */
export interface GenericErrorViewProps {
  titleKey: string;
  messageKey?: string;
  error?: unknown;
  retry$?: PropFunction<() => void>;
  backHref?: string;
  backLabelKey?: string;
}

export const GenericErrorView = component$<GenericErrorViewProps>(
  ({ titleKey, messageKey, error, retry$, backHref, backLabelKey }) => {
    const i18n = useI18n();
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : null;

    return (
      <div class="w-full max-w-[2000px] mx-auto">
        {backHref && backLabelKey && (
          <a
            href={backHref}
            class="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
          >
            ← {t(i18n, backLabelKey)}
          </a>
        )}
        <div class="p-6 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          <p class="text-[var(--red)] text-xs font-mono tracking-[0.3em] uppercase mb-2">
            {t(i18n, titleKey)}
          </p>
          {messageKey && (
            <p class="text-sm text-[var(--text)] mb-2">{t(i18n, messageKey)}</p>
          )}
          {errorMessage && (
            <p class="text-[10px] font-mono text-[var(--text-dim)] mt-2 break-all">
              {errorMessage}
            </p>
          )}
          {retry$ && (
            <button
              class="mt-4 px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-[var(--accent)] text-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)] transition-colors"
              onClick$={retry$}
            >
              {t(i18n, 'errors.retry')}
            </button>
          )}
        </div>
      </div>
    );
  },
);
