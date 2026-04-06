import { component$, useSignal, $, type PropFunction } from '@builder.io/qwik';
import { adminFetch, setAdminToken, AdminAuthError, AdminError } from '~/lib/admin/adminClient';

interface Props {
  onAuthed$: PropFunction<() => void>;
}

/**
 * Token entry gate. Validates the token by hitting `/admin/ping` once.
 * Stores the token in localStorage on success.
 */
export const AdminGate = component$<Props>(({ onAuthed$ }) => {
  const tokenInput = useSignal('');
  const error = useSignal<string | null>(null);
  const busy = useSignal(false);

  const submit = $(async () => {
    const t = tokenInput.value.trim();
    if (!t) {
      error.value = 'Enter a token.';
      return;
    }
    busy.value = true;
    error.value = null;
    try {
      await adminFetch('/admin/ping', { method: 'GET' }, t);
      setAdminToken(t);
      await onAuthed$();
    } catch (err) {
      if (err instanceof AdminAuthError) {
        error.value = err.status === 503 ? err.message : 'Invalid token.';
      } else if (err instanceof AdminError) {
        error.value = err.message;
      } else {
        error.value = 'Unexpected error.';
      }
    } finally {
      busy.value = false;
    }
  });

  return (
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-md p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.3)]">
        <div class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px] px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
          sys access
        </div>
        <div class="p-4 flex flex-col gap-3">
          <input
            type="password"
            autoComplete="off"
            placeholder="admin token"
            class="w-full bg-[rgba(26,26,26,0.4)] border border-[var(--border)] px-3 py-2 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            value={tokenInput.value}
            onInput$={(_, el) => (tokenInput.value = el.value)}
            onKeyDown$={(e) => {
              if (e.key === 'Enter') submit();
            }}
            disabled={busy.value}
          />
          {error.value && (
            <div class="text-xs font-mono text-red-400">{error.value}</div>
          )}
          <button
            type="button"
            class="bg-[rgba(36,36,36,0.5)] border border-[var(--border)] hover:border-[var(--accent)] px-3 py-2 font-mono uppercase tracking-[0.2em] text-[10px] text-[var(--text)] disabled:opacity-50 transition-colors"
            onClick$={submit}
            disabled={busy.value}
          >
            {busy.value ? 'verifying...' : 'authenticate'}
          </button>
        </div>
      </div>
    </div>
  );
});
