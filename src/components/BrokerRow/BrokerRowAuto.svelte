<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { Profile } from '../../stores/profile';
  import { composeRequest, planDelivery } from '../../lib/templates/ccpaRequest';

  export let broker: Broker;
  export let profile: Profile;

  let downloadUrl: string | null = null;
  let downloadName = '';
  let error: string | null = null;
  let copiedAddress = false;
  let copyFailed = false;

  function send() {
    error = null;
    try {
      const request = composeRequest(profile, broker);
      const plan = planDelivery(request);
      if (plan.kind === 'mailto') {
        window.location.href = plan.href;
      } else {
        downloadUrl = URL.createObjectURL(plan.blob);
        downloadName = plan.filename;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'could not compose the request';
    }
  }

  // The address is shown as plain selectable text, never as a mailto: href -- a broker's
  // address in an href is fine, but keeping every path here button-driven matches the rest
  // of the row and leaves nothing for a mis-click to navigate away to.
  async function copyAddress() {
    if (!broker.opt_out_email) return;
    try {
      await navigator.clipboard.writeText(broker.opt_out_email);
      copiedAddress = true;
      setTimeout(() => (copiedAddress = false), 1500);
    } catch {
      // Clipboard access can be refused outright (permission denied, insecure context, or a
      // document that isn't focused). Say so rather than throwing an unhandled rejection and
      // leaving a button that looks like it did nothing -- the address is rendered as visible
      // selectable text right next to this, so there is always a manual path.
      copyFailed = true;
      setTimeout(() => (copyFailed = false), 3000);
    }
  }
</script>

<div class="auto-action">
  <button on:click={send}>Compose opt-out email</button>

  <!--
    Auto-tier rows used to render this button and NOTHING else: no link, no address, no
    indication of what "compose" would do. The guided flow's first batch is all auto-tier (it
    scores easiest, see lib/batching/nextBatch.ts TIER_EASE), so a new reader's first screen
    was seven identical buttons and no visible way to act -- and `window.location.href =
    mailto:` fails silently when no mail client is registered, which is the default on a lot
    of desktop browsers. Showing the destination address makes the row self-explanatory and
    gives a working manual path when the mailto: never fires.
  -->
  {#if broker.opt_out_email}
    <p class="address-line">
      Sends to <span class="address">{broker.opt_out_email}</span>
      <button class="copy-address" on:click={copyAddress}>
        {copiedAddress ? 'copied' : 'copy'}
      </button>
      {#if copyFailed}
        <span class="copy-failed" role="status">couldn't copy — select the address above</span>
      {/if}
    </p>
  {/if}

  {#if downloadUrl}
    <a href={downloadUrl} download={downloadName} class="eml-link">
      Download {downloadName} (open it in your mail app to send)
    </a>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <p class="mailto-note">
    Opens your email app with the request written for you. Nothing sends until you press send
    there — if nothing opens, copy the address above and paste the request in by hand.
  </p>
</div>

<style>
  .auto-action {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
  }
  .error {
    color: var(--seal, #8a1c1c);
    font-size: 0.85rem;
  }
  .address-line {
    margin: 0;
    font-size: 0.85rem;
    color: var(--graphite, #6b6459);
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .address {
    font-family: 'Courier New', monospace;
    color: var(--ink, #16130e);
    /* Broker addresses can be long and have no spaces to break at -- same overflow risk the
       guided-tier instructions have. */
    overflow-wrap: anywhere;
  }
  .copy-address {
    font-size: 0.8rem;
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .copy-failed {
    font-size: 0.8rem;
    color: var(--seal, #8a1c1c);
  }
  .mailto-note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--graphite, #6b6459);
    max-width: 34rem;
    line-height: 1.4;
  }
</style>
