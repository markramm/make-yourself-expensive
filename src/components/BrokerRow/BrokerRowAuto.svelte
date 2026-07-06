<script lang="ts">
  import type { Broker } from '../../lib/dataset/fetchAndVerify';
  import type { Profile } from '../../stores/profile';
  import { composeRequest, planDelivery } from '../../lib/templates/ccpaRequest';

  export let broker: Broker;
  export let profile: Profile;

  let downloadUrl: string | null = null;
  let downloadName = '';
  let error: string | null = null;

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
</script>

<div class="auto-action">
  <button on:click={send}>Compose opt-out email</button>
  {#if downloadUrl}
    <a href={downloadUrl} download={downloadName} class="eml-link">
      Download {downloadName} (open it in your mail app to send)
    </a>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
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
</style>
