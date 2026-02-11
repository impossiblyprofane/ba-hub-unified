import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-6xl">
      <p class="text-[#3b8eed] text-xs font-mono tracking-[0.25em] uppercase mb-3">Community Builds</p>
      <h1 class="text-3xl font-bold mb-3 text-[#c8d1db]">Deck Arsenal</h1>
      <p class="text-[#6b7a8d] text-sm mb-8">Browse community-created decks and popular strategies.</p>

      {/* Filters */}
      <div class="mb-6 flex gap-3 card">
        <input
          type="text"
          placeholder="Search decks..."
          class="flex-1 bg-[#0c0f13] text-[#c8d1db] px-3 py-2 text-xs border border-[#1e2a36] focus:outline-none focus:border-[#3b8eed]"
        />
        <select class="bg-[#0c0f13] text-[#c8d1db] px-3 py-2 text-xs border border-[#1e2a36] focus:outline-none focus:border-[#3b8eed]">
          <option>All Factions</option>
          <option>Faction A</option>
          <option>Faction B</option>
        </select>
        <select class="bg-[#0c0f13] text-[#c8d1db] px-3 py-2 text-xs border border-[#1e2a36] focus:outline-none focus:border-[#3b8eed]">
          <option>Most Popular</option>
          <option>Newest</option>
          <option>Highest Rated</option>
        </select>
      </div>

      {/* Deck Cards Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} class="card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm text-[#c8d1db]">Deck #{i + 1}</h3>
              <span class="text-[#d29922] text-[10px]">★ {(Math.random() * 5).toFixed(1)}</span>
            </div>
            <p class="text-[#6b7a8d] text-xs mb-1">By Community</p>
            <p class="text-[10px] text-[#6b7a8d] mb-4">Faction: Faction {(i % 2) + 1}</p>
            <a href="#" class="text-[#3b8eed] text-xs hover:opacity-80">View Details →</a>
          </div>
        ))}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Deck Arsenal - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Browse community-created decks and popular strategies.',
    },
  ],
};
