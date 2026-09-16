<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { Profile } from '../../stores/profile';
  import { composeRequest, planDelivery } from '../../lib/templates/ccpaRequest';
  import { profileIsEmpty } from '../../lib/profile/isEmpty';

  export let broker: Broker;
  export let profile: Profile;

  let downloadUrl: string | null = null;
  let downloadName = '';
  let error: string | null = null;

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
  let copiedPart: 'to' | 'subject' | 'body' | 'all' | null = null;
  let partCopyFailed = false;

  /** The mailto: href for this letter, once composed -- null when the letter is too long. */
  let mailtoHref: string | null = null;

  /**
   * Which identifying fields the composed letter is missing.
   *
   * composeRequest() writes only the profile fields that are filled in, and silently omits the
   * rest. With an empty profile that produces a letter with the header "My identifying
   * information for locating my record:" followed by NOTHING, and an unsigned "Thank you," --
   * visibly broken, and unusable by a broker who cannot identify the requester. The reader was
   * given no indication anything was wrong.
   *
   * Name and email are what actually let a broker find a record, so they are called out
   * specifically; postal address materially improves a match and is worth prompting for.
   */
  $: missingFields = [
    !profile.fullName ? 'your full name' : null,
    !profile.email ? 'an email address' : null,
    !profile.address ? 'a postal address' : null,
  ].filter((f): f is string => f !== null);

  $: noIdentifyingInfo = profileIsEmpty(profile);

  /**
   * Composes the letter and SHOWS it. Deliberately does not touch window.location.
   *
   * It used to fire the mailto: immediately. On a Mac with no configured default mail client,
   * the OS intercepts that and offers to connect one -- which for Gmail means an OAuth consent
   * screen listing read, write and delete scopes on the reader's own mailbox. A tester hit
   * exactly that. Nothing here requested those scopes and nothing here can see them, but a
   * privacy tool whose first action raises an alarming permissions prompt loses people at the
   * worst possible moment, and it fired before they even knew a letter existed.
   *
   * So composing now only composes. Opening a mail app is a second, explicit click for people
   * who want it -- see openInMailApp(). Same information, same one-click path for anyone with
   * a mail client configured, minus the ambush for everyone else.
   */
  function send() {
    error = null;
    try {
      const request = composeRequest(profile, broker);
      letter = { subject: request.subject, body: request.body, toEmail: request.toEmail };

      const plan = planDelivery(request);
      if (plan.kind === 'mailto') {
        mailtoHref = plan.href;
      } else {
        // Over-length letters get a downloadable .eml rather than a truncated mailto. Revoke
        // any previous object URL first -- composing twice used to leak the earlier one.
        mailtoHref = null;
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(plan.blob);
        downloadName = plan.filename;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'could not compose the request';
    }
  }

  /** Hands the letter to a mail client, only when the reader asks for it. */
  function openInMailApp() {
    if (mailtoHref) window.location.href = mailtoHref;
  }

  /** The whole letter as one pasteable block, for a compose window that starts empty. */
  function fullLetterText(l: { subject: string; body: string; toEmail: string }): string {
    return `To: ${l.toEmail}\nSubject: ${l.subject}\n\n${l.body}`;
  }

  async function copyPart(part: 'to' | 'subject' | 'body' | 'all') {
    if (!letter) return;
    const text =
      part === 'to'
        ? letter.toEmail
        : part === 'subject'
          ? letter.subject
          : part === 'body'
            ? letter.body
            : fullLetterText(letter);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be refused outright (permission denied, insecure context, or a
      // document that isn't focused). Say
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

</script>

<div class="auto-action">
  <button on:click={send}>Write the opt-out email</button>

  <!-- A letter with no identifying details cannot locate anyone's record, so say so before the
       reader sends one. Shown next to the button rather than only inside the composed letter,
       so it is visible before they act. -->
  <!-- Leads with the PAYOFF, not the defect. The warning used to say only what was broken
       ("this letter can't identify you"), which is true but gives the reader no reason to go
       to the profile page beyond fixing one letter. The actual bargain is that filling it in
       once writes every future letter automatically -- and the email tier alone is dozens of
       brokers, each otherwise needing the same details typed again by hand. Say that, then
       say what is wrong. -->
  {#if noIdentifyingInfo}
    <p class="profile-warning">
      <strong>Fill in your profile once and these letters write themselves.</strong>
      Right now this one has no name or email, so the broker has nothing to match you against —
      and you would have to type your details into this letter and every other one by hand.
      <a href="/profile">Set up your profile</a>. It stays on this device and is never sent
      anywhere.
    </p>
  {:else if missingFields.length > 0}
    <p class="profile-warning subtle">
      The letter will be missing {missingFields.join(' and ')}, which makes a match less likely.
      <a href="/profile">Add {missingFields.length === 1 ? 'it' : 'them'} to your profile</a>.
    </p>
  {/if}

  <!--
    Auto-tier rows used to render this button and NOTHING else: no link, no address, no
    indication of what "compose" would do. The guided flow's first batch is all auto-tier (it
    scores easiest, see lib/batching/nextBatch.ts TIER_EASE), so a new reader's first screen
    was seven identical buttons and no visible way to act -- and `window.location.href =
    mailto:` fails silently when no mail client is registered, which is the default on a lot
    of desktop browsers. Showing the destination address makes the row self-explanatory and
    gives a working manual path when the mailto: never fires.
  -->
  <!-- The standalone "Sends to <address>" line is gone: the composed letter now shows To,
       Subject and Message as labelled fields with their own copy controls, so this repeated
       the address a second time directly above it. Before the letter is composed there is
       nothing to send yet, and the button says what it will do. -->

  {#if letter}
    <div class="letter">
      {#if noIdentifyingInfo}
        <p class="letter-missing">
          <strong>Before you send this:</strong> it has no name or email in it, so the broker
          has nothing to match you against. Type your details into the letter below — or
          <a href="/profile">fill in your profile</a> once and this letter, and every other
          one, fills itself in from then on.
        </p>
      {:else if missingFields.length > 0}
        <p class="letter-missing subtle">
          Missing {missingFields.join(' and ')} — add {missingFields.length === 1 ? 'it' : 'them'}
          before sending if you can.
        </p>
      {/if}
      <!-- Actions at the TOP. The old layout buried them under a scrolling letter body, so the
           reader met a wall of monospace text before learning what they could do with it. The
           lead paragraph here also used to claim "Your mail app should have opened with this" --
           true only while composing auto-fired a mailto:, which it no longer does. -->
      <div class="letter-top">
        {#if mailtoHref}
          <button class="send-btn" on:click={openInMailApp}>Send in my mail app</button>
        {/if}
        <button class="copy-all-btn" on:click={() => copyPart('all')}>
          {copiedPart === 'all' ? 'Copied' : 'Copy all'}
        </button>
      </div>
      {#if mailtoHref}
        <p class="mail-app-note">
          Only if you have a mail app set up. If your computer offers to connect an account
          instead, close that and copy the letter across by hand.
        </p>
      {/if}

      <!-- Copy control per field, aligned in its own column. Webmail compose forms have
           separate To / Subject / body inputs, so copying them one at a time is the actual
           task -- three buttons in a row underneath made the reader match label to field. -->
      <dl class="letter-fields">
        <dt>To</dt>
        <dd class="mono">{letter.toEmail}</dd>
        <dd class="field-copy">
          <button
            class="icon-btn"
            on:click={() => copyPart('to')}
            aria-label="Copy the recipient address"
          >
            {copiedPart === 'to' ? 'copied' : 'copy'}
          </button>
        </dd>

        <dt>Subject</dt>
        <dd class="mono">{letter.subject}</dd>
        <dd class="field-copy">
          <button class="icon-btn" on:click={() => copyPart('subject')} aria-label="Copy the subject">
            {copiedPart === 'subject' ? 'copied' : 'copy'}
          </button>
        </dd>

        <dt>Message</dt>
        <dd class="letter-body-cell"><pre class="letter-body">{letter.body}</pre></dd>
        <dd class="field-copy">
          <button class="icon-btn" on:click={() => copyPart('body')} aria-label="Copy the message">
            {copiedPart === 'body' ? 'copied' : 'copy'}
          </button>
        </dd>
      </dl>

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
    Writes the request for you and shows it here, so you can copy it into whatever you use for
    email. Nothing is sent from this page, and nothing leaves your browser.
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
  .letter {
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 4px;
    padding: 0.75rem 0.9rem;
    max-width: 34rem;
    width: 100%;
  }
  .letter-top {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .send-btn {
    font-size: 0.85rem;
    padding: 0.3rem 0.8rem;
    border: none;
    border-radius: 3px;
    background: var(--seal-surface, #8a1c1c);
    color: white;
    cursor: pointer;
  }
  .copy-all-btn {
    font-size: 0.85rem;
    padding: 0.3rem 0.8rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  /* label | value | copy. The copy column is sized to its content and sits hard right of the
     value, so the three controls line up in a single vertical run down the letter. */
  .letter-fields {
    margin: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.35rem 0.6rem;
    font-size: 0.85rem;
    align-items: start;
  }
  .letter-fields dt {
    color: var(--graphite, #6b6459);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.03em;
    padding-top: 0.15rem;
  }
  .letter-fields dd {
    margin: 0;
    min-width: 0;
    /* Addresses and subjects can run long with nothing to break at. */
    overflow-wrap: anywhere;
  }
  .field-copy {
    justify-self: end;
  }
  .icon-btn {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    color: var(--graphite, #6b6459);
    cursor: pointer;
    white-space: nowrap;
  }
  .icon-btn:hover,
  .icon-btn:focus-visible {
    color: var(--seal, #8a1c1c);
    border-color: var(--seal, #8a1c1c);
  }
  .mono {
    font-family: 'Courier New', monospace;
  }
  .letter-body-cell {
    /* The grid cell, not the <pre>, carries the width constraint -- a pre with its own
       max-height was scrolling internally, so the letter arrived cut off mid-sentence. */
    min-width: 0;
  }
  .letter-body {
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    margin: 0;
    padding: 0.6rem;
    background: color-mix(in srgb, var(--rule, #c9c1b2) 25%, transparent);
    border-radius: 3px;
    /* The letter is pre-formatted text and must keep its line breaks, but it also has to fit
       a phone -- so wrap long lines rather than forcing a horizontal scroll inside the row.
       No max-height: the whole letter shows at once. It is ~20 lines, and an inner scrollbar
       inside an already-scrolling page meant the reader saw a fragment starting mid-sentence
       and had to scroll a box to read what they were about to send. */
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .letter-status {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--seal, #8a1c1c);
    min-height: 1.2em;
  }
  .profile-warning,
  .letter-missing {
    font-size: 0.82rem;
    line-height: 1.45;
    max-width: 34rem;
    margin: 0;
    color: var(--ink, #16130e);
    border-left: 2px solid var(--seal, #8a1c1c);
    padding-left: 0.6rem;
  }
  .letter-missing {
    margin: 0 0 0.6rem;
  }
  .profile-warning.subtle,
  .letter-missing.subtle {
    color: var(--graphite, #6b6459);
    border-left-color: var(--rule, #c9c1b2);
  }
  .profile-warning a,
  .letter-missing a {
    color: var(--seal, #8a1c1c);
    font-weight: 600;
  }
  .mail-app-note {
    font-size: 0.78rem;
    color: var(--graphite, #6b6459);
    line-height: 1.4;
    margin: 0 0 0.6rem;
    max-width: 30rem;
  }
  .mailto-note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--graphite, #6b6459);
    max-width: 34rem;
    line-height: 1.4;
  }
</style>
