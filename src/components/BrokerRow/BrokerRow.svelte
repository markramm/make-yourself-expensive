<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { Profile } from '../../stores/profile';
  import RowShell from './RowShell.svelte';
  import BrokerRowAuto from './BrokerRowAuto.svelte';
  import BrokerRowAssisted from './BrokerRowAssisted.svelte';
  import BrokerRowGuided from './BrokerRowGuided.svelte';
  import GuardrailModal from '../GuardrailModal.svelte';

  export let broker: Broker;
  export let profile: Profile;
  export let done: boolean;
  export let onToggle: () => void;

  const SENSITIVE_FIELDS = new Set(['ssn', 'gov_id', 'vin']);
  $: hasSensitiveFields = broker.required_fields.some((f) => SENSITIVE_FIELDS.has(f));
  $: needsGuardrail = hasSensitiveFields && !guardrailConfirmed;

  // Only assisted/guided tiers have opt_out_url as their actual action -- auto-tier (email)
  // brokers sometimes carry a URL too (usually just a general privacy-policy page, not an
  // opt-out form), and linking the title there would point the reader at the wrong action.
  $: titleHref = needsGuardrail || broker.tier === 'auto' ? null : broker.opt_out_url;

  let guardrailConfirmed = false;
  let showGuardrail = false;

  function requestAction() {
    if (hasSensitiveFields && !guardrailConfirmed) {
      showGuardrail = true;
    }
  }
</script>

<RowShell {broker} {done} {onToggle} href={titleHref}>
  {#if needsGuardrail}
    <button class="reveal-action" on:click={requestAction}>Continue (sensitive info required)</button>
  {:else if broker.tier === 'auto'}
    <BrokerRowAuto {broker} {profile} />
  {:else if broker.tier === 'assisted'}
    <BrokerRowAssisted {broker} {profile} />
  {:else}
    <BrokerRowGuided {broker} />
  {/if}
</RowShell>

{#if showGuardrail}
  <GuardrailModal
    {broker}
    onConfirm={() => {
      guardrailConfirmed = true;
      showGuardrail = false;
    }}
    onCancel={() => (showGuardrail = false)}
  />
{/if}

<style>
  .reveal-action {
    font-size: 0.85rem;
    border: 1px solid var(--seal, #8a1c1c);
    color: var(--seal, #8a1c1c);
    background: transparent;
    padding: 0.3rem 0.6rem;
    border-radius: 3px;
    cursor: pointer;
  }
</style>
