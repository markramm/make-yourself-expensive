/**
 * Per-broker opt-out progress, keyed by broker id. Persisted to localStorage only.
 * Namespaced `protect.v1.progress` -- see stores/profile.ts for why this is a fresh key
 * rather than reusing the old app's `mye.v1`.
 */
import { writable, derived, type Readable } from 'svelte/store';
import { loadVersioned, saveVersioned, runMigrations, type Migration } from './versionedStorage';

const STORAGE_KEY = 'protect.v1.progress';

// Bump when ProgressMap/BrokerProgress's shape changes, and add a migration below FROM the
// old version -- also the version stamped into export files, so an older export can be
// upgraded the same way an old localStorage read is.
export const PROGRESS_SCHEMA_VERSION = 1;

export interface BrokerProgress {
  done: boolean;
  doneAt: string | null; // ISO date, set when done transitions to true
}

export type ProgressMap = Record<string, BrokerProgress>;

// schema_version 0 -> 1: no shape change yet, just adopting the versioned-storage wrapper.
// Pre-versioning localStorage data (a bare ProgressMap, no wrapper) reads as version 0.
const PROGRESS_MIGRATIONS: Migration<ProgressMap>[] = [
  { from: 0, migrate: (data) => (data as ProgressMap) ?? {} },
];

function loadFromStorage(): ProgressMap {
  return loadVersioned(STORAGE_KEY, PROGRESS_SCHEMA_VERSION, {}, PROGRESS_MIGRATIONS);
}

/**
 * Migrates a ProgressMap-shaped payload from an imported file (see
 * components/DeviceTransfer.svelte) up to the current schema. `fromVersion` is the export's
 * stated schema_versions.progress, or 0 if the export predates that field. Throws if no
 * migration path exists, since an import failure should surface to the user rather than
 * silently substitute an empty progress map (which would look like "everything undone").
 */
export function migrateProgress(data: unknown, fromVersion: number): ProgressMap {
  const migrated = runMigrations<ProgressMap>(data, fromVersion, PROGRESS_SCHEMA_VERSION, PROGRESS_MIGRATIONS);
  if (migrated === null) {
    throw new Error(
      `this backup's progress data (schema version ${fromVersion}) can't be read by this version of the app`,
    );
  }
  return migrated;
}

function createProgressStore() {
  const { subscribe, update, set } = writable<ProgressMap>(loadFromStorage());

  subscribe((value) => {
    saveVersioned(STORAGE_KEY, PROGRESS_SCHEMA_VERSION, value);
  });

  return {
    subscribe,
    set,
    toggle: (brokerId: string) => {
      update((map) => {
        const wasDone = map[brokerId]?.done ?? false;
        return {
          ...map,
          [brokerId]: {
            done: !wasDone,
            doneAt: !wasDone ? new Date().toISOString() : null,
          },
        };
      });
    },
    replaceAll: (next: ProgressMap) => set(next),
    /** Combines in an imported ProgressMap without ever un-marking something already done here. */
    merge: (incoming: ProgressMap) => update((current) => mergeProgress(current, incoming)),
    reset: () => set({}),
  };
}

export const progressStore = createProgressStore();

export function isDone(progress: ProgressMap, brokerId: string): boolean {
  return progress[brokerId]?.done ?? false;
}

/**
 * Combines two progress maps: a broker counts as done if it's done in EITHER map. Never
 * un-marks something the reader already did on this device, even if the incoming map has it
 * marked not-done (e.g. an older backup from before they finished it here).
 */
export function mergeProgress(current: ProgressMap, incoming: ProgressMap): ProgressMap {
  const merged: ProgressMap = { ...current };
  for (const [id, entry] of Object.entries(incoming)) {
    if (!merged[id] || (entry.done && !merged[id].done)) {
      merged[id] = entry;
    }
  }
  return merged;
}

/** Derived tally: { done, total } over a given list of broker ids. */
export function tallyFor(progress: Readable<ProgressMap>, brokerIds: string[]) {
  return derived(progress, ($progress) => {
    const done = brokerIds.filter((id) => isDone($progress, id)).length;
    return { done, total: brokerIds.length };
  });
}
