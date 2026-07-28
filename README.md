# Make Yourself Expensive

A free, no-account, no-server toolkit for making yourself a harder, more expensive target
for surveillance and data-harvesting. Static site (Astro + Svelte islands) — nothing you
enter here is ever transmitted anywhere. Your profile and progress live only in this
browser's local storage.

This is the umbrella site: **Opt-Out** (data broker removal — the first section, and the
one this repo currently implements) sits alongside planned sections on hardening your own
devices (phone, laptop/desktop) and other tools for reducing your footprint. It replaces an
earlier single-purpose opt-out-only tool of the same name.

The broker dataset the Opt-Out section consumes lives in its own repo,
[`data-broker-registry`](https://github.com/markramm/data-broker-registry) — deliberately
separate so it can be reused by other tools, run locally, or forked independently of this
site.

## Non-negotiables

1. **No server touches PII.** Fully static; all logic is client-side.
2. **Verifiable.** Open source, and the broker dataset's content hash is pinned into this
   build and checked against the fetched data on every load — see
   `src/lib/dataset/fetchAndVerify.ts`.
3. **No account, no signup.**
4. **The dataset is a commons**, decoupled from this app — see the
   [`data-broker-registry`](https://github.com/markramm/data-broker-registry) repo's
   `data/brokers/` and `broker.schema.json`. This app only ever fetches the compiled,
   hash-pinned artifact, never the raw source.
5. **PII never enters a URL.** No query-param prefills, anywhere, ever.

## Development

```sh
npm install
npm run dev       # localhost:4321
npm run build     # static output to ./dist/
npm run test      # vitest — crypto, dataset integrity, CCPA template, badge contract
npm run astro check
```

## Structure

- `src/lib/crypto/exportImport.ts` — WebCrypto (PBKDF2 + AES-GCM) profile/progress backup,
  encrypted by default.
- `src/lib/dataset/fetchAndVerify.ts` + `src/data/dataset-manifest.ts` — fetches the broker
  dataset and verifies its content hash against the pin baked into this build. Fails loud
  (a visible banner), not closed — a stale pin shouldn't deny service to real users.
- `src/lib/templates/ccpaRequest.ts` — composes the auto-tier CCPA opt-out email; falls back
  to a downloadable `.eml` when the request is too long for a `mailto:` link.
- `src/stores/profile.ts`, `src/stores/progress.ts` — the two local-storage-backed Svelte
  stores everything else reads from.
- `src/components/BrokerRow/` — one row-shell + three tier-specific action components
  (auto/assisted/guided), plus the pure `badgeContract.ts` that the unverified-badge
  contract test checks against.

## Dataset

`public/data/brokers.json` is a copy of the compiled artifact from the
[`data-broker-registry`](https://github.com/markramm/data-broker-registry) repo's dataset
pipeline. Updating it is a deliberate two-step process: copy the new `data/brokers.json`,
then update `src/data/dataset-manifest.ts`'s `datasetVersion`/`contentHash` to match — never
one without the other.

## Deploying

See `DEPLOYING.md` — static, hosted via GitHub Pages at
`become-expensive.transparencycascade.org`.

## Contributing

See `CONTRIBUTING.md` for the constraints that shape this codebase (PII-in-URL rules,
dataset-pin update process, the badge-contract test) before opening a PR.

## License

MIT. See `LICENSE`. The broker dataset itself is licensed separately (CC BY-NC-SA 4.0) in
the `data-broker-registry` repo.
