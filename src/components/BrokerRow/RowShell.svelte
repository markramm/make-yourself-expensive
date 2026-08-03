<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { BrokerProgress } from '../../stores/progress';
  import { badgeDecisionFor, isRecheckDue } from './badgeContract';

  export let broker: Broker;
  export let progress: BrokerProgress;
  export let onToggle: () => void;
  // The broker's own opt-out page, when one exists. The title IS the primary action --
  // clicking the name opens the opt-out page directly, rather than making the reader hunt
  // for a separately-styled "Open opt-out page" link elsewhere in the row. Phone-only
  // brokers and auto-tier (email) brokers have no URL, so the title stays plain text and
  // the tier-specific action (a phone number, a compose-email button) is the only action.
  export let href: string | null = null;

  $: done = progress.done;
  $: badge = badgeDecisionFor(broker);
  $: recheckDue = isRecheckDue(broker, progress);

  // Announced only after a real toggle (not on initial render) -- an aria-live region that's
  // already populated when the page loads doesn't get read by most screen readers; it has to
  // change *after* the region exists to fire. `done` is captured BEFORE calling onToggle():
  // onToggle() synchronously updates progressStore, which re-renders this component with the
  // new `done` prop value before this function finishes, so reading `done` after the call
  // reports the post-toggle state, not the transition that just happened.
  let announcement = '';
  function handleToggle() {
    const wasDone = done;
    onToggle();
    announcement = wasDone ? `${broker.name} marked not done` : `${broker.name} marked done`;
  }
</script>

<div class="row" class:done>
  <label class="check-target">
    <input
      type="checkbox"
      checked={done}
      on:change={handleToggle}
      aria-label={done ? `Mark ${broker.name} as not done` : `Mark ${broker.name} as done`}
    />
  </label>

  <div class="body">
    <div class="name-line">
      {#if href}
        <a {href} target="_blank" rel="noopener noreferrer" class="name">{broker.name} ↗</a>
      {:else}
        <span class="name">{broker.name}</span>
      {/if}
      <span class="priority-badge {badge.priorityBadgeClass}">{broker.priority}</span>
      {#if badge.showUnverifiedBadge}
        <span class="unverified-badge" title="A human hasn't confirmed this entry against the broker's own page yet">
          unverified
        </span>
      {/if}
      {#if recheckDue}
        <span
          class="recheck-badge"
          title="People-search sites often re-add listings after some time -- worth checking whether this one came back"
        >
          re-check due
        </span>
      {/if}
    </div>

    <slot />
  </div>
</div>

<span class="sr-only" aria-live="polite">{announcement}</span>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .row {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--rule, #c9c1b2);
    align-items: flex-start;
  }
  .row.done {
    opacity: 0.55;
  }
  .row.done .name {
    text-decoration: line-through;
  }
  /* 44px touch target (mobile-accessibility floor) around a visually smaller checkbox --
     the padding, not the checkbox itself, absorbs the extra tap area. */
  .check-target {
    flex: none;
    width: 2.75rem;
    height: 2.75rem;
    margin: -0.6rem -0.6rem 0 -0.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .check-target input {
    width: 1.15rem;
    height: 1.15rem;
    accent-color: var(--seal, #8a1c1c);
    cursor: pointer;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .name-line {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .name {
    font-weight: 600;
    color: inherit;
  }
  a.name {
    text-decoration: underline;
    text-decoration-color: var(--rule, #c9c1b2);
    text-underline-offset: 0.15em;
  }
  a.name:hover,
  a.name:focus-visible {
    text-decoration-color: var(--seal, #8a1c1c);
  }
  .priority-badge,
  .unverified-badge,
  .recheck-badge {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.1rem 0.4rem;
    border-radius: 2px;
  }
  .priority-crucial {
    background: var(--seal, #8a1c1c);
    color: white;
  }
  .priority-high {
    background: var(--graphite, #6b6459);
    color: white;
  }
  .priority-standard {
    background: transparent;
    border: 1px solid var(--rule, #c9c1b2);
  }
  .unverified-badge {
    border: 1px dashed var(--graphite, #6b6459);
    color: var(--graphite, #6b6459);
  }
  .recheck-badge {
    border: 1px solid var(--seal, #8a1c1c);
    color: var(--seal, #8a1c1c);
  }

  @media (prefers-reduced-motion: no-preference) {
    .row.done .name {
      transition: opacity 0.2s ease;
    }
  }
</style>
