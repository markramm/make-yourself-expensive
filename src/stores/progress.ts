/**
 * Per-broker opt-out progress, keyed by broker id. Persisted to localStorage only.
 * Namespaced `protect.v1.progress` -- see stores/profile.ts for why this is a fresh key
 * rather than reusing the old app's `mye.v1`.
 */
import { writable, derived, type Readable } from 'svelte/store';

const STORAGE_KEY = 'protect.v1.progress';

export interface BrokerProgress {
  done: boolean;
  doneAt: string | null; // ISO date, set when done transitions to true
}

export type ProgressMap = Record<string, BrokerProgress>;

function loadFromStorage(): ProgressMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function createProgressStore() {
  const { subscribe, update, set } = writable<ProgressMap>(loadFromStorage());

  subscribe((value) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
    reset: () => set({}),
  };
}

export const progressStore = createProgressStore();

export function isDone(progress: ProgressMap, brokerId: string): boolean {
  return progress[brokerId]?.done ?? false;
}

/** Derived tally: { done, total } over a given list of broker ids. */
export function tallyFor(progress: Readable<ProgressMap>, brokerIds: string[]) {
  return derived(progress, ($progress) => {
    const done = brokerIds.filter((id) => isDone($progress, id)).length;
    return { done, total: brokerIds.length };
  });
}
