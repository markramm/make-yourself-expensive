import { describe, it, expect } from 'vitest';
import { nextBatch, batchFromIds, sortForBatching, weightFor, DEFAULT_BATCH_WEIGHT, batchScoreFor } from '../nextBatch';
import type { Broker } from '../../dataset/fetchAndVerify';
import type { ProgressMap, BrokerProgress } from '../../../stores/progress';

/** A confirmed-removal record. Batching only reads `done`, but ProgressMap requires the
 *  full v2 shape -- see stores/progress.ts for why progress is a state machine now. */
function doneEntry(at = '2026-01-01'): BrokerProgress {
  return { done: true, doneAt: at, status: "confirmed", submittedAt: at, note: "" };
}

function makeBroker(overrides: Partial<Broker> & Pick<Broker, 'id' | 'tier' | 'priority'>): Broker {
  return {
    name: overrides.id,
    domain: `${overrides.id}.example`,
    category: 'people_search',
    people_search: true,
    method: 'form',
    opt_out_url: 'https://example.com/optout',
    opt_out_email: null,
    phone: null,
    captcha: false,
    id_required: false,
    phone_required: false,
    charges_fee: false,
    verification: null,
    required_fields: [],
    readd_days: null,
    legal_basis: [],
    link_status: 'unknown',
    last_verified: null,
    source: 'test',
    instructions_md: '',
    ...overrides,
  };
}

describe('weightFor', () => {
  it('assigns auto=1, assisted=2, guided=4', () => {
    expect(weightFor({ tier: 'auto' })).toBe(1);
    expect(weightFor({ tier: 'assisted' })).toBe(2);
    expect(weightFor({ tier: 'guided' })).toBe(4);
  });
});

describe('sortForBatching', () => {
  it('sorts priority first (crucial, high, standard)', () => {
    const brokers = [
      makeBroker({ id: 'c', priority: 'standard', tier: 'auto' }),
      makeBroker({ id: 'a', priority: 'crucial', tier: 'auto' }),
      makeBroker({ id: 'b', priority: 'high', tier: 'auto' }),
    ];
    expect(sortForBatching(brokers).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by tier (auto, assisted, guided) within the same priority', () => {
    const brokers = [
      makeBroker({ id: 'guided-one', priority: 'crucial', tier: 'guided' }),
      makeBroker({ id: 'auto-one', priority: 'crucial', tier: 'auto' }),
      makeBroker({ id: 'assisted-one', priority: 'crucial', tier: 'assisted' }),
    ];
    expect(sortForBatching(brokers).map((b) => b.id)).toEqual(['auto-one', 'assisted-one', 'guided-one']);
  });

  it('never lets tier override priority -- a crucial guided broker still beats a standard auto one', () => {
    const brokers = [
      makeBroker({ id: 'standard-auto', priority: 'standard', tier: 'auto' }),
      makeBroker({ id: 'crucial-guided', priority: 'crucial', tier: 'guided' }),
    ];
    expect(sortForBatching(brokers).map((b) => b.id)).toEqual(['crucial-guided', 'standard-auto']);
  });
});

describe('nextBatch', () => {
  it('returns null when there is nothing undone', () => {
    const brokers = [makeBroker({ id: 'a', priority: 'crucial', tier: 'auto' })];
    const progress: ProgressMap = { a: doneEntry('2026-01-01') };
    expect(nextBatch(brokers, progress)).toBeNull();
  });

  it('fills a batch up to the target weight, in priority/tier order', () => {
    // 5 auto (weight 1 each) = 5, fits comfortably under a target of 8
    const brokers = Array.from({ length: 5 }, (_, i) =>
      makeBroker({ id: `auto-${i}`, priority: 'crucial', tier: 'auto' }),
    );
    const batch = nextBatch(brokers, {}, 8);
    expect(batch).not.toBeNull();
    expect(batch!.items).toHaveLength(5);
    expect(batch!.totalWeight).toBe(5);
    expect(batch!.isFinalBatch).toBe(true);
    expect(batch!.remainingAfterBatch).toBe(0);
  });

  it('stops adding once the next item would exceed the target weight', () => {
    // 4 assisted (weight 2 each) = 8 exactly; a 5th would push to 10 > 8, so batch stops at 4
    const brokers = Array.from({ length: 6 }, (_, i) =>
      makeBroker({ id: `assisted-${i}`, priority: 'crucial', tier: 'assisted' }),
    );
    const batch = nextBatch(brokers, {}, 8);
    expect(batch!.items).toHaveLength(4);
    expect(batch!.totalWeight).toBe(8);
    expect(batch!.isFinalBatch).toBe(false);
    expect(batch!.remainingAfterBatch).toBe(2);
  });

  it('always includes at least one item, even if its weight alone exceeds the target', () => {
    // a single guided broker (weight 4) with a tiny target of 1 -- must still return it,
    // not an empty batch, or the flow would stall forever on this broker.
    const brokers = [makeBroker({ id: 'heavy', priority: 'crucial', tier: 'guided' })];
    const batch = nextBatch(brokers, {}, 1);
    expect(batch!.items).toHaveLength(1);
    expect(batch!.items[0].id).toBe('heavy');
    expect(batch!.isFinalBatch).toBe(true);
  });

  it('excludes brokers already marked done, and recomputes fresh each call (no stored identity)', () => {
    const brokers = [
      makeBroker({ id: 'a', priority: 'crucial', tier: 'auto' }),
      makeBroker({ id: 'b', priority: 'crucial', tier: 'auto' }),
      makeBroker({ id: 'c', priority: 'crucial', tier: 'auto' }),
    ];
    const progress: ProgressMap = { a: doneEntry('2026-01-01') };
    const batch = nextBatch(brokers, progress, 8);
    expect(batch!.items.map((b) => b.id)).toEqual(['b', 'c']);
  });

  it('mixes tiers within a batch once lighter items are exhausted at a priority level', () => {
    // 2 auto (weight 1 each = 2) + guided items (weight 4 each) at the same priority --
    // batch should take both auto, then start filling with guided up to the target.
    const brokers = [
      makeBroker({ id: 'auto-1', priority: 'crucial', tier: 'auto' }),
      makeBroker({ id: 'auto-2', priority: 'crucial', tier: 'auto' }),
      makeBroker({ id: 'guided-1', priority: 'crucial', tier: 'guided' }),
      makeBroker({ id: 'guided-2', priority: 'crucial', tier: 'guided' }),
    ];
    const batch = nextBatch(brokers, {}, 8);
    // 1 + 1 + 4 + 4 = 10 > 8, so after auto-1, auto-2 (weight 2), guided-1 (weight 6),
    // adding guided-2 would make 10 > 8 -- stop at 3 items, weight 6.
    expect(batch!.items.map((b) => b.id)).toEqual(['auto-1', 'auto-2', 'guided-1']);
    expect(batch!.totalWeight).toBe(6);
  });

  it('uses DEFAULT_BATCH_WEIGHT when no target is passed', () => {
    const brokers = Array.from({ length: 10 }, (_, i) =>
      makeBroker({ id: `auto-${i}`, priority: 'crucial', tier: 'auto' }),
    );
    const batch = nextBatch(brokers, {});
    expect(batch!.totalWeight).toBeLessThanOrEqual(DEFAULT_BATCH_WEIGHT);
  });
});

describe('batchFromIds -- resuming a persisted in-progress batch', () => {
  const brokers = [
    makeBroker({ id: 'a', priority: 'crucial', tier: 'auto' }),
    makeBroker({ id: 'b', priority: 'crucial', tier: 'assisted' }),
    makeBroker({ id: 'c', priority: 'crucial', tier: 'guided' }),
    makeBroker({ id: 'd', priority: 'high', tier: 'auto' }),
  ];

  it('reconstructs the same item set from persisted ids, regardless of current sort order', () => {
    const batch = batchFromIds(brokers, ['c', 'a'], {});
    // order of the persisted id list is preserved -- this IS the frozen batch, not a re-sort
    expect(batch!.items.map((b) => b.id)).toEqual(['c', 'a']);
    expect(batch!.totalWeight).toBe(4 + 1); // guided + auto
  });

  it('returns null if none of the persisted ids exist in the current dataset (fully stale)', () => {
    const batch = batchFromIds(brokers, ['nonexistent-1', 'nonexistent-2'], {});
    expect(batch).toBeNull();
  });

  it('silently drops ids that no longer exist while keeping the ones that do (partial staleness)', () => {
    const batch = batchFromIds(brokers, ['a', 'nonexistent', 'b'], {});
    expect(batch!.items.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('computes remainingAfterBatch against the CURRENT undone set, not a frozen snapshot', () => {
    // batch is [a, b]; c and d are undone elsewhere -- remaining should be 2
    const batch = batchFromIds(brokers, ['a', 'b'], {});
    expect(batch!.remainingAfterBatch).toBe(2);
    expect(batch!.isFinalBatch).toBe(false);
  });

  it('reflects live completion state -- marking an item done elsewhere shows up without changing batch membership', () => {
    const progress = { a: doneEntry('2026-01-01') };
    const batch = batchFromIds(brokers, ['a', 'b'], progress);
    // 'a' is done but stays IN the batch -- it doesn't vanish, matching the component's
    // "struck-through but still visible" behavior.
    expect(batch!.items.map((b) => b.id)).toEqual(['a', 'b']);
    // remainingAfterBatch counts only OTHER undone brokers (c, d), not 'a' which is done
    expect(batch!.remainingAfterBatch).toBe(2);
  });

  it('marks isFinalBatch true once every other broker is also done', () => {
    const progress = {
      c: doneEntry('2026-01-01'),
      d: doneEntry('2026-01-01'),
    };
    const batch = batchFromIds(brokers, ['a', 'b'], progress);
    expect(batch!.remainingAfterBatch).toBe(0);
    expect(batch!.isFinalBatch).toBe(true);
  });
});

describe('batchScoreFor -- value times ease', () => {
  it('ranks an easy crucial broker above a hard one', () => {
    const easy = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'live' });
    const hard = batchScoreFor({ priority: 'crucial', tier: 'guided', link_status: 'live' });
    expect(easy).toBeGreaterThan(hard);
  });

  it('lets an easy high-priority broker outrank a hard crucial one', () => {
    // This is the whole point of the change: strict priority ordering put a CAPTCHA-guarded
    // crucial broker ahead of a one-click high-priority email.
    const easyHigh = batchScoreFor({ priority: 'high', tier: 'auto', link_status: 'live' });
    const hardCrucial = batchScoreFor({ priority: 'crucial', tier: 'guided', link_status: 'live' });
    expect(easyHigh).toBeGreaterThan(hardCrucial);
  });

  it('still puts a crucial broker ahead of a standard one at equal ease', () => {
    const crucial = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'live' });
    const standard = batchScoreFor({ priority: 'standard', tier: 'auto', link_status: 'live' });
    expect(crucial).toBeGreaterThan(standard);
  });

  it('sinks a broken link below everything comparable', () => {
    const broken = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'broken' });
    const liveStandard = batchScoreFor({ priority: 'standard', tier: 'auto', link_status: 'live' });
    expect(broken).toBeLessThan(liveStandard);
  });

  it('does not banish bot-blocked -- it works for humans', () => {
    const blocked = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'bot-blocked' });
    const broken = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'broken' });
    const liveStandardGuided = batchScoreFor({ priority: 'standard', tier: 'guided', link_status: 'live' });
    expect(blocked).toBeGreaterThan(broken);
    expect(blocked).toBeGreaterThan(liveStandardGuided);
  });

  it('treats a missing link_status as near-live rather than penalising it', () => {
    const absent = batchScoreFor({ priority: 'high', tier: 'assisted' });
    const live = batchScoreFor({ priority: 'high', tier: 'assisted', link_status: 'live' });
    const brokenSame = batchScoreFor({ priority: 'high', tier: 'assisted', link_status: 'broken' });
    expect(absent).toBeLessThanOrEqual(live);
    expect(absent).toBeGreaterThan(brokenSame);
  });

  it('prefers a human-verified entry over an otherwise identical unverified one', () => {
    // Only 37 of 493 entries are verified, and without this term the first batch a tester met
    // was five unverified entries out of seven -- so a failure told them nothing about whether
    // the opt-out or the instruction was at fault.
    const verified = batchScoreFor({
      priority: 'crucial', tier: 'auto', link_status: 'live', last_verified: '2026-07-03',
    });
    const unverified = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'live' });
    expect(verified).toBeGreaterThan(unverified);
  });

  it('treats last_verified: null the same as the field being absent', () => {
    const explicitNull = batchScoreFor({
      priority: 'high', tier: 'assisted', link_status: 'live', last_verified: null,
    });
    const absent = batchScoreFor({ priority: 'high', tier: 'assisted', link_status: 'live' });
    expect(explicitNull).toBe(absent);
  });

  it('does not let verification outweigh ease: a verified hard crucial still loses to an easy high', () => {
    // The bound that sizes VERIFIED_BONUS. If verification could flip this, the flow would
    // start handing testers CAPTCHA-guarded multi-step brokers again, which is the exact
    // regression the value-times-ease ordering was introduced to fix.
    const verifiedHardCrucial = batchScoreFor({
      priority: 'crucial', tier: 'guided', link_status: 'live', last_verified: '2026-07-03',
    });
    const easyHigh = batchScoreFor({ priority: 'high', tier: 'auto', link_status: 'live' });
    expect(verifiedHardCrucial).toBeLessThan(easyHigh);
  });

  it('does not resurrect a dead link: a verified broken entry still loses to a live standard one', () => {
    // The other bound. Being confirmed-correct months ago does not help a reader whose click
    // lands on a page that no longer exists.
    const verifiedBroken = batchScoreFor({
      priority: 'crucial', tier: 'auto', link_status: 'broken', last_verified: '2026-07-03',
    });
    const liveStandard = batchScoreFor({ priority: 'standard', tier: 'auto', link_status: 'live' });
    expect(verifiedBroken).toBeLessThan(liveStandard);
  });

  it('keeps unverified entries in the ordinary flow rather than banishing them', () => {
    // Finding that an unverified entry is WRONG is the most valuable correction this project
    // can get, so the bonus must stay a nudge: an unverified crucial one-click email still
    // outranks a verified standard one.
    const unverifiedCrucial = batchScoreFor({ priority: 'crucial', tier: 'auto', link_status: 'live' });
    const verifiedStandard = batchScoreFor({
      priority: 'standard', tier: 'auto', link_status: 'live', last_verified: '2026-07-03',
    });
    expect(unverifiedCrucial).toBeGreaterThan(verifiedStandard);
  });

  it('is deterministic for equal scores', () => {
    const a = { id: 'a', name: 'Alpha', priority: 'high', tier: 'auto', link_status: 'live' } as never;
    const b = { id: 'b', name: 'Beta', priority: 'high', tier: 'auto', link_status: 'live' } as never;
    expect(sortForBatching([b, a]).map((x: { id: string }) => x.id)).toEqual(['a', 'b']);
    expect(sortForBatching([a, b]).map((x: { id: string }) => x.id)).toEqual(['a', 'b']);
  });
});
