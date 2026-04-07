import { component$ } from '@builder.io/qwik';

/**
 * Loading skeleton for /stats.
 * Mirrors the stats overview layout (header + leaderboard + 6 chart panels) to prevent CLS.
 */
const SkeletonBlock = component$<{ class?: string }>((props) => (
  <div class={`bg-[rgba(36,36,36,0.4)] ${props.class ?? ''}`} />
));

const SkeletonPanel = component$<{ height?: number; class?: string }>((props) => (
  <div
    class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] ${props.class ?? ''}`}
  >
    <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
      <SkeletonBlock class="h-3 w-24" />
    </div>
    <div class="p-3" style={{ height: `${props.height ?? 380}px` }}>
      <SkeletonBlock class="h-full w-full" />
    </div>
  </div>
));

export const StatsOverviewSkeleton = component$(() => {
  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Header */}
      <div class="mb-6">
        <SkeletonBlock class="h-3 w-28 mb-3" />
        <SkeletonBlock class="h-9 w-64 mb-2" />
        <SkeletonBlock class="h-4 w-96 mb-4" />

        {/* Player search */}
        <div class="mt-4 flex gap-2 max-w-lg">
          <SkeletonBlock class="flex-1 h-9" />
          <SkeletonBlock class="w-32 h-9" />
        </div>
      </div>

      {/* Leaderboard */}
      <div class="mb-6">
        <SkeletonPanel height={500} />
      </div>

      {/* Maps section */}
      <div class="mb-6">
        <SkeletonBlock class="h-3 w-24 mb-3" />
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <SkeletonPanel height={380} />
          <SkeletonPanel height={380} />
        </div>
      </div>

      {/* Specs / Faction row */}
      <div class="mb-6">
        <SkeletonBlock class="h-3 w-32 mb-3" />
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
          <SkeletonPanel height={320} />
          <SkeletonPanel height={320} />
        </div>
      </div>

      {/* Unit popularity */}
      <div class="mb-6">
        <SkeletonBlock class="h-3 w-28 mb-3" />
        <SkeletonBlock class="h-4 w-64 mb-3" />
        <SkeletonPanel height={400} />
      </div>
    </div>
  );
});
