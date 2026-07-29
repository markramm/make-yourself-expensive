<script lang="ts">
  import { profileStore, PROFILE_SCHEMA_VERSION, migrateProfile, type Profile } from '../stores/profile';
  import { progressStore, PROGRESS_SCHEMA_VERSION, migrateProgress, type ProgressMap } from '../stores/progress';
  import {
    hardenProgressStore,
    HARDEN_PROGRESS_SCHEMA_VERSION,
    migrateHardenProgress,
    type HardenProgressMap,
  } from '../stores/hardenProgress';
  import {
    exportEncrypted,
    exportPlaintext,
    importEnvelope,
    parseEnvelopeFromText,
    ImportError,
    type ExportPayload,
  } from '../lib/crypto/exportImport';

  // ---- Save (this device -> file) ----
  let encryptOnSave = true;
  let savePassphrase = '';
  let saveError: string | null = null;
  let saveConfirmation: string | null = null;

  function todayStamp(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function handleSave() {
    saveError = null;
    saveConfirmation = null;

    if (encryptOnSave && savePassphrase.trim().length === 0) {
      saveError = 'Enter a passphrase, or turn off encryption below.';
      return;
    }

    const payload: ExportPayload = {
      profile: profileStore_snapshot(),
      progress: $progressStore,
      harden: $hardenProgressStore,
      schema_versions: {
        profile: PROFILE_SCHEMA_VERSION,
        progress: PROGRESS_SCHEMA_VERSION,
        harden: HARDEN_PROGRESS_SCHEMA_VERSION,
      },
    };

    const envelope = encryptOnSave
      ? await exportEncrypted(payload, savePassphrase)
      : exportPlaintext(payload);

    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `make-yourself-expensive-progress-${todayStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    saveConfirmation = encryptOnSave
      ? 'Saved. This file is locked with your passphrase -- keep the passphrase somewhere you’ll remember it, separately from the file itself.'
      : 'Saved as a plain, unencrypted file.';
    savePassphrase = '';
  }

  function profileStore_snapshot(): Profile {
    let snapshot: Profile;
    profileStore.subscribe((v) => (snapshot = v))();
    return snapshot!;
  }

  // ---- Continue here (file -> this device) ----
  let fileInput: HTMLInputElement;
  let pendingEnvelope: ReturnType<typeof parseEnvelopeFromText> | null = null;
  let pendingFileName = '';
  let loadPassphrase = '';
  let loadError: string | null = null;
  let pendingPayload: ExportPayload | null = null;
  let mergeChoice: 'merge' | 'replace' = 'merge';

  async function handleFileSelected(e: Event) {
    loadError = null;
    pendingPayload = null;
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    pendingFileName = file.name;

    const text = await file.text();
    try {
      pendingEnvelope = parseEnvelopeFromText(text);
    } catch (err) {
      loadError = err instanceof ImportError ? err.message : 'could not read this file';
      pendingEnvelope = null;
      return;
    }

    if (!pendingEnvelope.encrypted) {
      await decryptAndPreview();
    }
    // if encrypted, wait for the user to enter a passphrase and click "Unlock"
  }

  async function decryptAndPreview() {
    if (!pendingEnvelope) return;
    loadError = null;
    try {
      pendingPayload = await importEnvelope(
        pendingEnvelope,
        pendingEnvelope.encrypted ? loadPassphrase : undefined,
      );
    } catch (err) {
      loadError = err instanceof ImportError ? err.message : 'could not read this file';
      pendingPayload = null;
    }
  }

  function applyImport() {
    if (!pendingPayload) return;

    let incomingProgress: ProgressMap;
    let incomingProfile: Profile;
    let incomingHarden: HardenProgressMap | null = null;
    try {
      incomingProgress = migrateProgress(
        pendingPayload.progress,
        pendingPayload.schema_versions?.progress ?? 0,
      );
      incomingProfile = migrateProfile(
        pendingPayload.profile,
        pendingPayload.schema_versions?.profile ?? 0,
      );
      // harden is optional -- older exports, or a session that never touched the Harden
      // section, simply won't have it. Absence is not an error.
      if (pendingPayload.harden) {
        incomingHarden = migrateHardenProgress(
          pendingPayload.harden,
          pendingPayload.schema_versions?.harden ?? 0,
        );
      }
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'could not read this backup';
      return;
    }

    if (mergeChoice === 'replace') {
      progressStore.replaceAll(incomingProgress);
      if (incomingHarden) hardenProgressStore.replaceAll(incomingHarden);
    } else {
      progressStore.merge(incomingProgress);
      if (incomingHarden) hardenProgressStore.merge(incomingHarden);
    }

    profileStore.replaceAll(incomingProfile);

    pendingEnvelope = null;
    pendingPayload = null;
    loadPassphrase = '';
    if (fileInput) fileInput.value = '';
  }

  function cancelImport() {
    pendingEnvelope = null;
    pendingPayload = null;
    loadPassphrase = '';
    loadError = null;
    if (fileInput) fileInput.value = '';
  }

  $: importedDoneCount = pendingPayload
    ? Object.values(pendingPayload.progress as ProgressMap).filter((p) => p.done).length
    : 0;
  $: currentDoneCount = Object.values($progressStore).filter((p) => p.done).length;
</script>

<section class="transfer-block">
  <h2>Save your progress</h2>
  <p class="hint">
    Everything you've checked off lives only in this browser. Save a copy to pick up where you
    left off on another device, in another browser, or after clearing your data.
  </p>

  <label class="encrypt-toggle">
    <input type="checkbox" bind:checked={encryptOnSave} />
    Lock this file with a passphrase (recommended)
  </label>

  {#if encryptOnSave}
    <label class="passphrase-field save-passphrase-field">
      Passphrase
      <input type="password" bind:value={savePassphrase} placeholder="Something only you'd know" />
    </label>
  {:else}
    <p class="warning">
      Anyone who opens this file can read your name, address, and progress. Only skip
      encryption if you're storing it somewhere you already trust — your own encrypted drive,
      a password manager, etc.
    </p>
  {/if}

  <button class="save-btn" on:click={handleSave}>Save to a file</button>

  {#if saveError}<p class="error">{saveError}</p>{/if}
  {#if saveConfirmation}<p class="confirmation">{saveConfirmation}</p>{/if}
</section>

<section class="transfer-block">
  <h2>Continue here</h2>
  <p class="hint">Load a progress file saved from another device or browser.</p>

  <input
    bind:this={fileInput}
    type="file"
    accept="application/json"
    on:change={handleFileSelected}
  />

  {#if loadError}
    <p class="error">{loadError}</p>
  {/if}

  {#if pendingEnvelope && pendingEnvelope.encrypted && !pendingPayload}
    <label class="passphrase-field load-passphrase-field">
      Passphrase for {pendingFileName}
      <input type="password" bind:value={loadPassphrase} />
    </label>
    <button on:click={decryptAndPreview}>Unlock</button>
  {/if}

  {#if pendingPayload}
    <div class="import-preview">
      <p>
        This file has <strong>{importedDoneCount}</strong> broker{importedDoneCount === 1 ? '' : 's'}
        marked done. You currently have <strong>{currentDoneCount}</strong> marked done here.
      </p>
      <fieldset>
        <legend>What should happen?</legend>
        <label>
          <input type="radio" bind:group={mergeChoice} value="merge" />
          Combine both — anything done in either place stays done
        </label>
        <label>
          <input type="radio" bind:group={mergeChoice} value="replace" />
          Replace what's here with the file's progress
        </label>
      </fieldset>
      <div class="import-actions">
        <button class="cancel-btn" on:click={cancelImport}>Cancel</button>
        <button class="apply-btn" on:click={applyImport}>Load this progress</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .transfer-block {
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--rule, #c9c1b2);
  }
  .transfer-block:last-child {
    border-bottom: none;
  }
  h2 {
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .hint {
    color: var(--graphite, #6b6459);
    font-size: 0.9rem;
    max-width: 32rem;
  }
  .encrypt-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    margin: 1rem 0 0.5rem;
  }
  .passphrase-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    max-width: 20rem;
    margin: 0.5rem 0 1rem;
  }
  .passphrase-field input {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .warning {
    font-size: 0.85rem;
    color: var(--seal, #8a1c1c);
    max-width: 30rem;
    margin: 0.5rem 0 1rem;
  }
  .save-btn,
  .apply-btn {
    background: var(--seal, #8a1c1c);
    color: white;
    border: none;
    padding: 0.55rem 1.1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .cancel-btn {
    background: transparent;
    border: 1px solid var(--rule, #c9c1b2);
    padding: 0.55rem 1.1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .error {
    color: var(--seal, #8a1c1c);
    font-size: 0.9rem;
  }
  .confirmation {
    color: var(--graphite, #6b6459);
    font-size: 0.9rem;
    max-width: 30rem;
  }
  .import-preview {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--rule, #c9c1b2);
    border-radius: 4px;
  }
  .import-preview p {
    margin-top: 0;
    font-size: 0.9rem;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0.75rem 0;
  }
  legend {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--graphite, #6b6459);
    padding: 0;
    margin-bottom: 0.4rem;
  }
  fieldset label {
    display: block;
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
  }
  .import-actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }
</style>
