import { describe, it, expect } from 'vitest';
import { mergeProgress, isDone, type ProgressMap } from '../progress';

describe('mergeProgress', () => {
  it('takes the union of two disjoint progress maps', () => {
    const current: ProgressMap = { a: { done: true, doneAt: '2026-01-01' } };
    const incoming: ProgressMap = { b: { done: true, doneAt: '2026-01-02' } };
    const merged = mergeProgress(current, incoming);
    expect(isDone(merged, 'a')).toBe(true);
    expect(isDone(merged, 'b')).toBe(true);
  });

  it('never un-marks something already done here, even if the incoming map says not-done', () => {
    // e.g. importing an OLDER backup from before the reader finished this broker on this device
    const current: ProgressMap = { a: { done: true, doneAt: '2026-01-05' } };
    const incoming: ProgressMap = { a: { done: false, doneAt: null } };
    const merged = mergeProgress(current, incoming);
    expect(isDone(merged, 'a')).toBe(true);
  });

  it('adopts an incoming done=true even if the current state has it not-done', () => {
    // the reader did this one on the OTHER device -- merging should pick that up
    const current: ProgressMap = { a: { done: false, doneAt: null } };
    const incoming: ProgressMap = { a: { done: true, doneAt: '2026-01-03' } };
    const merged = mergeProgress(current, incoming);
    expect(isDone(merged, 'a')).toBe(true);
  });

  it('leaves current entries with no counterpart in incoming untouched', () => {
    const current: ProgressMap = { a: { done: true, doneAt: '2026-01-01' }, b: { done: false, doneAt: null } };
    const merged = mergeProgress(current, {});
    expect(merged).toEqual(current);
  });

  it('is a pure function -- does not mutate either input', () => {
    const current: ProgressMap = { a: { done: true, doneAt: '2026-01-01' } };
    const incoming: ProgressMap = { b: { done: true, doneAt: '2026-01-02' } };
    const currentCopy = JSON.parse(JSON.stringify(current));
    const incomingCopy = JSON.parse(JSON.stringify(incoming));
    mergeProgress(current, incoming);
    expect(current).toEqual(currentCopy);
    expect(incoming).toEqual(incomingCopy);
  });
});
