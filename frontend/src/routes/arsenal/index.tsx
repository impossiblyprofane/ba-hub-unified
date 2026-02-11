import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-6xl">
      <p class="text-[#3b8eed] text-xs font-mono tracking-[0.25em] uppercase mb-3">Unit Database</p>
      <h1 class="text-3xl font-bold mb-3 text-[#c8d1db]">Arsenal Browser</h1>
      <p class="text-[#6b7a8d] text-sm mb-8">Browse and analyze 300+ units, weapons, and equipment with advanced filtering.</p>

      {/* Search and Filter Section */}
      <div class="mb-8 card">
        <div class="flex gap-3">
          <input
            type="text"
            placeholder="Search units..."
            class="flex-1 bg-[#0c0f13] text-[#c8d1db] px-3 py-2 text-xs border border-[#1e2a36] focus:outline-none focus:border-[#3b8eed]"
          />
          <select class="bg-[#0c0f13] text-[#c8d1db] px-3 py-2 text-xs border border-[#1e2a36] focus:outline-none focus:border-[#3b8eed]">
            <option>All Factions</option>
            <option>Faction A</option>
            <option>Faction B</option>
          </select>
        </div>
      </div>

      {/* Units Grid - Placeholder */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} class="card">
            <div class="w-full h-40 bg-[#0c0f13] border border-[#1e2a36] mb-3 flex items-center justify-center">
              <span class="text-[#6b7a8d] text-xs">Unit Preview</span>
            </div>
            <h3 class="font-semibold text-sm mb-1 text-[#c8d1db]">Unit Name {i + 1}</h3>
            <p class="text-[#6b7a8d] text-xs mb-2">Cost: 100</p>
            <p class="text-[#3b8eed] text-xs">View details →</p>
          </div>
        ))}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Arsenal Browser - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Browse and analyze 300+ units, weapons, and equipment with advanced filtering.',
    },
  ],
};
