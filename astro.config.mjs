// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://become-expensive.transparencycascade.org',
  output: 'static',
  // The section is called "Opt-Out" everywhere a human reads it -- the nav label, the
  // homepage prose, and the published field guide this site came from -- but the route
  // is /brokers. Anyone who types or shares the obvious URL gets a 404. Redirect rather
  // than rename: /brokers is what's already been linked.
  //
  // These now land on the guided flow rather than the full list, following the nav: someone
  // typing the section's human name wants to START opting out, not to meet 493 rows at once.
  // /brokers itself is untouched and still serves the full list for anyone who linked it.
  // '/opt-out/' is deliberately NOT listed: Astro emits /opt-out/index.html, which already
  // serves both the slashed and unslashed forms. Declaring both collides on one static
  // route -- a warning today, a hard error in a later Astro.
  redirects: {
    '/opt-out': '/brokers/guide/',
    '/optout': '/brokers/guide/',
  },
  integrations: [svelte(), mdx(), sitemap()]
});