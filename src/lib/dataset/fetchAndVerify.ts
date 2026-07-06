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

function canonicalForHash(brokers: Broker[]): string {
  const cleaned = brokers
    .map((b) => {
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b)) {
        if (!HASH_EXCLUDED_FIELDS.has(k)) copy[k] = v;
      }
      return copy;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
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
    brokers: data.brokers,
    verified,
    ...(verified
      ? {}
      : { integrityWarning: { expectedHash: PINNED_DATASET.contentHash, actualHash: recomputedHash } }),
  };
}
