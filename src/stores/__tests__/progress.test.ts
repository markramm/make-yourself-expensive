import { describe, it, expect } from 'vitest';
import { mergeProgress, isDone, statusOf, isInFlight, EMPTY_PROGRESS, type ProgressMap, type BrokerProgress } from '../progress';

/** A record in a given state, with the timestamps that state implies. */
function entry(overrides: Partial<BrokerProgress> = {}): BrokerProgress {
  return { ...EMPTY_PROGRESS, ...overrides };
}
const confirmed = (at: string) =>
  entry({ done: true, doneAt: at, status: 'confirmed', submittedAt: at });
const submitted = (at: string) => entry({ status: 'submitted', submittedAt: at });

describe('mergeProgress', () => {
  it('takes the union of two disjoint progress maps', () => {
    const current: ProgressMap = { a: confirmed('2026-01-01') };
    const incoming: ProgressMap = { b: confirmed('2026-01-02') };
    const merged = mergeProgress(current, incoming);
    expect(isDone(merged, 'a')).toBe(true);
    expect(isDone(merged, 'b')).toBe(true);
  });

  it('never moves a broker backwards, even if the incoming map is less far along', () => {
    // An older backup must not reset a removal the reader already confirmed here.
    const current: ProgressMap = { a: confirmed('2026-01-05') };
    const incoming: ProgressMap = { a: submitted('2026-01-01') };
    const merged = mergeProgress(current, incoming);
    expect(statusOf(merged, 'a')).toBe('confirmed');
    expect(isDone(merged, 'a')).toBe(true);
  });

  it('adopts an incoming state that is further along than the current one', () => {
    const current: ProgressMap = { a: submitted('2026-01-01') };
    const incoming: ProgressMap = { a: confirmed('2026-01-03') };
    const merged = mergeProgress(current, incoming);
    expect(statusOf(merged, 'a')).toBe('confirmed');
  });

  it('promotes not-started to an in-flight state from the other device', () => {
    // The point of syncing: a request sent on the laptop shows as outstanding on the phone.
    const current: ProgressMap = { a: entry() };
    const incoming: ProgressMap = { a: submitted('2026-01-02') };
    const merged = mergeProgress(current, incoming);
    expect(statusOf(merged, 'a')).toBe('submitted');
    expect(isInFlight(merged.a)).toBe(true);
  });

  it('keeps the EARLIEST submission date, since that is the age of the request', () => {
    // "Sent three weeks ago, still nothing" is the signal to chase; the later date would
    // understate how long it has been outstanding.
    const current: ProgressMap = { a: submitted('2026-01-10') };
    const incoming: ProgressMap = { a: submitted('2026-01-02') };
    expect(mergeProgress(current, incoming).a.submittedAt).toBe('2026-01-02');
  });

  it('preserves a local note rather than losing it to a merge', () => {
    // Notes hold confirmation numbers. Losing one to a backup import is its own disaster.
    const current: ProgressMap = { a: entry({ ...submitted('2026-01-01'), note: 'ref #12345' }) };
    const incoming: ProgressMap = { a: confirmed('2026-01-03') };
    const merged = mergeProgress(current, incoming);
    expect(merged.a.note).toBe('ref #12345');
    expect(merged.a.status).toBe('confirmed');
  });

  it('adopts an incoming note when there is none locally', () => {
    const current: ProgressMap = { a: submitted('2026-01-01') };
    const incoming: ProgressMap = { a: entry({ ...submitted('2026-01-01'), note: 'they asked for ID' }) };
    expect(mergeProgress(current, incoming).a.note).toBe('they asked for ID');
  });

  it('leaves current entries with no counterpart in incoming untouched', () => {
    const current: ProgressMap = { a: confirmed('2026-01-01'), b: entry() };
    const merged = mergeProgress(current, {});
    expect(merged.a).toEqual(current.a);
    expect(merged.b).toEqual(current.b);
  });

  it('is a pure function -- does not mutate either input', () => {
    const current: ProgressMap = { a: submitted('2026-01-01') };
    const incoming: ProgressMap = { a: confirmed('2026-01-03') };
    const snapshot = JSON.stringify([current, incoming]);
    mergeProgress(current, incoming);
    expect(JSON.stringify([current, incoming])).toBe(snapshot);
  });

  it('ignores a malformed incoming entry rather than corrupting the map', () => {
    const current: ProgressMap = { a: confirmed('2026-01-01') };
    const merged = mergeProgress(current, { a: null as unknown as BrokerProgress });
    expect(statusOf(merged, 'a')).toBe('confirmed');
  });
});

describe('isInFlight', () => {
  it('is true for a request that is sent but not yet confirmed', () => {
    // The state the whole change exists for: brokers take days to acknowledge, so work is
    // necessarily parallel and "waiting" has to be visible.
    expect(isInFlight(submitted('2026-01-01'))).toBe(true);
    expect(isInFlight(entry({ status: 'awaiting_verification' }))).toBe(true);
  });

  it('is false at both ends -- nothing sent, or already confirmed', () => {
    expect(isInFlight(entry())).toBe(false);
    expect(isInFlight(confirmed('2026-01-01'))).toBe(false);
    expect(isInFlight(undefined)).toBe(false);
  });
});

describe('isDone stays a faithful view of confirmed', () => {
  it('is true only when the broker has actually confirmed removal', () => {
    // Everything counting completions -- tallies, batching, the re-check badge -- reads this.
    // Submitting must not count, or the reader is told they are finished when they are waiting.
    const map: ProgressMap = {
      a: confirmed('2026-01-01'),
      b: submitted('2026-01-01'),
      c: entry({ status: 'awaiting_verification' }),
      d: entry(),
    };
    expect(isDone(map, 'a')).toBe(true);
    expect(isDone(map, 'b')).toBe(false);
    expect(isDone(map, 'c')).toBe(false);
    expect(isDone(map, 'd')).toBe(false);
  });

  it('reports not-started for a broker with no record at all', () => {
    expect(statusOf({}, 'never-touched')).toBe('not_started');
    expect(isDone({}, 'never-touched')).toBe(false);
  });
});
