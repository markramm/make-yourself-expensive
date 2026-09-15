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
