/**
 * Whether a profile has nothing the assisted-tier rows could paste into a broker's form.
 *
 * Extracted from BrokerList.svelte rather than left inline so it has a direct unit test --
 * the same reasoning as badgeContract.ts. What it gates is a reader-facing claim ("your
 * profile is empty, that's why these buttons are greyed out"), and telling someone their
 * profile is empty when it isn't sends them to a settings page to fix nothing.
 *
 * `dob` is deliberately NOT counted: it is optional (see stores/profile.ts), only 37 brokers
 * require it, and someone who filled in everything else should not be told they have no
 * profile. Conversely a profile with ONLY a dob genuinely can't fill any of the four fields
 * the assisted rows paste from, so it correctly still reads as empty.
 */
import type { Profile } from '../../stores/profile';

/** The fields BrokerRowAssisted actually pastes from -- keep in sync with profileValueFor(). */
export type PastableProfileFields = Pick<Profile, 'fullName' | 'email' | 'phone' | 'address'>;

export function profileIsEmpty(profile: Partial<PastableProfileFields>): boolean {
  return !(profile.fullName || profile.email || profile.phone || profile.address);
}
