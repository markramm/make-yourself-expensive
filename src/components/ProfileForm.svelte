<script lang="ts">
  import { profileStore } from '../stores/profile';
  import { US_STATES } from '../lib/usStates';
</script>

<p class="why-note">
  This is optional, and only used for two things: pre-filling the opt-out emails and forms
  you send yourself, and picking the right legal citation for your state (several states now
  have consumer-privacy laws — this determines which one your requests reference). You can
  skip straight to <a href="/brokers">the broker list</a> and fill this in later, but any
  broker row that composes an email or has fields to copy will be blank until you do.
</p>

<p class="privacy-note" id="profile-privacy-note">
  Everything below stays in this browser's local storage. It is never sent to a server —
  there isn't one. Clearing your browser data will erase it too (see the export page to make
  a backup).
</p>

<form on:submit|preventDefault aria-describedby="profile-privacy-note">
  <label>
    Full name
    <input type="text" bind:value={$profileStore.fullName} autocomplete="name" />
  </label>
  <label>
    Email
    <input type="email" bind:value={$profileStore.email} autocomplete="email" />
  </label>
  <label>
    Phone
    <input type="tel" bind:value={$profileStore.phone} autocomplete="tel" />
  </label>
  <label>
    Street address
    <input type="text" bind:value={$profileStore.address} autocomplete="street-address" />
  </label>
  <label>
    City
    <input type="text" bind:value={$profileStore.city} autocomplete="address-level2" />
  </label>
  <label>
    State
    <select bind:value={$profileStore.state} autocomplete="address-level1">
      <option value="">Select a state…</option>
      {#each US_STATES as s (s.code)}
        <option value={s.code}>{s.name}</option>
      {/each}
    </select>
  </label>
  <label>
    ZIP
    <input type="text" bind:value={$profileStore.zip} autocomplete="postal-code" />
  </label>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    max-width: 24rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  input[type='text'],
  input[type='email'],
  input[type='tel'],
  select {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  select option {
    color: initial;
  }
  .why-note {
    font-size: 0.9rem;
    max-width: 32rem;
    margin: 0 0 1rem;
  }
  .why-note a {
    color: var(--seal);
    font-weight: 600;
  }
  .privacy-note {
    font-size: 0.85rem;
    color: var(--graphite);
    max-width: 32rem;
  }
</style>
