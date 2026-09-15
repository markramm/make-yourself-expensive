/**
 * Builds a prefilled GitHub issue link for reporting a correction to a single broker entry.
 *
 * Deliberately NOT a form on this site: there is no server here, so a form would either need
 * one (breaking the whole premise) or quietly lose the report. A prefilled link keeps the
 * no-server guarantee and leaves the words in the reporter's own hands -- they see and edit
 * everything before it is sent. Same reasoning as the /testing page's issue links, which this
 * mirrors; the URL shape is defined here rather than there because a Svelte island cannot
 * import from an .astro page.
 *
 * It files against the DATASET repo, not the app repo. A wrong, missing, or unconfirmed
 * opt-out route is a defect in the broker entry, and the registry is where entries are fixed
 * (one markdown file per broker, no code required) -- see the issue-template config and
 * TESTING.md, which both route broker-data corrections there. Filing these against the app
 * would put them where nobody can act on them.
 *
 * PII RULE: the body is assembled from DATASET fields only -- id, name, domain, and the pinned
 * dataset version. Nothing from profileStore or progressStore is ever interpolated, and the
 * prompts deliberately ask for the opt-out URL rather than anything about the reporter. Issues
 * are public; this link must never become a way to leak a reader's own data into one.
 */
import { PINNED_DATASET } from '../data/dataset-manifest';

const DATA_REPO = 'https://github.com/markramm/data-broker-registry';

export interface ReportableBroker {
  id: string;
  name: string;
  domain: string;
  /** True when the entry's opt_out_url arrived as an unconfirmed `<verify:>` placeholder. */
  route_unconfirmed?: boolean;
  /** ISO date a human last confirmed this entry against the broker's own page, or null. */
  last_verified?: string | null;
}

/**
 * The single most valuable correction this project can receive, per /testing: someone who
 * followed a broker all the way through and found where the opt-out actually lives. These
 * rows are exactly where that is worth the most, because we could not find it ourselves.
 */
export function routeReportUrl(broker: ReportableBroker): string {
  const title = `Opt-out route for ${broker.name} (${broker.domain})`;
  const body = [
    `**Broker:** ${broker.name} (\`${broker.id}\`)`,
    `**Dataset version:** ${PINNED_DATASET.datasetVersion}`,
    '',
    broker.route_unconfirmed
      ? 'This entry has no confirmed opt-out URL. If you found where the opt-out actually lives, that URL is the fix.'
      : 'This entry lists no opt-out URL, email, or phone. If you found a working route, that is the fix.',
    '',
    '**The opt-out page you found**',
    '(paste the URL)',
    '',
    '**How you got there**',
    '(footer link? search result? something else?)',
    '',
    '**What it asked for**',
    '(fields, CAPTCHA, account, ID upload...)',
    '',
    '**Did it work?**',
    '(submitted / blocked / still unclear)',
    '',
    '---',
    'Please do not paste your real name, address, or profile contents here. Issues are public.',
    'Describe the route, not your personal data.',
  ].join('\n');

  return (
    `${DATA_REPO}/issues/new` +
    `?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}` +
    `&labels=${encodeURIComponent('broker-data,routing')}`
  );
}

/**
 * The report link every row carries, for the report /testing calls the most valuable one:
 * someone followed this broker the whole way through and found out what actually happens.
 *
 * Distinct from routeReportUrl() above, and deliberately NOT merged with it. That one asks a
 * narrow question of the 17 rows where we do not know where the opt-out lives ("where is it?").
 * This one asks the open question of every other row ("you followed it -- what happened?").
 * Collapsing them into one parameterised function would mean prompting a reader who just
 * completed a working opt-out for a URL we already have.
 *
 * `last_verified` shapes the framing rather than gating the link. An entry nobody has signed
 * off on is where a first-hand account is worth most, but a verified entry can still have
 * gone stale -- brokers redesign forms and retire domains constantly -- so a confirmed entry
 * that has since broken is itself a high-value report.
 *
 * PII RULE, as above: dataset fields only. This module imports no store, so it structurally
 * cannot read profileStore or progressStore, and every prompt asks about the BROKER's
 * behaviour rather than the reader. Issues are public.
 */
export function brokerReportUrl(broker: ReportableBroker): string {
  const title = `${broker.name} (${broker.domain}): opt-out report`;
  const verified = Boolean(broker.last_verified);
  const body = [
    `**Broker:** ${broker.name} (\`${broker.id}\`)`,
    `**Dataset version:** ${PINNED_DATASET.datasetVersion}`,
    verified
      ? `**Entry last confirmed:** ${broker.last_verified}`
      : '**Entry status:** not yet confirmed against the broker by a human',
    '',
    verified
      ? 'This entry was confirmed against the broker at some point. If it has since changed, that is worth knowing.'
      : 'Nobody has confirmed this entry against the broker yet, so a first-hand account is especially useful.',
    '',
    '**What did the tool say to expect?**',
    '(fields to fill, CAPTCHA, listing URL...)',
    '',
    '**What actually happened?**',
    '(different fields? an account requirement? a dead page? a fee?)',
    '',
    '**Did the listing come down?**',
    '(not yet / yes, after ___ days / no, still listed)',
    '',
    '**Browser and device**',
    '(e.g. Firefox 141 on macOS, Safari on iPhone)',
    '',
    '---',
    'Please do not paste your real name, address, or profile contents here. Issues are public.',
    'Describe the shape of the problem, not your personal data.',
  ].join('\n');

  return (
    `${DATA_REPO}/issues/new` +
    `?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}` +
    `&labels=${encodeURIComponent('broker-data,tester-report')}`
  );
}
