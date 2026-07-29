/**
 * Shared dataset-loading logic for any component that needs the verified broker list --
 * factored out of BrokerList.svelte so the guided-batch view doesn't duplicate the fetch/
 * verify/error-handling block.
 */
import { fetchAndVerifyDataset, type Broker, type DatasetMeta } from './fetchAndVerify';
import { PINNED_DATASET } from '../../data/dataset-manifest';

export interface DatasetLoadState {
  brokers: Broker[];
  meta: DatasetMeta | null;
  verified: boolean;
  integrityWarning?: { expectedHash: string; actualHash: string };
  loadError: string | null;
}

export async function loadDataset(): Promise<DatasetLoadState> {
  try {
    const result = await fetchAndVerifyDataset(PINNED_DATASET.url);
    if (!result.verified) {
      console.warn(
        `dataset integrity mismatch: expected ${result.integrityWarning?.expectedHash}, got ${result.integrityWarning?.actualHash}`,
      );
    }
    return {
      brokers: result.brokers,
      meta: result.meta,
      verified: result.verified,
      integrityWarning: result.integrityWarning,
      loadError: null,
    };
  } catch (e) {
    return {
      brokers: [],
      meta: null,
      verified: true,
      loadError: e instanceof Error ? e.message : 'failed to load the broker dataset',
    };
  }
}
