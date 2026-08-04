# Analytics

This site uses [Plausible](https://plausible.io) for aggregate, cookie-free page-view
counts. This is the one deliberate exception to "nothing leaves your browser" (non-negotiable
#1 in `README.md`) — everything below is what that exception actually covers, so anyone
auditing the code can see exactly where the line is drawn.

## What it collects

Automatic page views only: which page was loaded, an aggregate count, referrer source,
country/device/browser (derived server-side from the request, not stored per-visitor), and a
salted, rotating daily hash of IP + User-Agent that Plausible uses to dedupe unique visitors
without ever storing a persistent identifier. No cookies are set.

## What it never collects

- **Anything from `profileStore` or `progressStore`.** Name, email, address, phone, which
  brokers or hardening items are marked done — none of it is readable from `window`, and
  nothing in this codebase passes it to `plausible()`.
- **Broker-row or checklist-item interactions.** No custom event fires when a broker is
  marked done, a guided-batch level clears, a hardening item is checked, a field is copied
  to the clipboard, or an export/import happens. Grep the codebase for `plausible(` —
  there are no manual event calls anywhere in `src/`, only the automatic page-view pings
  Plausible's script sends on its own.
- **Anything that could reconstruct which specific brokers or hardening steps a visitor
  looked at.** A page view on `/brokers/` says someone visited the broker list. It says
  nothing about which of the 165 rows they read, expanded, or checked off.

## Where it's wired in

- `src/layouts/BaseLayout.astro` — the Plausible snippet, loaded on every page via the
  shared layout.
- The CSP in the same file allowlists exactly one third-party origin,
  `https://plausible.io`, in `script-src` (to load the snippet) and `connect-src` (to POST
  the page-view ping). No other third-party origin is reachable from this site — try
  `fetch()`-ing anything else from devtools and the browser blocks it.

## If you're contributing

Don't add a custom `plausible('EventName', ...)` call tied to a specific broker, hardening
item, or profile field — see `CONTRIBUTING.md`'s network-request constraint. Page-view-level
aggregate data is the whole point; anything more granular starts reconstructing an
individual visitor's specific choices, which is exactly what this project promises not to
do.

## Where the data lives

Aggregate dashboards are visible to the site maintainer via Plausible's hosted dashboard.
Plausible's own [data policy](https://plausible.io/data-policy) covers retention and
processing on their end.
