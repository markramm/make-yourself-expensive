// @vitest-environment jsdom
/**
 * The profile page's storage guarantee.
 *
 * This is the one screen where the tool actively asks someone to type in a name, an email and
 * a home address -- on a site whose entire premise is not giving those away. Readers now arrive
 * here from a broker row that teases "fill in your profile once and these letters write
 * themselves", so the reassurance has to be the thing they meet on arrival, and it has to say
 * the strong version: not merely "stored locally", but that no database of users exists at all.
 *
 * These are trust claims, not decoration. A future edit that quietly weakens them -- softening
 * "no database" into "we don't share your data", or dropping the local-only statement -- should
 * fail here rather than ship.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ProfileForm from '../ProfileForm.svelte';

afterEach(cleanup);

/** Rendered prose carries the source's line wrapping; collapse it before matching. */
function prose(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('the storage guarantee is stated, and stated strongly', () => {
  it('says there is no database of user information', () => {
    // The weaker, more common claim is "we don't sell your data", which concedes that a
    // database exists. The point here is that one does not.
    const { container } = render(ProfileForm);
    const text = prose(container.querySelector('.storage-promise'));
    expect(text).toMatch(/no database/i);
  });

  it('says the data stays on this device', () => {
    const { container } = render(ProfileForm);
    expect(prose(container.querySelector('.storage-promise'))).toMatch(/stays on your device/i);
  });

  it('explains WHY nothing is sent: there is no server', () => {
    // "Never sent to a server" is a promise; "there is no server" is a structural fact, and
    // the second is what makes the first checkable.
    const { container } = render(ProfileForm);
    expect(prose(container.querySelector('.storage-promise'))).toMatch(/there is no server/i);
  });

  it('names what a database would be exposed to, rather than waving at "privacy"', () => {
    const { container } = render(ProfileForm);
    const text = prose(container.querySelector('.storage-promise'));
    expect(text).toMatch(/breached/i);
    expect(text).toMatch(/subpoenaed/i);
  });

  it('is the first thing on the page, before the explanation of the fields', () => {
    // It used to sit below a longer "what this is for" paragraph. Someone deciding whether to
    // type their address in should not have to read past the ask to find the reassurance.
    const { container } = render(ProfileForm);
    const promise = container.querySelector('.storage-promise');
    const why = container.querySelector('.why-note');
    expect(promise).not.toBeNull();
    expect(why).not.toBeNull();
    expect(promise!.compareDocumentPosition(why!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is announced to screen readers as the form description', () => {
    const { container } = render(ProfileForm);
    const form = container.querySelector('form');
    expect(form?.getAttribute('aria-describedby')).toBe('profile-privacy-note');
    expect(container.querySelector('#profile-privacy-note')).not.toBeNull();
  });

  it('offers the code for verification rather than asking for trust', () => {
    const { getByRole } = render(ProfileForm);
    const link = getByRole('link', { name: /read the code/i });
    expect(link.getAttribute('href')).toContain('github.com');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('warns that clearing site data erases it, and points at the backup', () => {
    // The flip side of local-only storage, and the one way a reader can lose everything.
    const { container, getByRole } = render(ProfileForm);
    expect(prose(container.querySelector('.storage-promise'))).toMatch(/clearing your site data/i);
    expect(getByRole('link', { name: /save a backup/i }).getAttribute('href')).toBe('/switch-devices');
  });
});

describe('the form still explains what the fields are for', () => {
  it('says filling it in once carries across every letter', () => {
    const { container } = render(ProfileForm);
    expect(prose(container.querySelector('.why-note'))).toMatch(/every letter writes itself/i);
  });

  it('keeps the profile optional, with a route straight to opting out', () => {
    const { container, getByRole } = render(ProfileForm);
    expect(prose(container.querySelector('.why-note'))).toMatch(/optional/i);
    expect(getByRole('link', { name: /skip straight to opting out/i }).getAttribute('href')).toBe(
      '/brokers/guide/',
    );
  });
});
