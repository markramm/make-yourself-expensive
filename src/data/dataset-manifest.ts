/**
 * The dataset content hash and version THIS BUILD was tested against and ships expecting.
 * Committed to git so the pin itself is auditable history -- bumping it is a deliberate,
 * reviewable PR against the broker-data repo's release, not an automatic pull.
 *
 * Source of truth: the broker-data repo's data/manifest.json, emitted by
 * scripts/build_brokers.py. Update both fields together when bumping to a new dataset release.
 */
export const PINNED_DATASET = {
  datasetVersion: '0.1.16',
  contentHash: 'sha256:79953a83ff5ad7e269ff55772f59c230199a8f96ff940b2856d782c5e41ab39c',
  // Same-origin static path the app fetches at runtime -- update if the dataset is hosted
  // elsewhere (CDN, GitHub release asset, etc).
  url: '/data/brokers.json',
} as const;
