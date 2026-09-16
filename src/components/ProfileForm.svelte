<script lang="ts">
  import { profileStore } from '../stores/profile';
  import { US_STATES } from '../lib/usStates';
</script>

<!--
  The storage guarantee comes FIRST, before the explanation of what the fields are for.
  Readers arrive here from a broker row that has just asked them for a name, an email and a
  home address -- on a site about not giving those away. The reassurance has to be the thing
  they meet, not a note below the fold, and it has to say the strong version: not merely
  "stored locally", but that no database of users exists to be breached, subpoenaed or sold.
  That is the claim the whole project rests on, and this is the one page where someone is
  actively being asked to type the data in.
-->
<div class="storage-promise" id="profile-privacy-note">
  <p class="storage-headline">
    <strong>This stays on your device. We keep no database of anyone's information.</strong>
  </p>
  <ul class="storage-points">
    <li>
      Everything you type here is saved in this browser's local storage, on this machine, and
      nowhere else.
    </li>
    <li>
      It is never sent to a server, because there is no server — this is a static page. There
      is no account, no user record, and no database that could be breached, subpoenaed, or
      sold.
    </li>
    <li>
      Nothing here is transmitted when you use it. Your details reach a broker only when
      <em>you</em> send an email or paste them into a form yourself.
    </li>
    <li>
      Because it lives only in this browser, clearing your site data erases it —
      <a href="/switch-devices">save a backup</a> if you want to keep it or move it to another
      device.
    </li>
  </ul>
  <p class="storage-verify">
    You don't have to take our word for it:
    <a href="https://github.com/markramm/make-yourself-expensive" target="_blank" rel="noopener noreferrer">
      read the code
    </a>, or have someone technical you trust read it.
  </p>
</div>

<p class="why-note">
  This is optional, and only used for two things: pre-filling the opt-out emails and forms
  you send yourself, and picking the right legal citation for your state (several states now
  have consumer-privacy laws — this determines which one your requests reference). Fill it in
  once and every letter writes itself from then on; you can also
  <a href="/brokers/guide/">skip straight to opting out</a> and come back, though rows that
  compose an email or have fields to copy will be blank until you do.
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
  <label>
    Date of birth <span class="optional">— optional</span>
    <input type="date" bind:value={$profileStore.dob} autocomplete="bday" />
    <span class="field-note">
      Some brokers won't process an opt-out without it. It is only ever copied to your
      clipboard for a form that asks — it is never added to an email for you.
    </span>
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
  input[type='date'],
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
  .optional {
    color: var(--graphite);
    font-weight: normal;
  }
  .field-note {
    font-size: 0.8rem;
    color: var(--graphite);
    line-height: 1.35;
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
  .storage-promise {
    border: 1px solid var(--rule);
    border-left: 3px solid var(--seal);
    border-radius: 4px;
    padding: 0.9rem 1.1rem;
    margin: 0 0 1.25rem;
    max-width: 34rem;
  }
  .storage-headline {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    line-height: 1.4;
  }
  .storage-points {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--graphite);
  }
  .storage-points li + li {
    margin-top: 0.35rem;
  }
  .storage-points a,
  .storage-verify a {
    color: var(--seal);
    font-weight: 600;
  }
  .storage-verify {
    margin: 0.6rem 0 0;
    font-size: 0.82rem;
    color: var(--graphite);
  }
</style>
