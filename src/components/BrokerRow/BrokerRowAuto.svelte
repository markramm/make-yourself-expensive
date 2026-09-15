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

  // The composed letter, shown in the row once the reader asks for it.
  //
  // `window.location.href = 'mailto:...'` fails SILENTLY when no mail client is registered --
  // the default for anyone using Gmail or Outlook in a browser tab, which is most people. The
  // row's own note already admitted this ("if nothing opens, copy the address above and paste
  // the request in by hand"), but the request it told them to paste was never rendered
  // anywhere. That is the gap: we asked for manual work and withheld the thing to do it with.
  //
  // So the letter is shown on compose, not on failure. A reader cannot detect whether their
  // mailto fired -- nothing happens either way -- so offering the text only after a failure
  // they cannot observe is no offer at all. The mailto attempt stays, because it genuinely is
  // one click for people who have a mail client; it is now a convenience layered on top of a
  // path that always works rather than the only path.
  let letter: { subject: string; body: string; toEmail: string } | null = null;
  let copiedPart: 'subject' | 'body' | 'all' | null = null;
  let partCopyFailed = false;

  function send() {
    error = null;
    try {
      const request = composeRequest(profile, broker);
      letter = { subject: request.subject, body: request.body, toEmail: request.toEmail };

      const plan = planDelivery(request);
      if (plan.kind === 'mailto') {
        // Still attempt the mail client. If one is registered this is the fastest path; if
        // not, nothing happens and the letter below is already on screen.
        window.location.href = plan.href;
      } else {
        // Over-length letters get a downloadable .eml rather than a truncated mailto. Revoke
        // any previous object URL first -- composing twice used to leak the earlier one.
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(plan.blob);
        downloadName = plan.filename;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'could not compose the request';
    }
  }

  /** The whole letter as one pasteable block, for a compose window that starts empty. */
  function fullLetterText(l: { subject: string; body: string; toEmail: string }): string {
    return `To: ${l.toEmail}\nSubject: ${l.subject}\n\n${l.body}`;
  }

  async function copyPart(part: 'subject' | 'body' | 'all') {
    if (!letter) return;
    const text =
      part === 'subject' ? letter.subject : part === 'body' ? letter.body : fullLetterText(letter);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Same reasoning as copyAddress() below: clipboard access can be refused outright. Say
      // so plainly -- and unlike the assisted row, the text is rendered right here, so
      // selecting it by hand is always available as a fallback.
      partCopyFailed = true;
      setTimeout(() => (partCopyFailed = false), 3000);
      return;
    }
    copiedPart = part;
    setTimeout(() => {
      if (copiedPart === part) copiedPart = null;
    }, 1500);
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

  {#if letter}
    <div class="letter">
      <p class="letter-lead">
        Your mail app should have opened with this ready to send. <strong>If nothing opened</strong>
        — common when you read mail in a browser tab rather than an app — copy it across
        yourself. Nothing is sent from this page either way.
      </p>

      <dl class="letter-fields">
        <dt>To</dt>
        <dd class="mono">{letter.toEmail}</dd>
        <dt>Subject</dt>
        <dd class="mono">{letter.subject}</dd>
      </dl>

      <pre class="letter-body">{letter.body}</pre>

      <div class="letter-actions" role="group" aria-label="Copy the request">
        <button on:click={() => copyPart('all')}>
          {copiedPart === 'all' ? 'copied' : 'Copy the whole thing'}
        </button>
        <button on:click={() => copyPart('subject')}>
          {copiedPart === 'subject' ? 'copied' : 'Copy subject'}
        </button>
        <button on:click={() => copyPart('body')}>
          {copiedPart === 'body' ? 'copied' : 'Copy message'}
        </button>
      </div>
      <p class="letter-status" aria-live="polite">
        {#if partCopyFailed}
          Couldn't copy — select the text above instead.
        {/if}
      </p>
    </div>
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
  .letter {
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 4px;
    padding: 0.75rem 0.9rem;
    max-width: 34rem;
    width: 100%;
  }
  .letter-lead {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--graphite, #6b6459);
  }
  .letter-lead strong {
    color: var(--ink, #16130e);
  }
  .letter-fields {
    margin: 0 0 0.6rem;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.6rem;
    font-size: 0.85rem;
  }
  .letter-fields dt {
    color: var(--graphite, #6b6459);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.03em;
    align-self: baseline;
  }
  .letter-fields dd {
    margin: 0;
    /* Addresses and subjects can run long with nothing to break at. */
    overflow-wrap: anywhere;
  }
  .mono {
    font-family: 'Courier New', monospace;
  }
  .letter-body {
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    margin: 0 0 0.6rem;
    padding: 0.6rem;
    background: color-mix(in srgb, var(--rule, #c9c1b2) 25%, transparent);
    border-radius: 3px;
    /* The letter is pre-formatted text and must keep its line breaks, but it also has to fit
       a phone -- so wrap long lines rather than forcing a horizontal scroll inside the row. */
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 18rem;
    overflow-y: auto;
  }
  .letter-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .letter-actions button {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .letter-status {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--seal, #8a1c1c);
    min-height: 1.2em;
  }
  .mailto-note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--graphite, #6b6459);
    max-width: 34rem;
    line-height: 1.4;
  }
</style>
