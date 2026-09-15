// @vitest-environment jsdom
/**
 * Accessibility contracts for the broker row.
 *
 * badgeContract.ts is already unit-tested as a pure function, but nothing checked that
 * RowShell actually *renders* those decisions, or that the screen-reader affordances behave.
 * Those are the parts a sighted developer can break without noticing: the row still looks
 * right while the announcement never fires or the checkbox lies about what it does.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach } from 'vitest';
import RowShell from '../RowShell.svelte';
import type { Broker } from '../../../lib/dataset/fetchAndVerify';
import type { BrokerProgress } from '../../../stores/progress';

afterEach(cleanup);

function makeBroker(overrides: Partial<Broker> = {}): Broker {
  return {
    id: 'acme-data',
    name: 'Acme Data',
    domain: 'acme.test',
    category: 'people_search',
    people_search: true,
    tier: 'auto',
    priority: 'crucial',
    method: 'email',
    opt_out_url: null,
    opt_out_email: 'privacy@acme.test',
    phone: null,
    captcha: false,
    id_required: false,
    phone_required: false,
    charges_fee: false,
    verification: null,
    required_fields: [],
    readd_days: null,
    legal_basis: [],
    link_status: 'live',
    last_verified: '2026-01-01',
    source: 'test',
    instructions_md: 'do the thing',
    ...overrides,
  };
}

const notDone: BrokerProgress = { done: false, doneAt: null };
const done: BrokerProgress = { done: true, doneAt: '2026-01-01T00:00:00.000Z' };

function renderRow(broker: Broker, progress: BrokerProgress, onToggle = () => {}) {
  return render(RowShell, { props: { broker, progress, onToggle, href: null } });
}

describe('RowShell: checkbox labelling', () => {
  it('offers to mark an undone broker as done', () => {
    const { getByRole } = renderRow(makeBroker(), notDone);
    const box = getByRole('checkbox');
    expect(box.getAttribute('aria-label')).toBe('Mark Acme Data as done');
    expect((box as HTMLInputElement).checked).toBe(false);
  });

  it('offers to UN-mark a done broker, rather than repeating "mark as done"', () => {
    // The label has to describe the action the control will take, not the current state --
    // a checkbox that says "Mark X as done" when it is already done tells the reader the
    // opposite of what pressing it does.
    const { getByRole } = renderRow(makeBroker(), done);
    const box = getByRole('checkbox');
    expect(box.getAttribute('aria-label')).toBe('Mark Acme Data as not done');
    expect((box as HTMLInputElement).checked).toBe(true);
  });
});

describe('RowShell: screen-reader announcement', () => {
  it('starts empty, so the live region is not pre-populated on load', async () => {
    // An aria-live region that already has content when the page loads is not announced by
    // most screen readers -- it has to CHANGE after the region exists. This is why the
    // component starts it blank rather than describing the initial state.
    const { container } = renderRow(makeBroker(), notDone);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.textContent?.trim()).toBe('');
  });

  it('announces the transition that just happened, not the state it landed in', async () => {
    // RowShell captures `done` BEFORE calling onToggle(), because onToggle() synchronously
    // updates the store and re-renders with the new prop value. Reading it afterwards would
    // report the post-toggle state and announce the opposite of what occurred.
    const onToggle = vi.fn();
    const { getByRole, container } = renderRow(makeBroker(), notDone, onToggle);

    getByRole('checkbox').dispatchEvent(new Event('change', { bubbles: true }));
    // Svelte flushes DOM updates asynchronously, so the live region still holds its previous
    // text on the turn the event fires. Yield before asserting.
    await tick();

    expect(onToggle).toHaveBeenCalledOnce();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent?.trim()).toBe('Acme Data marked done');
  });

  it('announces un-marking when the row was already done', async () => {
    const { getByRole, container } = renderRow(makeBroker(), done);

    getByRole('checkbox').dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent?.trim()).toBe('Acme Data marked not done');
  });
});

describe('RowShell: badge rendering matches badgeContract', () => {
  it('renders the unverified badge when last_verified is null', () => {
    // The load-bearing contract from badgeContract.ts, checked at the render layer this
    // time -- the pure function can stay correct while the template drops the branch.
    const { getByText } = renderRow(makeBroker({ last_verified: null }), notDone);
    expect(getByText('unverified')).toBeTruthy();
  });

  it('omits the unverified badge once an entry has been verified', () => {
    const { queryByText } = renderRow(makeBroker({ last_verified: '2026-01-01' }), notDone);
    expect(queryByText('unverified')).toBeNull();
  });

  it('warns that a broken link may be dead without calling it definitely gone', () => {
    const { getByText } = renderRow(makeBroker({ link_status: 'broken' }), notDone);
    expect(getByText('link may be dead')).toBeTruthy();
  });

  it('distinguishes bot-blocked from broken, since one still works for a human', () => {
    const { getByText, queryByText } = renderRow(makeBroker({ link_status: 'bot-blocked' }), notDone);
    expect(getByText('blocks automated checks')).toBeTruthy();
    expect(queryByText('link may be dead')).toBeNull();
  });

  it('badges nothing for an unknown link state', () => {
    // 'unknown' means the checker has not run, which the reader cannot act on. Badging it
    // would put a warning on a large share of rows for no gain.
    const { queryByText } = renderRow(makeBroker({ link_status: 'unknown' }), notDone);
    expect(queryByText('link may be dead')).toBeNull();
    expect(queryByText('blocks automated checks')).toBeNull();
    expect(queryByText('redirects')).toBeNull();
  });
});

describe('RowShell: the broker name as the primary action', () => {
  // These query the NAME link by its accessible name rather than by "the link in this row".
  // Every row now also carries a quiet "Something wrong here?" report link, so a bare
  // getByRole('link') matches two elements and a queryByRole('link') is never null -- which
  // would make these tests assert something neither true nor interesting.
  it('renders the name as a link when an opt-out URL is supplied', () => {
    const { getByRole } = render(RowShell, {
      props: {
        broker: makeBroker(),
        progress: notDone,
        onToggle: () => {},
        href: 'https://acme.test/opt-out',
      },
    });
    const link = getByRole('link', { name: /Acme Data/ });
    expect(link.getAttribute('href')).toBe('https://acme.test/opt-out');
    // Opening a broker's site must not hand it a referrer or a window handle back.
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('leaves the name as plain text when there is no URL to open', () => {
    const { queryByRole, getByText } = renderRow(makeBroker(), notDone);
    expect(queryByRole('link', { name: /Acme Data/ })).toBeNull();
    expect(getByText('Acme Data')).toBeTruthy();
  });
});

describe('RowShell: every row can be reported on', () => {
  // /testing calls "follow one broker the whole way" the most valuable report this project
  // gets. Until now the only way to file one was three generic links on /testing that lost
  // the broker context -- which broker, which dataset version -- that makes a report
  // actionable. The link lives in the shell so every tier gets it from one definition.
  it('offers a report link on a row whose name is plain text', () => {
    const { getByRole } = renderRow(makeBroker(), notDone);
    const report = getByRole('link', { name: /Something wrong here/ });
    expect(report.getAttribute('href')).toContain('data-broker-registry/issues/new');
  });

  it('offers a report link on a row whose name is already a link', () => {
    const { getByRole } = render(RowShell, {
      props: {
        broker: makeBroker(),
        progress: notDone,
        onToggle: () => {},
        href: 'https://acme.test/opt-out',
      },
    });
    expect(getByRole('link', { name: /Something wrong here/ })).toBeTruthy();
  });

  it('carries this broker\'s id, so the report says which entry to fix', () => {
    const { getByRole } = renderRow(makeBroker(), notDone);
    const href = getByRole('link', { name: /Something wrong here/ }).getAttribute('href') ?? '';
    expect(decodeURIComponent(href)).toContain('acme-data');
  });

  it('opens without handing the repo a referrer or a window handle', () => {
    const { getByRole } = renderRow(makeBroker(), notDone);
    const rel = getByRole('link', { name: /Something wrong here/ }).getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('stays available on a row already marked done', () => {
    // Finishing an opt-out is exactly when someone knows whether the instructions were right.
    const { getByRole } = renderRow(makeBroker(), done);
    expect(getByRole('link', { name: /Something wrong here/ })).toBeTruthy();
  });
});
