import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // Node 20+ exposes globalThis.crypto.subtle natively; no DOM needed here
  },
});
