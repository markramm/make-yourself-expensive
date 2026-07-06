<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import { badgeDecisionFor } from './badgeContract';

  export let broker: Broker;
  export let done: boolean;
  export let onToggle: () => void;

  $: badge = badgeDecisionFor(broker);
</script>

<div class="row" class:done>
  <button class="strike-btn" on:click={onToggle} aria-pressed={done} aria-label={done ? `Mark ${broker.name} as not done` : `Mark ${broker.name} as done`}>
    {done ? '✓' : ''}
  </button>

  <div class="body">
    <div class="name-line">
      <span class="name">{broker.name}</span>
      <span class="priority-badge {badge.priorityBadgeClass}">{broker.priority}</span>
      {#if badge.showUnverifiedBadge}
        <span class="unverified-badge" title="A human hasn't confirmed this entry against the broker's own page yet">
          unverified
        </span>
      {/if}
    </div>

    <slot />
  </div>
</div>

<style>
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
  .strike-btn {
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
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
  }
  .priority-badge,
  .unverified-badge {
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

  @media (prefers-reduced-motion: no-preference) {
    .row.done .name {
      transition: opacity 0.2s ease;
    }
  }
</style>
