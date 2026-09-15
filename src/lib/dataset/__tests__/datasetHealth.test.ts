/**
 * Dataset health checks that run against the REAL shipped brokers.json, not a fixture.
 *
 * These are not unit tests of logic -- they are guards against the dataset and the app
 * drifting apart in ways a tester discovers before we do. Each one encodes a specific way
 * someone's first session can be wasted: an entry with no way to act on it, an empty
 * instruction, a pin that disagrees with the data it pins.
 *
 * They deliberately do NOT fail on unverified entries or bot-blocked links. Those are
 * honest states of the world that the UI is responsible for labelling, not defects to
 * block CI on -- see the link_status surfacing in RowShell.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PINNED_DATASET } from '../../../data/dataset-manifest';

const datasetPath = fileURLToPath(new URL('../../../../public/data/brokers.json', import.meta.url));
const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
const brokers = dataset.brokers as Array<Record<string, unknown>>;

describe('shipped dataset', () => {
  it('has brokers', () => {
    expect(Array.isArray(brokers)).toBe(true);
    expect(brokers.length).toBeGreaterThan(0);
  });

  it('matches the pinned version and hash in dataset-manifest.ts', () => {
    // The pin is what the app checks at runtime. If these drift, every visitor gets the
    // integrity warning banner -- usually because someone copied brokers.json and forgot
    // to bump the manifest (which is exactly what had happened at 0.1.8 vs 0.1.15).
    expect(dataset._meta.dataset_version).toBe(PINNED_DATASET.datasetVersion);
    expect(dataset._meta.content_hash).toBe(PINNED_DATASET.contentHash);
  });

  it('gives every broker at least one way to act', () => {
    // A row with no URL, no email and no phone renders an action a tester cannot take.
    const stranded = brokers.filter((b) => !b.opt_out_url && !b.opt_out_email && !b.phone);
    expect(stranded.map((b) => b.id)).toEqual([]);
  });

  it('gives every broker a way to act AFTER unconfirmed placeholders are nulled', () => {
    // The check above reads the raw file, where a `<verify: ...>` placeholder counts as a URL
    // and hides this entirely. The app never sees that string -- fetchAndVerify.ts nulls it --
    // so the reader-facing question is whether a route survives normalization. 17 entries do
    // not, 12 of them crucial, and for those the instructions ARE the route: the row must say
    // so rather than rendering a toggle above nothing. This asserts the fallback exists in the
    // data, so the UI always has something true to show.
    const isPlaceholder = (v: unknown) => typeof v === 'string' && v.startsWith('<verify:');
    const routeless = brokers.filter((b) => {
      const url = isPlaceholder(b.opt_out_url) ? null : b.opt_out_url;
      const email = isPlaceholder(b.opt_out_email) ? null : b.opt_out_email;
      return !url && !email && !b.phone;
    });
    const withoutGuidance = routeless.filter(
      (b) => String(b.instructions_md ?? '').trim().length < 40,
    );
    expect(withoutGuidance.map((b) => b.id)).toEqual([]);
  });

  it('gives every broker non-empty instructions', () => {
    const blank = brokers.filter((b) => !String(b.instructions_md ?? '').trim());
    expect(blank.map((b) => b.id)).toEqual([]);
  });

  it('uses only required_fields the UI knows how to label', () => {
    // An unlabelled field renders as a raw key ("gov_id") to a non-technical tester.
    const known = new Set([
      'full_name', 'email', 'address', 'phone', 'dob',
      'listing_url', 'ssn', 'gov_id', 'vin', 'other',
    ]);
    const unknown = new Set<string>();
    for (const b of brokers) {
      for (const f of (b.required_fields as string[] | undefined) ?? []) {
        if (!known.has(f)) unknown.add(f);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('uses only link_status values the UI knows how to render', () => {
    const known = new Set(['live', 'bot-blocked', 'redirect', 'broken', 'unknown']);
    const unknown = new Set<string>();
    for (const b of brokers) {
      if (b.link_status !== undefined && !known.has(String(b.link_status))) {
        unknown.add(String(b.link_status));
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('uses only tier and priority values the batching logic understands', () => {
    // sortForBatching indexes TIER_ORDER/PRIORITY_ORDER directly -- an unknown value sorts
    // as undefined and silently scrambles the working order a tester is handed.
    const tiers = new Set(brokers.map((b) => String(b.tier)));
    const priorities = new Set(brokers.map((b) => String(b.priority)));
    expect([...tiers].sort()).toEqual(['assisted', 'auto', 'guided']);
    expect([...priorities].sort()).toEqual(['crucial', 'high', 'standard']);
  });

  it('reports coverage counts that add up', () => {
    const m = dataset._meta;
    expect(m.authored_count).toBe(brokers.length);
    expect(m.authored_count + m.backlog_count).toBe(m.total_known);
  });
});
