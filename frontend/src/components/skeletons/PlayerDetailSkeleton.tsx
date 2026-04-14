import { component$ } from '@builder.io/qwik';

/**
 * Loading skeleton for /stats/player/[steamId].
 * Mirrors the player detail page layout to prevent CLS when data arrives.
 */
const SkeletonBlock = component$<{ class?: string }>((props) => (
  <div class={`bg-[rgba(36,36,36,0.4)] ${props.class ?? ''}`} />
));

const SkeletonPanel = component$<{ title?: string; class?: string }>((props) => (
  <div
    class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] ${props.class ?? ''}`}
  >
    <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
      <SkeletonBlock class="h-3 w-24" />
    </div>
    <div class="p-3">
      <SkeletonBlock class="h-4 w-full mb-2" />
      <SkeletonBlock class="h-4 w-5/6 mb-2" />
      <SkeletonBlock class="h-4 w-4/6" />
    </div>
  </div>
));

export const PlayerDetailSkeleton = component$(() => {
  return (
    <div class="w-full max-w-[2000px] mx-auto">
      {/* Back link placeholder */}
      <SkeletonBlock class="h-3 w-32 mb-4" />

      {/* Player header */}
      <div class="mb-4">
        <SkeletonBlock class="h-3 w-28 mb-2" />
        <div class="flex items-center gap-4">
          <SkeletonBlock class="h-14 w-14 rounded-sm" />
          <div class="flex flex-col gap-2">
            <SkeletonBlock class="h-6 w-48" />
            <SkeletonBlock class="h-3 w-40" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div class="flex gap-0 mb-4 border-b border-[rgba(51,51,51,0.3)]">
        <SkeletonBlock class="h-8 w-24" />
        <SkeletonBlock class="h-8 w-32 ml-2" />
      </div>

      <div class="flex flex-col gap-3">
        {/* Stat cards row */}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`card-${i}`}
              class="bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.15)] border-t-2 border-t-[rgba(51,51,51,0.3)] p-2"
            >
              <SkeletonBlock class="h-2 w-16 mb-2" />
              <SkeletonBlock class="h-5 w-12" />
            </div>
          ))}
        </div>

        {/* Chart row */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div class="lg:col-span-2">
            <SkeletonPanel class="h-[268px]" />
          </div>
          <SkeletonPanel class="h-[248px]" />
        </div>

        {/* 3-up stats */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </div>

        {/* 3-up panels */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel class="h-[228px]" />
        </div>

        {/* 4-up unit lists */}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPanel key={`unit-list-${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
});
