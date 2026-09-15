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

describe('malformed payload shapes that used to reach the UI as a raw TypeError', () => {
  // `typeof null === 'object'`, so the original shape check accepted these. They then threw
  // from inside a reactive block (Object.values(null)) -- past every ImportError handler,
  // leaving the import panel wedged with no message at all.
  const envelopeWith = (payload: unknown) =>
    parseEnvelopeFromText(
      JSON.stringify({ protect_export_version: 1, created_at: 'x', encrypted: false, payload }),
    );

  it('rejects a null progress map', async () => {
    await expect(importEnvelope(envelopeWith({ profile: {}, progress: null }))).rejects.toThrow(
      ImportError,
    );
  });

  it('rejects a null profile', async () => {
    await expect(importEnvelope(envelopeWith({ profile: null, progress: {} }))).rejects.toThrow(
      ImportError,
    );
  });

  it('rejects an array smuggled in where an object belongs', async () => {
    await expect(importEnvelope(envelopeWith({ profile: {}, progress: [] }))).rejects.toThrow(
      ImportError,
    );
  });

  it('rejects a damaged progress entry, naming which one', async () => {
    await expect(
      importEnvelope(envelopeWith({ profile: {}, progress: { 'spokeo-com': null } })),
    ).rejects.toThrow(/spokeo-com/);
  });

  it('rejects a progress entry whose done flag is not a boolean', async () => {
    await expect(
      importEnvelope(envelopeWith({ profile: {}, progress: { 'spokeo-com': { done: 'yes' } } })),
    ).rejects.toThrow(ImportError);
  });

  it('rejects damaged hardening data without rejecting its legitimate absence', async () => {
    await expect(
      importEnvelope(envelopeWith({ profile: {}, progress: {}, harden: { 'mac:filevault': 7 } })),
    ).rejects.toThrow(ImportError);
    // An absent harden block is normal: older exports, or a session that never opened Harden.
    await expect(importEnvelope(envelopeWith({ profile: {}, progress: {} }))).resolves.toBeTruthy();
  });

  it('reports a missing kdf block as an ImportError, not a TypeError on undefined', async () => {
    const envelope = parseEnvelopeFromText(
      JSON.stringify({ protect_export_version: 1, created_at: 'x', encrypted: true, iv: 'AAAA', ciphertext: 'AAAA' }),
    );
    await expect(importEnvelope(envelope, 'pw')).rejects.toThrow(ImportError);
  });
});

describe('PBKDF2 iteration count travels with the file', () => {
  it('decrypts a backup written with a different iteration count than today\'s default', async () => {
    // The count is recorded in the envelope precisely so it can be raised later. If decryption
    // used the current constant instead, every backup already in the wild would fail as
    // "wrong passphrase" the moment the constant moved -- at the one moment it is needed.
    const envelope = await exportEncrypted(samplePayload, 'a passphrase');
    if (!envelope.encrypted) throw new Error('expected an encrypted envelope');
    // Simulate a file written by an older build: re-encrypting is not needed, only proving the
    // recorded count is what drives derivation. Tamper it and decryption must fail rather than
    // silently succeed with the constant.
    const tampered = { ...envelope, kdf: { ...envelope.kdf, iterations: envelope.kdf.iterations + 1 } };
    await expect(importEnvelope(tampered, 'a passphrase')).rejects.toThrow(ImportError);
    // Untouched, it round-trips.
    await expect(importEnvelope(envelope, 'a passphrase')).resolves.toEqual(samplePayload);
  });

  it('rejects an unusable iteration count rather than deriving with it', async () => {
    const envelope = await exportEncrypted(samplePayload, 'a passphrase');
    if (!envelope.encrypted) throw new Error('expected an encrypted envelope');
    for (const bad of [0, -1, 1.5, null, 'many']) {
      const broken = { ...envelope, kdf: { ...envelope.kdf, iterations: bad as number } };
      await expect(importEnvelope(broken, 'a passphrase')).rejects.toThrow(ImportError);
    }
  });
});
