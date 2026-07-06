/**
 * The user's on-device profile (name, email, address, phone, ...). Persisted to localStorage
 * only -- never transmitted anywhere. Deliberately namespaced away from the old
 * "Make Yourself Expensive" tool's `mye.v1` key: different app, different schema, and this
 * avoids any storage collision if a user has both tools open in the same browser.
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'protect.v1.profile';

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  isCaliforniaResident: boolean;
}

const EMPTY_PROFILE: Profile = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  isCaliforniaResident: false,
};

function loadFromStorage(): Profile {
  if (typeof localStorage === 'undefined') return { ...EMPTY_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROFILE };
    return { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

function createProfileStore() {
  const { subscribe, set, update } = writable<Profile>(loadFromStorage());

  subscribe((value) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
