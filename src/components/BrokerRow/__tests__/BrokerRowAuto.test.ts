// @vitest-environment jsdom
/**
 * The auto-tier row's delivery contract.
 *
 * `window.location.href = 'mailto:...'` fails SILENTLY when no mail client is registered --
 * the default for anyone reading mail in a browser tab. The row's note already told those
 * readers to "paste the request in by hand", but the request itself was never rendered
 * anywhere, so the instruction pointed at nothing. These tests pin the fix: the composed
 * letter is shown on compose, and it is copyable.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import BrokerRowAuto from '../BrokerRowAuto.svelte';
import type { Broker } from '../../../lib/dataset/fetchAndVerify';
import type { Profile } from '../../../stores/profile';

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

const profile: Profile = {
  fullName: 'Jane Q Public',
  email: 'jane@example.test',
  phone: '555-0100',
  address: '1 Main St',
  city: 'Springfield',
  state: 'CA',
  zip: '90001',
  dob: '',
};

/**
 * jsdom throws "Not implemented: navigation" on a mailto: assignment, which would fail the
 * test for the wrong reason. Stub the accessor so compose() runs to completion the way it
 * does in a browser that simply ignores an unhandled scheme.
 */
function stubNavigation() {
  const assigned: string[] = [];
  const original = Object.getOwnPropertyDescriptor(window, 'location');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      set href(v: string) {
        assigned.push(v);
      },
      get href() {
        return assigned[assigned.length - 1] ?? '';
      },
    },
  });
  return {
    assigned,
    restore: () => {
      if (original) Object.defineProperty(window, 'location', original);
    },
  };
}

let nav: ReturnType<typeof stubNavigation>;
beforeEach(() => {
  nav = stubNavigation();
});
afterEach(() => nav.restore());

async function composeIn(broker = makeBroker()) {
  const utils = render(BrokerRowAuto, { props: { broker, profile } });
  await fireEvent.click(utils.getByText('Compose opt-out email'));
  await tick();
  return utils;
}

describe('the composed letter is shown, not just handed to a mail client', () => {
  it('renders nothing before the reader asks for it', () => {
    const { queryByText } = render(BrokerRowAuto, { props: { broker: makeBroker(), profile } });
    expect(queryByText(/Copy the whole thing/)).toBeNull();
  });

  it('shows the letter body after composing', async () => {
    const { container } = await composeIn();
    const body = container.querySelector('.letter-body');
    expect(body).not.toBeNull();
    // The real letter text, not a placeholder: the reader's own name and the substantive ask.
    expect(body?.textContent).toContain('Jane Q Public');
    expect(body?.textContent).toContain('Delete the personal information');
    expect(body?.textContent).toContain('Stop selling or sharing');
  });

  it('shows the destination and subject alongside it', async () => {
    const { container } = await composeIn();
    const text = container.querySelector('.letter-fields')?.textContent ?? '';
    expect(text).toContain('privacy@acme.test');
    expect(text).toContain('Acme Data');
  });

  it('still attempts the mail client, so a registered app remains one click', async () => {
    await composeIn();
    expect(nav.assigned.some((h) => h.startsWith('mailto:'))).toBe(true);
  });

  it('shows the letter even though the mailto was attempted', async () => {
    // The whole point: the reader cannot tell whether the mailto fired, so the fallback
    // cannot be gated on detecting failure.
    const { container } = await composeIn();
    expect(nav.assigned.some((h) => h.startsWith('mailto:'))).toBe(true);
    expect(container.querySelector('.letter-body')).not.toBeNull();
  });
});

describe('copying the letter', () => {
  function stubClipboard(impl: (t: string) => Promise<void>) {
    const writeText = vi.fn(impl);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    return writeText;
  }

  it('copies the whole letter including the destination address', async () => {
    const writeText = stubClipboard(async () => {});
    const { getByText } = await composeIn();
    await fireEvent.click(getByText('Copy the whole thing'));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('To: privacy@acme.test');
    expect(copied).toContain('Subject:');
    expect(copied).toContain('Jane Q Public');
  });

  it('copies the subject and the message separately, for a compose form with two fields', async () => {
    const writeText = stubClipboard(async () => {});
    const { getByText } = await composeIn();
    await fireEvent.click(getByText('Copy subject'));
    expect(writeText.mock.calls[0][0]).toContain('Acme Data');
    expect(writeText.mock.calls[0][0]).not.toContain('To: ');

    await fireEvent.click(getByText('Copy message'));
    expect(writeText.mock.calls[1][0]).toContain('Jane Q Public');
  });

  it('says so when the clipboard refuses, rather than looking inert', async () => {
    stubClipboard(async () => {
      throw new Error('denied');
    });
    const { getByText, container } = await composeIn();
    await fireEvent.click(getByText('Copy the whole thing'));
    await tick();
    expect(container.querySelector('.letter-status')?.textContent).toMatch(/couldn't copy/i);
  });

  it('keeps the text on screen when copying fails, so it can be selected by hand', async () => {
    stubClipboard(async () => {
      throw new Error('denied');
    });
    const { getByText, container } = await composeIn();
    await fireEvent.click(getByText('Copy the whole thing'));
    await tick();
    expect(container.querySelector('.letter-body')?.textContent).toContain('Jane Q Public');
  });
});

describe('composing a request that cannot be built', () => {
  it('surfaces the error instead of showing an empty letter', async () => {
    // An unconfirmed opt-out email is nulled at the dataset boundary, so composeRequest throws.
    const { container } = await composeIn(makeBroker({ opt_out_email: null }));
    expect(container.querySelector('.letter-body')).toBeNull();
    expect(container.querySelector('.error')).not.toBeNull();
  });
});
