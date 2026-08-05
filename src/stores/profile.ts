/**
 * The user's on-device profile (name, email, address, phone, ...). Persisted to localStorage
 * only -- never transmitted anywhere. Deliberately namespaced away from the old
 * "Make Yourself Expensive" tool's `mye.v1` key: different app, different schema, and this
 * avoids any storage collision if a user has both tools open in the same browser.
 */
import { writable } from 'svelte/store';
import { loadVersioned, saveVersioned, runMigrations, type Migration } from './versionedStorage';
import { coerceStateToCode } from '../lib/usStates';

const STORAGE_KEY = 'protect.v1.profile';

// Bump when Profile's shape changes, and add a migration below FROM the old version. This
// is also the version stamped into export files (see lib/crypto/exportImport.ts), so an
// import from an older export can be upgraded the same way an old localStorage read is.
export const PROFILE_SCHEMA_VERSION = 2;

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  /** Two-letter USPS code (e.g. "CA"), or '' if unset/unrecognized -- see lib/usStates.ts. */
  state: string;
  zip: string;
}

const EMPTY_PROFILE: Profile = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
};

// schema_version 0 -> 1: no shape change yet, just adopting the versioned-storage wrapper.
// Pre-versioning localStorage data (a bare Profile object, no wrapper) reads as version 0.
//
// schema_version 1 -> 2: dropped isCaliforniaResident (it only ever gated a UI banner, and
// duplicated `state`, which is what actually needs to be authoritative now that it also
// drives legal-template selection in lib/templates/ccpaRequest.ts -- see that file). `state`
// changes from free text ("California", "ca", "CA", ...) to a two-letter code; coerceStateToCode
// best-effort-maps old free text, falling back to '' (unset) on anything ambiguous rather than
// guessing wrong and silently mis-selecting a legal template.
const PROFILE_MIGRATIONS: Migration<Profile>[] = [
  { from: 0, migrate: (data) => ({ ...EMPTY_PROFILE, ...(data as Partial<Profile>) }) },
  {
    from: 1,
    migrate: (data) => {
      const { isCaliforniaResident, ...rest } = data as Partial<Profile> & { isCaliforniaResident?: boolean };
      const merged = { ...EMPTY_PROFILE, ...rest };
      return { ...merged, state: coerceStateToCode(merged.state) };
    },
  },
];

function loadFromStorage(): Profile {
  return loadVersioned(STORAGE_KEY, PROFILE_SCHEMA_VERSION, { ...EMPTY_PROFILE }, PROFILE_MIGRATIONS);
}

/**
 * Migrates a Profile-shaped payload from an imported file (see components/DeviceTransfer.svelte)
 * up to the current schema. `fromVersion` is the export's stated schema_versions.profile, or
 * 0 if the export predates that field. Throws if no migration path exists, since an import
 * failure should surface to the user rather than silently substitute an empty profile.
 */
export function migrateProfile(data: unknown, fromVersion: number): Profile {
  const migrated = runMigrations<Profile>(data, fromVersion, PROFILE_SCHEMA_VERSION, PROFILE_MIGRATIONS);
  if (migrated === null) {
    throw new Error(
      `this backup's profile data (schema version ${fromVersion}) can't be read by this version of the app`,
    );
  }
  return migrated;
}

function createProfileStore() {
  const { subscribe, set, update } = writable<Profile>(loadFromStorage());

  subscribe((value) => {
    saveVersioned(STORAGE_KEY, PROFILE_SCHEMA_VERSION, value);
  });

  return {
    subscribe,
    set,
    update,
    reset: () => set({ ...EMPTY_PROFILE }),
    replaceAll: (next: Profile) => set({ ...EMPTY_PROFILE, ...next }),
  };
}

export const profileStore = createProfileStore();
