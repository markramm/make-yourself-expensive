<script lang="ts">
  import { onMount } from 'svelte';
  import type { Broker, DatasetMeta } from '../lib/dataset/fetchAndVerify';
  import { loadDataset } from '../lib/dataset/useDataset';
  import { profileStore } from '../stores/profile';
  import { progressStore, isDone } from '../stores/progress';
  import BrokerRow from './BrokerRow/BrokerRow.svelte';

  const TIER_LABELS: Record<Broker['tier'], string> = {
    auto: 'One-click (email)',
    assisted: 'Assisted (forms)',
    guided: 'Guided (takes longer)',
  };

  let brokers: Broker[] = [];
  let meta: DatasetMeta | null = null;
  // null = not yet loaded / fetch failed (see useDataset.ts's DatasetLoadState) -- the
  // {#if loadError} branch always renders first when null, so the mismatch banner below never
  // shows for a failed fetch, only for a confirmed hash mismatch.
  let verified: boolean | null = true;
  let integrityWarning: { expectedHash: string; actualHash: string } | undefined;
  let loadError: string | null = null;
  let search = '';

  onMount(async () => {
    const result = await loadDataset();
    brokers = result.brokers;
    meta = result.meta;
    verified = result.verified;
    integrityWarning = result.integrityWarning;
    loadError = result.loadError;
  });

  $: filtered = search.trim()
    ? brokers.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()))
    : brokers;

  $: byTier = {
    auto: filtered.filter((b) => b.tier === 'auto'),
    assisted: filtered.filter((b) => b.tier === 'assisted'),
    guided: filtered.filter((b) => b.tier === 'guided'),
  };

  function tallyFor(list: Broker[], progress: Record<string, { done: boolean }>) {
    const done = list.filter((b) => isDone(progress, b.id)).length;
    return { done, total: list.length };
  }
</script>

{#if loadError}
  <p class="error">Couldn't load the broker list: {loadError}</p>
{:else if !verified}
  <div class="integrity-banner" role="alert">
    This dataset doesn't match the version this build expects. Opt-out links have not been
    re-verified against the pinned release — proceed with normal caution, or check the
    <a href="https://github.com/" target="_blank" rel="noopener noreferrer">releases page</a> for
    the current signed release.
  </div>
{/if}

{#if $profileStore.isCaliforniaResident}
  <div class="ca-banner">
    California residents can also use the state's free
    <a href="https://privacy.ca.gov/" target="_blank" rel="noopener noreferrer">DROP tool</a>,
    which covers many of these brokers in one request.
  </div>
{/if}

<div class="guide-callout">
  <p>
    {meta?.authored_count ?? 'This many'} brokers is a lot to look at once. <a href="/brokers/guide/">Work
    through them a few at a time</a> instead — sensible order, one sitting at a time.
  </p>
</div>

<div class="harden-callout">
  <p>
    Opting out cleans up data already collected. <a href="/harden/">Hardening your devices</a>
    slows down what gets collected next.
  </p>
</div>

<input class="search" type="search" placeholder="Search brokers…" bind:value={search} />

{#each ['auto', 'assisted', 'guided'] as const as tier}
  {@const list = byTier[tier]}
  {#if list.length > 0}
    {@const tally = tallyFor(list, $progressStore)}
    <section>
      <h2>{TIER_LABELS[tier]} <span class="tally">{tally.done}/{tally.total}</span></h2>
      {#each list as broker (broker.id)}
        <BrokerRow
          {broker}
          profile={$profileStore}
          progress={$progressStore[broker.id] ?? { done: false, doneAt: null }}
          onToggle={() => progressStore.toggle(broker.id)}
        />
      {/each}
    </section>
  {/if}
{/each}

{#if meta}
  <p class="coverage-note">
    {meta.authored_count} of {meta.total_known} known brokers have a full opt-out entry so far
    ({meta.backlog_count} more tracked, not yet researched).
  </p>
{/if}

<style>
  .error {
    color: var(--seal);
  }
  .integrity-banner {
    background: var(--seal);
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .integrity-banner a {
    color: white;
  }
  .ca-banner {
    background: transparent;
    border: 1px solid var(--rule);
    padding: 0.6rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .guide-callout {
    background: color-mix(in srgb, var(--seal) 8%, transparent);
    border: 1px solid var(--seal);
    border-radius: 4px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
  .guide-callout p {
    margin: 0;
  }
  .guide-callout a {
    color: var(--seal);
    font-weight: 600;
  }
  .harden-callout {
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
  .harden-callout p {
    margin: 0;
    color: var(--graphite);
  }
  .harden-callout a {
    color: var(--ink);
    font-weight: 600;
  }
  .search {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    margin-bottom: 1.5rem;
  }
  h2 {
    display: flex;
    justify-content: space-between;
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 0.3rem;
  }
  .tally {
    font-weight: normal;
  }
  .coverage-note {
    font-size: 0.8rem;
    color: var(--graphite);
    margin-top: 2rem;
  }
</style>
