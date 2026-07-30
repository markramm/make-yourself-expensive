// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://become-expensive.transparencycascade.org',
  output: 'static',
  integrations: [svelte(), mdx(), sitemap()]
});