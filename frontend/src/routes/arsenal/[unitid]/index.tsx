import { component$, useSignal, useResource$, Resource, $, useVisibleTask$ } from '@builder.io/qwik';
import { useLocation, Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import type { UnitDetailModSlot, UnitDetailData } from '~/lib/graphql-types';
import { UNIT_DETAIL_QUERY } from '~/lib/queries/unit-detail';
import { UnitDetailView } from '~/components/unit-detail/UnitDetailView';
import { ShareButton } from '~/components/share/ShareButton';
import { IconCompare } from '~/components/icons';

/* ── Helpers ────────────────────────────────────────────────────── */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

async function fetchUnitDetail(id: number, optionIds: number[]): Promise<UnitDetailData> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: UNIT_DETAIL_QUERY,
      variables: { id, optionIds: optionIds.length ? optionIds : null },
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json() as { data?: { unitDetail: UnitDetailData }; errors?: Array<{ message: string }> };
  if (!json.data?.unitDetail) {
    throw new Error(json.errors?.map(e => e.message).join(', ') || 'Unit not found');
  }
  return json.data.unitDetail;
}

/* ── Page Component ─────────────────────────────────────────────── */

export default component$(() => {
  const loc = useLocation();
  const unitId = parseInt(loc.params.unitid, 10);
  const i18n = useI18n();

  // Selected option IDs — empty = use server defaults
  const selectedOptionIds = useSignal<number[]>([]);
  const isRefetching = useSignal(false);
  const cachedData = useSignal<UnitDetailData | null>(null);

  // Reactive data resource
  const unitResource = useResource$<UnitDetailData>(async ({ track, cleanup }) => {
    const optIds = track(() => selectedOptionIds.value);
    const ctrl = new AbortController();
    cleanup(() => ctrl.abort());

    isRefetching.value = optIds.length > 0;
    try {
      const data = await fetchUnitDetail(unitId, optIds);
      return data;
    } finally {
      isRefetching.value = false;
    }
  });

  // URL sync: update search params when options change (for shareability)
  useVisibleTask$(({ track }) => {
    const opts = track(() => selectedOptionIds.value);
    if (opts.length > 0) {
      const url = new URL(window.location.href);
      url.searchParams.set('m', opts.join('-'));
      window.history.replaceState({}, '', url.toString());
    }
  });

  // On mount: read URL params and apply
  useVisibleTask$(() => {
    const url = new URL(window.location.href);
    const m = url.searchParams.get('m');
    if (m) {
      const ids = m.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
      if (ids.length) selectedOptionIds.value = ids;
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
            href={`/arsenal/compare?a=${unitId}`}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)]/40 transition-colors"
          >
            <IconCompare size={14} />
            {t(i18n, 'compare.title')}
          </Link>
          <ShareButton unitData={cachedData.value} />
        </div>
      </div>

      <Resource
        value={unitResource}
        onPending={() => {
          if (cachedData.value) {
            return (
              <div class="relative">
                <UnitDetailView
                  data={cachedData.value}
                  isRefetching={true}
                  onOptionChange$={handleOptionChange$}
                />
                <div class="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-none" />
              </div>
            );
          }
          return (
            <div class="p-8">
              <div class="text-sm font-mono text-[var(--text-dim)] animate-pulse">Loading unit data…</div>
            </div>
          );
        }}
        onRejected={(err) => (
          <div class="p-8">
            <p class="text-[var(--red)] text-sm font-mono">Error: {(err as Error).message}</p>
            <Link href="/arsenal" class="text-xs text-[var(--accent)] mt-4 inline-block">
              Return to Arsenal
            </Link>
          </div>
        )}
        onResolved={(data) => {
          cachedData.value = data;
          return (
            <UnitDetailView
              data={data}
              isRefetching={isRefetching.value}
              onOptionChange$={handleOptionChange$}
            />
          );
        }}
      />
    </div>
  );
});

/* ── Head ────────────────────────────────────────────────────────── */

export const head: DocumentHead = ({ params }) => {
  return {
    title: `Unit ${params.unitid} - BA Hub`,
    meta: [
      { name: 'description', content: `Unit details and configuration for unit ${params.unitid}` },
    ],
  };
};
