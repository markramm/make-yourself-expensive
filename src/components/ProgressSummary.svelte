<script lang="ts">
  import { onMount } from 'svelte';
  import { loadDataset } from '../lib/dataset/useDataset';
  import { progressStore, isDone } from '../stores/progress';
  import { hardenProgressStore, isHardenItemDone } from '../stores/hardenProgress';
  import { HARDEN_CHECKLISTS } from '../lib/harden/checklists';

  let brokerTotal = 0;
  let loaded = false;

  onMount(async () => {
    const result = await loadDataset();
    brokerTotal = result.brokers.length;
    loaded = true;
  });

  const hardenItemIds = HARDEN_CHECKLISTS.flatMap((guide) => guide.items.map((item) => item.id));
  const hardenTotal = hardenItemIds.length;

  $: brokerDone = Object.values($progressStore).filter((p) => p.done).length;
  $: hardenDone = hardenItemIds.filter((id) => isHardenItemDone($hardenProgressStore, id)).length;
</script>

{#if loaded}
  <div class="progress-summary">
    <div class="stat">
      <span class="count">{brokerDone}<span class="of">/{brokerTotal}</span></span>
      <span class="label">brokers opted out of</span>
    </div>
    <div class="stat">
      <span class="count">{hardenDone}<span class="of">/{hardenTotal}</span></span>
      <span class="label">hardening steps done</span>
    </div>
    <p class="note">Counted on this device only. Never sent anywhere.</p>
  </div>
{/if}

<style>
  .progress-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem 2.5rem;
    align-items: baseline;
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 1rem 1.25rem;
    margin: 1.5rem 0;
  }
  .stat {
    display: flex;
    flex-direction: column;
  }
  .count {
    font-family: 'Courier New', monospace;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--seal);
  }
  .count .of {
    color: var(--graphite);
    font-weight: 400;
    font-size: 1.1rem;
  }
  .label {
    font-size: 0.85rem;
    color: var(--graphite);
  }
  .note {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.78rem;
    color: var(--graphite);
  }
</style>
