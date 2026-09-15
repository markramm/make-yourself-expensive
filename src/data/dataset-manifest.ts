/**
 * The dataset content hash and version THIS BUILD was tested against and ships expecting.
 * Committed to git so the pin itself is auditable history -- bumping it is a deliberate,
 * reviewable PR against the broker-data repo's release, not an automatic pull.
 *
 * Source of truth: the broker-data repo's data/manifest.json, emitted by
 * scripts/build_brokers.py. Update both fields together when bumping to a new dataset release.
 */
export const PINNED_DATASET = {
  datasetVersion: '0.1.15',
  contentHash: 'sha256:b1030ef99ecb6380a05a876abf7f480e6385766eb8f67a9ebd0310328cadef61',
  // Same-origin static path the app fetches at runtime -- update if the dataset is hosted
  // elsewhere (CDN, GitHub release asset, etc).
  url: '/data/brokers.json',
} as const;
