import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-4xl">
      <p class="text-[#3b8eed] text-xs font-mono tracking-[0.25em] uppercase mb-3">Strategic Knowledge</p>
      <h1 class="text-3xl font-bold mb-3 text-[#c8d1db]">Guides</h1>
      <p class="text-[#6b7a8d] text-sm mb-8">Community guides covering basics to advanced competitive strategies.</p>

      {/* Category Tabs */}
      <div class="flex gap-1 mb-8 border-b border-[#1e2a36]">
        <button class="px-4 py-2 text-xs border-b-2 border-[#3b8eed] font-semibold text-[#c8d1db]">All</button>
        <button class="px-4 py-2 text-xs text-[#6b7a8d] hover:text-[#c8d1db] transition-colors">Beginner</button>
        <button class="px-4 py-2 text-xs text-[#6b7a8d] hover:text-[#c8d1db] transition-colors">Intermediate</button>
        <button class="px-4 py-2 text-xs text-[#6b7a8d] hover:text-[#c8d1db] transition-colors">Advanced</button>
      </div>

      {/* Guides List */}
      <div class="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} class="card">
            <h3 class="text-sm font-semibold mb-2 text-[#c8d1db]">Guide: {['Unit Types', 'Deck Building', 'Map Strategy', 'Faction Guide', 'Combat Tips', 'Economy Management', 'Advanced Tactics', 'Tournament Prep'][i]}</h3>
            <p class="text-[#6b7a8d] text-xs mb-3">Learn the essential mechanics and strategies for mastering Broken Arrow gameplay.</p>
            <div class="flex items-center justify-between text-[10px] text-[#6b7a8d]">
              <span>12 min read</span>
              <a href="#" class="text-[#3b8eed] hover:opacity-80">Read →</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Guides - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Community guides covering basics to advanced competitive strategies.',
    },
  ],
};
