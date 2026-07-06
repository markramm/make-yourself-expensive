<script lang="ts">
  import { profileStore } from '../stores/profile';
</script>

<p class="privacy-note">
  Everything below stays in this browser's local storage. It is never sent to a server —
  there isn't one. Clearing your browser data will erase it too (see the export page to make
  a backup).
</p>

<form on:submit|preventDefault>
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
    <input type="text" bind:value={$profileStore.state} autocomplete="address-level1" />
  </label>
  <label>
    ZIP
    <input type="text" bind:value={$profileStore.zip} autocomplete="postal-code" />
  </label>
  <label class="checkbox">
    <input type="checkbox" bind:checked={$profileStore.isCaliforniaResident} />
    I'm a California resident
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
  label.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
  input[type='text'],
  input[type='email'],
  input[type='tel'] {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .privacy-note {
    font-size: 0.85rem;
    color: var(--graphite);
    max-width: 32rem;
  }
</style>
