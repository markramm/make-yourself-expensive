<script lang="ts">
  /**
   * The per-broker workflow: submit, verify, wait, confirm.
   *
   * A beta tester who had done a manual purge described why a checkbox is not enough:
   *
   *   "Then there were the sites that would not tell you that they have accepted the opt out
   *    for several days. This makes it difficult to do each site serially (Be done with site A
   *    before starting on site B.. etc)"
   *
   * The brokers make serial work impossible, so a reader necessarily has many requests
   * outstanding at once. This component exists so "sent, still waiting" is a state the tool
   * can hold, and so a confirmation number has somewhere to live.
   *
   * Collapsed by default. Most people will tick the checkbox and never open this, and forcing
   * a four-step workflow on someone who just wants to mark a row done would be worse than the
   * binary it replaces. It opens automatically once a request is in flight, because at that
   * point the extra state is the whole point.
   */
  import type { BrokerProgress, OptOutStatus } from '../../stores/progress';
  import { isInFlight } from '../../stores/progress';

  export let brokerName: string;
  export let brokerId: string;
  export let progress: BrokerProgress;
  export let onSetStatus: (status: OptOutStatus) => void;
  export let onSetNote: (note: string) => void;

  const STEPS: { status: OptOutStatus; label: string; hint: string }[] = [
    {
      status: 'submitted',
      label: 'Request sent',
      hint: 'You submitted the form or sent the email.',
    },
    {
      status: 'awaiting_verification',
      label: 'Waiting on them',
      hint: 'Verification link clicked, or the form accepted — now it is their turn.',
    },
    {
      status: 'confirmed',
      label: 'Listing gone',
      hint: 'You searched again and your record is no longer there.',
    },
  ];

  const detailsId = `workflow-${brokerId}`;

  $: inFlight = isInFlight(progress);
  // Open when there is something to see. Once a request is outstanding the status IS the
  // information the reader came back for.
  $: open = inFlight || progress.note.length > 0;

  /** Whole days since submission -- the "sent three weeks ago, still nothing" signal. */
  $: waitingDays = progress.submittedAt
    ? Math.floor((Date.now() - new Date(progress.submittedAt).getTime()) / 86_400_000)
    : null;

  function describeWait(days: number): string {
    if (days <= 0) return 'sent today';
    if (days === 1) return 'sent yesterday';
    if (days < 14) return `sent ${days} days ago`;
    const weeks = Math.floor(days / 7);
    return `sent ${weeks} weeks ago`;
  }

  // Clicking the step you are already on steps back out of it, so a mis-click is recoverable
  // without hunting for an "undo".
  function choose(status: OptOutStatus) {
    onSetStatus(progress.status === status ? 'not_started' : status);
  }
</script>

<details class="workflow" {open}>
  <summary>
    Track this one
    {#if inFlight && waitingDays !== null}
      <span class="waiting" class:stale={waitingDays >= 14}>{describeWait(waitingDays)}</span>
    {/if}
  </summary>

  <div class="workflow-body" id={detailsId}>
    <ul class="steps" role="group" aria-label="Opt-out progress for {brokerName}">
      {#each STEPS as step (step.status)}
        <li>
          <button
            type="button"
            class="step"
            class:active={progress.status === step.status}
            aria-pressed={progress.status === step.status}
            on:click={() => choose(step.status)}
          >
            <span class="step-label">{step.label}</span>
            <span class="step-hint">{step.hint}</span>
          </button>
        </li>
      {/each}
    </ul>

    <label class="note-field">
      <span class="note-label">Notes — confirmation number, what they asked for, anything else</span>
      <textarea
        rows="2"
        value={progress.note}
        placeholder="e.g. ref #12345, they wanted a photo ID"
        on:input={(e) => onSetNote((e.currentTarget as HTMLTextAreaElement).value)}
      ></textarea>
    </label>
    <p class="note-privacy">Stays on this device, like everything else here.</p>
  </div>
</details>

<style>
  .workflow {
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }
  summary {
    cursor: pointer;
    color: var(--graphite, #6b6459);
    font-size: 0.8rem;
  }
  .waiting {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    margin-left: 0.4rem;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 2px;
  }
  /* Two weeks with no reply is worth chasing, so it stops being quiet. */
  .waiting.stale {
    border-color: var(--seal, #8a1c1c);
    color: var(--seal, #8a1c1c);
  }
  .workflow-body {
    margin-top: 0.5rem;
    padding-left: 0.6rem;
    border-left: 2px solid var(--rule, #c9c1b2);
  }
  .steps {
    list-style: none;
    margin: 0 0 0.6rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    padding: 0.35rem 0.5rem;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  .step:hover,
  .step:focus-visible {
    border-color: var(--seal, #8a1c1c);
  }
  .step.active {
    border-color: var(--seal, #8a1c1c);
    background: color-mix(in srgb, var(--seal, #8a1c1c) 10%, transparent);
  }
  .step-label {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .step-hint {
    font-size: 0.75rem;
    color: var(--graphite, #6b6459);
    line-height: 1.35;
  }
  .note-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .note-label {
    font-size: 0.75rem;
    color: var(--graphite, #6b6459);
  }
  textarea {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    resize: vertical;
    width: 100%;
    max-width: 30rem;
  }
  .note-privacy {
    margin: 0.25rem 0 0;
    font-size: 0.72rem;
    color: var(--graphite, #6b6459);
  }
</style>
