# Testing this site

This is an **alpha**. It works, it is not finished, and the fastest way to make it better
is someone who is not its author trying to actually opt out of something with it.

You do not need to be technical. If you can follow a set of instructions and say "this step
didn't work," that is the whole job.

## What this tool is

A free, no-account, no-server toolkit for getting your personal information out of the
data-broker economy by hand. It exists because of a finding worth repeating: a 2024
*Consumer Reports* study found paid removal services removed about **35%** of participants'
records over four months, while **doing it yourself removed 70%**. Free DIY matches the best
paid service and beats all the others. The thing standing between most people and that 70%
is an hour and knowing where to start — so this is the "where to start."

## Before you begin — the one thing to know

**Nothing you type here leaves your browser.** No server receives your name, address, or
progress; it is a static page and everything is stored locally on your device. You can read
the code, or have someone technical you trust read it.

The one exception is an aggregate, cookie-free page-view count (see `ANALYTICS.md`) — it
never carries anything from your profile, and it never records *which* broker you clicked.

**That said**: this is alpha software handling personal information. If you are in a
situation where your address being findable is a physical safety matter — an abuse
survivor, someone being harassed, a public official — please do not learn this tool on
your live data. Use it with a throwaway profile first, or wait for a later release.

## The three things most worth testing

### 1. Does an opt-out actually work, start to finish?

Pick **one** broker and follow it the whole way. This is the highest-value report by a
wide margin, because it is the only thing the author cannot easily do at scale.

Tell us: did the broker's page look like what we said it would? Were the fields we told you
to fill actually the fields it asked for? Was there a CAPTCHA we didn't warn you about? Did
you get a confirmation email? **Did your listing actually come down, and how long did it
take?**

### 2. Is the instruction wrong, or just hard?

Those are different bugs and we want them separated.

- *"The page said to paste a listing URL but there's no field for it"* → the instruction is
  wrong. High value.
- *"I couldn't figure out where to find my listing URL"* → the instruction is unclear. Also
  high value, and more common.

### 3. Does it make sense before you've done it once?

Read the homepage and the top of the broker list as if you had never heard of any of this.
Where do you get lost? What word did you have to look up? The author has been staring at
this for months and can no longer see it fresh — you can, exactly once. Spend it.

## Known-incomplete, so don't bother reporting

- **Most entries are marked UNVERIFIED.** 456 of 493 as of dataset 0.1.15. That badge is
  honest, not broken: it means a human has not yet confirmed the routing against the
  broker's own page. Finding out that an unverified entry is *wrong* is exactly the
  contribution we want — the badge tells you where to look.
- **The Harden section is thin.** Device-hardening guides are next, not done.
- **Some brokers are dead.** Domains lapse constantly in this industry. Telling us a site no
  longer exists is a real fix — we drop them.
- **There is no sync between devices.** By design. Your progress is on one browser, on one
  machine. Clearing site data clears it.

## What a good report looks like

Short is fine. What we need:

```
Broker: spokeo.com
What I expected (from the tool): paste listing URL + email, solve CAPTCHA
What actually happened: the form also demanded a phone number, and the
  CAPTCHA failed twice in Firefox before working
Browser/device: Firefox 141, macOS
Did the listing come down? Not yet — 3 days so far
```

Anything missing from that is still worth sending. A one-line "the Harden link 404s on my
phone" is a useful bug.

## Where to send it

Open an issue at <https://github.com/markramm/make-yourself-expensive/issues>, or reply to
the post that brought you here if a GitHub account is a barrier. **Do not paste your real
name, address, or the contents of your profile into an issue** — describe the shape of the
problem, not your personal data.

If the bug is in a *broker entry* specifically (wrong URL, wrong fields, site is dead),
that lives in the dataset repo instead: <https://github.com/markramm/data-broker-registry>
— see its `CONTRIBUTING.md`. One markdown file per broker, no code required.

## For developers

```sh
npm install
npm run dev        # localhost:4321
npm test           # vitest -- crypto, dataset integrity, CCPA template, badge contract
npx astro check    # typecheck
npm ci             # run at least once before pushing; CI fails hard on lockfile drift
```

Read `CONTRIBUTING.md` first — the non-negotiables there (no PII in URLs, no third-party
network calls beyond the one allowlisted analytics exception, encryption default-on) are
structural, not stylistic, and a PR that breaks one will be rejected on principle rather
than on taste.
