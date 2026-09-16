<script lang="ts">
  import { onMount } from 'svelte';
  import type { Broker, DatasetMeta } from '../lib/dataset/fetchAndVerify';
  import { loadDataset } from '../lib/dataset/useDataset';
  import { profileStore } from '../stores/profile';
  import { progressStore, isDone, EMPTY_PROGRESS } from '../stores/progress';
  import { profileIsEmpty } from '../lib/profile/isEmpty';
  import BrokerRow from './BrokerRow/BrokerRow.svelte';

  // "Guided" previously named BOTH this difficulty tier and the batch flow at /brokers/guide/,
  // so someone who clicked "Work through them a few at a time" and landed on "Guided opt-out"
  // could reasonably expect the 270 guided-tier brokers. The tier is renamed rather than the
  // route: /brokers/guide/ is already linked from the homepage, the harden index and the
  // published field guide, and breaking those is a worse cost than a label change.
  const TIER_LABELS: Record<Broker['tier'], string> = {
    auto: 'One-click (email)',
    assisted: 'Assisted (forms)',
    guided: 'Manual (takes longer)',
  };

  let brokers: Broker[] = [];
  let meta: DatasetMeta | null = null;
  // null = not yet loaded / fetch failed (see useDataset.ts's DatasetLoadState). Starts null
  // rather than true: the dataset hasn't been checked yet on first render, and claiming
  // "verified" before the hash is computed is exactly the assurance this tool must not give
  // on faith. The banner below tests `verified === false` explicitly so that this in-between
  // state shows no banner either way -- an unverified-yet dataset is not a mismatch, and a
  // failed fetch renders the loadError branch first regardless.
  let verified: boolean | null = null;
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

  // Drives the "your profile is empty, that's why these are greyed out" hint below. The
  // predicate lives in lib/profile/isEmpty.ts so it can be unit-tested directly -- see that
  // file for why dob doesn't count toward a profile being non-empty.
  $: isProfileEmpty = profileIsEmpty($profileStore);
</script>

{#if loadError}
  <p class="error">Couldn't load the broker list: {loadError}</p>
{:else if verified === false}
  <div class="integrity-banner" role="alert">
    This dataset doesn't match the version this build expects. Opt-out links have not been
    re-verified against the pinned release — proceed with normal caution, or check the
    <a
      href="https://github.com/markramm/data-broker-registry/releases"
      target="_blank"
      rel="noopener noreferrer">releases page</a
    > for the current signed release.
  </div>
{/if}

{#if $profileStore.state === 'CA'}
  <div class="ca-banner">
    California residents can also use the state's free
    <a href="https://privacy.ca.gov/" target="_blank" rel="noopener noreferrer">DROP tool</a>,
    which covers many of these brokers in one request.
  </div>
{/if}

<!-- This page is now the SECONDARY path: the nav and homepage lead to /brokers/guide/, which
     picks a sensible batch instead of presenting all of them at once. People still come here
     deliberately -- to search for one broker, or to revisit something already done -- so the
     callout no longer sells the guided flow as an escape hatch from a wall of rows. It says
     what this page is for, and offers the way back. -->
<div class="guide-callout">
  <p>
    Every broker we've researched, all {meta?.authored_count ?? ''} of them — useful for
    finding a specific one or revisiting something you've done.
    <a href="/brokers/guide/">Work through them a few at a time instead →</a>
  </p>
</div>

<!--
  With no profile filled in, every "copy" button in the assisted rows renders disabled -- 346
  of them on the current dataset. The homepage explains that profile-less rows come up blank,
  but by the time someone is looking at the list, that sentence is two pages behind them, and
  a wall of greyed-out buttons reads as broken rather than as "not set up yet." Say it once,
  here, where the disabled buttons actually are.
-->
{#if isProfileEmpty}
  <p class="profile-hint">
    The copy buttons below fill from your profile, which is empty — so they're greyed out.
    <a href="/profile">Fill in your profile</a> to switch them on, or work the email-only brokers
    in “One-click (email)” below, which don't need it.
  </p>
{/if}

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
          progress={$progressStore[broker.id] ?? EMPTY_PROGRESS}
          onToggle={() => progressStore.toggle(broker.id)}
          onSetStatus={(status) => progressStore.setStatus(broker.id, status)}
          onSetNote={(note) => progressStore.setNote(broker.id, note)}
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

<!-- Moved down from above the list. As the second of two stacked callouts it was advertising a
     different section of the site before the reader had engaged with this one; at the end it
     reads as a next step instead of an interruption. -->
<div class="harden-callout">
  <p>
    Opting out cleans up data already collected. <a href="/harden/">Hardening your devices</a>
    slows down what gets collected next.
  </p>
</div>

<style>
  .error {
    color: var(--seal);
  }
  .integrity-banner {
    background: var(--seal-surface);
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
    margin-top: 1.5rem;
    font-size: 0.9rem;
  }
  .profile-hint {
    font-size: 0.9rem;
    color: var(--graphite);
    max-width: 34rem;
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }
  .profile-hint a {
    color: var(--seal);
    font-weight: 600;
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
    /* Shrinking the font inside a fixed-width container pushes the measure out past the
       comfortable reading range. The cap is in `ch` rather than `rem` so it tracks this
       block's own smaller font size -- a 34rem cap still measured ~85 characters here. */
    max-width: 68ch;
  }
</style>
