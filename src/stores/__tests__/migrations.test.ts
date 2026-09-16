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
    // 0 -> 1 was shape-preserving; 1 -> 2 enriches {done,doneAt} into a state machine, so a
    // v0 payload no longer round-trips unchanged -- it arrives with the new fields filled in.
    const raw = { 'spokeo-com': { done: true, doneAt: '2026-01-01' } };
    const migrated = migrateProgress(raw, 0);
    expect(migrated['spokeo-com']).toEqual({
      done: true,
      doneAt: '2026-01-01',
      status: 'confirmed',
      submittedAt: '2026-01-01',
      note: '',
    });
  });

  it('reads a done entry as confirmed, reusing its timestamp as the submission date', () => {
    // We never knew when the request was actually sent. Reusing the one timestamp we have
    // beats inventing a submission date we do not.
    const migrated = migrateProgress({ a: { done: true, doneAt: '2026-02-02' } }, 1);
    expect(migrated.a.status).toBe('confirmed');
    expect(migrated.a.submittedAt).toBe('2026-02-02');
  });

  it('reads a not-done entry as not_started, with no invented in-flight state', () => {
    // There was no way to record an in-flight request before v2, so there is nothing to
    // recover -- claiming one would be fabrication.
    const migrated = migrateProgress({ a: { done: false, doneAt: null } }, 1);
    expect(migrated.a.status).toBe('not_started');
    expect(migrated.a.submittedAt).toBeNull();
    expect(migrated.a.doneAt).toBeNull();
  });

  it('skips a malformed entry rather than failing the whole import', () => {
    const migrated = migrateProgress({ good: { done: true, doneAt: '2026-01-01' }, bad: null }, 1);
    expect(migrated.good.status).toBe('confirmed');
    expect(migrated.bad).toBeUndefined();
  });

  it('treats undefined/null legacy data as an empty progress map rather than throwing', () => {
    expect(migrateProgress(undefined, 0)).toEqual({});
    expect(migrateProgress(null, 0)).toEqual({});
  });

  it('passes through data already at the current schema version unchanged', () => {
    // Fixture is a real v2 record, so this documents the current shape rather than an
    // obsolete one. Passing a v1-shaped object here would still pass -- runMigrations does
    // nothing when from === target -- which is exactly why the fixture has to be honest.
    const raw = {
      a: {
        done: false,
        doneAt: null,
        status: 'submitted' as const,
        submittedAt: '2026-01-01',
        note: 'ref #12345',
      },
    };
    const migrated = migrateProgress(raw, PROGRESS_SCHEMA_VERSION);
    expect(migrated).toEqual(raw);
  });

  it('throws rather than silently substituting an empty progress map (which would look like "everything undone")', () => {
    expect(() => migrateProgress({}, PROGRESS_SCHEMA_VERSION + 5)).toThrow();
  });
});
