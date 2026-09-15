import { describe, it, expect } from 'vitest';
import { badgeDecisionFor, isRecheckDue } from '../badgeContract';

describe('badgeDecisionFor: unconfirmed-routing contract', () => {
  // The dataset marks a field it could not confirm with `<verify: ...>` rather than guessing
  // (registry CONTRIBUTING.md). 40 of 493 entries carry one on opt_out_url, and without this
  // branch they compile to link_status 'unknown' and render no badge at all -- so a reader
  // sees nothing distinguishing "nobody knows where this opt-out lives" from a normal row.
  it('badges a broker whose opt_out_url is a <verify:> placeholder', () => {
    const decision = badgeDecisionFor({
      last_verified: null,
      priority: 'crucial',
      link_status: 'unknown',
      opt_out_url: '<verify: parked domain, needs a confirmed consumer-rights URL>',
    });
    expect(decision.linkWarning).toBe('routing unconfirmed');
    expect(decision.linkWarningTitle).toContain('may route you somewhere that cannot process');
  });

  it('still badges nothing for an ordinary unknown link with a real URL', () => {
    // The 128 merely-unchecked rows must stay unbadged; that is what keeps this signal rare
    // enough to mean something.
    const decision = badgeDecisionFor({
      last_verified: null,
      priority: 'high',
      link_status: 'unknown',
      opt_out_url: 'https://example.test/opt-out',
    });
    expect(decision.linkWarning).toBeNull();
  });

  it('lets an unconfirmed route outrank a link-state warning', () => {
    // No point saying "this URL redirects" when we are not sure it is the right URL at all.
    const decision = badgeDecisionFor({
      last_verified: null,
      priority: 'crucial',
      link_status: 'redirect',
      opt_out_url: '<verify: unconfirmed>',
    });
    expect(decision.linkWarning).toBe('routing unconfirmed');
  });

  it('leaves link-state warnings alone when the URL is real', () => {
    const decision = badgeDecisionFor({
      last_verified: null,
      priority: 'crucial',
      link_status: 'broken',
      opt_out_url: 'https://example.test/gone',
    });
    expect(decision.linkWarning).toBe('link may be dead');
  });

  it('does not badge a null or absent opt_out_url as unconfirmed', () => {
    // Email-only brokers legitimately have no opt_out_url; that is not an unconfirmed route.
    expect(
      badgeDecisionFor({ last_verified: null, priority: 'crucial', opt_out_url: null }).linkWarning,
    ).toBeNull();
    expect(badgeDecisionFor({ last_verified: null, priority: 'crucial' }).linkWarning).toBeNull();
  });

  it('does not treat a URL merely containing "<verify:" mid-string as a placeholder', () => {
    // The marker is an anchored prefix, so a query string that happens to embed the text
    // does not flip a real URL into an unconfirmed one.
    const decision = badgeDecisionFor({
      last_verified: null,
      priority: 'standard',
      link_status: 'live',
      opt_out_url: 'https://example.test/x?note=<verify:%20nope>',
    });
    expect(decision.linkWarning).toBeNull();
  });
});

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

describe('link_status badges', () => {
  it('warns on a broken link', () => {
    const d = badgeDecisionFor({ last_verified: '2026-01-01', priority: 'crucial', link_status: 'broken' });
    expect(d.linkWarning).toBe('link may be dead');
    expect(d.linkWarningTitle).toBeTruthy();
  });

  it('distinguishes bot-blocked from broken -- they are different experiences', () => {
    const broken = badgeDecisionFor({ last_verified: null, priority: 'crucial', link_status: 'broken' });
    const blocked = badgeDecisionFor({ last_verified: null, priority: 'crucial', link_status: 'bot-blocked' });
    expect(blocked.linkWarning).not.toBe(broken.linkWarning);
    // Saying "broken" about a link that works for humans makes someone skip a broker they
    // could have opted out of.
    expect(blocked.linkWarning).not.toMatch(/dead|broken/i);
  });

  it('badges a redirect', () => {
    const d = badgeDecisionFor({ last_verified: null, priority: 'high', link_status: 'redirect' });
    expect(d.linkWarning).toBe('redirects');
  });

  it('stays silent on a live link', () => {
    const d = badgeDecisionFor({ last_verified: '2026-01-01', priority: 'high', link_status: 'live' });
    expect(d.linkWarning).toBeNull();
    expect(d.linkWarningTitle).toBeNull();
  });

  it('stays silent on unknown -- not actionable, and it would badge a quarter of the list', () => {
    const d = badgeDecisionFor({ last_verified: null, priority: 'standard', link_status: 'unknown' });
    expect(d.linkWarning).toBeNull();
  });

  it('stays silent when link_status is absent entirely', () => {
    const d = badgeDecisionFor({ last_verified: null, priority: 'standard' });
    expect(d.linkWarning).toBeNull();
  });

  it('does not disturb the unverified contract', () => {
    const d = badgeDecisionFor({ last_verified: null, priority: 'crucial', link_status: 'broken' });
    expect(d.showUnverifiedBadge).toBe(true);
    expect(d.priorityBadgeClass).toBe('priority-crucial');
  });
});
