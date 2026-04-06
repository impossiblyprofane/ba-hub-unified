import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { AdminGate } from '~/components/admin/AdminGate';
import { AdminLayout, type AdminSection } from '~/components/admin/AdminLayout';
import { HealthDashboard } from '~/components/admin/HealthDashboard';
import { DbInspector } from '~/components/admin/DbInspector';
import { LogStream } from '~/components/admin/LogStream';
import { CrawlerPanel } from '~/components/admin/CrawlerPanel';
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  AdminAuthError,
} from '~/lib/admin/adminClient';

/**
 * Hidden admin entry — `/sys`. Token-gated, no nav link, not in sitemap.
 *
 * On mount, probes /admin/ping with whatever token is in localStorage. If
 * the probe succeeds, jumps straight into the dashboard. Otherwise renders
 * the gate.
 */
export default component$(() => {
  const authed = useSignal(false);
  const checking = useSignal(true);
  const section = useSignal<AdminSection>('health');

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async () => {
      const stored = getAdminToken();
      if (!stored) {
        checking.value = false;
        return;
      }
      try {
        await adminFetch('/admin/ping');
        authed.value = true;
      } catch (err) {
        if (err instanceof AdminAuthError) {
          clearAdminToken();
        }
      } finally {
        checking.value = false;
      }
    },
    { strategy: 'document-ready' },
  );

  const onAuthed$ = $(() => {
    authed.value = true;
  });

  const onSignOut$ = $(() => {
    clearAdminToken();
    authed.value = false;
  });

  if (checking.value) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="font-mono uppercase tracking-[0.3em] text-[10px] text-[var(--text-dim)]">
          checking...
        </div>
      </div>
    );
  }

  if (!authed.value) {
    return <AdminGate onAuthed$={onAuthed$} />;
  }

  return (
    <AdminLayout section={section} onSignOut$={onSignOut$}>
      {section.value === 'health' && <HealthDashboard />}
      {section.value === 'db' && <DbInspector />}
      {section.value === 'logs' && <LogStream />}
      {section.value === 'crawler' && <CrawlerPanel />}
    </AdminLayout>
  );
});

export const head: DocumentHead = {
  title: 'sys',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
};
