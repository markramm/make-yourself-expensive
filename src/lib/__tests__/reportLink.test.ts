import { describe, it, expect } from 'vitest';
import { routeReportUrl } from '../reportLink';
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
