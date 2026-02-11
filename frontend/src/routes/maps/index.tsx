import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-6xl">
      <p class="text-[#3b8eed] text-xs font-mono tracking-[0.25em] uppercase mb-3">Battlefield Intel</p>
      <h1 class="text-3xl font-bold mb-3 text-[#c8d1db]">Maps & Tactics</h1>
      <p class="text-[#6b7a8d] text-sm mb-8">Interactive map viewer with tactical overlays and terrain analysis.</p>

      {/* Map Filter */}
      <div class="mb-6 card">
        <select class="bg-[#0c0f13] text-[#c8d1db] px-3 py-2 text-xs border border-[#1e2a36] focus:outline-none focus:border-[#3b8eed]">
          <option>All Maps</option>
          <option>Map Type 1</option>
          <option>Map Type 2</option>
        </select>
      </div>

      {/* Maps Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} class="card">
            <div class="w-full h-48 bg-[#0c0f13] border border-[#1e2a36] mb-3 flex items-center justify-center">
              <span class="text-[#6b7a8d] text-xs">Map Preview {i + 1}</span>
            </div>
            <h3 class="font-semibold text-sm mb-2 text-[#c8d1db]">Battlefield {i + 1}</h3>
            <p class="text-[#6b7a8d] text-xs mb-4">Size: 256x256 | Terrain: Mixed</p>
            <a href="#" class="text-[#3b8eed] text-xs hover:opacity-80">View Analysis →</a>
          </div>
        ))}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Maps & Tactics - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Interactive map viewer with tactical overlays and terrain analysis.',
    },
  ],
};
