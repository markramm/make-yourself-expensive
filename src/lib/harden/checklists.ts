/**
 * Concrete, checkable action items extracted from each src/pages/harden/*.md guide -- kept
 * as data here rather than inline in the Markdown so the same list can render both at the
 * end of each article and standalone (for someone who's already done the steps and doesn't
 * need to re-read the guide). Items are hand-extracted from each guide's actual settings
 * paths/recommendations, not paraphrased from memory -- keep this in sync if a guide's
 * concrete steps change.
 */

export type HardenTier = 'baseline' | 'higher-risk';

export interface HardenItem {
  /** Stable across re-renders/reorderings -- this is the localStorage key, never reuse or repurpose one. */
  id: string;
  label: string;
  /** The exact settings path from the guide, shown as a monospace hint under the label. */
  path?: string;
  tier: HardenTier;
}

export interface HardenGuide {
  device: string;
  title: string;
  href: string;
  items: HardenItem[];
}

export const HARDEN_CHECKLISTS: HardenGuide[] = [
  {
    device: 'iphone',
    title: 'iPhone',
    href: '/harden/iphone/',
    items: [
      {
        id: 'iphone:power-off-habit',
        label: 'Learn the power-off habit for moments of real risk',
        path: 'Hold the side button + a volume button, then power all the way down',
        tier: 'baseline',
      },
      {
        id: 'iphone:advanced-data-protection',
        label: 'Turn on Advanced Data Protection',
        path: 'Settings → your name → iCloud → Advanced Data Protection',
        tier: 'baseline',
      },
      {
        id: 'iphone:app-tracking',
        label: 'Turn off "Allow Apps to Request to Track"',
        path: 'Settings → Privacy & Security → Tracking',
        tier: 'baseline',
      },
      {
        id: 'iphone:personalized-ads',
        label: "Turn off Apple's Personalized Ads",
        path: 'Settings → Privacy & Security → Apple Advertising',
        tier: 'baseline',
      },
      {
        id: 'iphone:location-services',
        label: 'Lock down Location Services app-by-app; turn off Significant Locations',
        path: 'Settings → Privacy & Security → Location Services → System Services',
        tier: 'baseline',
      },
      {
        id: 'iphone:passcode',
        label: 'Switch to a custom alphanumeric passcode; hide lock-screen previews',
        path: 'Settings → Face ID & Passcode → Change Passcode → Passcode Options',
        tier: 'baseline',
      },
      {
        id: 'iphone:disable-face-id-before-risk',
        label: 'Know how to disable Face ID fast before a risk moment (power button, then Cancel)',
        tier: 'higher-risk',
      },
      {
        id: 'iphone:lockdown-mode',
        label: 'Turn on Lockdown Mode if you have specific reason to be targeted',
        path: 'Settings → Privacy & Security → Lockdown Mode',
        tier: 'higher-risk',
      },
    ],
  },
  {
    device: 'android',
    title: 'Android',
    href: '/harden/android/',
    items: [
      {
        id: 'android:power-off-habit',
        label: 'Learn the power-off habit for moments of real risk',
        tier: 'baseline',
      },
      {
        id: 'android:delete-ad-id',
        label: 'Delete your advertising ID',
        path: 'Settings → Security & privacy → Privacy controls → Ads',
        tier: 'baseline',
      },
      {
        id: 'android:google-privacy-checkup',
        label: 'Turn off Web & App Activity, Location History, and Ad personalization',
        path: 'myaccount.google.com/privacycheckup',
        tier: 'baseline',
      },
      {
        id: 'android:app-permissions',
        label: 'Audit app permissions, especially Location and Nearby devices',
        path: 'Settings → Security & privacy → Privacy controls → Permission manager',
        tier: 'baseline',
      },
      {
        id: 'android:firefox-ublock',
        label: 'Install Firefox + uBlock Origin, set DuckDuckGo as default search',
        tier: 'baseline',
      },
      {
        id: 'android:screen-lock',
        label: 'Set a real screen lock (PIN/passphrase, not 4 digits); hide notification previews',
        path: 'Settings → Security & privacy → Device unlock → Screen lock',
        tier: 'baseline',
      },
      {
        id: 'android:wifi-bluetooth-scanning',
        label: 'Turn off Wi-Fi scanning and Bluetooth scanning',
        path: 'Settings → Location → Location services',
        tier: 'baseline',
      },
      {
        id: 'android:disable-biometric-before-risk',
        label: 'Know how to restart to a passcode-only unlock before a risk moment',
        tier: 'higher-risk',
      },
      {
        id: 'android:disable-2g',
        label: 'Disable 2G (defeats most cell-site simulators)',
        path: 'Settings → Network & internet → SIMs',
        tier: 'higher-risk',
      },
      {
        id: 'android:grapheneos',
        label: 'Consider GrapheneOS if this is sustained, serious risk, not just a worry',
        tier: 'higher-risk',
      },
    ],
  },
  {
    device: 'mac',
    title: 'Mac',
    href: '/harden/mac/',
    items: [
      {
        id: 'mac:filevault',
        label: 'Turn on FileVault; save the recovery key somewhere physical',
        path: 'System Settings → Privacy & Security → FileVault',
        tier: 'baseline',
      },
      {
        id: 'mac:long-passphrase',
        label: 'Set a real passphrase (EFF rule of thumb: six random words)',
        tier: 'baseline',
      },
      {
        id: 'mac:shutdown-habit',
        label: 'Learn to Shut Down (not sleep, not close-the-lid) before any risk moment',
        tier: 'baseline',
      },
      {
        id: 'mac:permissions',
        label: 'Review Accessibility, Full Disk Access, Screen Recording, Input Monitoring grants',
        path: 'System Settings → Privacy & Security',
        tier: 'baseline',
      },
      {
        id: 'mac:analytics-ads',
        label: 'Turn off Analytics & Improvements and Personalized Ads',
        path: 'System Settings → Privacy & Security',
        tier: 'baseline',
      },
      {
        id: 'mac:firefox-ublock',
        label: 'Use Firefox + uBlock Origin',
        tier: 'baseline',
      },
      {
        id: 'mac:firewall',
        label: 'Turn on the firewall (blocks incoming, not outgoing -- know the limit)',
        path: 'System Settings → Network → Firewall',
        tier: 'baseline',
      },
      {
        id: 'mac:auto-updates',
        label: 'Turn on automatic updates, including Rapid Security Responses',
        tier: 'baseline',
      },
      {
        id: 'mac:lockdown-mode',
        label: 'Turn on Lockdown Mode if you might be a spyware target',
        path: 'Privacy & Security → Lockdown Mode',
        tier: 'higher-risk',
      },
    ],
  },
  {
    device: 'windows',
    title: 'Windows',
    href: '/harden/windows/',
    items: [
      {
        id: 'windows:confirm-encryption',
        label: 'Confirm Device Encryption / BitLocker is actually on',
        path: 'Settings → Privacy & security → Device encryption (or search "manage-bde")',
        tier: 'baseline',
      },
      {
        id: 'windows:check-recovery-key',
        label: 'Check whether Microsoft is holding your recovery key',
        path: 'account.microsoft.com/devices/recoverykey',
        tier: 'baseline',
      },
      {
        id: 'windows:shutdown-habit',
        label: 'Shut down fully (not sleep) before any risk moment',
        tier: 'baseline',
      },
      {
        id: 'windows:optional-telemetry',
        label: 'Turn off optional diagnostic data',
        path: 'Settings → Privacy & security → Diagnostics & feedback',
        tier: 'baseline',
      },
      {
        id: 'windows:ad-id',
        label: 'Turn off personalized ads via advertising ID',
        path: 'Settings → Privacy & security → Recommendations & offers',
        tier: 'baseline',
      },
      {
        id: 'windows:firefox-ublock',
        label: 'Use Firefox + uBlock Origin instead of Edge defaults',
        tier: 'baseline',
      },
      {
        id: 'windows:recall',
        label: "Turn off or remove Recall if you're not using it",
        path: 'Settings → Privacy & security → Recall & snapshots',
        tier: 'baseline',
      },
      {
        id: 'windows:preboot-pin',
        label: 'Add a pre-boot PIN (defeats the TPM-sniffing attack)',
        tier: 'higher-risk',
      },
      {
        id: 'windows:rotate-recovery-key',
        label: "Delete the escrowed key from Microsoft's servers and rotate it",
        tier: 'higher-risk',
      },
      {
        id: 'windows:local-account',
        label: 'Consider moving to a local account instead of a Microsoft account',
        tier: 'higher-risk',
      },
    ],
  },
];

export function checklistFor(device: string): HardenGuide | undefined {
  return HARDEN_CHECKLISTS.find((g) => g.device === device);
}
