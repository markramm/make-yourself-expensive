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
  onMount(() => titleEl?.focus());

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="backdrop" role="presentation" on:click={onCancel}>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="guardrail-title" on:click|stopPropagation>
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
    background: var(--seal, #8a1c1c);
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
