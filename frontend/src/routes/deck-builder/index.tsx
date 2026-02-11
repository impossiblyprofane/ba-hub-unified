import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-6xl">
      <p class="text-[#3b8eed] text-xs font-mono tracking-[0.25em] uppercase mb-3">Tactical Planning</p>
      <h1 class="text-3xl font-bold mb-3 text-[#c8d1db]">Deck Builder</h1>
      <p class="text-[#6b7a8d] text-sm mb-8">Create and optimize deck compositions with real-time cost calculation.</p>

      <div class="grid grid-cols-3 gap-4">
        {/* Unit Palette */}
        <div class="col-span-1">
          <div class="card mb-4">
            <h3 class="font-semibold text-sm mb-4 text-[#c8d1db]">Units</h3>
            <div class="space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} class="p-2.5 bg-[#0c0f13] border border-[#1e2a36] hover:border-[#3b8eed] cursor-move transition-colors">
                  <p class="text-xs font-medium text-[#c8d1db]">Unit {i + 1}</p>
                  <p class="text-[10px] text-[#6b7a8d]">Cost: {(i + 1) * 50}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deck Canvas */}
        <div class="col-span-2">
          <div class="card" style={{ minHeight: '600px' }}>
            <h3 class="font-semibold text-sm mb-4 text-[#c8d1db]">Deck Composition</h3>
            <div class="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} class="p-2.5 bg-[#0c0f13] border border-[#1e2a36] flex justify-between items-center">
                  <span class="text-xs text-[#c8d1db]">Unit {i + 1} x2</span>
                  <span class="text-[#6b7a8d] text-[10px]">Cost: {(i + 1) * 100}</span>
                </div>
              ))}
            </div>
            <div class="mt-6 p-3 bg-[#1a3a5c] border border-[#3b8eed]">
              <p class="text-xs font-bold text-[#5ba3f5]">Total Cost: 500 / 500</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Deck Builder - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Create and optimize deck compositions with real-time cost calculation.',
    },
  ],
};
