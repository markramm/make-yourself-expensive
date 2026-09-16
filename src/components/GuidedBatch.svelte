<script lang="ts">
  import { onMount } from 'svelte';
  import type { Broker, DatasetMeta } from '../lib/dataset/fetchAndVerify';
  import { loadDataset } from '../lib/dataset/useDataset';
  import { nextBatch, batchFromIds, type Batch } from '../lib/batching/nextBatch';
  import { profileStore } from '../stores/profile';
  import { progressStore, isDone, EMPTY_PROGRESS } from '../stores/progress';
  import { currentBatchIds } from '../stores/currentBatch';
  import BrokerRow from './BrokerRow/BrokerRow.svelte';

  let brokers: Broker[] = [];
  let meta: DatasetMeta | null = null;
  let loadError: string | null = null;
  let loaded = false;

  // The batch's ITEM SET is captured once when a batch starts and held stable -- only
  // completion state (read live from progressStore) changes within it. Recomputing
  // nextBatch() reactively on every progress change would make a checked-off item vanish
  // and the batch silently reshuffle underneath the reader mid-task, instead of letting them
  // see "2/5 done" tick up toward a real finish line.
  let currentBatch: Batch | null = null;

  // Counts completed levels this session -- purely a celebratory number, not persisted;
  // if someone reloads mid-way it just starts counting from 1 again, no real state lost
  // since the underlying source of truth is still progressStore.
  let levelsThisSession = 0;
  let showLevelUp = false;

  onMount(async () => {
    const result = await loadDataset();
    brokers = result.brokers;
    meta = result.meta;
    loadError = result.loadError;
    loaded = true;
  });

  // Resumes an in-progress batch from its persisted id set (survives a reload -- the exact
  // "got pulled away mid-task" scenario this flow is designed for), or starts a fresh one
  // and persists ITS ids, so the item set stays stable and reload-proof once chosen. Only
  // runs when there isn't already a batch loaded in this component instance.
  $: if (loaded && currentBatch === null && brokers.length > 0) {
    const persistedIds = $currentBatchIds;
    const resumed = persistedIds ? batchFromIds(brokers, persistedIds, $progressStore) : null;
    if (resumed) {
      currentBatch = resumed;
    } else {
      currentBatch = nextBatch(brokers, $progressStore);
      currentBatchIds.set(currentBatch?.items.map((b) => b.id) ?? null);
    }
  }

  // What kind of work this batch actually is, in the same words the full list's tier headings
  // use. Batches are built by value x ease (lib/batching/nextBatch.ts), so an early batch is
  // usually all one tier -- naming it is the difference between "seven identical buttons" and
  // "seven emails to send."
  // Matches the full list's tier names (see BrokerList.svelte) -- "guided" is deliberately not
  // used as a tier word anywhere now, since it names this page.
  const TIER_LABELS: Record<Broker['tier'], string> = {
    auto: 'one-click email',
    assisted: 'a form to fill in',
    guided: 'manual, step-by-step',
  };

  $: batchKindSummary = currentBatch
    ? (() => {
        const counts = new Map<Broker['tier'], number>();
        for (const b of currentBatch.items) counts.set(b.tier, (counts.get(b.tier) ?? 0) + 1);
        const parts = (['auto', 'assisted', 'guided'] as const)
          .filter((t) => counts.has(t))
          .map((t) => `${counts.get(t)} × ${TIER_LABELS[t]}`);
        return parts.join(' · ');
      })()
    : '';

  $: batchDoneCount = currentBatch
    ? currentBatch.items.filter((b) => isDone($progressStore, b.id)).length
    : 0;
  $: batchAllDone = currentBatch !== null && batchDoneCount === currentBatch.items.length;

  function continueToNextLevel() {
    levelsThisSession += 1;
    showLevelUp = false;
    currentBatch = null; // clears to trigger picking up a fresh batch on the next render
    currentBatchIds.clear();
  }

  let levelUpHeading: HTMLHeadingElement | undefined;

  $: if (currentBatch !== null && batchAllDone && !showLevelUp) {
    showLevelUp = true;
  }

  // Moves focus to the level-up heading once it's actually in the DOM, so a screen-reader or
  // keyboard user isn't left on a checkbox that just disappeared -- afterUpdate would fire too
  // early (before the {#if} block renders it), so this reacts off showLevelUp directly.
  $: if (showLevelUp && levelUpHeading) {
    levelUpHeading.focus();
  }
</script>

{#if loadError}
  <p class="error">Couldn't load the broker list: {loadError}</p>
{:else if !loaded}
  <p class="loading">Loading…</p>
{:else if currentBatch === null}
  <div class="all-clear">
    <h2>Every authored broker is marked done.</h2>
    <p>
      That's the full {meta?.authored_count ?? ''} researched so far. More get added as we
      verify them — check back, or browse the
      <a href="/brokers">full list</a> to revisit anything.
    </p>
  </div>
{:else if showLevelUp}
  <div class="level-up" aria-live="polite">
    <h2 bind:this={levelUpHeading} tabindex="-1">Level {levelsThisSession + 1} cleared.</h2>
    <p>
      {currentBatch.remainingAfterBatch > 0
        ? `${currentBatch.remainingAfterBatch} more to go after this next one.`
        : "That's everything researched so far."}
    </p>
    <button class="continue-btn" on:click={continueToNextLevel}>
      {currentBatch.remainingAfterBatch > 0 ? 'Start the next batch →' : 'See the full list →'}
    </button>
  </div>
{:else}
  <div class="batch-header">
    <div class="progress-line">
      <span class="progress-label">This batch</span>
      <span class="progress-count">{batchDoneCount}/{currentBatch.items.length}</span>
    </div>
    <!-- The full list groups rows under a tier heading ("One-click (email)"), which tells the
         reader what KIND of work is in front of them. The guided view dropped that, so a batch
         of email-only brokers looked like an unexplained wall of identical buttons. -->
    <p class="batch-kinds">{batchKindSummary}</p>
    <div class="progress-bar" role="progressbar" aria-valuenow={batchDoneCount} aria-valuemin={0} aria-valuemax={currentBatch.items.length}>
      <div class="progress-fill" style="width: {(batchDoneCount / currentBatch.items.length) * 100}%"></div>
    </div>
  </div>

  {#each currentBatch.items as broker (broker.id)}
    <BrokerRow
      {broker}
      profile={$profileStore}
      progress={$progressStore[broker.id] ?? EMPTY_PROGRESS}
      onToggle={() => progressStore.toggle(broker.id)}
      onSetStatus={(status) => progressStore.setStatus(broker.id, status)}
      onSetNote={(note) => progressStore.setNote(broker.id, note)}
    />
  {/each}

  <!-- Moved below the batch. At the top, the first concrete number a new arrival read was
       "486 more after this one" -- the size of the backlog, before they had done anything.
       After the rows it answers "what happens when I finish these?" instead. -->
  {#if currentBatch.remainingAfterBatch > 0}
    <p class="remaining-note">{currentBatch.remainingAfterBatch} more after this one.</p>
  {/if}
{/if}

<style>
  .error {
    color: var(--seal);
  }
  .loading {
    color: var(--graphite);
  }
  .all-clear,
  .level-up {
    text-align: center;
    padding: 2.5rem 1rem;
  }
  .all-clear h2,
  .level-up h2 {
    font-family: 'Courier New', monospace;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 1.1rem;
  }
  .level-up h2:focus-visible {
    outline: none;
  }
  .all-clear p,
  .level-up p {
    color: var(--graphite);
    max-width: 28rem;
    margin: 0.5rem auto 1.5rem;
  }
  .continue-btn {
    background: var(--seal-surface);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }
  .continue-btn:hover {
    opacity: 0.9;
  }
  .batch-header {
    margin-bottom: 1.5rem;
  }
  .progress-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.4rem;
  }
  .progress-bar {
    height: 0.5rem;
    background: var(--rule);
    border-radius: 999px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--seal-surface);
    border-radius: 999px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .progress-fill {
      transition: width 0.3s ease;
    }
  }
  .remaining-note {
    font-size: 0.8rem;
    color: var(--graphite);
    margin: 0.5rem 0 0;
  }
  .batch-kinds {
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    color: var(--graphite);
    margin: 0 0 0.5rem;
  }
</style>
