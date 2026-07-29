/**
 * Persists the IN-PROGRESS batch's item ids across reloads, separate from progressStore's
 * permanent done/not-done state. Without this, someone interrupted mid-batch (the exact
 * "busy, got pulled away" scenario the guided flow is designed for) would come back to find
 * their batch silently reshuffled -- their checked-off item stays done, but the batch they
 * were partway through is gone and a fresh one takes its place.
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'protect.v1.currentBatch';

function loadFromStorage(): string[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function createCurrentBatchStore() {
  const { subscribe, set } = writable<string[] | null>(loadFromStorage());

  subscribe((value) => {
    if (typeof localStorage === 'undefined') return;
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  });

  return { subscribe, set, clear: () => set(null) };
}

export const currentBatchIds = createCurrentBatchStore();
