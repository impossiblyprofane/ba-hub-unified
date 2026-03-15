/**
 * /arsenal/compare — Side-by-side unit comparison page.
 *
 * URL params: ?a={unitId1}&b={unitId2}&ma={mods1}&mb={mods2}
 * Fetches both units via the existing unitDetail GraphQL query and renders
 * full UnitDetailView instances side-by-side with independent mod controls.
 */

import { component$, useSignal, useResource$, Resource, $, useVisibleTask$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import type { UnitDetailData, UnitDetailModSlot, ArsenalCard } from '~/lib/graphql-types';
import { UNIT_DETAIL_QUERY } from '~/lib/queries/unit-detail';
import { ARSENAL_PAGE_QUERY } from '~/lib/queries/arsenal';
import { CompareView } from '~/components/compare/CompareView';
import { UnitSelector } from '~/components/compare/UnitSelector';

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

async function fetchArsenalCards(): Promise<ArsenalCard[]> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: ARSENAL_PAGE_QUERY }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json() as { data?: { arsenalUnitsCards: ArsenalCard[] } };
  return json.data?.arsenalUnitsCards ?? [];
}

function parseModIds(param: string | null): number[] {
  if (!param) return [];
  return param.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
}

/* ── Page Component ─────────────────────────────────────────────── */

export default component$(() => {
  const i18n = useI18n();

  // Selected unit IDs — from URL or user interaction
  const unitIdA = useSignal<number | null>(null);
  const unitIdB = useSignal<number | null>(null);
  const modsA = useSignal<number[]>([]);
  const modsB = useSignal<number[]>([]);
  const isRefetchingA = useSignal(false);
  const isRefetchingB = useSignal(false);

  // Arsenal cards for the selector
  const cardsResource = useResource$<ArsenalCard[]>(async ({ cleanup }) => {
    const ctrl = new AbortController();
    cleanup(() => ctrl.abort());
    return fetchArsenalCards();
  });

  // Read URL params on mount
  useVisibleTask$(() => {
    const url = new URL(window.location.href);
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    if (a) unitIdA.value = parseInt(a, 10) || null;
    if (b) unitIdB.value = parseInt(b, 10) || null;
    modsA.value = parseModIds(url.searchParams.get('ma'));
    modsB.value = parseModIds(url.searchParams.get('mb'));
  });

  // Sync URL when units change
  useVisibleTask$(({ track }) => {
    const a = track(() => unitIdA.value);
    const b = track(() => unitIdB.value);
    const ma = track(() => modsA.value);
    const mb = track(() => modsB.value);
    const url = new URL(window.location.href);
    if (a) url.searchParams.set('a', String(a)); else url.searchParams.delete('a');
    if (b) url.searchParams.set('b', String(b)); else url.searchParams.delete('b');
    if (ma.length) url.searchParams.set('ma', ma.join('-')); else url.searchParams.delete('ma');
    if (mb.length) url.searchParams.set('mb', mb.join('-')); else url.searchParams.delete('mb');
    window.history.replaceState({}, '', url.toString());
  });

  // Fetch both units when IDs are set
  const compareResource = useResource$<{ a: UnitDetailData; b: UnitDetailData } | null>(async ({ track, cleanup }) => {
    const idA = track(() => unitIdA.value);
    const idB = track(() => unitIdB.value);
    const mA = track(() => modsA.value);
    const mB = track(() => modsB.value);

    if (!idA || !idB) return null;

    const ctrl = new AbortController();
    cleanup(() => ctrl.abort());

    const [a, b] = await Promise.all([
      fetchUnitDetail(idA, mA),
      fetchUnitDetail(idB, mB),
    ]);
    return { a, b };
  });

  const handleSelectA$ = $((id: number) => { unitIdA.value = id; modsA.value = []; });
  const handleSelectB$ = $((id: number) => { unitIdB.value = id; modsB.value = []; });

  // Modification change handlers — mirror the unit detail page pattern
  const handleOptionChangeA$ = $((modId: number, newOptionId: number, modifications: UnitDetailModSlot[]) => {
    const newIds = modifications.map(mod => {
      if (mod.modification.Id === modId) return newOptionId;
      const currentlySelected = modsA.value.find(id =>
        mod.options.some(opt => opt.Id === id),
      );
      return currentlySelected ?? mod.selectedOptionId;
    });
    modsA.value = newIds;
  });

  const handleOptionChangeB$ = $((modId: number, newOptionId: number, modifications: UnitDetailModSlot[]) => {
    const newIds = modifications.map(mod => {
      if (mod.modification.Id === modId) return newOptionId;
      const currentlySelected = modsB.value.find(id =>
        mod.options.some(opt => opt.Id === id),
      );
      return currentlySelected ?? mod.selectedOptionId;
    });
    modsB.value = newIds;
  });

  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Back link */}
      <Link
        href="/arsenal"
        class="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        ← {t(i18n, 'nav.arsenal')}
      </Link>

      {/* Header */}
      <div class="mb-6">
        <span class="text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase">{t(i18n, 'compare.tag')}</span>
        <h1 class="text-2xl font-bold text-[var(--text)] mt-1">{t(i18n, 'compare.title')}</h1>
        <p class="text-sm text-[var(--text-dim)] mt-1">{t(i18n, 'compare.subtitle')}</p>
      </div>

      {/* Unit selectors */}
      <Resource
        value={cardsResource}
        onPending={() => (
          <div class="text-sm font-mono text-[var(--text-dim)] animate-pulse py-4">{t(i18n, 'common.loading')}</div>
        )}
        onRejected={(err) => (
          <div class="text-sm text-[var(--red)] font-mono py-4">Error: {(err as Error).message}</div>
        )}
        onResolved={(cards) => (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-1">UNIT A</p>
              <UnitSelector cards={cards} selectedUnitId={unitIdA.value} onSelect$={handleSelectA$} />
            </div>
            <div>
              <p class="text-[9px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-1">UNIT B</p>
              <UnitSelector cards={cards} selectedUnitId={unitIdB.value} onSelect$={handleSelectB$} />
            </div>
          </div>
        )}
      />

      {/* Comparison results */}
      {unitIdA.value && unitIdB.value ? (
        <Resource
          value={compareResource}
          onPending={() => (
            <div class="text-sm font-mono text-[var(--text-dim)] animate-pulse py-8">{t(i18n, 'common.loading')}</div>
          )}
          onRejected={(err) => (
            <div class="text-sm text-[var(--red)] font-mono py-8">Error: {(err as Error).message}</div>
          )}
          onResolved={(result) => {
            if (!result) return null;
            return (
              <CompareView
                dataA={result.a}
                dataB={result.b}
                onOptionChangeA$={handleOptionChangeA$}
                onOptionChangeB$={handleOptionChangeB$}
                isRefetchingA={isRefetchingA.value}
                isRefetchingB={isRefetchingB.value}
              />
            );
          }}
        />
      ) : (
        <div class="text-center py-12 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
          <p class="text-sm font-mono text-[var(--text-dim)]">{t(i18n, 'compare.selectUnit')}</p>
          <p class="text-[10px] font-mono text-[var(--text-dim)] mt-1 opacity-60">{t(i18n, 'compare.subtitle')}</p>
        </div>
      )}
    </div>
  );
});

/* ── Head ────────────────────────────────────────────────────────── */

export const head: DocumentHead = () => ({
  title: 'Compare Units - BA Hub Arsenal',
  meta: [
    { name: 'description', content: 'Compare two Broken Arrow units side-by-side with advantage highlighting.' },
  ],
});
