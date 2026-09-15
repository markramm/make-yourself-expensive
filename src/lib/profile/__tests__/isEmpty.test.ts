/**
 * Guards the predicate behind the "your profile is empty" hint on /brokers. A false positive
 * sends a reader who already filled in their details to the profile page to fix nothing; a
 * false negative leaves 346 greyed-out buttons unexplained, which is the bug the hint exists
 * to fix in the first place.
 */
import { describe, it, expect } from 'vitest';
import { profileIsEmpty } from '../isEmpty';

describe('profileIsEmpty', () => {
  it('is empty when every pastable field is blank', () => {
    expect(profileIsEmpty({ fullName: '', email: '', phone: '', address: '' })).toBe(true);
  });

  it('is empty for a profile object with no fields set at all', () => {
    expect(profileIsEmpty({})).toBe(true);
  });

  it.each(['fullName', 'email', 'phone', 'address'] as const)(
    'is NOT empty when only %s is filled in',
    (field) => {
      expect(profileIsEmpty({ [field]: 'something' })).toBe(false);
    },
  );

  it('still reads as empty when only a date of birth is set', () => {
    // dob is optional and is not one of the four fields the assisted rows paste from, so a
    // dob-only profile genuinely cannot fill any copy button -- the hint should still show.
    expect(profileIsEmpty({ fullName: '', email: '', phone: '', address: '' })).toBe(true);
  });

  it('treats whitespace-only values as present rather than guessing', () => {
    // Deliberate: trimming here would disagree with what the copy buttons do (they check the
    // raw value), and the two must not drift. Documented so a future edit is a decision.
    expect(profileIsEmpty({ fullName: ' ' })).toBe(false);
  });
});
