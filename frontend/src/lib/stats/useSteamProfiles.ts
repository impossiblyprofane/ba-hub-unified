import { useStore, useVisibleTask$ } from '@builder.io/qwik';
import type { SteamProfile } from '~/lib/graphql-types';
import { fetchSteamProfiles } from '~/lib/queries/steamProfiles';

/**
 * Client-side Steam profile resolver.
 *
 * Pass in a list of SteamID64s (may include nulls/dupes — they'll be filtered).
 * Returns a reactive store keyed by steamId. Fetching happens in a
 * `useVisibleTask$`, so SSR is never blocked — avatars pop in after hydration.
 *
 * The task re-runs whenever the joined id list changes, but repeat fetches are
 * cheap: the backend has a 24h in-memory cache, so the second call to the same
 * ids is instant.
 */
export function useSteamProfiles(
  ids: Array<string | null | undefined>,
): Record<string, SteamProfile> {
  const store = useStore<Record<string, SteamProfile>>({});

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const list = ids.filter((id): id is string => !!id);
    if (list.length === 0) return;
    fetchSteamProfiles(list).then((map) => {
      Object.assign(store, map);
    });
  }, { strategy: 'document-ready' });

  return store;
}
