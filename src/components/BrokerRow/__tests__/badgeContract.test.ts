import { describe, it, expect } from 'vitest';
import { badgeDecisionFor } from '../badgeContract';

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
