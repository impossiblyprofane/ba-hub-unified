/**
 * CompareView — Side-by-side full unit detail comparison.
 *
 * Layout: Unit A (full detail) | Unit B (full detail)
 * Both units display the complete UnitDetailView with modification controls,
 * optimised for tighter spacing in the two-column layout.
 */

import { component$ } from '@builder.io/qwik';
import { UnitDetailView } from '~/components/unit-detail/UnitDetailView';
import type { UnitDetailModSlot, UnitDetailData } from '~/lib/graphql-types';

export type CompareViewProps = {
  dataA: UnitDetailData;
  dataB: UnitDetailData;
  onOptionChangeA$: (modId: number, optionId: number, mods: UnitDetailModSlot[]) => void;
  onOptionChangeB$: (modId: number, optionId: number, mods: UnitDetailModSlot[]) => void;
  isRefetchingA?: boolean;
  isRefetchingB?: boolean;
};

export const CompareView = component$<CompareViewProps>(({
  dataA,
  dataB,
  onOptionChangeA$,
  onOptionChangeB$,
  isRefetchingA = false,
  isRefetchingB = false,
}) => {
  return (
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Unit A — full detail */}
      <div class="min-w-0">
        <UnitDetailView
          data={dataA}
          isRefetching={isRefetchingA}
          onOptionChange$={onOptionChangeA$}
        />
      </div>

      {/* Unit B — full detail */}
      <div class="min-w-0">
        <UnitDetailView
          data={dataB}
          isRefetching={isRefetchingB}
          onOptionChange$={onOptionChangeB$}
        />
      </div>
    </div>
  );
});
