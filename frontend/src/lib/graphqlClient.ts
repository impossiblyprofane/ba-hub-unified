/**
 * Centralized GraphQL fetch client with optional AES encryption.
 *
 * All frontend GraphQL requests should go through this module.
 * When encryption is configured (VITE_ENCRYPTION_KEY + VITE_ENCRYPTION_IV),
 * requests and responses are encrypted transparently.
 */
import { encryptPayload, decryptPayload, isEncryptionConfigured } from '@ba-hub/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
const useEncryption = isEncryptionConfigured();

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query/mutation with transparent encryption.
 *
 * @param query  - GraphQL query string
 * @param variables - Optional variables object
 * @param options - Optional fetch options (signal for abort, etc.)
 * @returns The parsed `data` payload
 * @throws On HTTP errors or GraphQL errors
 */
export async function graphqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const payload = { query, variables };

  let body: string;
  if (useEncryption) {
    body = JSON.stringify({ e: encryptPayload(payload) });
  } else {
    body = JSON.stringify(payload);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status})`);
  }

  const raw = await response.json() as GraphQLResponse<T> | { e: string };

  // Decrypt if response is encrypted
  let result: GraphQLResponse<T>;
  if ('e' in raw && typeof raw.e === 'string') {
    result = decryptPayload<GraphQLResponse<T>>(raw.e);
  } else {
    result = raw as GraphQLResponse<T>;
  }

  if (!result.data) {
    const msg = result.errors?.map((e) => e.message).join(', ') || 'Unknown GraphQL error';
    throw new Error(msg);
  }

  return result.data;
}

/**
 * Execute a GraphQL query/mutation, returning the full response
 * (including possible errors) without throwing.
 * Useful for SSR loaders where you want to handle errors gracefully.
 */
export async function graphqlFetchRaw<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { signal?: AbortSignal },
): Promise<GraphQLResponse<T>> {
  const payload = { query, variables };

  let body: string;
  if (useEncryption) {
    body = JSON.stringify({ e: encryptPayload(payload) });
  } else {
    body = JSON.stringify(payload);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: options?.signal,
  });

  const raw = await response.json() as GraphQLResponse<T> | { e: string };

  if ('e' in raw && typeof raw.e === 'string') {
    return decryptPayload<GraphQLResponse<T>>(raw.e);
  }
  return raw as GraphQLResponse<T>;
}
