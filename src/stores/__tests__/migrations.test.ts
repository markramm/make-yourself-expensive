import { describe, it, expect } from 'vitest';
import { migrateProfile, PROFILE_SCHEMA_VERSION } from '../profile';
import { migrateProgress, PROGRESS_SCHEMA_VERSION } from '../progress';

describe('migrateProfile (import-time migration)', () => {
  it('migrates a version-0 (pre-versioning) export up to the current schema', () => {
    const raw = { fullName: 'Jane Doe', email: 'jane@example.com' };
    const migrated = migrateProfile(raw, 0);
    expect(migrated.fullName).toBe('Jane Doe');
    expect(migrated.email).toBe('jane@example.com');
    // fields absent from the old export get filled with EMPTY_PROFILE defaults
    expect(migrated.phone).toBe('');
    expect(migrated.state).toBe('');
  });

  it('migrates a version-1 export (free-text state, isCaliforniaResident) up to version 2', () => {
    // Regression coverage for the schema change that dropped isCaliforniaResident (it only
    // ever gated a UI banner and duplicated `state`, which now drives legal-template
    // selection -- see lib/templates/ccpaRequest.ts) and switched `state` from free text to
    // a two-letter code.
    const raw = {
      fullName: 'Jane',
      email: 'jane@example.com',
      phone: '',
      address: '',
      city: '',
      state: 'California',
      zip: '',
      isCaliforniaResident: true,
    };
    const migrated = migrateProfile(raw, 1);
    expect(migrated.state).toBe('CA');
    expect(migrated.fullName).toBe('Jane');
    expect('isCaliforniaResident' in migrated).toBe(false);
  });

  it('migrates a version-1 export with an unrecognized state to the empty (unset) code, not a guess', () => {
    const raw = {
      fullName: 'Jane',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: 'Somewhere Else',
      zip: '',
      isCaliforniaResident: false,
    };
    const migrated = migrateProfile(raw, 1);
    expect(migrated.state).toBe('');
  });

  it('passes through data already at the current schema version unchanged', () => {
    const raw = {
      fullName: 'Jane',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: 'NY',
      zip: '',
    };
    const migrated = migrateProfile(raw, PROFILE_SCHEMA_VERSION);
    expect(migrated).toEqual(raw);
  });

  it('throws rather than silently substituting an empty profile when no migration path exists', () => {
    // simulates an export from a hypothetical FUTURE version this build predates
    expect(() => migrateProfile({}, PROFILE_SCHEMA_VERSION + 5)).toThrow();
  });
});

describe('migrateProgress (import-time migration)', () => {
  it('migrates a version-0 (pre-versioning) export up to the current schema', () => {
    const raw = { 'spokeo-com': { done: true, doneAt: '2026-01-01' } };
    const migrated = migrateProgress(raw, 0);
    expect(migrated).toEqual(raw);
  });

  it('treats undefined/null legacy data as an empty progress map rather than throwing', () => {
    expect(migrateProgress(undefined, 0)).toEqual({});
    expect(migrateProgress(null, 0)).toEqual({});
  });

  it('passes through data already at the current schema version unchanged', () => {
    const raw = { a: { done: true, doneAt: '2026-01-01' } };
    const migrated = migrateProgress(raw, PROGRESS_SCHEMA_VERSION);
    expect(migrated).toEqual(raw);
  });

  it('throws rather than silently substituting an empty progress map (which would look like "everything undone")', () => {
    expect(() => migrateProgress({}, PROGRESS_SCHEMA_VERSION + 5)).toThrow();
  });
});
