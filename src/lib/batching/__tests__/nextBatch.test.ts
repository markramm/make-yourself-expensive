import { describe, it, expect } from 'vitest';
import { nextBatch, batchFromIds, sortForBatching, weightFor, DEFAULT_BATCH_WEIGHT } from '../nextBatch';
import type { Broker } from '../../dataset/fetchAndVerify';
import type { ProgressMap } from '../../../stores/progress';

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
    const progress: ProgressMap = { a: { done: true, doneAt: '2026-01-01' } };
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
    const progress: ProgressMap = { a: { done: true, doneAt: '2026-01-01' } };
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
    const progress = { a: { done: true, doneAt: '2026-01-01' } };
    const batch = batchFromIds(brokers, ['a', 'b'], progress);
    // 'a' is done but stays IN the batch -- it doesn't vanish, matching the component's
    // "struck-through but still visible" behavior.
    expect(batch!.items.map((b) => b.id)).toEqual(['a', 'b']);
    // remainingAfterBatch counts only OTHER undone brokers (c, d), not 'a' which is done
    expect(batch!.remainingAfterBatch).toBe(2);
  });

  it('marks isFinalBatch true once every other broker is also done', () => {
    const progress = {
      c: { done: true, doneAt: '2026-01-01' },
      d: { done: true, doneAt: '2026-01-01' },
    };
    const batch = batchFromIds(brokers, ['a', 'b'], progress);
    expect(batch!.remainingAfterBatch).toBe(0);
    expect(batch!.isFinalBatch).toBe(true);
  });
});
