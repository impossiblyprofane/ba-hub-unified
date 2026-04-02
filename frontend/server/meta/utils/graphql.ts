import { encryptPayload, decryptPayload, isEncryptionConfigured } from '@ba-hub/shared';

const API_URL = process.env.API_URL || 'http://localhost:3001/graphql';
const useEncryption = isEncryptionConfigured();

/**
 * Lightweight GraphQL fetch for SSR metadata with optional encryption.
 * 3s timeout — don't block crawlers if backend is slow.
 */
export async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const payload = { query, variables };
    const body = useEncryption
      ? JSON.stringify({ e: encryptPayload(payload) })
      : JSON.stringify(payload);

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;

    const raw = await res.json() as { data?: T } | { e: string };

    // Decrypt if response is encrypted
    if ('e' in raw && typeof raw.e === 'string') {
      const decrypted = decryptPayload<{ data?: T }>(raw.e);
      return decrypted.data ?? null;
    }

    return (raw as { data?: T }).data ?? null;
  } catch {
    return null;
  }
}
