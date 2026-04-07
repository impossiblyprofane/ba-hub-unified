/**
 * User Identity Service — anonymous GUID-based identity for deck publishing.
 *
 * On first publish/like the frontend generates a UUID, registers it with the
 * backend, and stores it in localStorage. Subsequent actions re-use the same
 * ID silently. No accounts, no passwords.
 */

import { REGISTER_USER_MUTATION } from './queries/decks';
import { graphqlFetch } from './graphqlClient';

const USER_ID_KEY = 'ba_user_id';
const USER_REGISTERED_KEY = 'ba_user_registered';

// ── Read ────────────────────────────────────────────────────────

/** Get the locally stored user ID (may or may not be registered yet). */
export function getUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

/** Check if the user ID has been confirmed by the server. */
export function isRegistered(): boolean {
  try {
    return localStorage.getItem(USER_REGISTERED_KEY) === '1';
  } catch {
    return false;
  }
}

// ── Write / Register ────────────────────────────────────────────

/**
 * Ensure a registered user identity exists.
 *
 * If already registered, returns immediately.
 * If a local ID exists but isn't registered, registers it.
 * If no local ID exists, generates a new UUID, registers it, and stores both.
 *
 * @returns `{ userId, isNew }` — `isNew` is true when the identity was
 * just created (use for showing a one-time toast).
 */
export async function ensureUserId(): Promise<{ userId: string; isNew: boolean }> {
  let localId = getUserId();
  const wasRegistered = isRegistered();

  // Already registered — fast path
  if (localId && wasRegistered) {
    return { userId: localId, isNew: false };
  }

  // Generate if missing
  if (!localId) {
    localId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, localId);
  }

  // Register with backend
  const data = await graphqlFetch<{ registerUser: { userId: string; isNew: boolean } }>(
    REGISTER_USER_MUTATION,
    { tentativeId: localId },
  );

  const result = data.registerUser;
  localStorage.setItem(USER_ID_KEY, result.userId);
  localStorage.setItem(USER_REGISTERED_KEY, '1');

  return { userId: result.userId, isNew: result.isNew };
}
