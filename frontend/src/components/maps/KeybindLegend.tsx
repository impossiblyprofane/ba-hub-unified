// ══════════════════════════════════════════════════════════════
// KeybindLegend — collapsible keybind reference
// ══════════════════════════════════════════════════════════════

import { component$, useSignal } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import { KEYBINDS } from '~/lib/maps/constants';

export const KeybindLegend = component$(() => {
  const i18n = useI18n();
  const expanded = useSignal(false);

  return (
    <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)]">
      <button
        class="w-full flex items-center justify-between px-2 py-1.5 text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-wider hover:text-[var(--text)] transition-colors"
        onClick$={() => { expanded.value = !expanded.value; }}
      >
        <span>{t(i18n, 'maps.keybinds.title')}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class={[
            'transition-transform duration-200',
            expanded.value ? 'rotate-180' : '',
          ].join(' ')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded.value && (
        <div class="px-2 pb-2 space-y-0.5">
          {KEYBINDS.map(kb => (
            <div key={kb.key} class="flex items-center justify-between text-[9px]">
              <span class="font-mono text-[var(--text-dim)] min-w-[60px]">
                <kbd class="px-1 py-0.5 bg-[rgba(26,26,26,0.6)] border border-[rgba(51,51,51,0.3)] text-[var(--text)]">
                  {kb.key}
                </kbd>
              </span>
              <span class="text-[var(--text-dim)]">{t(i18n, kb.actionKey)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
