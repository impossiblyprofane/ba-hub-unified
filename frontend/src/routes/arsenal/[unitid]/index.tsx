import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-5xl mx-auto">
      <Link href="/arsenal" class="text-xs font-mono uppercase text-[var(--text-dim)] hover:text-[var(--text)]">
        ← Back to Arsenal
      </Link>
      <div class="mt-6 border border-[var(--border)] bg-[var(--bg-raised)] p-6">
        <p class="text-[10px] font-mono tracking-[0.35em] uppercase text-[var(--text-dim)]">Unit Detail</p>
        <h1 class="text-2xl font-semibold text-[var(--text)] mt-3">Unit profile is in progress</h1>
        <p class="text-sm text-[var(--text-dim)] mt-2">
          We are building the full unit inspection page. Check back soon.
        </p>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Unit Detail - BA Hub',
};
