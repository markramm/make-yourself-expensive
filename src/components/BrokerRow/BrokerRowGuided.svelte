<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';

  export let broker: Broker;

  const instructionsId = `guided-instructions-${broker.id}`;

  // Guided-tier brokers are the highest-friction ones (CAPTCHA, ID, phone) -- the steps are
  // expanded by default so a reader sees them BEFORE clicking away to the opt-out page, not
  // hidden below a toggle they'd only notice after already leaving. Still collapsible, since
  // a 108-entry section needs a way to compact back down once a row's been read.
  let expanded = true;

  // instructions_md is authored plain markdown (numbered lists, plain links) -- a minimal
  // line-based renderer is enough here without pulling in a full markdown parser dependency.
  // Escape BEFORE extracting links, and escape quotes too -- a dataset entry containing
  // [x](https://a.com/" onmouseover="...) would otherwise break out of the href attribute.
  // The registry repo's review + hash pin make smuggling this through genuinely hard, but
  // "verifiable safety" is the whole pitch, so this is defense in depth, not the only layer.
  function renderInstructions(md: string): string {
    return md
      .split('\n')
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        return escaped.replace(
          /\[([^\]]+)\]\((https?:\/\/[^)"]+)\)/g,
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

  {#if !broker.opt_out_url && broker.phone}
    <span class="phone">Call {broker.phone}</span>
  {/if}

  <button
    class="toggle"
    on:click={() => (expanded = !expanded)}
    aria-expanded={expanded}
    aria-controls={instructionsId}
  >
    {expanded ? 'Hide steps' : 'Show steps'}
  </button>

  {#if expanded}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div id={instructionsId} class="instructions">{@html renderInstructions(broker.instructions_md)}</div>
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
  .phone {
    font-size: 0.9rem;
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
    background: color-mix(in srgb, var(--rule, #c9c1b2) 25%, transparent);
    border-radius: 4px;
    padding: 0.6rem 0.75rem;
  }
</style>
