// @vitest-environment jsdom
/**
 * Accessibility contracts for the sensitive-information guardrail.
 *
 * This modal is the one place the tool deliberately interrupts someone before they hand a
 * broker an SSN, a government ID, or a VIN. It is a real decision point, so the keyboard
 * behaviour is load-bearing: focus must not escape into the page behind it, Escape must
 * back out, and the dialog must announce itself rather than appearing as anonymous divs.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import GuardrailModal from '../GuardrailModal.svelte';
import type { Broker } from '../../lib/dataset/fetchAndVerify';

afterEach(cleanup);

function makeBroker(required_fields: string[]): Broker {
  return {
    id: 'tlo-com',
    name: 'TLO',
    domain: 'tlo.test',
    category: 'people_search',
    people_search: true,
    tier: 'guided',
    priority: 'crucial',
    method: 'form',
    opt_out_url: 'https://tlo.test/opt-out',
    opt_out_email: null,
    phone: null,
    captcha: false,
    id_required: true,
    phone_required: false,
    charges_fee: false,
    verification: null,
    required_fields,
    readd_days: null,
    legal_basis: [],
    link_status: 'live',
    last_verified: null,
    source: 'test',
    instructions_md: 'steps',
  };
}

function renderModal(fields = ['ssn', 'gov_id'], handlers: Partial<{ onConfirm: () => void; onCancel: () => void }> = {}) {
  return render(GuardrailModal, {
    props: {
      broker: makeBroker(fields),
      onConfirm: handlers.onConfirm ?? (() => {}),
      onCancel: handlers.onCancel ?? (() => {}),
    },
  });
}

describe('GuardrailModal: dialog semantics', () => {
  it('announces itself as a modal dialog labelled by its heading', () => {
    const { getByRole } = renderModal();
    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // Without aria-labelledby a screen reader announces "dialog" and nothing about what
    // decision is being asked for.
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBe('guardrail-title');
    expect(dialog.querySelector(`#${labelledBy}`)?.textContent).toContain('TLO');
  });

  it('moves focus into the dialog on open', () => {
    // If focus stays on the row behind, a keyboard user has no idea the modal appeared and
    // tabbing continues through the page underneath it.
    const { getByRole } = renderModal();
    const dialog = getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('GuardrailModal: what it says is at stake', () => {
  it('names each sensitive field in words rather than dataset keys', () => {
    // "gov_id" tells a non-technical reader nothing about what they are being asked for.
    const { getByText } = renderModal(['ssn', 'gov_id']);
    expect(getByText(/Social Security Number/i)).toBeTruthy();
    expect(getByText(/driver's license photo/i)).toBeTruthy();
  });

  it('lists only the sensitive fields, not every required field', () => {
    const { queryByText, getByText } = renderModal(['ssn', 'full_name', 'email']);
    expect(getByText(/Social Security Number/i)).toBeTruthy();
    expect(queryByText(/full_name/)).toBeNull();
    expect(queryByText(/email/)).toBeNull();
  });
});

describe('GuardrailModal: keyboard escape routes', () => {
  it('cancels on Escape', () => {
    // Escape is the expected way out of a modal. Without it a keyboard user is stuck
    // choosing between the two buttons.
    const onCancel = vi.fn();
    renderModal(['ssn'], { onCancel });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not confirm on Escape', () => {
    // Backing out must never be mistaken for consenting to hand over an SSN.
    const onConfirm = vi.fn();
    renderModal(['ssn'], { onConfirm });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('wraps Tab from the last focusable element back to the first', () => {
    const { getByRole } = renderModal();
    const dialog = getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    expect(focusable.length).toBeGreaterThan(1);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable element back to the last', () => {
    const { getByRole } = renderModal();
    const dialog = getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
  });
});

describe('GuardrailModal: the two decisions', () => {
  it('confirms only when the reader explicitly continues', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText } = renderModal(['ssn'], { onConfirm, onCancel });
    (getByText(/I understand, continue/i) as HTMLButtonElement).click();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels on "Not right now"', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText } = renderModal(['ssn'], { onConfirm, onCancel });
    (getByText(/Not right now/i) as HTMLButtonElement).click();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('GuardrailModal: focus does not escape from the opening position', () => {
  // Focus opens on the heading, which is tabindex="-1" and so is NOT one of the focusable
  // controls the trap wraps between. The original trap only acted when focus was already on
  // the first or last control, so Shift+Tab from that opening position matched neither branch
  // and walked out into the page behind the modal -- past a dialog the reader believes is
  // blocking them, on the one screen that guards an SSN or a government ID.
  it('wraps Shift+Tab from the heading to the last control, rather than leaving the dialog', () => {
    const { getByRole } = renderModal();
    const heading = getByRole('heading', { level: 2 });
    heading.focus();
    expect(document.activeElement).toBe(heading);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));

    const confirm = getByRole('button', { name: /I understand, continue/ });
    expect(document.activeElement).toBe(confirm);
  });

  it('wraps a forward Tab from the heading to the first control', () => {
    const { getByRole } = renderModal();
    getByRole('heading', { level: 2 }).focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    const cancel = getByRole('button', { name: /Not right now/ });
    expect(document.activeElement).toBe(cancel);
  });

  it('keeps focus inside the dialog when focus sits on the modal container itself', () => {
    // The container is tabindex="-1" and can receive focus programmatically; it is not in the
    // focusable list either, so it needs the same treatment as the heading.
    const { getByRole } = renderModal();
    const dialog = getByRole('dialog');
    (dialog as HTMLElement).focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('GuardrailModal: focus goes back where it came from', () => {
  it('returns focus to the element that opened it', async () => {
    // Without this, dismissing drops focus to the top of the document and a keyboard user has
    // to tab through the entire page to get back to the row they were working on.
    const trigger = document.createElement('button');
    trigger.textContent = 'Continue (sensitive info required)';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderModal();
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it('does not throw when the opening element is gone by the time it closes', () => {
    // Confirming can replace the trigger with the tier-specific action, so the node we
    // captured may be detached. Focusing a detached node silently does nothing; the guard
    // exists so this stays a no-op rather than an error.
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = renderModal();
    trigger.remove();

    expect(() => unmount()).not.toThrow();
  });
});
