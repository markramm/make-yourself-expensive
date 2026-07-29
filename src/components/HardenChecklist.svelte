<script lang="ts">
  import type { HardenItem } from '../lib/harden/checklists';
  import { hardenProgressStore, isHardenItemDone } from '../stores/hardenProgress';

  export let device: string;
  export let title: string;
  export let items: HardenItem[];
  // When true (used on the standalone /harden/checklist page), shows the device name as a
  // heading -- when embedded at the end of an article, the article's own <h1> already says
  // the device, so the heading would be redundant.
  export let showDeviceHeading = false;

  $: baseline = items.filter((i) => i.tier === 'baseline');
  $: higherRisk = items.filter((i) => i.tier === 'higher-risk');
  $: doneCount = items.filter((i) => isHardenItemDone($hardenProgressStore, i.id)).length;
</script>

<div class="checklist">
  {#if showDeviceHeading}
    <h2>{title}</h2>
  {/if}
  <p class="tally">{doneCount}/{items.length} done</p>

  {#if baseline.length > 0}
    <ul class="items">
      {#each baseline as item (item.id)}
        <li>
          <label>
            <input
              type="checkbox"
              checked={isHardenItemDone($hardenProgressStore, item.id)}
              on:change={() => hardenProgressStore.toggle(item.id)}
            />
            <span class="item-text">
              <span class="item-label">{item.label}</span>
              {#if item.path}<span class="item-path">{item.path}</span>{/if}
            </span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}

  {#if higherRisk.length > 0}
    <p class="higher-risk-heading">If you're higher-risk (organizers, immigrants, journalists)</p>
    <ul class="items">
      {#each higherRisk as item (item.id)}
        <li>
          <label>
            <input
              type="checkbox"
              checked={isHardenItemDone($hardenProgressStore, item.id)}
              on:change={() => hardenProgressStore.toggle(item.id)}
            />
            <span class="item-text">
              <span class="item-label">{item.label}</span>
              {#if item.path}<span class="item-path">{item.path}</span>{/if}
            </span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .checklist {
    margin: 1.5rem 0;
  }
  h2 {
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--rule, #c9c1b2);
    padding-bottom: 0.3rem;
  }
  .tally {
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--graphite, #6b6459);
    margin: 0.25rem 0 0.75rem;
  }
  .higher-risk-heading {
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--seal, #8a1c1c);
    margin: 1.25rem 0 0.5rem;
  }
  .items {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .items li {
    border-bottom: 1px solid var(--rule, #c9c1b2);
  }
  .items li:last-child {
    border-bottom: none;
  }
  label {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.6rem 0.1rem;
    cursor: pointer;
  }
  input[type='checkbox'] {
    margin-top: 0.2rem;
    width: 1.1rem;
    height: 1.1rem;
    flex: none;
    accent-color: var(--seal, #8a1c1c);
    cursor: pointer;
  }
  .item-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .item-label {
    font-size: 0.95rem;
  }
  .item-path {
    font-family: 'Courier New', monospace;
    font-size: 0.78rem;
    color: var(--graphite, #6b6459);
  }
</style>
