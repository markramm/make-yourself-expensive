/**
 * Client-side export/import of profile + progress state. Encryption is default-on
 * (PBKDF2 + AES-GCM via WebCrypto) with an explicit opt-out, per the "PII never leaves
 * this browser unprotected by default" non-negotiable. No network calls anywhere in
 * this module -- everything here is SubtleCrypto + Blob/FileReader.
 */

const ENVELOPE_VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96-bit IV, the recommended size for AES-GCM

export interface ExportPayload {
  profile: Record<string, unknown>;
  progress: Record<string, unknown>;
  /**
   * Per-store schema versions at the time of export (see stores/profile.ts and
   * stores/progress.ts for their PROFILE_SCHEMA_VERSION / PROGRESS_SCHEMA_VERSION constants).
   * Optional and absent on exports written before this field existed -- treat a missing
   * entry as schema_version 0 for that store, same convention loadVersioned() uses for
   * pre-versioning localStorage data.
   */
  schema_versions?: { profile?: number; progress?: number };
}

interface EncryptedEnvelope {
  protect_export_version: typeof ENVELOPE_VERSION;
  created_at: string;
  encrypted: true;
  kdf: { name: 'PBKDF2'; iterations: number; salt: string };
  iv: string;
  ciphertext: string;
}

interface PlaintextEnvelope {
  protect_export_version: typeof ENVELOPE_VERSION;
  created_at: string;
  encrypted: false;
  payload: ExportPayload;
}

export type ExportEnvelope = EncryptedEnvelope | PlaintextEnvelope;

export class ImportError extends Error {}

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function exportEncrypted(payload: ExportPayload, passphrase: string): Promise<ExportEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    protect_export_version: ENVELOPE_VERSION,
    created_at: new Date().toISOString(),
    encrypted: true,
    kdf: { name: 'PBKDF2', iterations: PBKDF2_ITERATIONS, salt: bufToBase64(salt.buffer) },
    iv: bufToBase64(iv.buffer),
    ciphertext: bufToBase64(ciphertext),
  };
}

export function exportPlaintext(payload: ExportPayload): ExportEnvelope {
  return {
    protect_export_version: ENVELOPE_VERSION,
    created_at: new Date().toISOString(),
    encrypted: false,
    payload,
  };
}

export async function importEnvelope(envelope: ExportEnvelope, passphrase?: string): Promise<ExportPayload> {
  if (envelope.protect_export_version !== ENVELOPE_VERSION) {
    throw new ImportError(`unsupported export version: ${(envelope as any).protect_export_version}`);
  }

  if (!envelope.encrypted) {
    return validatePayloadShape(envelope.payload);
  }

  if (!passphrase) {
    throw new ImportError('this backup is encrypted -- a passphrase is required');
  }

  const salt = new Uint8Array(base64ToBuf(envelope.kdf.salt));
  const iv = new Uint8Array(base64ToBuf(envelope.iv));
  const key = await deriveKey(passphrase, salt);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBuf(envelope.ciphertext),
    );
  } catch {
    // AES-GCM auth-tag failure surfaces as a generic OperationError from SubtleCrypto --
    // normalize it to a message a non-technical user can act on, since "wrong passphrase"
    // and "corrupted file" are indistinguishable at the crypto layer.
    throw new ImportError('wrong passphrase, or this file is corrupted');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new ImportError('decrypted content is not valid JSON -- this file is corrupted');
  }

  return validatePayloadShape(parsed);
}

function validatePayloadShape(payload: unknown): ExportPayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('profile' in payload) ||
    !('progress' in payload) ||
    typeof (payload as any).profile !== 'object' ||
    typeof (payload as any).progress !== 'object'
  ) {
    throw new ImportError('this file does not look like a Make Yourself Expensive backup (missing profile/progress)');
  }
  return payload as ExportPayload;
}

export function parseEnvelopeFromText(text: string): ExportEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('this file is not valid JSON');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('protect_export_version' in parsed) ||
    !('encrypted' in parsed)
  ) {
    throw new ImportError('this file does not look like a Make Yourself Expensive backup');
  }
  return parsed as ExportEnvelope;
}
