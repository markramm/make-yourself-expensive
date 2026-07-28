---
layout: ../../layouts/BaseLayout.astro
title: Harden Your Android
---

# Harden Your Android: The Settings That Make You Expensive

Remember Mobilewalla — the broker the FTC caught in 2024 holding 500 million people's locations, drawn from the ad auctions inside ordinary phone apps? On Android, there's a single number sitting at the center of that whole machine, and you can delete it.

It's called the advertising ID. Think of it as a name tag your phone wears that every app can read. By itself, one app knowing you opened it isn't much. But the ad ID is the *same* tag across every app, so the weather app, the game, and the flashlight can all report "this same person was here," and a broker can stitch those reports into a single profile — where you live, where you sleep, who you're near — and sell it. To a marketer. To a stalker. To a federal agency that isn't allowed to collect it but is allowed to buy it.

So on Android, the highest-leverage privacy move isn't hiding. It's pulling the name tag off. This isn't about disappearing — it's about cost. Every step below makes you more expensive to surveil, and surveillance runs on a budget.

Here are the settings that matter. Android's menus move around between phone-makers and versions, so the paths below are the common ones — if yours is slightly different, search the Settings app for the bold word.

## Do this now: delete your advertising ID

This is the one with the most leverage per second of effort.

> **Settings → Security & privacy → Privacy controls → Ads → Delete advertising ID.** (That's the Samsung/One UI path; on stock Android — Pixel and others — it's *Settings → Privacy → Ads*. If your menus differ, search the Settings app for **Delete advertising ID**.)

On Android 12 and newer, this doesn't just *reset* the tag to a new number — it removes it. Apps that ask for it get back a string of zeros. The durable thread that lets brokers follow you across every app, cut.

It's not a force field. Companies have other ways to recognize you — your IP address, the specific fingerprint of your device, the account you're logged into. But the ad ID is the *easy* one, the one the whole broker economy is built on by default. Take it away and you've broken the cheapest link in the chain.

While you're in your Google account, do the matching cleanup: go to **myaccount.google.com/privacycheckup** and turn off **Web & App Activity**, **Location History**, and **Ad personalization**, and set anything you keep to auto-delete after three months. One honest catch worth knowing: turning off Location History does *not* stop Google from logging your location — Web & App Activity quietly does it too, from your IP and "general area." So you have to turn off *both*. Google's own help pages admit this; most how-to articles don't.

## The one big idea: the most powerful security setting is the power button

Before the rest of the toggles, the thing almost nobody is told:

**A phone that is turned off is dramatically harder to break into than a phone that is merely locked.**

When your phone has been unlocked even once since it booted, the keys that decrypt your data are sitting in memory, ready. The forensic tools police and border agents use — made by companies like Cellebrite — are far better at pulling data off a phone in that "already unlocked" state. Power the phone *all the way off*, and those keys aren't in memory yet. The data is a safe with the door welded shut.

We actually know how well this works, because the tool-makers' own capability documents leaked. They showed Cellebrite could pull data from ordinary Android phones in most states — but a powered-off phone is the hardest case, and certain hardened phones, fully off, they simply listed as inaccessible.

So in any moment of real risk — a protest, a border crossing, a traffic stop — the single most protective thing you can do is hold the power button and turn the phone **all the way off.** Not lock it. Off. Everything else is settings. This is a habit, and the habit matters more.

## The everyday baseline: four moves for a normal Tuesday

**1. Audit your app permissions.** *Settings → Security & privacy → Privacy controls → Permission manager.* Go through Location, Camera, Microphone, and the one people miss — **Nearby devices**. Set location to "Approximate" or "Only while using" wherever you can; a weather app does not need your exact GPS point or your location at 3 a.m. Leave "remove permissions if app unused" turned on, so the apps you forget about lose their access automatically.

**2. Use Firefox with uBlock Origin.** This is the one place your Android phone genuinely beats an iPhone. Install **Firefox**, then add the **uBlock Origin** extension — it blocks ads and trackers at the network level, before they even load. (Chrome on Android allows no such extensions, and on iPhones Apple forbids this entirely.) Set **DuckDuckGo** as your search engine while you're at it.

**3. Use a real screen lock, and hide your notifications.** *Settings → Security & privacy → Device unlock → Screen lock.* A longer PIN or a passphrase, not a four-digit code. Then turn off lock-screen notification previews so your messages don't display to anyone holding the phone.

**4. Turn off Wi-Fi and Bluetooth scanning.** *Settings → Location → Location services →* turn off **Wi-Fi scanning** and **Bluetooth scanning**. This is the "improve location accuracy" feature, and what it actually does is let apps locate you by the Wi-Fi and Bluetooth signals around you *even when your GPS is off.* Few people need that; everyone has it on by default.

That's the baseline. Twenty minutes, and you've gone from the easiest target in the room to one that costs real money to track.

## If you're higher-risk: organizers, immigrants, journalists

If your phone could be searched or seized — at a protest, an arrest, an ICE encounter, a border crossing — the stakes change. A few additions, stated plainly, with no false comfort.

**Turn off fingerprint and face unlock before any risk moment.** Under current U.S. law, courts have more often allowed police to compel you to unlock with your *fingerprint or face* than with a *passcode you remember* — your body is treated as a physical thing they can use, while the contents of your mind get more protection. That law is genuinely unsettled and split across the country, so don't treat it as a guarantee. The practical move: when seizure is possible, restart the phone (after a reboot, most Androids require the PIN, not your fingerprint, on the first unlock) and rely on a memorized passcode.

**Consider a hardened phone if this is your life, not just your worry.** For people at serious, sustained risk — some journalists and organizers — there's **GrapheneOS**, a stripped-down, de-Googled version of Android that runs only on Google's Pixel phones. It adds real defenses: a "duress PIN" that wipes the phone if you're forced to unlock it, hardware that refuses data connections over USB while locked (the exact thing forensic tools exploit), and the ability to deny any app internet access. In those leaked Cellebrite documents, fully-locked Pixels running GrapheneOS were the ones listed as inaccessible. It's not for everyone — it can break apps, and it's a commitment — but it's the real thing.

**At the border, the law is weaker — and it depends on who you are.** This is the paragraph to read twice. U.S. citizens *cannot be denied entry* for refusing to unlock a device, though agents can seize it and hold you up. Green-card holders are stronger than visa-holders but face real pressure. **Visa-holders and visa-waiver travelers can be turned away for refusing.** The same act of refusal carries wildly different costs depending on your status. The practical guidance from the EFF: carry as little as possible, ideally a clean travel device; keep sensitive material in encrypted cloud storage, not on the phone; and power the device all the way off before you reach the checkpoint.

**Turn off 2G.** *Settings → Network & internet → SIMs →* disable 2G. Cell-site simulators — the fake cell towers police use to sweep up phones at protests, sometimes called Stingrays — generally work by forcing your phone down onto old, insecure 2G. Refusing 2G closes that door.

## The honest bottom line

What actually moves the needle: **deleting the ad ID and minimizing your Google account, a strong screen lock, and the habit of powering off.** Those are not theater.

What's oversold: the tracking toggles help, but they don't make you invisible — your IP and device fingerprint still identify you, and Google's location logging hides in more than one switch. Flip everything anyway; just don't mistake it for a cloak.

And the one truth under all of it: **for a person who might be searched, the physical state of the device protects you more reliably than the law does** — especially if you're not a citizen, because that's exactly where the legal protections are thinnest. Off beats locked. A passphrase beats a fingerprint. Carrying less beats carrying a fortress.

You don't have to do all of this today. Delete the ad ID and learn the power-off habit this afternoon. Come back for the rest.

---

*This is part of a [series on hardening the devices you actually carry](/harden/). Next: [your Mac](/harden/mac/) or [Windows PC](/harden/windows/). Companion tool — a free, no-account walk-through for getting your data off the brokers — lives in the [Opt-Out section](/brokers/) of this site. The deepest reference is the [Electronic Frontier Foundation's Surveillance Self-Defense](https://ssd.eff.org).*
