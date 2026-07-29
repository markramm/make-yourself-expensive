import { describe, it, expect } from 'vitest';
import { migrateHardenProgress, isHardenItemDone, HARDEN_PROGRESS_SCHEMA_VERSION } from '../hardenProgress';
import { mergeDoneMaps, type DoneMap } from '../versionedStorage';

describe('migrateHardenProgress (import-time migration)', () => {
  it('migrates a version-0 (pre-versioning) export up to the current schema', () => {
    const raw = { 'iphone:advanced-data-protection': { done: true, doneAt: '2026-01-01' } };
    const migrated = migrateHardenProgress(raw, 0);
    expect(migrated).toEqual(raw);
  });

  it('treats undefined/null legacy data as an empty map rather than throwing', () => {
    expect(migrateHardenProgress(undefined, 0)).toEqual({});
    expect(migrateHardenProgress(null, 0)).toEqual({});
  });

  it('throws rather than silently substituting an empty map for a future schema version', () => {
    expect(() => migrateHardenProgress({}, HARDEN_PROGRESS_SCHEMA_VERSION + 5)).toThrow();
  });
});

describe('mergeDoneMaps (shared by progressStore.merge and hardenProgressStore.merge)', () => {
  it('takes the union of two disjoint maps', () => {
    const current: DoneMap = { a: { done: true, doneAt: '2026-01-01' } };
    const incoming: DoneMap = { b: { done: true, doneAt: '2026-01-02' } };
    const merged = mergeDoneMaps(current, incoming);
    expect(isHardenItemDone(merged, 'a')).toBe(true);
    expect(isHardenItemDone(merged, 'b')).toBe(true);
  });

  it('never un-marks something already done, even if incoming says not-done', () => {
    const current: DoneMap = { a: { done: true, doneAt: '2026-01-05' } };
    const incoming: DoneMap = { a: { done: false, doneAt: null } };
    const merged = mergeDoneMaps(current, incoming);
    expect(isHardenItemDone(merged, 'a')).toBe(true);
  });

  it('adopts an incoming done=true even if current has it not-done', () => {
    const current: DoneMap = { a: { done: false, doneAt: null } };
    const incoming: DoneMap = { a: { done: true, doneAt: '2026-01-03' } };
    const merged = mergeDoneMaps(current, incoming);
    expect(isHardenItemDone(merged, 'a')).toBe(true);
  });
});
