# Deploying

Static site, no server — GitHub Pages via Actions. `.github/workflows/deploy.yml` runs the
test suite, typechecks, builds, and publishes on every push to `main`.

## One-time setup

1. **Push this repo to GitHub** (if not already):
   ```sh
   git remote add origin git@github.com:<org>/protect.git
   git push -u origin main
   ```
2. **In the GitHub repo settings → Pages**, set the source to "GitHub Actions" (not the
   legacy branch-based Pages deploy). The `deploy.yml` workflow handles the rest.
3. **Confirm/update the subdomain** in `public/CNAME`. It currently says
   `protect.transparencycascade.org` — a placeholder guess based on the app's working
   title, not confirmed. Change it if the final subdomain differs, and note: changing it
   later means updating both this file and the DNS record below, and possibly waiting out
   a browser HSTS cache on the old value if anyone already visited it over HTTPS.
4. **Add a DNS record** at the domain registrar/DNS host for `transparencycascade.org`:
   ```
   Type: CNAME
   Name: protect  (or whatever subdomain public/CNAME says)
   Value: <org>.github.io.
   ```
   (GitHub's docs call this out specifically: use `<org>.github.io`, not the repo-specific
   `<org>.github.io/protect` path — the CNAME file is what tells Pages which repo serves
   the custom domain.)
5. **Back in repo settings → Pages**, add the same custom domain and wait for GitHub to
   verify DNS and provision a TLS certificate (can take a few minutes to a few hours).
   Once provisioned, enable "Enforce HTTPS."

## Every subsequent deploy

Just push to `main`. The workflow:
1. Runs `npm test` and `npx astro check` — a failure here blocks the deploy.
2. Builds (`npm run build`) and uploads `dist/` as a Pages artifact.
3. Publishes it.

## Updating the broker dataset

Deploying a new dataset version is a normal code change, not a special operation — see
`CONTRIBUTING.md`'s "Updating the broker dataset" section. Copy the new
`public/data/brokers.json`, update `src/data/dataset-manifest.ts`'s hash/version to match,
commit, push. The same test-then-build-then-deploy pipeline applies.
