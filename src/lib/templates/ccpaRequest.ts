/**
 * Composes an opt-out/deletion request from the on-device profile, for auto-tier (email)
 * brokers. The user reviews and sends it themselves -- this only builds the message, it
 * never transmits anything.
 *
 * Which law the letter cites depends on the REQUESTER's state of residence (profile.state),
 * not anything about the broker -- a California resident has CCPA rights against any broker
 * holding their data, regardless of where that broker is based. An earlier version of this
 * template selected by broker.legal_basis and defaulted every non-matching broker to a
 * CCPA-citing letter regardless of the user's actual state, which is simply wrong for anyone
 * outside California. STATE_TEMPLATES below covers the states with a verified statute
 * citation; every other state (including ones that do have a privacy law but whose citation
 * wasn't independently corroborated at the time this was written) falls through to the
 * generic template, which asserts the same substantive rights without claiming a specific
 * statutory basis the reader may not actually have. Under-citing is the safe failure mode
 * here; a wrong citation actively undermines the request's legitimacy.
 *
 * mailto: URLs have a practical ~2000-char ceiling across mail clients (older Outlook/webmail
 * redirectors choke well before that). A real letter with a full address and statutory
 * citations routinely exceeds a safe margin, so .eml download is the PRIMARY path here, not a
 * rare fallback -- mailto is only used when the encoded URL is safely short.
 */
import type { Profile } from '../../stores/profile';
import type { Broker } from '../dataset/fetchAndVerify';

const MAILTO_SAFE_LENGTH = 1800;

interface StateLawInfo {
  /** The reader-facing law name, e.g. "California Consumer Privacy Act (CCPA/CPRA)". */
  lawName: string;
  /** The precise statute citation, shown in the letter for the recipient to verify. */
  citation: string;
  /** Statutory response window in days, or null if not independently confirmed. */
  responseDays: number | null;
}

// Verified against multiple independent, corroborating sources as of this writing (see the
// commit message / PR this was added in for the research trail). Only states with a citation
// that checked out across sources are listed -- see the module comment above for why an
// under-cited generic letter is preferable to a guessed one. If you're adding a state here,
// verify its citation independently before adding it, not from a single source.
const STATE_LAW_INFO: Record<string, StateLawInfo> = {
  CA: { lawName: 'California Consumer Privacy Act (CCPA), as amended by the CPRA', citation: 'Cal. Civ. Code § 1798.100 et seq.', responseDays: 45 },
  CO: { lawName: 'Colorado Privacy Act (CPA)', citation: 'Colo. Rev. Stat. § 6-1-1301 et seq.', responseDays: 45 },
  CT: { lawName: 'Connecticut Data Privacy Act (CTDPA)', citation: 'Conn. Gen. Stat. § 42-515 et seq.', responseDays: 45 },
  OR: { lawName: 'Oregon Consumer Privacy Act (OCPA)', citation: 'Or. Rev. Stat. § 646A.570 et seq.', responseDays: 45 },
  TX: { lawName: 'Texas Data Privacy and Security Act (TDPSA)', citation: 'Tex. Bus. & Com. Code § 541.001 et seq.', responseDays: 45 },
  UT: { lawName: 'Utah Consumer Privacy Act (UCPA)', citation: 'Utah Code § 13-61-101 et seq.', responseDays: 45 },
  VA: { lawName: 'Virginia Consumer Data Protection Act (VCDPA)', citation: 'Va. Code § 59.1-575 et seq.', responseDays: 45 },
};

interface RequestTemplate {
  buildSubject: (broker: Broker) => string;
  buildBody: (profile: Profile, broker: Broker, today: string) => string;
}

function stateSpecificTemplate(law: StateLawInfo): RequestTemplate {
  return {
    buildSubject: (broker) => `Data Deletion and Opt-Out Request — ${broker.name}`,
    buildBody: (profile, broker, today) => {
      const lines: string[] = [];
      lines.push(`To Whom It May Concern at ${broker.name},`);
      lines.push('');
      lines.push(`Under the ${law.lawName} (${law.citation}), I am requesting that you:`);
      lines.push('  1. Disclose what personal information you have collected about me.');
      lines.push('  2. Delete the personal information you have collected about me.');
      lines.push('  3. Stop selling or sharing my personal information with any third party.');
      lines.push('');
      lines.push('My identifying information for locating my record:');
      if (profile.fullName) lines.push(`  Full name: ${profile.fullName}`);
      if (profile.email) lines.push(`  Email: ${profile.email}`);
      if (profile.phone) lines.push(`  Phone: ${profile.phone}`);
      if (profile.address) lines.push(`  Address: ${profile.address}`);
      if (profile.city || profile.state || profile.zip) {
        lines.push(`  City/State/ZIP: ${[profile.city, profile.state, profile.zip].filter(Boolean).join(', ')}`);
      }
      lines.push('');
      if (law.responseDays) {
        lines.push(
          `Please confirm in writing once this request has been completed. I understand you have ` +
            `${law.responseDays} days to respond (subject to any extension permitted by law).`,
        );
      } else {
        lines.push('Please confirm in writing once this request has been completed.');
      }
      lines.push('');
      lines.push(`Date: ${today}`);
      lines.push('');
      lines.push('Thank you,');
      if (profile.fullName) lines.push(profile.fullName);
      return lines.join('\n');
    },
  };
}

// Used when the reader's state has no verified citation above (unset state, a state not yet
// covered, or a recognized-but-uncorroborated one). Makes the same substantive ask without
// claiming a specific statutory right the reader may not actually have -- many brokers honor
// opt-out/deletion requests as a matter of policy regardless of a specific citation.
const GENERIC_TEMPLATE: RequestTemplate = {
  buildSubject: (broker) => `Data Deletion and Opt-Out Request — ${broker.name}`,
  buildBody: (profile, broker, today) => {
    const lines: string[] = [];
    lines.push(`To Whom It May Concern at ${broker.name},`);
    lines.push('');
    lines.push('I am requesting that you:');
    lines.push('  1. Disclose what personal information you have collected about me.');
    lines.push('  2. Delete the personal information you have collected about me.');
    lines.push('  3. Stop selling or sharing my personal information with any third party.');
    lines.push('');
    lines.push('My identifying information for locating my record:');
    if (profile.fullName) lines.push(`  Full name: ${profile.fullName}`);
    if (profile.email) lines.push(`  Email: ${profile.email}`);
    if (profile.phone) lines.push(`  Phone: ${profile.phone}`);
    if (profile.address) lines.push(`  Address: ${profile.address}`);
    if (profile.city || profile.state || profile.zip) {
      lines.push(`  City/State/ZIP: ${[profile.city, profile.state, profile.zip].filter(Boolean).join(', ')}`);
    }
    lines.push('');
    lines.push('Please confirm in writing once this request has been completed.');
    lines.push('');
    lines.push(`Date: ${today}`);
    lines.push('');
    lines.push('Thank you,');
    if (profile.fullName) lines.push(profile.fullName);
    return lines.join('\n');
  },
};

function templateFor(profile: Profile): RequestTemplate {
  const law = STATE_LAW_INFO[profile.state];
  return law ? stateSpecificTemplate(law) : GENERIC_TEMPLATE;
}

export interface ComposedRequest {
  subject: string;
  body: string;
  toEmail: string;
}

export function composeRequest(profile: Profile, broker: Broker, today = new Date().toISOString().slice(0, 10)): ComposedRequest {
  if (!broker.opt_out_email || broker.opt_out_email.startsWith('<verify:')) {
    throw new Error(`broker ${broker.id} has no confirmed opt_out_email -- cannot compose an auto-tier request`);
  }
  const template = templateFor(profile);
  return {
    subject: template.buildSubject(broker),
    body: template.buildBody(profile, broker, today),
    toEmail: broker.opt_out_email,
  };
}

function encodeMailto(request: ComposedRequest): string {
  // encodeURIComponent alone (not URLSearchParams, which encodes spaces as '+' -- mail
  // clients mis-render '+' as a literal plus sign in the body rather than a space) plus a
  // CRLF fixup, since mailto: requires %0D%0A per RFC 6068. Normalize any pre-existing \r\n to
  // \n FIRST -- otherwise %0A in the encoded %0D%0A would get a second %0D inserted in front
  // of it, corrupting the line ending.
  const encode = (s: string) => encodeURIComponent(s.replace(/\r\n/g, '\n')).replace(/%0A/g, '%0D%0A');
  return `mailto:${encodeURIComponent(request.toEmail)}?subject=${encode(request.subject)}&body=${encode(request.body)}`;
}

export interface MailtoPlan {
  kind: 'mailto';
  href: string;
}

export interface EmlPlan {
  kind: 'eml';
  filename: string;
  blob: Blob;
}

/**
 * Decides mailto vs. .eml based on the actual encoded URL length, and returns whichever is
 * safe. Never silently truncates a request -- an over-length letter always falls back to a
 * full, untruncated .eml file instead.
 */
export function planDelivery(request: ComposedRequest): MailtoPlan | EmlPlan {
  const href = encodeMailto(request);
  if (href.length <= MAILTO_SAFE_LENGTH) {
    return { kind: 'mailto', href };
  }
  return { kind: 'eml', filename: emlFilename(request), blob: buildEmlBlob(request) };
}

function emlFilename(request: ComposedRequest): string {
  const safe = request.toEmail.replace(/[^a-z0-9.@-]/gi, '_');
  return `ccpa-request-${safe}.eml`;
}

function buildEmlBlob(request: ComposedRequest): Blob {
  // Minimal RFC 5322 message. From is left blank -- we don't know the user's mail identity,
  // and their mail client will fill it in when they open/send the .eml file.
  const crlf = '\r\n';
  const message = [
    `To: ${request.toEmail}`,
    `Subject: ${request.subject}`,
    `Date: ${new Date().toUTCString()}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    request.body,
  ].join(crlf);
  return new Blob([message], { type: 'message/rfc822' });
}
