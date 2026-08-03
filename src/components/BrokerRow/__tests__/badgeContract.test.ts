import { describe, it, expect } from 'vitest';
import { badgeDecisionFor, isRecheckDue } from '../badgeContract';

// This is the render-contract check from the trust/licensing plan: a synthetic entry with
// last_verified: null MUST produce showUnverifiedBadge: true. If a future edit to RowShell
// accidentally drops this branch, this test (and the equivalent CI check in the dataset repo
// once wired up) is what catches it before ship.
describe('badgeDecisionFor: unverified-badge enforcement contract', () => {
  it('shows the unverified badge when last_verified is null', () => {
    const decision = badgeDecisionFor({ last_verified: null, priority: 'crucial' });
    expect(decision.showUnverifiedBadge).toBe(true);
  });

  it('does not show the unverified badge when last_verified is a real date', () => {
    const decision = badgeDecisionFor({ last_verified: '2026-07-03', priority: 'crucial' });
    expect(decision.showUnverifiedBadge).toBe(false);
  });

  it('derives the priority badge class from the priority field', () => {
    expect(badgeDecisionFor({ last_verified: '2026-01-01', priority: 'crucial' }).priorityBadgeClass).toBe(
      'priority-crucial',
    );
    expect(badgeDecisionFor({ last_verified: '2026-01-01', priority: 'standard' }).priorityBadgeClass).toBe(
      'priority-standard',
    );
  });
});

describe('isRecheckDue: people-search listings can silently come back', () => {
  const now = new Date('2026-07-03T00:00:00Z');

  it('is never due for a broker not marked done', () => {
    expect(isRecheckDue({ readd_days: 30 }, { done: false, doneAt: null }, now)).toBe(false);
  });

  it('is never due when readd_days is null (no known re-add cadence)', () => {
    const doneAt = new Date(now.getTime() - 1000 * 24 * 60 * 60 * 1000).toISOString(); // 1000 days ago
    expect(isRecheckDue({ readd_days: null }, { done: true, doneAt }, now)).toBe(false);
  });

  it('is never due when doneAt is missing even though done is true (defensive -- should not happen in practice)', () => {
    expect(isRecheckDue({ readd_days: 30 }, { done: true, doneAt: null }, now)).toBe(false);
  });

  it('is not due before readd_days have elapsed', () => {
    const doneAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    expect(isRecheckDue({ readd_days: 30 }, { done: true, doneAt }, now)).toBe(false);
  });

  it('is due once readd_days have fully elapsed', () => {
    const doneAt = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago
    expect(isRecheckDue({ readd_days: 30 }, { done: true, doneAt }, now)).toBe(true);
  });

  it('is due exactly at the readd_days boundary', () => {
    const doneAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // exactly 30 days ago
    expect(isRecheckDue({ readd_days: 30 }, { done: true, doneAt }, now)).toBe(true);
  });

  it('never un-marks done -- it only signals staleness, done stays true regardless', () => {
    // isRecheckDue itself has no way to un-mark anything (it returns a boolean, not a mutation),
    // but this test documents the contract: callers must keep rendering the row as done even
    // when recheck is due, per RowShell.svelte's `class:done` staying bound to progress.done.
    const doneAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const progress = { done: true, doneAt };
    isRecheckDue({ readd_days: 30 }, progress, now);
    expect(progress.done).toBe(true);
  });
});
