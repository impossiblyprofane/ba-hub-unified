import { component$ } from '@builder.io/qwik';

/**
 * Loading skeleton for /arsenal.
 * Mirrors the arsenal filter bar + unit card grid to prevent CLS.
 */
const SkeletonBlock = component$<{ class?: string }>((props) => (
  <div class={`bg-[rgba(36,36,36,0.4)] ${props.class ?? ''}`} />
));

export const ArsenalSkeleton = component$(() => {
  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Header */}
      <div class="mb-4">
        <SkeletonBlock class="h-3 w-20 mb-2" />
        <SkeletonBlock class="h-8 w-48 mb-2" />
        <SkeletonBlock class="h-4 w-96" />
      </div>

      {/* Filter bar */}
      <div class="mb-4 flex flex-wrap gap-2">
        <SkeletonBlock class="h-9 w-64" />
        <SkeletonBlock class="h-9 w-32" />
        <SkeletonBlock class="h-9 w-32" />
        <SkeletonBlock class="h-9 w-40" />
        <SkeletonBlock class="h-9 w-28 ml-auto" />
      </div>

      {/* Unit card grid */}
      <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={`unit-${i}`}
            class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] p-3 flex flex-col gap-2"
          >
            <SkeletonBlock class="aspect-video w-full" />
            <SkeletonBlock class="h-4 w-3/4" />
            <SkeletonBlock class="h-3 w-1/2" />
            <div class="flex justify-between">
              <SkeletonBlock class="h-3 w-12" />
              <SkeletonBlock class="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
