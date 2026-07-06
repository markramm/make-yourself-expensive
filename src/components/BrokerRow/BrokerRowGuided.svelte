<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';

  export let broker: Broker;

  let expanded = false;

  // instructions_md is authored plain markdown (numbered lists, plain links) -- a minimal
  // line-based renderer is enough here without pulling in a full markdown parser dependency.
  function renderInstructions(md: string): string {
    return md
      .split('\n')
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return escaped.replace(
          /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        );
      })
      .join('<br />');
  }
</script>

<div class="guided-action">
  <div class="flags">
    {#if broker.captcha}<span class="flag">CAPTCHA</span>{/if}
    {#if broker.id_required}<span class="flag">ID required</span>{/if}
    {#if broker.phone_required}<span class="flag">phone call required</span>{/if}
    {#if broker.charges_fee}<span class="flag">charges a fee</span>{/if}
  </div>

  {#if broker.opt_out_url}
    <a href={broker.opt_out_url} target="_blank" rel="noopener noreferrer" class="open-link">
      Open opt-out page ↗
    </a>
  {:else if broker.phone}
    <span class="phone">Call {broker.phone}</span>
  {/if}

  <button class="toggle" on:click={() => (expanded = !expanded)}>
    {expanded ? 'Hide steps' : 'Show steps'}
  </button>

  {#if expanded}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="instructions">{@html renderInstructions(broker.instructions_md)}</div>
  {/if}
</div>

<style>
  .guided-action {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: flex-start;
  }
  .flags {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .flag {
    font-size: 0.7rem;
    text-transform: uppercase;
    border: 1px solid var(--rule, #c9c1b2);
    color: var(--graphite, #6b6459);
    padding: 0.1rem 0.35rem;
    border-radius: 2px;
  }
  .toggle {
    font-size: 0.85rem;
    background: transparent;
    border: none;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }
  .instructions {
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 34rem;
  }
</style>
