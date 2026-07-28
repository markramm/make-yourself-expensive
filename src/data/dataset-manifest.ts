/**
 * The dataset content hash and version THIS BUILD was tested against and ships expecting.
 * Committed to git so the pin itself is auditable history -- bumping it is a deliberate,
 * reviewable PR against the broker-data repo's release, not an automatic pull.
 *
 * Source of truth: the broker-data repo's data/manifest.json, emitted by
 * scripts/build_brokers.py. Update both fields together when bumping to a new dataset release.
 */
export const PINNED_DATASET = {
  datasetVersion: '0.1.7',
  contentHash: 'sha256:97bc26d198c2484d7d6c9d543a1820302deb16c7ae50e15a34f473cf9c05273d',
  // Same-origin static path the app fetches at runtime -- update if the dataset is hosted
  // elsewhere (CDN, GitHub release asset, etc).
  url: '/data/brokers.json',
} as const;
