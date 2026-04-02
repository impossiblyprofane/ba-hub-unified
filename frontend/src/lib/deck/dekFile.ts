/**
 * .dek file helpers — client-side wrappers for the backend encrypt/decrypt API.
 *
 * The AES key never leaves the server. The frontend sends/receives base64-encoded
 * binary data via REST endpoints on the backend.
 */

import type { Deck } from '@ba-hub/shared';

const API_URL = () => import.meta.env.VITE_API_URL?.replace('/graphql', '') || 'http://localhost:3001';

// ── Public API ──────────────────────────────────────────────────

/**
 * Encrypt a Deck object into a .dek binary ArrayBuffer via the backend.
 */
export async function encryptDekFile(deck: Deck): Promise<ArrayBuffer> {
  const resp = await fetch(`${API_URL()}/api/dek/encrypt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deckJson: JSON.stringify(deck) }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Encryption failed' }));
    throw new Error((err as { error?: string }).error || 'Encryption failed');
  }
  const { data } = await resp.json() as { data: string };
  // Decode base64 → ArrayBuffer
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Decrypt a .dek binary file into a Deck object via the backend.
 * Accepts an ArrayBuffer (e.g. from `file.arrayBuffer()`).
 */
export async function decryptDekFile(buffer: ArrayBuffer): Promise<Deck> {
  // Encode ArrayBuffer → base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);

  const resp = await fetch(`${API_URL()}/api/dek/decrypt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: b64 }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Decryption failed' }));
    throw new Error((err as { error?: string }).error || 'Decryption failed');
  }
  const { deckJson } = await resp.json() as { deckJson: string };
  const deck = JSON.parse(deckJson) as Deck;

  // Validate basic structure
  if (typeof deck.country !== 'number' || typeof deck.spec1 !== 'number' || typeof deck.spec2 !== 'number') {
    throw new Error('Invalid deck data in .dek file');
  }

  return deck;
}

/**
 * Trigger a browser download of a .dek file.
 */
export function downloadDekFile(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dek') ? filename : `${filename}.dek`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
