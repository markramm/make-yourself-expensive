import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchAndVerifyDataset } from '../fetchAndVerify';
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
});
