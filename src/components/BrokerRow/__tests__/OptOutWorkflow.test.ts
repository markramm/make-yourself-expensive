// @vitest-environment jsdom
/**
 * The per-broker workflow UI.
 *
 * This exists because of a beta tester's report: brokers often take days to acknowledge an
 * opt-out, which makes serial work impossible and leaves a reader with many requests
 * outstanding at once. A checkbox cannot hold "sent, still waiting", and re-sending can burn
 * a once-per-year-per-email allowance. These tests pin the states the store now supports and
 * the two things the UI must not do: bury an in-flight request, or force the workflow on
 * someone who only wants to tick a box.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import OptOutWorkflow from '../OptOutWorkflow.svelte';
import { EMPTY_PROGRESS, type BrokerProgress } from '../../../stores/progress';

afterEach(cleanup);

function entry(overrides: Partial<BrokerProgress> = {}): BrokerProgress {
  return { ...EMPTY_PROGRESS, ...overrides };
}

function renderWorkflow(progress: BrokerProgress, handlers: Partial<{
  onSetStatus: (s: string) => void;
  onSetNote: (n: string) => void;
}> = {}) {
  return render(OptOutWorkflow, {
    props: {
      brokerName: 'Acme Data',
      brokerId: 'acme-data',
      progress,
      onSetStatus: handlers.onSetStatus ?? (() => {}),
      onSetNote: handlers.onSetNote ?? (() => {}),
    },
  });
}

/** Days ago as an ISO timestamp. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

describe('the workflow stays out of the way until there is something to see', () => {
  it('is collapsed for an untouched broker', () => {
    // Most readers will tick the checkbox and never open this. Forcing a four-step workflow
    // on them would be worse than the binary it replaces.
    const { container } = renderWorkflow(entry());
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
  });

  it('opens automatically once a request is in flight', () => {
    // At that point the extra state IS what the reader came back to check.
    const { container } = renderWorkflow(entry({ status: 'submitted', submittedAt: daysAgo(3) }));
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
  });

  it('opens when a note exists, so saved text is never hidden', () => {
    const { container } = renderWorkflow(entry({ note: 'ref #12345' }));
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
  });
});

describe('how long a request has been outstanding', () => {
  it('shows the age of a submitted request', () => {
    // "Sent three weeks ago, still nothing" is the signal to chase.
    const { container } = renderWorkflow(entry({ status: 'submitted', submittedAt: daysAgo(3) }));
    expect(container.querySelector('.waiting')?.textContent).toMatch(/sent 3 days ago/i);
  });

  it('reads naturally on the first day', () => {
    const { container } = renderWorkflow(entry({ status: 'submitted', submittedAt: daysAgo(0) }));
    expect(container.querySelector('.waiting')?.textContent).toMatch(/sent today/i);
  });

  it('switches to weeks once days stop being useful', () => {
    const { container } = renderWorkflow(entry({ status: 'submitted', submittedAt: daysAgo(21) }));
    expect(container.querySelector('.waiting')?.textContent).toMatch(/sent 3 weeks ago/i);
  });

  it('marks a long wait as stale, so it stops being quiet', () => {
    const { container } = renderWorkflow(entry({ status: 'submitted', submittedAt: daysAgo(20) }));
    expect(container.querySelector('.waiting')?.classList.contains('stale')).toBe(true);
  });

  it('does not mark a recent request as stale', () => {
    const { container } = renderWorkflow(entry({ status: 'submitted', submittedAt: daysAgo(2) }));
    expect(container.querySelector('.waiting')?.classList.contains('stale')).toBe(false);
  });

  it('shows no age for a broker that was never submitted', () => {
    const { container } = renderWorkflow(entry());
    expect(container.querySelector('.waiting')).toBeNull();
  });
});

describe('moving between states', () => {
  it('offers the three steps of a real opt-out', () => {
    const { getByText } = renderWorkflow(entry());
    expect(getByText('Request sent')).toBeTruthy();
    expect(getByText('Waiting on them')).toBeTruthy();
    expect(getByText('Listing gone')).toBeTruthy();
  });

  it('reports the chosen status to the store', async () => {
    const onSetStatus = vi.fn();
    const { getByText } = renderWorkflow(entry(), { onSetStatus });
    await fireEvent.click(getByText('Request sent'));
    expect(onSetStatus).toHaveBeenCalledWith('submitted');
  });

  it('steps back out when the active state is clicked again', async () => {
    // A mis-click must be recoverable without hunting for an undo.
    const onSetStatus = vi.fn();
    const { getByText } = renderWorkflow(entry({ status: 'submitted' }), { onSetStatus });
    await fireEvent.click(getByText('Request sent'));
    expect(onSetStatus).toHaveBeenCalledWith('not_started');
  });

  it('marks the current state as pressed, for screen readers as well as sighted users', () => {
    const { getByRole } = renderWorkflow(entry({ status: 'awaiting_verification' }));
    const active = getByRole('button', { name: /Waiting on them/ });
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: /Listing gone/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('groups the steps under the broker name', () => {
    const { getByRole } = renderWorkflow(entry());
    expect(getByRole('group', { name: /Acme Data/ })).toBeTruthy();
  });
});

describe('notes', () => {
  it('reports typed notes to the store', async () => {
    const onSetNote = vi.fn();
    const { container } = renderWorkflow(entry(), { onSetNote });
    const box = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(box, { target: { value: 'ref #12345' } });
    expect(onSetNote).toHaveBeenCalledWith('ref #12345');
  });

  it('shows a note that was already saved', () => {
    const { container } = renderWorkflow(entry({ note: 'they wanted a photo ID' }));
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'they wanted a photo ID',
    );
  });

  it('repeats the on-device promise next to the field', () => {
    // The note field invites confirmation numbers and reference IDs, so the storage promise
    // has to travel with the ask.
    const { container } = renderWorkflow(entry());
    expect(container.querySelector('.note-privacy')?.textContent).toMatch(/stays on this device/i);
  });
});
