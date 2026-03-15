import { component$ } from '@builder.io/qwik';

export const EmptyPanel = component$<{ label: string; compact?: boolean; fill?: boolean }>(({ label, compact, fill }) => (
  <div
    class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70 ${fill ? 'h-full flex flex-col' : ''}`}
  >
    <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[var(--border)]/30`}>
      {label}
    </p>
    <div class="flex-1 flex items-center justify-center p-4">
      <span class="text-xs font-mono text-[var(--text-dim)]/50 uppercase tracking-widest">No {label}</span>
    </div>
  </div>
));
