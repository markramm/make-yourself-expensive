/**
 * Per-item hardening-checklist progress, keyed by the HardenItem ids in
 * lib/harden/checklists.ts (e.g. "iphone:advanced-data-protection"). Separate namespace from
 * the broker progressStore -- these track a different kind of "done" (a device setting
 * changed once, not an ongoing opt-out) and someone may reasonably want to reset one without
 * touching the other.
 */
import { writable } from 'svelte/store';
import { loadVersioned, saveVersioned, runMigrations, mergeDoneMaps, type Migration } from './versionedStorage';

const STORAGE_KEY = 'protect.v1.hardenProgress';

export const HARDEN_PROGRESS_SCHEMA_VERSION = 1;

export interface HardenItemProgress {
  done: boolean;
  doneAt: string | null;
}

export type HardenProgressMap = Record<string, HardenItemProgress>;

const HARDEN_PROGRESS_MIGRATIONS: Migration<HardenProgressMap>[] = [
  { from: 0, migrate: (data) => (data as HardenProgressMap) ?? {} },
];

function loadFromStorage(): HardenProgressMap {
  return loadVersioned(STORAGE_KEY, HARDEN_PROGRESS_SCHEMA_VERSION, {}, HARDEN_PROGRESS_MIGRATIONS);
}

function createHardenProgressStore() {
  const { subscribe, update, set } = writable<HardenProgressMap>(loadFromStorage());

  subscribe((value) => {
    saveVersioned(STORAGE_KEY, HARDEN_PROGRESS_SCHEMA_VERSION, value);
  });

  return {
    subscribe,
    set,
    toggle: (itemId: string) => {
      update((map) => {
        const wasDone = map[itemId]?.done ?? false;
        return {
          ...map,
          [itemId]: { done: !wasDone, doneAt: !wasDone ? new Date().toISOString() : null },
        };
      });
    },
    replaceAll: (next: HardenProgressMap) => set(next),
    /** Combines in an imported HardenProgressMap without ever un-marking something already done here. */
    merge: (incoming: HardenProgressMap) => update((current) => mergeDoneMaps(current, incoming)),
    reset: () => set({}),
  };
}

export const hardenProgressStore = createHardenProgressStore();

export function isHardenItemDone(progress: HardenProgressMap, itemId: string): boolean {
  return progress[itemId]?.done ?? false;
}

export function migrateHardenProgress(data: unknown, fromVersion: number): HardenProgressMap {
  const migrated = runMigrations<HardenProgressMap>(
    data,
    fromVersion,
    HARDEN_PROGRESS_SCHEMA_VERSION,
    HARDEN_PROGRESS_MIGRATIONS,
  );
  if (migrated === null) {
    throw new Error(
      `this backup's hardening checklist data (schema version ${fromVersion}) can't be read by this version of the app`,
    );
  }
  return migrated;
}
