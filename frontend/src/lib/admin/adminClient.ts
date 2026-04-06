/**
 * Admin REST client — single bearer token, plain JSON, no encryption.
 *
 * The token lives in localStorage under `ba_admin_token` and is sent on
 * every request as `Authorization: Bearer <token>`. EventSource cannot set
 * headers, so the SSE log stream uses `?token=` instead.
 *
 * The base URL is derived from `VITE_API_URL` by stripping the trailing
 * `/graphql` segment so admin and GraphQL share host:port without needing
 * a separate env var.
 */

import type { LogEntry } from './types';

const STORAGE_KEY = 'ba_admin_token';

/** Strip trailing /graphql so VITE_API_URL=http://x:3001/graphql → http://x:3001 */
function deriveBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
  return raw.replace(/\/graphql\/?$/, '');
}

const BASE_URL = deriveBaseUrl();

export class AdminAuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

export class AdminError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'AdminError';
  }
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Fetch a JSON response from `/admin/*`.
 * Throws `AdminAuthError` on 401/503 and `AdminError` on other non-2xx.
 */
export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string,
): Promise<T> {
  const token = tokenOverride ?? getAdminToken();
  if (!token) {
    throw new AdminAuthError('No admin token configured', 401);
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AdminError(`Network error: ${message}`, 0);
  }

  if (res.status === 401) {
    throw new AdminAuthError('Unauthorized', 401);
  }
  if (res.status === 503) {
    let bodyMsg = 'Admin interface not configured on backend';
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') bodyMsg = body.error;
    } catch {
      /* ignore */
    }
    throw new AdminAuthError(bodyMsg, 503);
  }
  if (!res.ok) {
    let bodyMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') bodyMsg = body.error;
    } catch {
      /* ignore */
    }
    throw new AdminError(bodyMsg, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Open an SSE stream to `/admin/logs/stream`.
 * EventSource can't set headers, so the token is appended as a query param.
 *
 * Returns an unsubscribe function that closes the stream.
 */
export function openLogStream(
  onMessage: (entry: LogEntry) => void,
  onError?: (err: Event) => void,
): () => void {
  const token = getAdminToken();
  if (!token) {
    onError?.(new Event('no-token'));
    return () => {};
  }
  const url = `${BASE_URL}/admin/logs/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.onmessage = (ev) => {
    try {
      const entry = JSON.parse(ev.data) as LogEntry;
      onMessage(entry);
    } catch {
      /* ignore malformed line */
    }
  };
  if (onError) es.onerror = onError;

  return () => {
    try {
      es.close();
    } catch {
      /* already closed */
    }
  };
}
