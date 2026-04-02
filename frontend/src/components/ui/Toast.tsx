/**
 * Toast — lightweight notification system.
 *
 * Usage from within a Qwik component:
 *   const toast = useContext(ToastContext);
 *   toast.show('Message here');
 *
 * Mount <ToastProvider> once in the root layout.
 */
import {
  component$, createContextId, useContextProvider,
  useStore, useVisibleTask$, Slot,
} from '@builder.io/qwik';

// ── Context ─────────────────────────────────────────────────────

export interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface ToastState {
  items: ToastItem[];
  nextId: number;
}

export interface ToastAPI {
  show: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const ToastContext = createContextId<ToastState>('toast');

// ── Provider ────────────────────────────────────────────────────

export const ToastProvider = component$(() => {
  const state = useStore<ToastState>({ items: [], nextId: 1 });
  useContextProvider(ToastContext, state);

  return (
    <>
      <Slot />
      {/* Toast container — fixed bottom-right */}
      <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {state.items.map((item) => (
          <ToastNotification key={item.id} item={item} state={state} />
        ))}
      </div>
    </>
  );
});

// ── Single toast notification ───────────────────────────────────

const ToastNotification = component$<{ item: ToastItem; state: ToastState }>(
  ({ item, state }) => {
    // Auto-dismiss after 4 seconds
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      const timer = setTimeout(() => {
        state.items = state.items.filter((t) => t.id !== item.id);
      }, 4000);
      return () => clearTimeout(timer);
    });

    const borderColor =
      item.type === 'error'
        ? 'border-red-500/60'
        : item.type === 'success'
          ? 'border-emerald-500/60'
          : 'border-[rgba(70,151,195,0.4)]';

    const iconColor =
      item.type === 'error'
        ? 'text-red-400'
        : item.type === 'success'
          ? 'text-emerald-400'
          : 'text-[var(--accent)]';

    return (
      <div
        class={`pointer-events-auto max-w-sm border ${borderColor} bg-[#0a0e14]/95 backdrop-blur-sm px-3 py-2.5 shadow-lg shadow-black/40 animate-slide-in-right`}
      >
        <div class="flex items-start gap-2">
          <span class={`text-xs font-mono ${iconColor} mt-0.5 shrink-0`}>
            {item.type === 'error' ? '✕' : item.type === 'success' ? '✓' : 'ℹ'}
          </span>
          <p class="text-[11px] font-mono text-[var(--text)] leading-relaxed">
            {item.message}
          </p>
        </div>
      </div>
    );
  },
);

// ── Helper to add a toast from outside ──────────────────────────

/** Add a toast from a component that has access to the ToastContext. */
export function showToast(
  state: ToastState,
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
) {
  state.items = [
    ...state.items,
    { id: state.nextId, message, type },
  ];
  state.nextId++;
}
