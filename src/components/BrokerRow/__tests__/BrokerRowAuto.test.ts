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

/** Rendered prose carries the source's line wrapping; collapse it before matching. */
function prose(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function composeIn(broker = makeBroker()) {
  const utils = render(BrokerRowAuto, { props: { broker, profile } });
  await fireEvent.click(utils.getByText('Write the opt-out email'));
  await tick();
  return utils;
}

describe('the composed letter is shown, not just handed to a mail client', () => {
  it('renders nothing before the reader asks for it', () => {
    const { queryByText } = render(BrokerRowAuto, { props: { broker: makeBroker(), profile } });
    expect(queryByText(/Copy all/)).toBeNull();
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

  it('does NOT touch the mail client on compose', async () => {
    // Firing the mailto: automatically is what ambushed a tester: on a Mac with no default
    // mail client, the OS offers to connect one, and for Gmail that is an OAuth consent screen
    // listing read/write/delete scopes on their own mailbox. It fired before they knew a
    // letter existed. Composing now only composes.
    await composeIn();
    expect(nav.assigned.some((h) => h.startsWith('mailto:'))).toBe(false);
  });

  it('opens the mail client only when the reader explicitly asks', async () => {
    // Still one click for anyone who has a mail app -- just a click they chose to make.
    const { getByText } = await composeIn();
    await fireEvent.click(getByText('Send in my mail app'));
    expect(nav.assigned.some((h) => h.startsWith('mailto:'))).toBe(true);
  });

  it('warns that the machine may offer to connect an account instead', async () => {
    const { container } = await composeIn();
    const note = container.querySelector('.mail-app-note')?.textContent ?? '';
    expect(note).toMatch(/offers to connect an account/i);
    expect(note).toMatch(/copy the letter/i);
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
    await fireEvent.click(getByText('Copy all'));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('To: privacy@acme.test');
    expect(copied).toContain('Subject:');
    expect(copied).toContain('Jane Q Public');
  });

  it('copies the subject and the message separately, for a compose form with two fields', async () => {
    const writeText = stubClipboard(async () => {});
    const { getByRole } = await composeIn();
    await fireEvent.click(getByRole('button', { name: /Copy the subject/i }));
    expect(writeText.mock.calls[0][0]).toContain('Acme Data');
    expect(writeText.mock.calls[0][0]).not.toContain('To: ');

    await fireEvent.click(getByRole('button', { name: /Copy the message/i }));
    expect(writeText.mock.calls[1][0]).toContain('Jane Q Public');
  });

  it('says so when the clipboard refuses, rather than looking inert', async () => {
    stubClipboard(async () => {
      throw new Error('denied');
    });
    const { getByText, container } = await composeIn();
    await fireEvent.click(getByText('Copy all'));
    await tick();
    expect(container.querySelector('.letter-status')?.textContent).toMatch(/couldn't copy/i);
  });

  it('keeps the text on screen when copying fails, so it can be selected by hand', async () => {
    stubClipboard(async () => {
      throw new Error('denied');
    });
    const { getByText, container } = await composeIn();
    await fireEvent.click(getByText('Copy all'));
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

describe('a letter that cannot identify the reader says so', () => {
  // composeRequest() omits profile fields that are blank. With an empty profile that yields a
  // letter whose "My identifying information for locating my record:" header is followed by
  // nothing at all, and an unsigned "Thank you," -- unusable by a broker, and the reader was
  // given no sign anything was wrong.
  const emptyProfile: Profile = {
    fullName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', dob: '',
  };

  function renderWith(p: Profile) {
    return render(BrokerRowAuto, { props: { broker: makeBroker(), profile: p } });
  }

  it('warns before composing, not only after', async () => {
    const { container } = renderWith(emptyProfile);
    const warning = container.querySelector('.profile-warning');
    expect(warning?.textContent).toMatch(/nothing to match you against/i);
  });

  it('points at the profile page, where the fix is', async () => {
    const { getByRole } = renderWith(emptyProfile);
    expect(getByRole('link', { name: /Set up your profile/i }).getAttribute('href')).toBe('/profile');
  });

  it('repeats the warning inside the composed letter', async () => {
    const { container, getByText } = renderWith(emptyProfile);
    await fireEvent.click(getByText('Write the opt-out email'));
    await tick();
    expect(container.querySelector('.letter-missing')?.textContent).toMatch(
      /no name or email in it/i,
    );
  });

  it('names which fields are missing on a partly-filled profile', async () => {
    const { container } = renderWith({ ...emptyProfile, fullName: 'Jane Q Public', email: 'j@example.test' });
    const warning = container.querySelector('.profile-warning');
    expect(warning?.textContent).toMatch(/postal address/i);
    expect(warning?.textContent).not.toMatch(/full name/i);
  });

  it('says nothing when the profile can actually identify the reader', async () => {
    const { container } = renderWith(profile);
    expect(container.querySelector('.profile-warning')).toBeNull();
  });

  it('still composes the letter, rather than blocking on a missing profile', async () => {
    // The reader may want to paste their own details in by hand. Warn, do not obstruct.
    const { container, getByText } = renderWith(emptyProfile);
    await fireEvent.click(getByText('Write the opt-out email'));
    await tick();
    expect(container.querySelector('.letter-body')).not.toBeNull();
  });
});

describe('the letter is laid out for the task, not as a wall of text', () => {
  it('puts the send and copy-all actions above the letter, not below it', async () => {
    // They used to sit under a scrolling body, so the reader met the monospace wall first and
    // only then learned what they could do with it.
    const { container } = await composeIn();
    const top = container.querySelector('.letter-top');
    expect(top).not.toBeNull();
    expect(top?.textContent).toMatch(/Send in my mail app/);
    expect(top?.textContent).toMatch(/Copy all/);
  });

  it('gives every field its own copy control', async () => {
    const { getByRole } = await composeIn();
    expect(getByRole('button', { name: /Copy the recipient address/i })).toBeTruthy();
    expect(getByRole('button', { name: /Copy the subject/i })).toBeTruthy();
    expect(getByRole('button', { name: /Copy the message/i })).toBeTruthy();
  });

  it('copies just the recipient address from its own control', async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { getByRole } = await composeIn();
    await fireEvent.click(getByRole('button', { name: /Copy the recipient address/i }));
    expect(writeText).toHaveBeenCalledWith('privacy@acme.test');
  });

  it('does not repeat the address above the letter', async () => {
    // The composed letter shows To as a labelled field; a standalone "Sends to ..." line
    // directly above it said the same thing twice.
    const { container } = await composeIn();
    expect(container.querySelector('.address-line')).toBeNull();
  });

  it('shows the whole letter rather than an inner scrollbox', async () => {
    // An 18rem max-height inside an already-scrolling page meant the reader saw a fragment
    // starting mid-sentence and had to scroll a box to read what they were about to send.
    const { container } = await composeIn();
    const body = container.querySelector('.letter-body') as HTMLElement | null;
    expect(body).not.toBeNull();
    expect(body?.style.maxHeight ?? '').toBe('');
  });
});

describe('an empty profile is told what it gains, not only what is broken', () => {
  // The warning used to say only that the letter could not identify the reader. True, but it
  // gave them no reason to visit the profile page beyond fixing this one letter. The actual
  // bargain is that filling it in ONCE writes every subsequent letter automatically, and the
  // email tier alone is dozens of brokers that would otherwise each need the same details
  // typed again by hand.
  const emptyProfile: Profile = {
    fullName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', dob: '',
  };

  function renderEmpty() {
    return render(BrokerRowAuto, { props: { broker: makeBroker(), profile: emptyProfile } });
  }

  it('leads with the payoff before naming the defect', async () => {
    const { container } = renderEmpty();
    const text = prose(container.querySelector('.profile-warning'));
    expect(text).toMatch(/once/i);
    expect(text).toMatch(/letters write themselves/i);
  });

  it('says the saving is recurring, not a one-letter fix', async () => {
    const { container } = renderEmpty();
    expect(prose(container.querySelector('.profile-warning'))).toMatch(
      /every other one by hand/i,
    );
  });

  it('repeats the offer inside the composed letter', async () => {
    const { container, getByText } = renderEmpty();
    await fireEvent.click(getByText('Write the opt-out email'));
    await tick();
    expect(prose(container.querySelector('.letter-missing'))).toMatch(
      /every other one, fills itself in/i,
    );
  });

  it('keeps the on-device promise next to the ask', async () => {
    // The tease is asking for name, email and address. It has to carry the reason that is
    // safe to give, in the same breath.
    const { container } = renderEmpty();
    const text = prose(container.querySelector('.profile-warning'));
    expect(text).toMatch(/stays on this device/i);
    expect(text).toMatch(/never sent anywhere/i);
  });

  it('does not tease a reader who already has a usable profile', async () => {
    const { container } = render(BrokerRowAuto, { props: { broker: makeBroker(), profile } });
    expect(container.querySelector('.profile-warning')).toBeNull();
  });
});
