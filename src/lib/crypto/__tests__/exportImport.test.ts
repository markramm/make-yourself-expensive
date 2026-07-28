import { describe, it, expect } from 'vitest';
import {
  exportEncrypted,
  exportPlaintext,
  importEnvelope,
  parseEnvelopeFromText,
  ImportError,
  type ExportPayload,
} from '../exportImport';

const samplePayload: ExportPayload = {
  profile: { fullName: 'Jane Doe', email: 'jane@example.com' },
  progress: { 'spokeo-com': { done: true, doneAt: '2026-07-01' } },
};

describe('encrypted export/import round-trip', () => {
  it('decrypts with the correct passphrase and recovers the exact payload', async () => {
    const envelope = await exportEncrypted(samplePayload, 'correct horse battery staple');
    const recovered = await importEnvelope(envelope, 'correct horse battery staple');
    expect(recovered).toEqual(samplePayload);
  });

  it('rejects the wrong passphrase without leaking a raw crypto exception', async () => {
    const envelope = await exportEncrypted(samplePayload, 'right passphrase');
    await expect(importEnvelope(envelope, 'wrong passphrase')).rejects.toThrow(ImportError);
    await expect(importEnvelope(envelope, 'wrong passphrase')).rejects.toThrow(
      /wrong passphrase|corrupted/,
    );
  });

  it('requires a passphrase for an encrypted envelope', async () => {
    const envelope = await exportEncrypted(samplePayload, 'some passphrase');
    await expect(importEnvelope(envelope)).rejects.toThrow(ImportError);
  });

  it('uses a fresh random salt and IV on every export (no key/nonce reuse)', async () => {
    const a = await exportEncrypted(samplePayload, 'same passphrase');
    const b = await exportEncrypted(samplePayload, 'same passphrase');
    if (!a.encrypted || !b.encrypted) throw new Error('expected encrypted envelopes');
    expect(a.kdf.salt).not.toEqual(b.kdf.salt);
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });
});

describe('plaintext export/import (explicit no-encryption opt-out)', () => {
  it('round-trips without a passphrase', async () => {
    const envelope = exportPlaintext(samplePayload);
    expect(envelope.encrypted).toBe(false);
    const recovered = await importEnvelope(envelope);
    expect(recovered).toEqual(samplePayload);
  });
});

describe('malformed / hostile input handling', () => {
  it('rejects a file that is not JSON', () => {
    expect(() => parseEnvelopeFromText('not json at all')).toThrow(ImportError);
  });

  it('rejects JSON that is not a recognized backup envelope', () => {
    expect(() => parseEnvelopeFromText(JSON.stringify({ foo: 'bar' }))).toThrow(ImportError);
  });

  it('rejects a decrypted payload missing profile/progress keys', async () => {
    const envelope = await exportEncrypted({ profile: {}, progress: {} } as ExportPayload, 'pw');
    // corrupt the envelope's ciphertext-adjacent shape check by importing a hand-built
    // plaintext envelope with a malformed payload instead
    const badPlaintext = exportPlaintext({ notProfile: {} } as any);
    await expect(importEnvelope(badPlaintext)).rejects.toThrow(ImportError);
    // sanity: the well-formed one still works
    await expect(importEnvelope(envelope, 'pw')).resolves.toEqual({ profile: {}, progress: {} });
  });

  it('rejects an unsupported envelope version', async () => {
    const envelope = exportPlaintext(samplePayload);
    (envelope as any).protect_export_version = 99;
    await expect(importEnvelope(envelope)).rejects.toThrow(ImportError);
  });
});
