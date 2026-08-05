import { describe, it, expect } from 'vitest';
import { composeRequest, planDelivery } from '../ccpaRequest';
import type { Profile } from '../../../stores/profile';
import type { Broker } from '../../dataset/fetchAndVerify';

const shortProfile: Profile = {
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '',
  address: '',
  city: '',
  state: 'CA',
  zip: '',
};

const longProfile: Profile = {
  fullName: 'Jane Alexandra Middlename Doe-Smitherington',
  email: 'jane.alexandra.doesmitherington@example-very-long-domain.com',
  phone: '+1 (555) 123-4567 ext. 8910',
  address: '12345 Extremely Long Boulevard Apartment Number 6789-B',
  city: 'San Francisco',
  state: 'CA',
  zip: '94103-1234',
};

function makeBroker(overrides: Partial<Broker> = {}): Broker {
  return {
    id: 'test-broker',
    name: 'Test Broker',
    domain: 'test-broker.example',
    category: 'people_search',
    people_search: true,
    tier: 'auto',
    priority: 'crucial',
    method: 'email',
    opt_out_url: null,
    opt_out_email: 'privacy@test-broker.example',
    phone: null,
    captcha: false,
    id_required: false,
    phone_required: false,
    charges_fee: false,
    verification: null,
    required_fields: ['email'],
    readd_days: 30,
    legal_basis: ['ccpa'],
    link_status: 'unknown',
    last_verified: null,
    source: 'test',
    instructions_md: '',
    ...overrides,
  };
}

describe('composeRequest', () => {
  it('fills in only the profile fields that are present, omitting blanks', () => {
    const req = composeRequest(shortProfile, makeBroker(), '2026-07-03');
    expect(req.body).toContain('Full name: Jane Doe');
    expect(req.body).toContain('Email: jane@example.com');
    expect(req.body).not.toContain('Phone:');
    expect(req.body).not.toContain('Address:');
    expect(req.toEmail).toBe('privacy@test-broker.example');
  });

  it('throws rather than composing a request with no confirmed opt_out_email', () => {
    expect(() => composeRequest(shortProfile, makeBroker({ opt_out_email: null }))).toThrow();
    expect(() =>
      composeRequest(shortProfile, makeBroker({ opt_out_email: '<verify: find their DPO address>' })),
    ).toThrow();
  });
});

describe('composeRequest: legal-basis selection is keyed on the REQUESTER\'s state, not the broker', () => {
  // Regression coverage for a real bug: the template used to select by broker.legal_basis and
  // fall back to a CCPA-citing letter for every non-matching broker, regardless of the user's
  // actual state -- so a Texas resident's request cited California law. Selection must be
  // keyed on profile.state.

  it('cites CCPA/CPRA for a California resident', () => {
    const req = composeRequest({ ...shortProfile, state: 'CA' }, makeBroker(), '2026-07-03');
    expect(req.body).toContain('California Consumer Privacy Act');
    expect(req.body).toContain('Cal. Civ. Code');
  });

  it('cites the correct state law for each verified state, not California\'s', () => {
    const cases: Array<[string, string]> = [
      ['CO', 'Colorado Privacy Act'],
      ['CT', 'Connecticut Data Privacy Act'],
      ['OR', 'Oregon Consumer Privacy Act'],
      ['TX', 'Texas Data Privacy and Security Act'],
      ['UT', 'Utah Consumer Privacy Act'],
      ['VA', 'Virginia Consumer Data Protection Act'],
    ];
    for (const [code, expectedLawName] of cases) {
      const req = composeRequest({ ...shortProfile, state: code }, makeBroker(), '2026-07-03');
      expect(req.body).toContain(expectedLawName);
      expect(req.body).not.toContain('California Consumer Privacy Act');
    }
  });

  it('falls back to a generic, non-state-specific request for a state with no verified citation', () => {
    const req = composeRequest({ ...shortProfile, state: 'FL' }, makeBroker(), '2026-07-03');
    expect(req.body).not.toContain('California Consumer Privacy Act');
    expect(req.body).not.toContain('Cal. Civ. Code');
    expect(req.body).not.toMatch(/Under the .* Act/); // no "Under the X Act" citation line at all
    expect(req.body).toContain('I am requesting that you:');
    expect(req.body).toContain('Delete the personal information');
  });

  it('falls back to the generic request when state is unset, never defaulting to CCPA', () => {
    const req = composeRequest({ ...shortProfile, state: '' }, makeBroker(), '2026-07-03');
    expect(req.body).not.toContain('California Consumer Privacy Act');
    expect(req.body).toContain('I am requesting that you:');
  });

  it('ignores broker.legal_basis entirely -- selection is state-only', () => {
    // A broker tagged legal_basis: ['ccpa'] must NOT force a CCPA letter for a non-CA resident.
    const req = composeRequest({ ...shortProfile, state: 'NY' }, makeBroker({ legal_basis: ['ccpa'] }), '2026-07-03');
    expect(req.body).not.toContain('California Consumer Privacy Act');
  });
});

describe('planDelivery: mailto vs .eml branching', () => {
  it('uses mailto for a short request', () => {
    const req = composeRequest(shortProfile, makeBroker(), '2026-07-03');
    const plan = planDelivery(req);
    expect(plan.kind).toBe('mailto');
    if (plan.kind === 'mailto') {
      expect(plan.href.startsWith('mailto:')).toBe(true);
      expect(plan.href.length).toBeLessThanOrEqual(1800);
    }
  });

  it('falls back to a full, untruncated .eml for a long request rather than truncating', async () => {
    const req = composeRequest(longProfile, makeBroker(), '2026-07-03');
    const plan = planDelivery(req);
    // Sanity: confirm this test actually exercises the long path, not the short one.
    expect(req.body.length).toBeGreaterThan(200);
    if (plan.kind === 'mailto') {
      // If mailto was still chosen, it must be because it's genuinely under the safe length --
      // never because we silently truncated the body to fit.
      expect(plan.href.length).toBeLessThanOrEqual(1800);
      return;
    }
    expect(plan.kind).toBe('eml');
    if (plan.kind === 'eml') {
      expect(plan.filename).toMatch(/\.eml$/);
      const text = await plan.blob.text();
      expect(text).toContain(req.subject);
      expect(text).toContain(req.body); // full, untruncated body present in the .eml
      expect(text).toContain(`To: ${req.toEmail}`);
    }
  });

  it('forces the .eml path with an artificially long body, and the body is never truncated', async () => {
    const hugeProfile: Profile = {
      ...longProfile,
      address: 'A'.repeat(3000), // guarantees we cross the mailto safe-length threshold
    };
    const req = composeRequest(hugeProfile, makeBroker(), '2026-07-03');
    const plan = planDelivery(req);
    expect(plan.kind).toBe('eml');
    if (plan.kind === 'eml') {
      const text = await plan.blob.text();
      expect(text).toContain('A'.repeat(3000));
    }
  });

  it('never double-encodes a line ending that already arrives as \\r\\n', () => {
    // composeRequest always builds bodies with bare \n, but planDelivery accepts any
    // ComposedRequest -- a body that already contains \r\n (e.g. from a future template, or a
    // pasted value) must not come out as %0D%0D%0A. Regression test for a real bug: the old
    // encoder replaced %0A with %0D%0A unconditionally, so an already-correct %0D%0A picked up
    // an extra %0D.
    const req = { subject: 'Test', body: 'line1\r\nline2', toEmail: 'privacy@test-broker.example' };
    const plan = planDelivery(req);
    expect(plan.kind).toBe('mailto');
    if (plan.kind === 'mailto') {
      expect(plan.href).not.toContain('%0D%0D%0A');
      expect(plan.href).toContain('line1%0D%0Aline2');
    }
  });
});
