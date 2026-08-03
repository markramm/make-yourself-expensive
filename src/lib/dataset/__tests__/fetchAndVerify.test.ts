import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchAndVerifyDataset, compareCodepoints } from '../fetchAndVerify';
import { PINNED_DATASET } from '../../../data/dataset-manifest';

const datasetPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'public',
  'data',
  'brokers.json',
);
const rawDataset = readFileSync(datasetPath, 'utf-8');

describe('fetchAndVerifyDataset', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(rawDataset, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies successfully against the real compiled dataset checked into public/data', async () => {
    // This is the critical cross-language check: the JS canonical-hash logic here must
    // agree byte-for-byte with scripts/build_brokers.py's Python implementation, since
    // PINNED_DATASET.contentHash was computed by that script. If this test fails, the two
    // canonicalization implementations have drifted (e.g. key sorting, field exclusion).
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    expect(result.verified).toBe(true);
    expect(result.integrityWarning).toBeUndefined();
    expect(result.brokers.length).toBeGreaterThan(0);
  });

  it('flags verified:false on a tampered opt_out_url without throwing', async () => {
    const tampered = JSON.parse(rawDataset);
    tampered.brokers[0].opt_out_url = 'https://evil.example.com/steal';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(tampered), { status: 200 })),
    );

    const result = await fetchAndVerifyDataset('/data/brokers.json');
    expect(result.verified).toBe(false);
    expect(result.integrityWarning?.expectedHash).toBe(PINNED_DATASET.contentHash);
    expect(result.integrityWarning?.actualHash).not.toBe(PINNED_DATASET.contentHash);
    // fail-loud, not fail-closed: data still comes back so the UI can still render
    expect(result.brokers.length).toBeGreaterThan(0);
  });

  it('does NOT flag a mismatch when only last_verified changes (routine re-verification)', async () => {
    const reVerified = JSON.parse(rawDataset);
    reVerified.brokers[0].last_verified = '2099-01-01';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(reVerified), { status: 200 })),
    );

    const result = await fetchAndVerifyDataset('/data/brokers.json');
    expect(result.verified).toBe(true);
  });

  it('throws on a non-ok HTTP response rather than silently returning empty data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404, statusText: 'Not Found' })),
    );
    await expect(fetchAndVerifyDataset('/data/brokers.json')).rejects.toThrow(/404/);
  });

  it('compareCodepoints sorts by raw codepoint, diverging from localeCompare on punctuation/case', () => {
    // Direct pin of the comparator's behavior. localeCompare, under the ICU default/many
    // locales, sorts punctuation-insensitively or case-insensitively in ways that diverge from
    // plain codepoint order -- e.g. it can treat 'a-b' and 'ab' as equal, or order 'B' before
    // 'a'. compareCodepoints must never do that: it's pure UTF-16 code unit comparison, which
    // is what Python's sorted() does too.
    const ids = ['broker-b', 'brokerA', 'broker-a', 'Broker'];
    const sorted = [...ids].sort(compareCodepoints);
    // Plain codepoint order: uppercase letters (0x41-0x5A) sort before lowercase (0x61-0x7A),
    // and '-' (0x2D) sorts before any letter -- this exact order would NOT be guaranteed by
    // localeCompare, whose result depends on the running environment's locale.
    expect(sorted).toEqual(['Broker', 'broker-a', 'broker-b', 'brokerA']);
  });

  it('sorts ids by codepoint, not locale, so the hash matches regardless of input order or user locale', async () => {
    // Regression test: the sort used to be String(a.id).localeCompare(String(b.id)), which is
    // locale-dependent (e.g. some locales collate '-' or accented characters differently than
    // plain codepoint order). Python's sorted() is always codepoint order, so the two
    // implementations could silently diverge for certain id sets. Two "datasets" that contain
    // the same broker objects in different input order must hash identically, since the sort
    // should fully normalize order before hashing -- this is the property that would break
    // first if a locale-aware comparator were reintroduced on a machine with a non-C locale.
    const base = JSON.parse(rawDataset);
    const reordered = { ...base, brokers: [...base.brokers].reverse() };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(reordered), { status: 200 })),
    );
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    expect(result.verified).toBe(true);
  });
});
