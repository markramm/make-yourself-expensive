<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import { routeReportUrl } from '../../lib/reportLink';

  export let broker: Broker;

  const instructionsId = `guided-instructions-${broker.id}`;

  // 17 entries (12 of them crucial) have no URL, no email and no phone once an unconfirmed
  // `<verify:>` placeholder is nulled at the dataset boundary. Before normalization the
  // placeholder rendered as a live link to our own 404; after it, the row would show a "Show
  // steps" toggle above nothing at all, which reads as broken rather than as honest. For these
  // rows the written steps ARE the route, so say that in words and keep them open.
  $: hasNoRoute = !broker.opt_out_url && !broker.opt_out_email && !broker.phone;

  // Guided-tier brokers are the highest-friction ones (CAPTCHA, ID, phone) -- the steps are
  // expanded by default so a reader sees them BEFORE clicking away to the opt-out page, not
  // hidden below a toggle they'd only notice after already leaving. Still collapsible, since
  // a 270-entry section needs a way to compact back down once a row's been read.
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

  <!-- Safe to test opt_out_url for truthiness: fetchAndVerify.ts normalizes an unconfirmed
       `<verify:>` placeholder to null before any component sees it. Before that, the
       placeholder string read as truthy and silently hid the phone number on the 7 phone-only
       rows that carry one -- exactly the rows where the number IS the opt-out route. -->
  {#if !broker.opt_out_url && broker.phone}
    <span class="phone">Call {broker.phone}</span>
  {/if}

  {#if hasNoRoute}
    <div class="no-route">
      <p class="no-route-lead">
        {#if broker.route_unconfirmed}
          We could not confirm where this broker's opt-out lives. The steps below are our best
          current understanding, and they may be incomplete.
        {:else}
          This broker publishes no opt-out link, email, or phone number. The steps below are the
          whole route.
        {/if}
      </p>
      <!-- Most of these rows are bot-blocked or CAPTCHA-gated, and their own instructions say
           so. The previous copy told the reader to "find the form on their own site", which set
           them up to bounce off a challenge page and conclude the tool was wrong. Warn once,
           here, so the friction is expected rather than surprising. -->
      {#if broker.captcha || broker.link_status === 'bot-blocked'}
        <p class="no-route-note">
          This site blocks automated checks, so expect a CAPTCHA or a verification step before
          you can get anywhere.
        </p>
      {/if}
      <p class="no-route-ask">
        <strong>If you find the real opt-out page, that is the single most useful correction
        this project can get.</strong>
        <a href={routeReportUrl(broker)} target="_blank" rel="noopener noreferrer">
          Tell us where it lives →
        </a>
      </p>
    </div>
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
  .no-route {
    font-size: 0.85rem;
    line-height: 1.45;
    max-width: 34rem;
    margin: 0;
    color: var(--graphite, #6b6459);
    border-left: 2px solid var(--seal, #8a1c1c);
    padding-left: 0.6rem;
  }
  .no-route p {
    margin: 0 0 0.4rem;
  }
  .no-route p:last-child {
    margin-bottom: 0;
  }
  .no-route-ask strong {
    color: var(--ink, #16130e);
    font-weight: 600;
  }
  .no-route-ask a {
    color: var(--seal, #8a1c1c);
    font-weight: 600;
    white-space: nowrap;
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
    /* Instruction text carries bare opt-out URLs -- OneTrust request-portal links run to 170+
       characters with no spaces or hyphens to break at. Without this, one of those tokens sets
       the row's minimum width and the whole page scrolls sideways on a phone (515px of scroll
       at a 390px viewport, measured). `anywhere` rather than `break-word` so the long token is
       allowed to influence min-content width as little as possible. */
    overflow-wrap: anywhere;
    background: color-mix(in srgb, var(--rule, #c9c1b2) 25%, transparent);
    border-radius: 4px;
    padding: 0.6rem 0.75rem;
  }
</style>
