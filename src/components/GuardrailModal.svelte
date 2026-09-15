<script lang="ts">
  import { onMount } from 'svelte';
  import type { Broker } from '../lib/dataset/fetchAndVerify';

  export let broker: Broker;
  export let onConfirm: () => void;
  export let onCancel: () => void;

  const SENSITIVE_FIELDS = new Set(['ssn', 'gov_id', 'vin']);
  $: sensitiveFields = broker.required_fields.filter((f) => SENSITIVE_FIELDS.has(f));

  const FIELD_LABELS: Record<string, string> = {
    ssn: 'Social Security Number (or last 4 digits)',
    gov_id: "government ID (e.g. driver's license photo)",
    vin: 'vehicle identification number',
  };

  let titleEl: HTMLHeadingElement;
  let modalEl: HTMLDivElement;

  // Whatever had focus when this modal opened -- captured before we move focus into the
  // dialog, so it can be handed back on close. Without this, dismissing the modal drops focus
  // to the top of the document and a keyboard user has to tab back through the whole page to
  // reach the row they were on. The trigger is the "Continue (sensitive info required)" button
  // in BrokerRow, which stays in the DOM while the modal is open.
  let previouslyFocused: HTMLElement | null = null;

  onMount(() => {
    previouslyFocused = document.activeElement as HTMLElement | null;
    titleEl?.focus();
    return () => {
      // Guard isConnected: the trigger can be gone by the time we unmount (the row
      // re-rendered, or confirming replaced the button with the tier-specific action), and
      // focusing a detached node silently does nothing while looking like it worked.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  });

  function focusableElements(): HTMLElement[] {
    if (!modalEl) return [];
    return Array.from(
      modalEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  // Basic focus trap: Tab/Shift+Tab wrap within the modal instead of walking out into the
  // page behind it -- this is a real modal blocking a decision about sensitive data, not a
  // dismissable tooltip, so keyboard focus should never silently escape it.
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = focusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    // Focus opens on the HEADING, which is tabindex="-1" and so deliberately absent from
    // focusableElements(). The previous version only wrapped when focus was already on the
    // first or last control, so Shift+Tab from that opening position matched neither branch
    // and walked straight out into the page behind the modal -- past the backdrop, into a
    // dialog the reader believes is blocking them. Anything inside the dialog that is not a
    // listed control (the heading, the modal container) has to wrap too.
    const insideTrap = active !== null && focusable.includes(active);
    if (!insideTrap) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Clicking the backdrop dismisses, which is a mouse convenience only. The keyboard route
     out is Escape, handled on svelte:window above -- it works from anywhere in the modal, so
     it is strictly better than a handler bound to this element, which would require tabbing
     to a presentational div first. The keydown here exists so the behaviour is declared on
     the element the compiler checks, not to introduce a second, worse escape route. -->
<div
  class="backdrop"
  role="presentation"
  on:click={onCancel}
  on:keydown={(e) => e.key === 'Escape' && onCancel()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- This click handler is a sink, not a control: its whole job is to stop clicks inside the
       dialog from reaching the backdrop's dismiss above. There is no action to reach by
       keyboard, so satisfying the rule would mean inventing a keydown handler that does
       nothing -- worse for a screen-reader user than the suppression. The dialog's real
       keyboard contract (Escape to cancel, Tab wrapping inside the modal) lives in
       handleKeydown on svelte:window and is covered by __tests__/GuardrailModal.a11y.test.ts. -->
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="guardrail-title"
    tabindex="-1"
    bind:this={modalEl}
    on:click|stopPropagation
  >
    <h2 id="guardrail-title" bind:this={titleEl} tabindex="-1">Before you continue with {broker.name}</h2>
    <p>
      This broker's process asks for sensitive information most opt-outs don't require:
    </p>
    <ul>
      {#each sensitiveFields as field}
        <li>{FIELD_LABELS[field] ?? field}</li>
      {/each}
    </ul>
    <p>
      Decide whether you're comfortable providing this before continuing — we can't verify how
      {broker.name} stores or protects it once submitted.
    </p>
    <div class="actions">
      <button class="cancel" on:click={onCancel}>Not right now</button>
      <button class="confirm" on:click={onConfirm}>I understand, continue</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--paper, #ede9e0);
    color: var(--ink, #16130e);
    max-width: 32rem;
    padding: 1.5rem;
    border-radius: 4px;
    border: 1px solid var(--rule, #c9c1b2);
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  .confirm {
    background: var(--seal-surface, #8a1c1c);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 3px;
    cursor: pointer;
  }
  .cancel {
    background: transparent;
    border: 1px solid var(--rule, #c9c1b2);
    padding: 0.5rem 1rem;
    border-radius: 3px;
    cursor: pointer;
  }
  #guardrail-title:focus-visible {
    outline: none;
  }
</style>
