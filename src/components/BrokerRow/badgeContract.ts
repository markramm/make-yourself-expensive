/**
 * Pure, DOM-free render-contract logic for RowShell.svelte's badges. Factored out so CI can
 * assert this contract directly (a synthetic entry in, expected badge decision out) without
 * a headless-browser snapshot test -- see the trust/licensing plan's "unverified badge
 * enforcement" section for why this exists as its own testable function.
 */
import type { Broker } from '../../lib/dataset/fetchAndVerify';

export interface BadgeDecision {
  showUnverifiedBadge: boolean;
  priorityBadgeClass: string;
}

export function badgeDecisionFor(broker: Pick<Broker, 'last_verified' | 'priority'>): BadgeDecision {
  return {
    // The one non-negotiable contract: last_verified === null MUST show the unverified badge.
    // A CI check can construct a synthetic broker with last_verified: null and assert this is
    // true, catching a future edit that accidentally drops the branch in RowShell.svelte.
    showUnverifiedBadge: broker.last_verified === null,
    priorityBadgeClass: `priority-${broker.priority}`,
  };
}

/**
 * People-search sites in particular re-scrape and re-add listings within months -- readd_days
 * captures how long a broker's opt-out reliably sticks. Without this, `done` means "done
 * forever," which quietly undermines the whole exercise: a listing can silently reappear and
 * the checked-off row gives no signal it needs another look.
 *
 * `done` stays true regardless -- this never un-marks the checkbox, it only flags that the
 * completed action may be stale. Returns false (never due) when the data can't support the
 * calculation: not done yet, no completion timestamp, or the broker has no known readd cadence.
 */
export function isRecheckDue(
  broker: Pick<Broker, 'readd_days'>,
  progress: { done: boolean; doneAt: string | null },
  now: Date = new Date(),
): boolean {
  if (!progress.done || !progress.doneAt || broker.readd_days === null) return false;
  const doneAt = new Date(progress.doneAt);
  if (Number.isNaN(doneAt.getTime())) return false;
  const dueAt = new Date(doneAt.getTime() + broker.readd_days * 24 * 60 * 60 * 1000);
  return now >= dueAt;
}
