import { describe, it, expect } from 'vitest';
import { routeReportUrl, brokerReportUrl } from '../reportLink';
import { PINNED_DATASET } from '../../data/dataset-manifest';

const broker = {
  id: 'backgroundcheck-run',
  name: 'BackgroundCheck.run',
  domain: 'backgroundcheck.run',
  route_unconfirmed: true,
};

/** The issue body, decoded back out of the generated URL. */
function bodyOf(url: string): string {
  const body = new URL(url).searchParams.get('body');
  if (body === null) throw new Error('no body parameter in the generated URL');
  return body;
}

describe('routeReportUrl: where the report goes', () => {
  it('files against the dataset repo, not the app repo', () => {
    // A wrong or missing opt-out route is a defect in the broker ENTRY. The registry is where
    // entries get fixed (one markdown file per broker); the issue-template config and
    // TESTING.md both route broker-data corrections there. Filing these against the app repo
    // would put them somewhere nobody can act on them.
    expect(routeReportUrl(broker)).toContain('data-broker-registry/issues/new');
    expect(routeReportUrl(broker)).not.toContain('make-yourself-expensive/issues');
  });

  it('produces a valid, fully-encoded URL', () => {
    const url = routeReportUrl(broker);
    expect(() => new URL(url)).not.toThrow();
    // Raw newlines or spaces in a query value would be mangled or truncated by the browser.
    expect(url).not.toMatch(/[\n ]/);
  });

  it('labels the issue so the registry can triage it', () => {
    const labels = new URL(routeReportUrl(broker)).searchParams.get('labels');
    expect(labels).toContain('broker-data');
  });
});

describe('routeReportUrl: PII rule', () => {
  // Issues are public. This link must never become a way for a reader to leak their own data
  // into one -- so the body is assembled from dataset fields only, and the module imports no
  // store at all. This test pins the observable half of that guarantee.
  it('carries only dataset facts: id, name, domain, dataset version', () => {
    const body = bodyOf(routeReportUrl(broker));
    expect(body).toContain('backgroundcheck-run');
    expect(body).toContain('BackgroundCheck.run');
    expect(body).toContain(PINNED_DATASET.datasetVersion);
  });

  it('asks for the opt-out route, never for anything about the reporter', () => {
    const body = bodyOf(routeReportUrl(broker)).toLowerCase();
    // The prompts must not invite a name, address, phone, email or date of birth.
    for (const prompt of ['your name', 'your address', 'your phone', 'your email', 'date of birth']) {
      expect(body).not.toContain(prompt);
    }
  });

  it('warns the reporter that issues are public', () => {
    const body = bodyOf(routeReportUrl(broker));
    expect(body).toMatch(/do not paste your real name/i);
    expect(body).toMatch(/public/i);
  });
});

describe('routeReportUrl: says which kind of gap this is', () => {
  it('describes an unconfirmed route as unconfirmed', () => {
    const body = bodyOf(routeReportUrl({ ...broker, route_unconfirmed: true }));
    expect(body).toContain('no confirmed opt-out URL');
  });

  it('describes a broker with no published route differently', () => {
    // "Nobody has confirmed where this lives" and "this broker publishes nothing" are different
    // facts, and a reporter who is told the wrong one goes looking for the wrong thing.
    const body = bodyOf(routeReportUrl({ ...broker, route_unconfirmed: false }));
    expect(body).toContain('lists no opt-out URL, email, or phone');
  });

  it('names the broker in the title so the issue is identifiable in a list', () => {
    const title = new URL(routeReportUrl(broker)).searchParams.get('title');
    expect(title).toContain('BackgroundCheck.run');
    expect(title).toContain('backgroundcheck.run');
  });
});

describe('brokerReportUrl: the report every row can file', () => {
  const ordinary = {
    id: 'spokeo-com',
    name: 'Spokeo',
    domain: 'spokeo.com',
    last_verified: null as string | null,
  };

  it('files against the dataset repo, like the routing report', () => {
    expect(brokerReportUrl(ordinary)).toContain('data-broker-registry/issues/new');
    expect(brokerReportUrl(ordinary)).not.toContain('make-yourself-expensive/issues');
  });

  it('produces a valid, fully-encoded URL', () => {
    const url = brokerReportUrl(ordinary);
    expect(() => new URL(url)).not.toThrow();
    expect(url).not.toMatch(/[\n ]/);
  });

  it('carries the broker id and dataset version, so a report is actionable', () => {
    // The three generic links on /testing lose exactly this: which broker, which dataset
    // version. Without them a maintainer cannot tell which entry to fix.
    const body = bodyOf(brokerReportUrl(ordinary));
    expect(body).toContain('spokeo-com');
    expect(body).toContain(PINNED_DATASET.datasetVersion);
  });

  it('asks the questions /testing says matter most', () => {
    const body = bodyOf(brokerReportUrl(ordinary));
    expect(body).toContain('What did the tool say to expect?');
    expect(body).toContain('What actually happened?');
    expect(body).toContain('Did the listing come down?');
  });

  it('says a first-hand account matters most where nobody has confirmed the entry', () => {
    const body = bodyOf(brokerReportUrl({ ...ordinary, last_verified: null }));
    expect(body).toContain('Nobody has confirmed this entry');
  });

  it('frames a confirmed entry as possibly stale rather than unchecked', () => {
    // A verified entry can still break -- brokers redesign forms and retire domains -- so the
    // link stays on verified rows, asking a different question.
    const body = bodyOf(brokerReportUrl({ ...ordinary, last_verified: '2026-01-15' }));
    expect(body).toContain('2026-01-15');
    expect(body).toContain('has since changed');
    expect(body).not.toContain('Nobody has confirmed this entry');
  });

  it('never asks for anything about the reporter', () => {
    const body = bodyOf(brokerReportUrl(ordinary)).toLowerCase();
    for (const prompt of ['your name', 'your address', 'your phone', 'your email', 'date of birth']) {
      expect(body).not.toContain(prompt);
    }
    expect(body).toMatch(/do not paste your real name/i);
  });

  it('labels the issue as a tester report for triage', () => {
    const labels = new URL(brokerReportUrl(ordinary)).searchParams.get('labels');
    expect(labels).toContain('tester-report');
  });

  it('stays distinct from the routing report, which asks a narrower question', () => {
    // Merging the two would prompt someone who just completed a working opt-out for a URL we
    // already have.
    const general = bodyOf(brokerReportUrl(ordinary));
    const routing = bodyOf(routeReportUrl({ ...ordinary, route_unconfirmed: true }));
    expect(general).toContain('What actually happened?');
    expect(routing).toContain('The opt-out page you found');
    expect(general).not.toContain('The opt-out page you found');
  });
});
