import { component$ } from '@builder.io/qwik';

/**
 * Loading skeleton for /stats/match/[fightId].
 * Mirrors the match detail layout to prevent CLS when data arrives.
 */
const SkeletonBlock = component$<{ class?: string }>((props) => (
  <div class={`bg-[rgba(36,36,36,0.4)] ${props.class ?? ''}`} />
));

const SkeletonPanel = component$<{ class?: string }>((props) => (
  <div
    class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] ${props.class ?? ''}`}
  >
    <div class="px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
      <SkeletonBlock class="h-3 w-24" />
    </div>
    <div class="p-3 flex flex-col gap-2">
      <SkeletonBlock class="h-4 w-full" />
      <SkeletonBlock class="h-4 w-5/6" />
      <SkeletonBlock class="h-4 w-4/6" />
      <SkeletonBlock class="h-4 w-3/4" />
    </div>
  </div>
));

export const MatchDetailSkeleton = component$(() => {
  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Back link placeholder */}
      <SkeletonBlock class="h-3 w-32 mb-4" />

      {/* Match header */}
      <div class="mb-4">
        <SkeletonBlock class="h-3 w-28 mb-2" />
        <div class="flex items-end gap-4">
          <SkeletonBlock class="h-8 w-64" />
          <SkeletonBlock class="h-3 w-40" />
        </div>
      </div>

      {/* Match summary stats */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`sum-${i}`}
            class="bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)] border-t-2 border-t-[rgba(51,51,51,0.3)] p-2"
          >
            <SkeletonBlock class="h-2 w-16 mb-2" />
            <SkeletonBlock class="h-5 w-12" />
          </div>
        ))}
      </div>

      {/* Two team panels side-by-side */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SkeletonPanel class="h-[400px]" />
        <SkeletonPanel class="h-[400px]" />
      </div>
    </div>
  );
});
