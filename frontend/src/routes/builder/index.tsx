import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-6xl">
      <p class="text-[var(--accent)] text-xs font-mono tracking-[0.25em] uppercase mb-3">Tactical Planning</p>
      <h1 class="text-3xl font-bold mb-3 text-[var(--text)]">Deck Builder</h1>
      <p class="text-[var(--text-dim)] text-sm mb-8">Create and optimize deck compositions with real-time cost calculation.</p>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Unit Palette */}
        <div class="md:col-span-1">
          <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] p-4 h-full">
            <h3 class="font-bold font-mono tracking-wider text-sm mb-4 text-[var(--text)] uppercase border-b border-[rgba(51,51,51,0.3)] pb-2">Units</h3>
            <div class="space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} class="p-2.5 bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.3)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] cursor-move transition-colors">
                  <p class="text-xs font-medium text-[var(--text)]">Unit {i + 1}</p>
                  <p class="text-[10px] text-[var(--text-dim)] font-mono">Cost: {(i + 1) * 50}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deck Canvas */}
        <div class="md:col-span-3">
          <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] p-4 flex flex-col" style={{ minHeight: '600px' }}>
            <h3 class="font-bold font-mono tracking-wider text-sm mb-4 text-[var(--text)] uppercase border-b border-[rgba(51,51,51,0.3)] pb-2 flex justify-between items-center">
              <span>Deck Composition</span>
              <span class="text-[10px] bg-[rgba(26,26,26,0.4)] px-2 py-1 rounded">500 / 1000 PTS</span>
            </h3>
            
            <div class="space-y-1.5 flex-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} class="p-2.5 bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.3)] flex justify-between items-center group hover:bg-[var(--bg-hover)] transition-colors">
                  <span class="text-xs text-[var(--text)]">Unit {i + 1} <span class="text-[var(--text-dim)] ml-1">x2</span></span>
                  <span class="text-[var(--text-dim)] font-mono text-[10px] group-hover:text-[var(--text)] transition-colors">Cost: {(i + 1) * 100}</span>
                </div>
              ))}
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
