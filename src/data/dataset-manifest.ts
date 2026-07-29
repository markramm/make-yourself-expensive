/**
 * The dataset content hash and version THIS BUILD was tested against and ships expecting.
 * Committed to git so the pin itself is auditable history -- bumping it is a deliberate,
 * reviewable PR against the broker-data repo's release, not an automatic pull.
 *
 * Source of truth: the broker-data repo's data/manifest.json, emitted by
 * scripts/build_brokers.py. Update both fields together when bumping to a new dataset release.
 */
export const PINNED_DATASET = {
  datasetVersion: '0.1.8',
  contentHash: 'sha256:5b5d06897bd0faeb308dbd5c7ea67c816f456c8536418140f887aaf27a68645c',
  // Same-origin static path the app fetches at runtime -- update if the dataset is hosted
  // elsewhere (CDN, GitHub release asset, etc).
  url: '/data/brokers.json',
} as const;
