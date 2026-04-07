import { component$, useSignal, $, useVisibleTask$ } from '@builder.io/qwik';
import { useLocation, Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import type { UnitDetailModSlot, UnitDetailData } from '~/lib/graphql-types';
import { UNIT_DETAIL_QUERY } from '~/lib/queries/unit-detail';
import { graphqlFetch } from '~/lib/graphqlClient';
import { UnitDetailView } from '~/components/unit-detail/UnitDetailView';
import { ShareButton } from '~/components/share/ShareButton';
import { IconCompare } from '~/components/icons';

/* ── Helpers ────────────────────────────────────────────────────── */

async function fetchUnitDetail(
  id: number,
  optionIds: number[],
  signal?: AbortSignal,
): Promise<UnitDetailData> {
  const data = await graphqlFetch<{ unitDetail: UnitDetailData | null }>(
    UNIT_DETAIL_QUERY,
    { id, optionIds: optionIds.length ? optionIds : null },
    { signal },
  );
  if (!data.unitDetail) {
    throw new Error('Unit not found');
  }
  return data.unitDetail;
}

/* ── Page Component ─────────────────────────────────────────────── */

export default component$(() => {
  const loc = useLocation();
  const i18n = useI18n();

  // Selected option IDs — empty = use server defaults
  const selectedOptionIds = useSignal<number[]>([]);
  const isRefetching = useSignal(false);
  const cachedData = useSignal<UnitDetailData | null>(null);
  const unitError = useSignal<unknown>(null);

  // Client-only data fetching via useVisibleTask$ — tracks route param + selected options.
  // Tracking loc.params.unitid ensures re-fetch on same-route navigation
  // (e.g. clicking a transport link from one unit to another). The task is
  // browser-only so the initial HTML response contains no unit data.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const unitIdParam = track(() => loc.params.unitid);
    const optIds = track(() => selectedOptionIds.value);

    const currentUnitId = parseInt(unitIdParam, 10);
    const ctrl = new AbortController();
    cleanup(() => ctrl.abort());

    isRefetching.value = optIds.length > 0;
    unitError.value = null;
    // Only null the cache on fresh unit loads, not on option swaps —
    // that way mod swaps show the stale-with-overlay state instead of
    // a full "loading…" flash.
    if (optIds.length === 0) {
      cachedData.value = null;
    }

    fetchUnitDetail(currentUnitId, optIds, ctrl.signal)
      .then((data) => {
        cachedData.value = data;
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        unitError.value = err;
      })
      .finally(() => {
        isRefetching.value = false;
      });
  });

  // On mount: read URL params and apply.
  // On subsequent same-route navigations: reset stale modification selections.
  const initialised = useSignal(false);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => loc.params.unitid);
    if (!initialised.value) {
      initialised.value = true;
      const url = new URL(window.location.href);
      const m = url.searchParams.get('m');
      if (m) {
        const ids = m.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
        if (ids.length) selectedOptionIds.value = ids;
      }
    } else {
      // Navigated to a different unit — clear old mod selections + cached data
      selectedOptionIds.value = [];
      cachedData.value = null;
      // Also strip leftover ?m= param from the URL bar
      const url = new URL(window.location.href);
      if (url.searchParams.has('m')) {
        url.searchParams.delete('m');
        window.history.replaceState({}, '', url.toString());
      }
    }
  });

  // URL sync: update search params when options change (for shareability)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const opts = track(() => selectedOptionIds.value);
    if (opts.length > 0) {
      const url = new URL(window.location.href);
      url.searchParams.set('m', opts.join('-'));
      window.history.replaceState({}, '', url.toString());
    }
  });

  // Modification change handler
  const handleOptionChange$ = $((modId: number, newOptionId: number, modifications: UnitDetailModSlot[]) => {
    const newIds = modifications.map(mod => {
      if (mod.modification.Id === modId) return newOptionId;
      // Keep current selection for other mods
      const currentlySelected = selectedOptionIds.value.find(id =>
        mod.options.some(opt => opt.Id === id),
      );
      return currentlySelected ?? mod.selectedOptionId;
    });
    selectedOptionIds.value = newIds;
  });

  return (
    <div class="w-full max-w-[1600px] mx-auto">
      {/* Top bar: back link + actions */}
      <div class="flex items-center justify-between mb-4">
        <Link
          href="/arsenal"
          class="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
        >
          ← {t(i18n, 'nav.arsenal')}
        </Link>
        <div class="flex items-center gap-2">
          <Link
            href={`/arsenal/compare?a=${loc.params.unitid}`}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)]/40 transition-colors"
          >
            <IconCompare size={14} />
            {t(i18n, 'compare.title')}
          </Link>
          <ShareButton unitData={cachedData.value} />
        </div>
      </div>

      {unitError.value ? (
        <div class="p-8">
          <p class="text-[var(--red)] text-sm font-mono">
            Error: {(unitError.value as Error).message}
          </p>
          <Link href="/arsenal" class="text-xs text-[var(--accent)] mt-4 inline-block">
            Return to Arsenal
          </Link>
        </div>
      ) : cachedData.value ? (
        <div class={isRefetching.value ? 'relative' : ''}>
          <UnitDetailView
            data={cachedData.value}
            isRefetching={isRefetching.value}
            onOptionChange$={handleOptionChange$}
          />
          {isRefetching.value && (
            <div class="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-none" />
          )}
        </div>
      ) : (
        <div class="p-8">
          <div class="text-sm font-mono text-[var(--text-dim)] animate-pulse">
            Loading unit data…
          </div>
        </div>
      )}
    </div>
  );
});

/* ── Head ────────────────────────────────────────────────────────── */

export const head: DocumentHead = ({ params }) => {
  return {
    title: `BA HUB - Unit ${params.unitid}`,
    meta: [
      { name: 'description', content: `Unit details and configuration for unit ${params.unitid}` },
    ],
  };
};
