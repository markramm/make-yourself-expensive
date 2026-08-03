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
  /**
   * true = hash matched the pin, false = mismatch, null = couldn't be determined (the fetch
   * itself failed, so there were no bytes to hash). Callers that only check `!verified` would
   * treat a failed fetch the same as a confirmed mismatch, which is the right conservative
   * default -- but the null case should always be paired with checking loadError first, since
   * "verified" is meaningless when nothing was loaded.
   */
  verified: boolean | null;
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
      verified: null,
      loadError: e instanceof Error ? e.message : 'failed to load the broker dataset',
    };
  }
}
