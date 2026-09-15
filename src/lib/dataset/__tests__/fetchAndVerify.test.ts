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

describe('unconfirmed-placeholder normalization', () => {
  // The registry writes `<verify: ...>` into a field it could not confirm rather than guessing.
  // Those are prose, not values: rendered as an href one sends the reader to this site's own
  // 404, and being a non-empty string it reads as truthy at every `if (broker.opt_out_url)`.
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(rawDataset, { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands components no placeholder URL to render as a link', async () => {
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    const leaked = result.brokers.filter(
      (b) => typeof b.opt_out_url === 'string' && b.opt_out_url.startsWith('<verify:'),
    );
    expect(leaked.map((b) => b.id)).toEqual([]);
  });

  it('records WHY the URL is absent, which a bare null cannot express', async () => {
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    const flagged = result.brokers.filter((b) => b.route_unconfirmed);
    expect(flagged.length).toBeGreaterThan(0);
    // Every flagged entry must also have been nulled, or the badge and the link disagree.
    expect(flagged.every((b) => b.opt_out_url === null)).toBe(true);
  });

  it('does not flag a broker that simply has no URL', async () => {
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    const emailOnly = result.brokers.filter((b) => b.opt_out_url === null && !b.route_unconfirmed);
    // Email- and phone-only brokers legitimately have no URL and must not be badged as
    // unconfirmed routes -- that would put the warning on rows where nothing is wrong.
    expect(emailOnly.length).toBeGreaterThan(0);
  });

  it('restores the phone number on phone-only rows the placeholder had hidden', async () => {
    // A truthy placeholder made `!broker.opt_out_url` false, so BrokerRowGuided silently
    // dropped "Call ..." on exactly the rows where the number IS the opt-out route.
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    const nowShowing = result.brokers.filter(
      (b) => b.tier === 'guided' && b.route_unconfirmed && b.phone && !b.opt_out_url,
    );
    expect(nowShowing.length).toBeGreaterThan(0);
  });

  it('hashes the registry bytes as published, not our normalized rewrite', async () => {
    // Normalization must run AFTER the integrity check. If it ran before, the pin would only
    // ever match a dataset we had already edited -- verifying our own edit, not the release.
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    expect(result.verified).toBe(true);
    expect(result.brokers.some((b) => b.route_unconfirmed)).toBe(true);
  });

  it('treats the marker as an anchored prefix, not a substring match', async () => {
    // A real URL whose query string happens to embed the text must stay a real URL.
    const doctored = JSON.parse(rawDataset);
    const target = doctored.brokers.find((b: { opt_out_url: string | null }) => b.opt_out_url);
    target.opt_out_url = 'https://example.test/x?note=<verify:%20nope>';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(doctored), { status: 200 })));
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    const seen = result.brokers.find((b) => b.id === target.id);
    expect(seen?.opt_out_url).toBe('https://example.test/x?note=<verify:%20nope>');
    expect(seen?.route_unconfirmed).toBeFalsy();
  });

  it('normalizes an unconfirmed opt-out EMAIL the same way', async () => {
    const result = await fetchAndVerifyDataset('/data/brokers.json');
    const leaked = result.brokers.filter(
      (b) => typeof b.opt_out_email === 'string' && b.opt_out_email.startsWith('<verify:'),
    );
    expect(leaked.map((b) => b.id)).toEqual([]);
    expect(result.brokers.some((b) => b.opt_out_email_unconfirmed)).toBe(true);
  });
});
