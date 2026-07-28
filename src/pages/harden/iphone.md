---
layout: ../../layouts/BaseLayout.astro
title: Harden Your iPhone
---

# Harden Your iPhone: The Five Settings That Actually Matter

In December 2024, the Federal Trade Commission caught a data broker called Mobilewalla holding more than 500 million advertising IDs paired with people's precise location — and selling the ability to draw a circle around a building and get a list of every phone that had been inside it. The FTC's own example of what that buys you: a segment of "visitors to pregnancy centers." Roughly 60% of that location data came from ordinary phone apps, scooped up through the ad auctions that fire every time an app loads a banner.

Here's the part that matters for you. That same pipeline — your phone, to an ad ID, to a broker, to a buyer — sells to the government too. A federal agency that isn't allowed to collect your location without a warrant can simply *buy* it from a broker who got it from your weather app. The EFF has tracked this exact data reaching Customs and Border Protection. In this transaction you are not the customer. You are the inventory.

So "privacy settings" turns out to be the wrong frame. This isn't about hiding. It's about cost. Every setting below makes you a little more expensive to surveil — and surveillance, like any other operation, runs on a budget. The goal isn't to disappear. It's to make yourself not worth the money.

Here are the five that matter on an iPhone. Not the top fifty. The five that change what someone can actually do to you.

## The one big idea: the most powerful security setting is the power button

Before any of the toggles, the most important thing to understand about your iPhone is counterintuitive, and almost nobody is told it:

**A phone that is turned off is dramatically harder to break into than a phone that is merely locked.**

Here's why. When your iPhone has been unlocked even once since it booted up, the keys that decrypt your data are sitting in its memory, ready to go. Forensic tools — the kind police and border agents use, made by companies like Cellebrite — are far better at pulling data off a phone in that "already been unlocked" state. But when a phone is powered *all the way off* and hasn't been unlocked since, those keys don't exist in memory yet. The data is a safe with the door welded shut. Leaked documents from the tool-makers themselves show that a powered-off, up-to-date iPhone is the case they struggle with most.

So the single most protective thing you can do, in any moment of real risk — a protest, a border crossing, a traffic stop — is hold the side button and a volume button until the slider appears, and **power the phone all the way down.** Not lock it. Off.

Everything else is settings. This is a habit. The habit matters more.

## Do this now: turn on Advanced Data Protection

If you only change one setting today, change this one.

By default, a lot of what's in your iCloud — your backups, your photos, your notes — is encrypted in a way where **Apple holds a key.** That's convenient if you get locked out. It also means that if someone sends Apple a subpoena, Apple can hand over the contents. You're trusting not just Apple, but everyone who can legally lean on Apple.

**Advanced Data Protection** changes that. Turn it on and those categories become end-to-end encrypted — meaning *Apple itself can no longer read them.* A legal demand to Apple comes back empty, because there's nothing for Apple to hand over.

> **Settings → tap your name at the top → iCloud → Advanced Data Protection → turn it on.**

It'll ask you to set up a recovery key or recovery contact first. Do it, and write the recovery key down somewhere physical — because the flip side of "Apple can't read your data" is "Apple can't recover it for you either." That's the deal. It's a good deal.

(One honest note, because this whole series runs on honesty: this protection is strong, but it's not untouchable by governments. In early 2025, the UK ordered Apple to build a backdoor into it, and rather than comply, Apple simply switched the feature off for UK users. The lesson isn't "don't use it." It's that even the best tool is a few political decisions away from changing — so the habits matter as much as the settings.)

## The everyday baseline: four toggles for a normal Tuesday

If you're not facing a specific threat, you're facing the *ambient* one — the quiet, constant harvesting that feeds the broker economy. These four close the biggest leaks.

**1. Tell apps not to track you.** *Settings → Privacy & Security → Tracking → turn off "Allow Apps to Request to Track."* This cuts the advertising identifier — think of it as a name tag every app could read to follow you across all the others. Turning it off is real and worth doing. It's also not magic: companies fall back to other tricks. But you've taken away the easy one.

**2. Turn off Apple's own ad tracking.** *Settings → Privacy & Security → Apple Advertising → turn off Personalized Ads.* Apple markets itself as the privacy company, and it's better than most — but it still runs an ad business that profiles you inside the App Store and News. Off.

**3. Lock down location.** *Settings → Privacy & Security → Location Services.* Go app by app: almost nothing needs "Always," and most things don't need "Precise." Then find **System Services → Significant Locations** and turn it off — that's the quiet log of the places you go most.

**4. Use a real passcode, and hide your notifications.** A six-digit PIN can be brute-forced by the same forensic tools mentioned above. A longer alphanumeric passphrase can't, in any practical timeframe. *Settings → Face ID & Passcode → Change Passcode → Passcode Options → Custom Alphanumeric Code.* And while you're there, set lock-screen previews to "When Unlocked" so your messages don't display to anyone holding your phone.

That's the baseline. Fifteen minutes, and you've made yourself meaningfully more expensive than you were this morning.

## If you're higher-risk: organizers, immigrants, journalists

If you're in a category where your phone could be searched or seized — at a protest, an arrest, an ICE encounter, a border crossing — the stakes change, and so does the playbook. A few additions, stated plainly, with no false comfort.

**Disable Face ID before any risk moment.** This is the uncomfortable part. Under current U.S. law, courts have more often allowed police to compel you to unlock a phone with your *face or fingerprint* than with a *passcode you remember* — the rough idea being that your face is a physical thing they can use, while the contents of your mind get more protection. That law is genuinely unsettled and split across the country, so don't treat it as a guarantee. But the practical move is clear: when seizure is possible, switch to passcode-only. Squeeze the side button and a volume button until the power-off slider appears, then cancel — your next unlock will require the passcode, not your face.

**At the border, the law is weaker — and it depends on who you are.** This is the most important and most carefully-stated paragraph here. U.S. citizens *cannot be denied entry* for refusing to unlock a device, though agents can seize it and hold you up. Green-card holders are in a stronger position than visa-holders but face real pressure. **Visa-holders and visa-waiver travelers can be turned away for refusing.** That asymmetry is the whole game: the same act of refusal carries wildly different costs depending on your status. The practical guidance from the Electronic Frontier Foundation: carry as little as possible, ideally a clean travel device; keep sensitive material in encrypted cloud storage (behind Advanced Data Protection) rather than on the device; and power the phone all the way off before you reach the checkpoint.

**Lockdown Mode, if you're a target.** If you have specific reason to think you're being targeted by government-grade spyware — the Pegasus class of tool, which can infect a phone with no tap or click from you — Apple's **Lockdown Mode** (*Settings → Privacy & Security → Lockdown Mode*) shrinks the attack surface these tools use. It's been confirmed to block real attacks. It also breaks some everyday features, which is why it's for people genuinely at risk, not everyone.

## The honest bottom line

What actually moves the needle: **Advanced Data Protection, a long passphrase, location minimization, and the habit of powering off.** Those four are not theater.

What's oversold: the tracking toggles help, but they don't stop everything — companies have other ways to follow you, and Apple's own collection isn't fully switched off by its own switches. Flip them anyway; just don't believe they make you invisible.

And the one truth under all of it, the one worth carrying out of this piece: **for a person who might be searched, the physical state of the device protects you more reliably than the law does** — especially if you're not a citizen, because that's exactly where the legal protections are thinnest. Off beats locked. A passphrase beats a face. Carrying less beats carrying a fortress.

You don't have to do all of this today. Do the power-off habit and Advanced Data Protection this afternoon. Come back for the rest.

---

*This is part of a [series on hardening the devices you actually carry](/harden/). Next: [Android](/harden/android/). Companion tool — a free, no-account walk-through for getting your data off the brokers — lives in the [Opt-Out section](/brokers/) of this site. For the deepest reference, the [Electronic Frontier Foundation's Surveillance Self-Defense](https://ssd.eff.org) is the standard.*
