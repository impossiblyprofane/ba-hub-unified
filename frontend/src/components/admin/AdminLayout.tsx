import { component$, Slot, type Signal, type PropFunction } from '@builder.io/qwik';

export type AdminSection = 'health' | 'db' | 'logs' | 'crawler';

interface Props {
  section: Signal<AdminSection>;
  onSignOut$: PropFunction<() => void>;
}

const TABS: Array<{ id: AdminSection; label: string }> = [
  { id: 'health', label: 'health' },
  { id: 'db', label: 'database' },
  { id: 'logs', label: 'logs' },
  { id: 'crawler', label: 'crawler' },
];

/**
 * Admin chassis — fixed sidebar of tabs + content slot.
 * Follows the project panel-styling rules: transparent gradients, rgba()
 * borders, font-mono uppercase headers, no solid backgrounds.
 */
export const AdminLayout = component$<Props>(({ section, onSignOut$ }) => {
  return (
    <div class="min-h-screen flex flex-col lg:flex-row bg-[var(--bg)]">
      {/* Sidebar */}
      <aside class="lg:w-56 lg:min-h-screen p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border-b lg:border-b-0 lg:border-r border-[rgba(51,51,51,0.3)] flex flex-col">
        <div class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-[10px] px-3 py-3 border-b border-[rgba(51,51,51,0.3)]">
          sys
        </div>
        <nav class="flex flex-row lg:flex-col">
          {TABS.map((tab) => {
            const active = section.value === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                class={[
                  'text-left font-mono tracking-[0.2em] uppercase text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.15)] transition-colors',
                  active
                    ? 'text-[var(--accent)] bg-[rgba(26,26,26,0.4)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[rgba(26,26,26,0.4)]',
                ].join(' ')}
                onClick$={() => (section.value = tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div class="mt-auto p-3 border-t border-[rgba(51,51,51,0.3)] hidden lg:block">
          <button
            type="button"
            class="w-full font-mono uppercase tracking-[0.2em] text-[10px] text-[var(--text-dim)] hover:text-red-400 transition-colors"
            onClick$={onSignOut$}
          >
            sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main class="flex-1 p-3 lg:p-6 max-w-[2000px]">
        <Slot />
      </main>
    </div>
  );
});
