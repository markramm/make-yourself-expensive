<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { Profile } from '../../stores/profile';

  export let broker: Broker;
  export let profile: Profile;

  // opt_out_url is rendered exactly as authored, with NOTHING appended from the profile --
  // this is how "PII never enters a URL" is enforced here, not just documented. Profile
  // values only ever reach the clipboard via a direct writeText() call in a click handler,
  // never a href, never history.

  const FIELD_LABELS: Record<string, string> = {
    full_name: 'Full name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    dob: 'Date of birth',
    listing_url: 'Listing URL (find this on the broker’s own site first)',
    other: 'Other',
  };

  function profileValueFor(field: string): string {
    switch (field) {
      case 'full_name':
        return profile.fullName;
      case 'email':
        return profile.email;
      case 'phone':
        return profile.phone;
      case 'address':
        return [profile.address, profile.city, profile.state, profile.zip].filter(Boolean).join(', ');
      default:
        return '';
    }
  }

  let copiedField: string | null = null;

  async function copy(field: string) {
    const value = profileValueFor(field);
    if (!value) return;
    await navigator.clipboard.writeText(value);
    copiedField = field;
    // Deliberately no analytics event here, even a field-name-only one -- which fields a
    // user copies is itself PII-shaped information.
    setTimeout(() => {
      if (copiedField === field) copiedField = null;
    }, 1500);
  }

  $: pastableFields = broker.required_fields.filter((f) => f !== 'ssn' && f !== 'gov_id' && f !== 'vin');
</script>

<div class="assisted-action">
  {#if pastableFields.length > 0}
    <div class="fields" role="group" aria-label="Fields to paste into the form">
      {#each pastableFields as field}
        <button class="field-btn" on:click={() => copy(field)} disabled={!profileValueFor(field)}>
          {FIELD_LABELS[field] ?? field}
          <span aria-live="polite">{copiedField === field ? ' — copied' : ' — copy'}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .assisted-action {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .field-btn {
    font-size: 0.85rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
  }
  .field-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
