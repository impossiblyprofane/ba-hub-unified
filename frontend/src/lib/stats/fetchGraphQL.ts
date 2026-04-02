/**
 * Minimal GraphQL fetch helper used by stats components.
 * Returns the parsed `data` payload or throws on errors.
 */
export async function fetchGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (!payload.data) {
    const msg = payload.errors?.map((e) => e.message).join(', ') || 'Unknown error';
    throw new Error(msg);
  }

  return payload.data;
}
