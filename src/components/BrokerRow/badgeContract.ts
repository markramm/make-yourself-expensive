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
  /** Short badge label for a non-live link, or null when the link is fine/unknown. */
  linkWarning: string | null;
  /** Tooltip explaining what the reader should expect, paired with linkWarning. */
  linkWarningTitle: string | null;
}

/**
 * Non-live link states, in the words a reader needs rather than the words the crawler used.
 *
 * `broken` and `bot-blocked` are very different experiences and must not be collapsed: a
 * broken link wastes the visit entirely, while a bot-blocked one works fine for a human and
 * only defeated our automated checker. Telling someone "this is broken" when it isn't is its
 * own harm -- they skip a broker they could have opted out of.
 *
 * `unknown` deliberately gets NO badge. It means the checker hasn't run against this entry,
 * which is not information the reader can act on, and badging it would put a warning on 128
 * of 493 rows for no gain.
 *
 * An UNCONFIRMED ROUTE is a different thing and does get a badge -- see `routeWarningFor`.
 */
const LINK_WARNINGS: Record<string, { label: string; title: string }> = {
  broken: {
    label: 'link may be dead',
    title:
      "Our last check couldn't reach this page. It may have moved or the broker may be gone. " +
      'If you find a working URL, that correction is worth reporting.',
  },
  'bot-blocked': {
    label: 'blocks automated checks',
    title:
      "This broker blocks our automated link checker, so we can't confirm the page from here. " +
      'It usually still works in a normal browser — you may hit a CAPTCHA.',
  },
  redirect: {
    label: 'redirects',
    title:
      'This URL redirects somewhere else. It usually still lands on a working opt-out page, ' +
      'but tell us if it sends you somewhere unexpected.',
  },
};

/**
 * The dataset marks a field it could not confirm with an angle-bracket placeholder --
 * `<verify: what still needs checking>` -- rather than leaving it blank or guessing a value
 * (see the registry repo's CONTRIBUTING.md). A placeholder `opt_out_url` means nobody has
 * established where this broker's opt-out actually lives, which is materially different from
 * `link_status: unknown` ("we simply haven't run the checker against it").
 *
 * That distinction is worth a badge because the two failure modes cost a reader differently:
 * an unchecked link usually works, while an unconfirmed route may send them somewhere that
 * cannot process their request at all. 40 of 493 entries carry one, so this stays rare enough
 * to mean something -- unlike badging all 128 `unknown` rows.
 *
 * This reads the `route_unconfirmed` flag rather than sniffing `opt_out_url` for the
 * placeholder text: fetchAndVerify.ts nulls those placeholders before any component sees them
 * (they were rendering as live links to our own 404), so by the time a row is drawn the raw
 * marker is gone and only the flag still carries the fact. See normalizeBroker().
 */
function routeWarningFor(routeUnconfirmed: boolean | undefined): { label: string; title: string } | null {
  if (!routeUnconfirmed) return null;
  return {
    label: 'routing unconfirmed',
    title:
      "Nobody has confirmed where this broker's opt-out actually lives, so the steps below may " +
      'route you somewhere that cannot process your request. Read them before you start — and ' +
      'if you find the real opt-out page, that correction is worth reporting.',
  };
}

export function badgeDecisionFor(
  broker: Pick<Broker, 'last_verified' | 'priority'> &
    Partial<Pick<Broker, 'link_status' | 'route_unconfirmed'>>,
): BadgeDecision {
  // An unconfirmed route outranks a link-state warning: there is no point telling someone a
  // URL redirects when we are not sure it is the right URL in the first place.
  const routeWarning = routeWarningFor(broker.route_unconfirmed);
  const warning = routeWarning ?? (broker.link_status ? LINK_WARNINGS[broker.link_status] : undefined);
  return {
    // The one non-negotiable contract: last_verified === null MUST show the unverified badge.
    // A CI check can construct a synthetic broker with last_verified: null and assert this is
    // true, catching a future edit that accidentally drops the branch in RowShell.svelte.
    showUnverifiedBadge: broker.last_verified === null,
    priorityBadgeClass: `priority-${broker.priority}`,
    linkWarning: warning?.label ?? null,
    linkWarningTitle: warning?.title ?? null,
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
  // Keyed on doneAt (the CONFIRMED timestamp), never submittedAt. A request that was sent
  // but not yet confirmed has no removal to re-check -- starting the clock at submission
  // would tell someone a listing might have come back before it ever came down.
  if (!progress.done || !progress.doneAt || broker.readd_days === null) return false;
  const doneAt = new Date(progress.doneAt);
  if (Number.isNaN(doneAt.getTime())) return false;
  const dueAt = new Date(doneAt.getTime() + broker.readd_days * 24 * 60 * 60 * 1000);
  return now >= dueAt;
}
