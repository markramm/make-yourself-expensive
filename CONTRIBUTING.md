# Contributing

## Setup

```sh
npm install
npm run dev        # localhost:4321
npm test           # vitest -- run this before every PR
npx astro check    # typecheck
```

**Before pushing**, run `npm ci` (not just `npm install`) at least once and confirm it
succeeds. `npm install` will happily update `node_modules` from a lockfile that's drifted
out of sync with `package.json` -- `npm ci` is what CI actually runs, and it fails hard on
that drift instead of quietly tolerating it. This has broken the deploy workflow more than
once (usually after installing a new dependency or running a tool like `playwright install`
that touches platform-specific optional deps) -- `npm ci` locally catches it before a push
does.

## The constraints that shape everything here

This app's whole reason to exist is "no server touches your data, and you don't have to
take our word for it." Concretely, that means:

- **Nothing in `src/` makes a network request except fetching the static dataset JSON and
  the one allowlisted analytics exception.** `BaseLayout.astro` loads Plausible
  (`plausible.io`) for aggregate, cookie-free page-view counts -- see `ANALYTICS.md` for
  exactly what it does and doesn't collect. That is the *only* third-party network call this
  app makes, and the CSP in `BaseLayout.astro` enforces it structurally (only `'self'` and
  `plausible.io` are allowlisted in `connect-src`/`script-src`). **Never fire a custom
  Plausible event from broker-row or hardening-checklist interactions** -- page views only.
  If you're tempted to add a *new* third-party script or telemetry beyond this one
  allowlisted exception, don't; bring it up first.
- **Profile data (name, email, address, phone, ...) may never end up in a URL, `href`,
  or browser history.** See `src/components/BrokerRow/BrokerRowAssisted.svelte` for the
  pattern: the opt-out link is rendered exactly as authored, untouched; profile values only
  ever reach `navigator.clipboard.writeText()` inside a click handler. If you're adding a
  new way to hand profile data to a broker, that's the bar to match.
- **Encryption is default-on, not opt-in**, for anything that leaves the browser (export
  files). See `src/lib/crypto/exportImport.ts`.
- **Dataset integrity checks fail loud, not closed.** A hash mismatch shows a warning
  banner; it does not block the user from using the tool. See
  `src/lib/dataset/fetchAndVerify.ts` for why -- denying service over what's usually just a
  forgotten version bump does more harm than good.

## Updating the broker dataset

The dataset lives in a separate repo (`data-broker-registry`, `data/brokers/` +
`broker.schema.json`) on purpose -- this app only ever consumes the *compiled* artifact, per
non-negotiable #4 (the dataset is a commons, decoupled from any one frontend). To pull in a
new dataset release:

1. Copy the new `data/brokers.json` from that repo into `public/data/brokers.json` here.
2. Update **both** `datasetVersion` and `contentHash` in `src/data/dataset-manifest.ts` to
   match that build's `_meta.dataset_version` / `_meta.content_hash` -- never update one
   without the other, and never hand-edit the hash without actually copying the matching
   dataset file, or the integrity check will (correctly) start failing on every load.
3. Run `npm test` -- the dataset test suite (`src/lib/dataset/__tests__/fetchAndVerify.test.ts`)
   asserts the JS-side canonical-hash implementation agrees byte-for-byte with the Python
   build script's. If this fails after a dataset update, don't just update the pinned hash to
   make it pass -- figure out whether the two canonicalization implementations have drifted
   (see the test's comments; this has happened once already, over non-ASCII character
   escaping).

## Adding a new broker action tier or row variant

Tier-specific behavior lives in `src/components/BrokerRow/BrokerRow{Auto,Assisted,Guided}.svelte`,
dispatched from `BrokerRow.svelte` by `broker.tier`. All three share `RowShell.svelte` for the
strikethrough/priority-badge/unverified-badge chrome -- don't duplicate that markup in a new
variant; extend the shell instead.

The unverified-badge logic is deliberately factored into a pure function,
`badgeContract.ts`, rather than left inline in the Svelte template, specifically so it has a
direct unit test (`badgeContract.test.ts`) asserting "`last_verified: null` must show the
unverified badge." If you touch badge-rendering logic, keep it in that pure function and make
sure the test still passes -- this is the one rendering contract this project treats as
load-bearing enough to test directly rather than trust to code review.

## Tests

Run `npm test` before opening a PR. At minimum:

- `src/lib/crypto/__tests__/` -- encryption round-trips, wrong-passphrase handling, malformed
  input.
- `src/lib/dataset/__tests__/` -- hash verification against the real checked-in dataset,
  including the cross-language agreement check above.
- `src/lib/templates/__tests__/` -- the CCPA template's mailto/.eml length branching. If
  you change the template or the length threshold, add a case rather than just adjusting
  the existing assertions -- the whole point of this suite is catching silent truncation of
  a legal request.
- `src/components/BrokerRow/__tests__/badgeContract.test.ts` -- the unverified-badge contract.

## License

MIT (see `LICENSE`). The broker dataset this app consumes is licensed separately
(CC BY-NC-SA 4.0) in the `data-broker-registry` repo -- don't add dataset content
directly to this repo; contribute it upstream instead.
