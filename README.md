# Protect

A free, no-account, no-server tool for opting out of data brokers. Static site (Astro +
Svelte islands) — nothing you enter here is ever transmitted anywhere. Your profile and
progress live only in this browser's local storage.

This is the operational successor to
[Make Yourself Expensive](https://github.com/) — same mission, now with a real tiered
action model (auto/assisted/guided), an on-device profile, and dataset integrity
verification instead of a static broker list.

## Non-negotiables

1. **No server touches PII.** Fully static; all logic is client-side.
2. **Verifiable.** Open source, and the broker dataset's content hash is pinned into this
   build and checked against the fetched data on every load — see
   `src/lib/dataset/fetchAndVerify.ts`.
3. **No account, no signup.**
4. **The dataset is a commons**, decoupled from this app — see the `make-yourself-expensive`
   repo's `data/brokers/` and `broker.schema.json`. This app only ever fetches the compiled,
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
`make-yourself-expensive` repo's dataset pipeline. Updating it is a deliberate two-step
process: copy the new `data/brokers.json`, then update `src/data/dataset-manifest.ts`'s
`datasetVersion`/`contentHash` to match — never one without the other.

## License

MIT. See `LICENSE`. The broker dataset itself is licensed separately (CC BY-NC-SA 4.0) in
the `make-yourself-expensive` repo.
