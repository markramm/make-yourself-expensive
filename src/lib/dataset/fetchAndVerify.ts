/**
 * Fetches the compiled broker dataset and verifies its content hash against the pin baked
 * into this build (src/data/dataset-manifest.ts), independently of trusting the served
 * manifest.json's own claimed hash -- we recompute from the raw bytes ourselves.
 *
 * Fail-loud, not fail-closed: a hash mismatch does not block the tool (a stale pin after a
 * routine release would otherwise deny service to real users over nothing malicious). It
 * still renders, but callers get `verified: false` so the UI can show a persistent warning.
 */
import { PINNED_DATASET } from '../../data/dataset-manifest';

export interface Broker {
  id: string;
  name: string;
  domain: string;
  category: string;
  people_search: boolean;
  tier: 'auto' | 'assisted' | 'guided';
  priority: 'crucial' | 'high' | 'standard';
  method: 'email' | 'form' | 'portal' | 'mail' | 'phone' | 'unsupported';
  opt_out_url: string | null;
  opt_out_email: string | null;
  phone: string | null;
  captcha: boolean;
  id_required: boolean;
  phone_required: boolean;
  charges_fee: boolean;
  verification: string | null;
  required_fields: string[];
  readd_days: number | null;
  legal_basis: string[];
  link_status: 'live' | 'bot-blocked' | 'redirect' | 'broken' | 'unknown';
  last_verified: string | null;
  source: string;
  notes?: string;
  instructions_md: string;
  /**
   * Set by normalizeBroker() when `opt_out_url` arrived as a `<verify:>` placeholder and was
   * nulled. Not a field the registry publishes -- it carries the fact that the URL is absent
   * BECAUSE it is unconfirmed, which a bare null cannot express. Absent on ordinary entries.
   */
  route_unconfirmed?: boolean;
  /** Same, for `opt_out_email`. 2 of 493 entries currently arrive this way. */
  opt_out_email_unconfirmed?: boolean;
}

export interface DatasetMeta {
  schema_version: string;
  dataset_version: string;
  content_hash: string;
  attribution: string;
  authored_count: number;
  backlog_count: number;
  total_known: number;
  unverified_count: number;
  tiers: Record<string, number>;
  priorities: Record<string, number>;
}

export interface DatasetResult {
  meta: DatasetMeta;
  brokers: Broker[];
  /** True if the freshly-fetched bytes hash to the value pinned in this build. */
  verified: boolean;
  /** Present only when verified is false -- for the mismatch banner / console.warn. */
  integrityWarning?: { expectedHash: string; actualHash: string };
}

// last_verified legitimately changes on every re-verification pass and must not affect the
// hash the frontend checks against -- mirrors scripts/build_brokers.py's HASH_EXCLUDED_FIELDS.
const HASH_EXCLUDED_FIELDS = new Set(['last_verified']);

// Codepoint order, NOT localeCompare -- localeCompare's collation depends on the user's
// machine/browser locale (punctuation, case, and accented characters can sort differently
// across locales), while Python's sorted() on strings is always codepoint order. Must match
// build_brokers.py's `entries.sort(key=lambda e: e.get("id", ""))` byte-for-byte, or
// verification could fail only for users in certain locales -- a nightmare to reproduce.
// Exported for a direct regression test against localeCompare's locale-dependent behavior.
export function compareCodepoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalForHash(brokers: Broker[]): string {
  const cleaned = brokers
    .map((b) => {
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b)) {
        if (!HASH_EXCLUDED_FIELDS.has(k)) copy[k] = v;
      }
      return copy;
    })
    .sort((a, b) => compareCodepoints(String(a.id), String(b.id)));
  return JSON.stringify(sortKeysDeep(cleaned));
}

// Matches Python's json.dumps(..., sort_keys=True) byte-for-byte for our data shapes (only
// plain objects/arrays/primitives -- no Dates, Maps, etc. appear in this dataset).
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The registry marks a field it could not confirm with an angle-bracket placeholder --
 * `<verify: what still needs checking>` -- rather than guessing a value or leaving it blank
 * (see the registry repo's CONTRIBUTING.md). Those placeholders are prose, not values: a
 * placeholder `opt_out_url` rendered as an href sends the reader to this site's own 404, and
 * because it is a non-empty string it also reads as truthy everywhere a component asks
 * "is there a URL?" -- which is how 7 phone-only rows lost their phone number.
 *
 * Normalizing them to null at this boundary fixes every consumer at once, and is strictly
 * safer than patching each call site: a future component that does `if (broker.opt_out_url)`
 * is then correct by default rather than newly broken.
 *
 * Nulling alone would lose WHY the field is empty, which the row still needs to say -- "nobody
 * has confirmed where this opt-out lives" is a different message from "this broker publishes
 * no URL at all". normalizeBroker() therefore records the fact as a flag alongside the null,
 * and that flag is what the badge and the row read.
 *
 * Exported as the single definition of the marker: anything that needs to recognise a
 * placeholder should call this rather than re-spelling the prefix, so the two cannot drift.
 */
export function isUnconfirmedPlaceholder(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('<verify:');
}

/**
 * Replaces unconfirmed-placeholder strings with null, and records on the entry that the
 * placeholder was there, so the badge layer keeps the information the null throws away.
 *
 * Runs AFTER the hash is computed, never before: the integrity check must hash exactly the
 * bytes the registry published, or the pin would only ever match a dataset we had already
 * rewritten -- which would verify our own edit rather than the registry's release.
 */
function normalizeBroker(broker: Broker): Broker {
  const urlUnconfirmed = isUnconfirmedPlaceholder(broker.opt_out_url);
  const emailUnconfirmed = isUnconfirmedPlaceholder(broker.opt_out_email);
  if (!urlUnconfirmed && !emailUnconfirmed) return broker;
  return {
    ...broker,
    opt_out_url: urlUnconfirmed ? null : broker.opt_out_url,
    opt_out_email: emailUnconfirmed ? null : broker.opt_out_email,
    route_unconfirmed: urlUnconfirmed,
    opt_out_email_unconfirmed: emailUnconfirmed,
  };
}

export async function fetchAndVerifyDataset(datasetUrl: string): Promise<DatasetResult> {
  const res = await fetch(datasetUrl);
  if (!res.ok) {
    throw new Error(`failed to fetch broker dataset: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { _meta: DatasetMeta; brokers: Broker[] };

  const recomputedHash = 'sha256:' + (await sha256Hex(canonicalForHash(data.brokers)));
  const verified = recomputedHash === PINNED_DATASET.contentHash;

  return {
    meta: data._meta,
    brokers: data.brokers.map(normalizeBroker),
    verified,
    ...(verified
      ? {}
      : { integrityWarning: { expectedHash: PINNED_DATASET.contentHash, actualHash: recomputedHash } }),
  };
}
