/**
 * Computes the next "batch" of undone brokers to work through, in priority order, sized to
 * a roughly consistent amount of effort rather than a fixed item count. A batch IS a level:
 * finishing one is "leveling up," there's no separate batch/level concept layered on top.
 *
 * Recomputed live from current progress every time -- there's no stored batch identity.
 * "Batch 3" isn't a fixed set of brokers; it's just "the next chunk of undone work," so
 * dataset growth or a user skipping around never desyncs a stale batch number.
 */
import type { Broker } from '../dataset/fetchAndVerify';
import type { ProgressMap } from '../../stores/progress';
import { isDone } from '../../stores/progress';

// Relative effort weights, not literal minutes -- auto (compose+send an email) is the
// cheapest, assisted (open a form, paste fields, submit) is moderate, guided (CAPTCHA,
// multi-step, sometimes a phone call) is heaviest. A weight-4 guided broker costs about as
// much attention as two weight-2 assisted ones or four weight-1 auto ones.
const TIER_WEIGHT: Record<Broker['tier'], number> = {
  auto: 1,
  assisted: 2,
  guided: 4,
};

const PRIORITY_ORDER: Record<Broker['priority'], number> = {
  crucial: 0,
  high: 1,
  standard: 2,
};

const TIER_ORDER: Record<Broker['tier'], number> = {
  auto: 0,
  assisted: 1,
  guided: 2,
};

/**
 * How much removing this broker is worth. Roughly halves per step, so a crucial entry is
 * worth about two high ones and four standard ones.
 */
const PRIORITY_VALUE: Record<Broker['priority'], number> = {
  crucial: 4,
  high: 2,
  standard: 1,
};

/**
 * How likely the reader is to finish this one in a sitting, before accounting for the link.
 * Not a probability -- a relative ease multiplier, the reciprocal-ish of TIER_WEIGHT.
 */
const TIER_EASE: Record<Broker['tier'], number> = {
  auto: 1,
  assisted: 0.6,
  guided: 0.3,
};

/**
 * Link state discounts ease, because a link that fails is a dead end regardless of how easy
 * the form behind it would have been.
 *
 * `broken` is heavily discounted rather than excluded: it is still real work if someone
 * wants it, and a reader who finds a working replacement URL is giving us the single most
 * valuable correction the dataset can receive. It just should not be anyone's first click.
 *
 * `bot-blocked` is discounted only mildly -- it works fine for a human and only defeated our
 * automated checker, so it belongs in the ordinary flow with a CAPTCHA warning, not banished.
 */
const LINK_EASE: Record<string, number> = {
  live: 1,
  unknown: 0.9,
  redirect: 0.8,
  'bot-blocked': 0.7,
  broken: 0.15,
};

/**
 * The ordering score: value of doing it, times the odds of actually getting it done.
 *
 * Strict priority-then-tier ordering put a crucial CAPTCHA-guarded broker with a dead link
 * ahead of a high-priority one-click email, which is the wrong first experience -- early
 * wins are what carry someone into the second sitting. Measured against the real dataset at
 * the time this changed, the first batch a new reader met contained a broken crucial entry
 * at position three.
 *
 * Higher is better. Exported so the ordering can be asserted directly in tests.
 */
export function batchScoreFor(
  broker: Pick<Broker, 'priority' | 'tier'> & Partial<Pick<Broker, 'link_status'>>,
): number {
  const linkEase = broker.link_status ? (LINK_EASE[broker.link_status] ?? 0.9) : 0.9;
  return PRIORITY_VALUE[broker.priority] * TIER_EASE[broker.tier] * linkEase;
}

// Target weight per batch. ~8 lands around "5 auto" or "4 assisted" or "2 guided" or a mix
// -- small enough to be a single sensible sitting, large enough to feel like real progress.
export const DEFAULT_BATCH_WEIGHT = 8;

export function weightFor(broker: Pick<Broker, 'tier'>): number {
  return TIER_WEIGHT[broker.tier];
}

/**
 * Sorts undone brokers into working order by batchScoreFor() -- value times ease -- so that
 * an easy high-priority win can legitimately come before a hard crucial one, and a dead link
 * is never the first thing anyone clicks.
 *
 * Ties fall back to the old lexicographic order (priority, then tier, then name) so the
 * result is fully deterministic: two brokers with an identical score always sort the same
 * way, which keeps the batch a reader resumes identical to the one they left.
 */
export function sortForBatching(brokers: Broker[]): Broker[] {
  return [...brokers].sort((a, b) => {
    const scoreDiff = batchScoreFor(b) - batchScoreFor(a); // higher score first
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return a.name.localeCompare(b.name);
  });
}

export interface Batch {
  /** Brokers in this batch, already in working order. */
  items: Broker[];
  /** Sum of weightFor() across items -- for display ("this batch: ~8 units of effort"). */
  totalWeight: number;
  /** True if there is no more undone work after this batch. */
  isFinalBatch: boolean;
  /** Count of brokers remaining after this batch completes (for "N more to go" framing). */
  remainingAfterBatch: number;
}

/**
 * Picks the next batch: walks undone brokers in priority/tier order, keeps adding until the
 * running weight would exceed targetWeight, then stops. Always includes at least one item
 * (even if a single guided broker's weight alone exceeds the target) so a batch is never
 * empty while undone work remains.
 */
export function nextBatch(
  brokers: Broker[],
  progress: ProgressMap,
  targetWeight: number = DEFAULT_BATCH_WEIGHT,
): Batch | null {
  const undone = sortForBatching(brokers).filter((b) => !isDone(progress, b.id));
  if (undone.length === 0) return null;

  const items: Broker[] = [];
  let totalWeight = 0;

  for (const broker of undone) {
    const w = weightFor(broker);
    if (items.length > 0 && totalWeight + w > targetWeight) break;
    items.push(broker);
    totalWeight += w;
  }

  return {
    items,
    totalWeight,
    isFinalBatch: items.length === undone.length,
    remainingAfterBatch: undone.length - items.length,
  };
}

/**
 * Reconstructs a Batch from a persisted set of broker ids (see stores/currentBatch.ts) --
 * used to resume an in-progress batch across a reload instead of picking a fresh one.
 * remainingAfterBatch/isFinalBatch are recomputed against the CURRENT undone set, since
 * total remaining count should stay accurate even though the batch's own items are frozen.
 */
export function batchFromIds(
  brokers: Broker[],
  ids: string[],
  progress: ProgressMap,
): Batch | null {
  const byId = new Map(brokers.map((b) => [b.id, b]));
  const items = ids.map((id) => byId.get(id)).filter((b): b is Broker => b !== undefined);
  if (items.length === 0) return null;

  const totalWeight = items.reduce((sum, b) => sum + weightFor(b), 0);
  const undoneCount = brokers.filter((b) => !isDone(progress, b.id)).length;
  // undoneCount includes this batch's own not-yet-done items, so subtract only the ones in
  // this batch still undone to get "how many OTHER undone brokers exist beyond this batch."
  const undoneInBatch = items.filter((b) => !isDone(progress, b.id)).length;
  const remainingAfterBatch = undoneCount - undoneInBatch;

  return {
    items,
    totalWeight,
    isFinalBatch: remainingAfterBatch === 0,
    remainingAfterBatch,
  };
}
