import { describe, it, expect, beforeEach } from 'vitest';
import { loadVersioned, saveVersioned } from '../versionedStorage';

// vitest's default environment doesn't include localStorage -- polyfill a minimal one for
// this test file only, since versionedStorage.ts is designed to no-op gracefully when it's
// undefined (SSR-safety) but we want to exercise the real read/write path here.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('saveVersioned / loadVersioned round-trip', () => {
  it('round-trips data unchanged when no migration is needed', () => {
    saveVersioned('test-key', 1, { name: 'Jane' });
    expect(loadVersioned('test-key', 1, { name: '' })).toEqual({ name: 'Jane' });
  });

  it('returns the fallback when the key does not exist', () => {
    expect(loadVersioned('missing-key', 1, { name: 'fallback' })).toEqual({ name: 'fallback' });
  });

  it('returns the fallback on corrupt JSON rather than throwing', () => {
    localStorage.setItem('bad-key', '{not valid json');
    expect(loadVersioned('bad-key', 1, { name: 'fallback' })).toEqual({ name: 'fallback' });
  });
});

describe('migrations', () => {
  it('treats pre-versioning bare data (no schema_version wrapper) as version 0', () => {
    // simulates data written before versionedStorage.ts existed
    localStorage.setItem('legacy-key', JSON.stringify({ name: 'Old Jane' }));
    const result = loadVersioned(
      'legacy-key',
      1,
      { name: '', greeting: '' },
      [{ from: 0, migrate: (d: any) => ({ name: d.name, greeting: 'hello' }) }],
    );
    expect(result).toEqual({ name: 'Old Jane', greeting: 'hello' });
  });

  it('chains multiple migrations to reach the current version', () => {
    saveVersioned('multi-key', 0, { a: 1 });
    const result = loadVersioned(
      'multi-key',
      2,
      { a: 0, b: 0, c: 0 },
      [
        { from: 0, migrate: (d: any) => ({ a: d.a, b: d.a * 2 }) },
        { from: 1, migrate: (d: any) => ({ ...d, c: d.b + 1 }) },
      ],
    );
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('falls back to the default if a build is newer than the persisted schema_version supports going backward', () => {
    // data was written by a FUTURE version of the app (schema_version 5) -- this build only
    // knows up to version 2, so it shouldn't guess how to downgrade it.
    saveVersioned('future-key', 5, { fancy: 'new field' });
    const result = loadVersioned('future-key', 2, { basic: 'fallback' });
    expect(result).toEqual({ basic: 'fallback' });
  });

  it('falls back to the default if no migration path exists from the persisted version', () => {
    saveVersioned('gap-key', 0, { a: 1 });
    // no migration registered for "from: 0" -- can't reach version 1
    const result = loadVersioned('gap-key', 1, { fallback: true }, []);
    expect(result).toEqual({ fallback: true });
  });

  it('persists the current schema_version on save, so a subsequent load needs no migration', () => {
    saveVersioned('stamped-key', 3, { x: 1 });
    const raw = JSON.parse(localStorage.getItem('stamped-key')!);
    expect(raw.schema_version).toBe(3);
    expect(raw.data).toEqual({ x: 1 });
  });
});
