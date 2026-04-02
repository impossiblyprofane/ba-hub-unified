/**
 * .dek file encryption/decryption — Broken Arrow game deck files.
 *
 * Binary format:
 *   [8 bytes header "fhk3s0g3"] [16 bytes random IV] [AES-256-CBC ciphertext]
 *
 * The plaintext is PKCS7-padded JSON matching the game's deck structure.
 * Uses Node.js `crypto` module — the key never leaves the server.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// ── Constants ───────────────────────────────────────────────────

const HEADER = Buffer.from('fhk3s0g3', 'ascii'); // 8 bytes
const KEY = Buffer.from('09234237536700238099172758697347', 'ascii'); // 32 bytes → AES-256
const ALGORITHM = 'aes-256-cbc';

// ── Public API ──────────────────────────────────────────────────

/**
 * Encrypt a deck JSON string into a .dek binary buffer.
 */
export function encryptDek(jsonData: string): Buffer {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(jsonData, 'utf-8'),
    cipher.final(),
  ]);

  // Assemble: header (8) + iv (16) + ciphertext
  return Buffer.concat([HEADER, iv, encrypted]);
}

/**
 * Decrypt a .dek binary buffer into a JSON string.
 * Throws if the header is invalid or decryption fails.
 */
export function decryptDek(data: Buffer): string {
  if (data.length < 24) {
    throw new Error('File too small to be a valid .dek file');
  }

  // Validate header
  const header = data.subarray(0, 8);
  if (!header.equals(HEADER)) {
    throw new Error('Invalid .dek file: missing header');
  }

  const iv = data.subarray(8, 24);
  const ciphertext = data.subarray(24);

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}
