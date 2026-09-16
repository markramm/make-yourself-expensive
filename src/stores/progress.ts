/**
 * Per-broker opt-out progress, keyed by broker id. Persisted to localStorage only.
 * Namespaced `protect.v1.progress` -- see stores/profile.ts for why this is a fresh key
 * rather than reusing the old app's `mye.v1`.
 *
 * WHY THIS IS NOT A BOOLEAN
 *
 * A real opt-out is a sequence, not an event: submit the request, click the verification
 * link they email you, wait, then confirm the listing is actually gone. A beta tester who
 * had done a manual purge put the problem precisely:
 *
 *   "Then there were the sites that would not tell you that they have accepted the opt out
 *    for several days. This makes it difficult to do each site serially (Be done with site A
 *    before starting on site B.. etc)"
 *
 * So the brokers themselves make serial work impossible. Anyone working at any scale has
 * dozens of requests outstanding at once, in different states. A binary done/not-done failed
 * that three ways: marking "done" at submission is a lie until the broker confirms; leaving
 * it unmarked loses the fact that a request was already sent (and re-sending can burn a
 * once-per-year-per-email allowance); and there was no way to see "sent three weeks ago,
 * still nothing", which is exactly the state that needs chasing.
 */
import { writable, derived, type Readable } from 'svelte/store';
import { loadVersioned, saveVersioned, runMigrations, type Migration } from './versionedStorage';

const STORAGE_KEY = 'protect.v1.progress';

// Bump when ProgressMap/BrokerProgress's shape changes, and add a migration below FROM the
// old version -- also the version stamped into export files, so an older export can be
// upgraded the same way an old localStorage read is.
export const PROGRESS_SCHEMA_VERSION = 2;

/**
 * Where a broker stands. Ordered by how far through the process it is, which is also the
 * order the UI advances them in.
 *
 * `not_started` is never stored -- an absent entry means the same thing, and writing a row
 * for every untouched broker would bloat localStorage with 493 no-op entries.
 */
export type OptOutStatus = 'not_started' | 'submitted' | 'awaiting_verification' | 'confirmed';

export interface BrokerProgress {
  /**
   * Derived, NOT independent state: true exactly when status is 'confirmed'.
   *
   * Kept on the record rather than computed at each call site so that everything already
   * reading `p.done` -- mergeDoneMaps(), the export-file validator, the tallies in
   * BrokerList/GuidedBatch/ProgressSummary, isRecheckDue() -- keeps working unchanged
   * against a richer record. setStatus() is the only writer, so the two cannot drift.
   */
  done: boolean;
  /** ISO timestamp of the CONFIRMED transition, or null. Named for backward compatibility. */
  doneAt: string | null;
  status: OptOutStatus;
  /** ISO timestamp the request was first submitted -- what "sent 3 weeks ago" is measured from. */
  submittedAt: string | null;
  /** Free text: confirmation numbers, reference IDs, "they asked for ID", whatever the reader needs. */
  note: string;
}

export type ProgressMap = Record<string, BrokerProgress>;

export const EMPTY_PROGRESS: BrokerProgress = {
  done: false,
  doneAt: null,
  status: 'not_started',
  submittedAt: null,
  note: '',
};

/** The states a reader can be waiting in -- submitted but not yet confirmed gone. */
export function isInFlight(entry: BrokerProgress | undefined): boolean {
  return entry?.status === 'submitted' || entry?.status === 'awaiting_verification';
}

// schema_version 0 -> 1: no shape change, just adopting the versioned-storage wrapper.
// Pre-versioning localStorage data (a bare ProgressMap, no wrapper) reads as version 0.
//
// schema_version 1 -> 2: {done, doneAt} gains status/submittedAt/note. An existing done:true
// entry becomes 'confirmed' and keeps its doneAt as both the confirmation and the submission
// time -- we never knew when it was actually sent, and claiming a submission date we do not
// have would be worse than reusing the one timestamp we do. A done:false entry becomes
// 'not_started'; there was no way to record an in-flight request before this version, so
// there is nothing to recover.
const PROGRESS_MIGRATIONS: Migration<ProgressMap>[] = [
  { from: 0, migrate: (data) => (data as ProgressMap) ?? {} },
  {
    from: 1,
    migrate: (data) => {
      const old = (data ?? {}) as Record<string, { done?: boolean; doneAt?: string | null }>;
      const next: ProgressMap = {};
      for (const [id, entry] of Object.entries(old)) {
        if (entry === null || typeof entry !== 'object') continue;
        const wasDone = entry.done === true;
        const at = typeof entry.doneAt === 'string' ? entry.doneAt : null;
        next[id] = {
          done: wasDone,
          doneAt: wasDone ? at : null,
          status: wasDone ? 'confirmed' : 'not_started',
          submittedAt: wasDone ? at : null,
          note: '',
        };
      }
      return next;
    },
  },
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

function withStatus(prev: BrokerProgress | undefined, status: OptOutStatus, now: string): BrokerProgress {
  const base = prev ?? EMPTY_PROGRESS;
  const confirmed = status === 'confirmed';
  return {
    ...base,
    status,
    done: confirmed,
    // Keep the original confirmation timestamp if it is already confirmed, so re-saving a
    // note does not silently restart the re-check clock in badgeContract.isRecheckDue().
    doneAt: confirmed ? (base.doneAt ?? now) : null,
    // First submission wins: "sent 3 weeks ago" must not reset when they advance to
    // awaiting_verification. Reverting to not_started clears it.
    submittedAt: status === 'not_started' ? null : (base.submittedAt ?? now),
  };
}

function createProgressStore() {
  const { subscribe, update, set } = writable<ProgressMap>(loadFromStorage());

  subscribe((value) => {
    saveVersioned(STORAGE_KEY, PROGRESS_SCHEMA_VERSION, value);
  });

  return {
    subscribe,
    set,
    /** Moves a broker to an explicit state. The only writer of `done`/`doneAt`. */
    setStatus: (brokerId: string, status: OptOutStatus, now: Date = new Date()) => {
      update((map) => ({ ...map, [brokerId]: withStatus(map[brokerId], status, now.toISOString()) }));
    },
    /**
     * The checkbox: jumps straight to confirmed, or back to not_started. Kept because most
     * readers will never touch the intermediate states, and demanding a four-step workflow
     * from someone who just wants to tick a box would be worse than the binary it replaced.
     */
    toggle: (brokerId: string, now: Date = new Date()) => {
      update((map) => {
        const next: OptOutStatus = map[brokerId]?.status === 'confirmed' ? 'not_started' : 'confirmed';
        return { ...map, [brokerId]: withStatus(map[brokerId], next, now.toISOString()) };
      });
    },
    setNote: (brokerId: string, note: string) => {
      update((map) => ({ ...map, [brokerId]: { ...(map[brokerId] ?? EMPTY_PROGRESS), note } }));
    },
    replaceAll: (next: ProgressMap) => set(next),
    /** Combines in an imported ProgressMap without ever moving a broker backwards. */
    merge: (incoming: ProgressMap) => update((current) => mergeProgress(current, incoming)),
    reset: () => set({}),
  };
}

export const progressStore = createProgressStore();

export function isDone(progress: ProgressMap, brokerId: string): boolean {
  return progress[brokerId]?.done ?? false;
}

export function statusOf(progress: ProgressMap, brokerId: string): OptOutStatus {
  return progress[brokerId]?.status ?? 'not_started';
}

/** How far along a state is, for merges: a later state always wins. */
const STATUS_RANK: Record<OptOutStatus, number> = {
  not_started: 0,
  submitted: 1,
  awaiting_verification: 2,
  confirmed: 3,
};

/**
 * Combines two progress maps, keeping whichever entry is FURTHER ALONG. Never moves a broker
 * backwards -- someone who confirmed a removal here must not have it reset to "submitted" by
 * an older backup. Notes are preserved from whichever side has one, preferring the local
 * note, since losing a confirmation number to a merge would be its own small disaster.
 *
 * This replaces the shared mergeDoneMaps() for progress specifically: that helper only
 * understands a boolean, so it cannot tell 'submitted' from 'not_started'. hardenProgress
 * still uses it, since a hardening item genuinely is binary.
 */
export function mergeProgress(current: ProgressMap, incoming: ProgressMap): ProgressMap {
  const merged: ProgressMap = { ...current };
  for (const [id, entry] of Object.entries(incoming)) {
    if (entry === null || typeof entry !== 'object') continue;
    const mine = merged[id];
    if (!mine) {
      merged[id] = entry;
      continue;
    }
    const ahead = STATUS_RANK[entry.status] > STATUS_RANK[mine.status];
    const winner = ahead ? entry : mine;
    merged[id] = {
      ...winner,
      note: mine.note || entry.note || '',
      // Keep the EARLIEST submission: it is the age of the outstanding request.
      submittedAt: earliest(mine.submittedAt, entry.submittedAt),
    };
  }
  return merged;
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Derived tally: { done, total } over a given list of broker ids. */
export function tallyFor(progress: Readable<ProgressMap>, brokerIds: string[]) {
  return derived(progress, ($progress) => {
    const done = brokerIds.filter((id) => isDone($progress, id)).length;
    return { done, total: brokerIds.length };
  });
}
