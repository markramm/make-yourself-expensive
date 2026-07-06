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
