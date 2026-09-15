import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Needed to mount .svelte components in tests. Without it vite hands the raw component
  // to its JS import analyser, which fails on the first `</script>` -- the error reads like
  // a syntax error in the component rather than a missing plugin, so it is worth naming here.
  plugins: [svelte()],
  resolve: {
    // Use each package's browser build. Svelte ships an SSR build that renders to a string
    // and never mounts to the DOM, which is not what a component test is checking.
    conditions: ['browser'],
  },
  test: {
    // Stays 'node'. The crypto suite relies on globalThis.crypto.subtle, and the vast
    // majority of tests here are pure functions that need no DOM. Component tests opt in
    // per file with a `// @vitest-environment jsdom` docblock -- verified that jsdom does
    // expose a working WebCrypto (PBKDF2 derive + AES-GCM encrypt), so the two coexist;
    // this is about not paying jsdom's setup cost on ~120 tests that never touch the DOM.
    environment: 'node',
  },
});
