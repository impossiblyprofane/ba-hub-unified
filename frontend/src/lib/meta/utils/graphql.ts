const API_URL = typeof process !== 'undefined' && process.env?.API_URL
  ? process.env.API_URL
  : 'http://localhost:3001/graphql';

/**
 * Lightweight GraphQL fetch for SSR metadata.
 * 3s timeout — don't block crawlers if backend is slow.
 */
export async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}
