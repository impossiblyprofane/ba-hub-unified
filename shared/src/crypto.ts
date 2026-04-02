/**
 * AES-256-CBC encryption for API traffic obfuscation.
 *
 * This is a surface-level anti-scraping measure — the key and IV are
 * shared between frontend and backend and are effectively public.
 * It prevents casual bots from reading GraphQL responses directly.
 *
 * Uses crypto-js for cross-environment compatibility (browser + Node).
 */
import CryptoJS from 'crypto-js';

let _key: CryptoJS.lib.WordArray | null = null;
let _iv: CryptoJS.lib.WordArray | null = null;

function getKey(): CryptoJS.lib.WordArray {
  if (!_key) {
    const hex =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENCRYPTION_KEY) ||
      (typeof process !== 'undefined' && process.env?.ENCRYPTION_KEY) ||
      '';
    if (!hex) throw new Error('Encryption key not configured');
    _key = CryptoJS.enc.Hex.parse(hex);
  }
  return _key;
}

function getIV(): CryptoJS.lib.WordArray {
  if (!_iv) {
    const hex =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENCRYPTION_IV) ||
      (typeof process !== 'undefined' && process.env?.ENCRYPTION_IV) ||
      '';
    if (!hex) throw new Error('Encryption IV not configured');
    _iv = CryptoJS.enc.Hex.parse(hex);
  }
  return _iv;
}

/** Encrypt a JSON-serializable object to an AES ciphertext string. */
export function encryptPayload(obj: unknown): string {
  const json = JSON.stringify(obj);
  const encrypted = CryptoJS.AES.encrypt(json, getKey(), { iv: getIV() });
  return encrypted.toString();
}

/** Decrypt an AES ciphertext string back to a parsed object. */
export function decryptPayload<T = unknown>(ciphertext: string): T {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, getKey(), { iv: getIV() });
  const json = decrypted.toString(CryptoJS.enc.Utf8);
  return JSON.parse(json) as T;
}

/** Check if encryption is available (keys configured). */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    getIV();
    return true;
  } catch {
    return false;
  }
}
