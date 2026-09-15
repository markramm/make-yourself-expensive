<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { Profile } from '../../stores/profile';
  import { routeReportUrl } from '../../lib/reportLink';

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
      case 'dob':
        return profile.dob;
      default:
        return '';
    }
  }

  let copiedField: string | null = null;
  let failedField: string | null = null;

  async function copy(field: string) {
    const value = profileValueFor(field);
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be refused outright (permission denied, insecure context, or a
      // document that isn't focused). Without this the promise rejects unhandled and the
      // button just looks inert -- and unlike the auto-tier row, the value here is the
      // reader's own profile data, which is NOT rendered anywhere on screen to fall back to.
      // So say plainly that it didn't copy and point at the profile page.
      failedField = field;
      setTimeout(() => {
        if (failedField === field) failedField = null;
      }, 3000);
      return;
    }
    copiedField = field;
    // Deliberately no analytics event here, even a field-name-only one -- which fields a
    // user copies is itself PII-shaped information. The failure path above is equally silent
    // for the same reason.
    setTimeout(() => {
      if (copiedField === field) copiedField = null;
    }, 1500);
  }

  $: pastableFields = broker.required_fields.filter((f) => f !== 'ssn' && f !== 'gov_id' && f !== 'vin');

  // An assisted row's whole premise is "open their form, paste these fields in." When the
  // opt-out URL was an unconfirmed `<verify:>` placeholder, nulled at the dataset boundary,
  // there is no form to open -- so the copy buttons point nowhere and the row silently asks
  // the reader to paste into a page we never gave them. Say what is missing, and surface the
  // written steps, which are the only route left. One shipped entry is in this state today.
  $: hasNoRoute = !broker.opt_out_url && !broker.opt_out_email && !broker.phone;
</script>

<div class="assisted-action">
  {#if hasNoRoute}
    <div class="no-route">
      <p class="no-route-lead">
        {#if broker.route_unconfirmed}
          We could not confirm where this broker's opt-out lives. The steps below are our best
          current understanding, and the buttons are the fields their form is expected to ask for.
        {:else}
          This broker publishes no opt-out link, email, or phone number. The steps below are the
          whole route, and the buttons are the fields their form is expected to ask for.
        {/if}
      </p>
      {#if broker.captcha || broker.link_status === 'bot-blocked'}
        <p class="no-route-note">
          This site blocks automated checks, so expect a CAPTCHA or a verification step before
          you can get anywhere.
        </p>
      {/if}
      <p class="no-route-ask">
        <strong>If you find the real opt-out page, that is the single most useful correction
        this project can get.</strong>
        <a href={routeReportUrl(broker)} target="_blank" rel="noopener noreferrer">
          Tell us where it lives →
        </a>
      </p>
    </div>
    <!-- Shown open, not behind a <details>. The guided tier keeps its steps expanded for
         exactly this reason, and on a routeless row the written steps ARE the route -- a
         reader whose only guidance is collapsed out of view sees copy buttons pointing at a
         form we never gave them. Same situation, so same shape. -->
    {#if broker.instructions_md?.trim()}
      <p class="steps-body">{broker.instructions_md}</p>
    {/if}
  {/if}

  {#if pastableFields.length > 0}
    <div class="fields" role="group" aria-label="Fields to paste into the form">
      {#each pastableFields as field}
        <button
          class="field-btn"
          class:copy-failed={failedField === field}
          on:click={() => copy(field)}
          disabled={!profileValueFor(field)}
        >
          {FIELD_LABELS[field] ?? field}
          <span aria-live="polite">
            {#if failedField === field}
              — couldn't copy, open your profile to select it
            {:else if copiedField === field}
              — copied
            {:else}
              — copy
            {/if}
          </span>
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
  .no-route {
    font-size: 0.85rem;
    line-height: 1.45;
    max-width: 34rem;
    margin: 0;
    color: var(--graphite, #6b6459);
    border-left: 2px solid var(--seal, #8a1c1c);
    padding-left: 0.6rem;
  }
  .no-route p {
    margin: 0 0 0.4rem;
  }
  .no-route p:last-child {
    margin-bottom: 0;
  }
  .no-route-ask strong {
    color: var(--ink, #16130e);
    font-weight: 600;
  }
  .no-route-ask a {
    color: var(--seal, #8a1c1c);
    font-weight: 600;
    white-space: nowrap;
  }
  .steps-body {
    font-size: 0.85rem;
    max-width: 34rem;
    margin: 0.5rem 0 0;
    /* Instruction text carries bare opt-out URLs that run long with nothing to break at --
       same overflow risk the guided tier handles. */
    overflow-wrap: anywhere;
    white-space: pre-line;
    line-height: 1.5;
  }
  .field-btn.copy-failed {
    border-color: var(--seal, #8a1c1c);
    color: var(--seal, #8a1c1c);
  }
</style>
