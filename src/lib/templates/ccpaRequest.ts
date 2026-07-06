/**
 * Composes a CCPA-style opt-out/deletion request from the on-device profile, for auto-tier
 * (email) brokers. The user reviews and sends it themselves -- this only builds the message,
 * it never transmits anything.
 *
 * mailto: URLs have a practical ~2000-char ceiling across mail clients (older Outlook/webmail
 * redirectors choke well before that). A real CCPA letter with a full address and statutory
 * citations routinely exceeds a safe margin, so .eml download is the PRIMARY path here, not a
 * rare fallback -- mailto is only used when the encoded URL is safely short.
 */
import type { Profile } from '../../stores/profile';
import type { Broker } from '../dataset/fetchAndVerify';

const MAILTO_SAFE_LENGTH = 1800;

interface RequestTemplate {
  buildSubject: (broker: Broker) => string;
  buildBody: (profile: Profile, broker: Broker, today: string) => string;
}

const CCPA_TEMPLATE: RequestTemplate = {
  buildSubject: (broker) => `CCPA Deletion and Opt-Out Request — ${broker.name}`,
  buildBody: (profile, broker, today) => {
    const lines: string[] = [];
    lines.push(`To Whom It May Concern at ${broker.name},`);
    lines.push('');
    lines.push(
      'Under the California Consumer Privacy Act (CCPA), as amended by the California Privacy ' +
        'Rights Act (CPRA), I am requesting that you:',
    );
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
    lines.push(
      'Please confirm in writing once this request has been completed. I understand you have ' +
        '45 days to respond under CCPA/CPRA (extendable by an additional 45 days with notice).',
    );
    lines.push('');
    lines.push(`Date: ${today}`);
    lines.push('');
    lines.push('Thank you,');
    if (profile.fullName) lines.push(profile.fullName);
    return lines.join('\n');
  },
};

const TEMPLATES_BY_LEGAL_BASIS: Record<string, RequestTemplate> = {
  ccpa: CCPA_TEMPLATE,
  cpra: CCPA_TEMPLATE,
};

function templateFor(broker: Broker): RequestTemplate {
  for (const basis of broker.legal_basis) {
    const t = TEMPLATES_BY_LEGAL_BASIS[basis];
    if (t) return t;
  }
  return CCPA_TEMPLATE; // sensible default: CCPA's request pattern generalizes reasonably
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
  const template = templateFor(broker);
  return {
    subject: template.buildSubject(broker),
    body: template.buildBody(profile, broker, today),
    toEmail: broker.opt_out_email,
  };
}

function encodeMailto(request: ComposedRequest): string {
  // encodeURIComponent alone (not URLSearchParams, which encodes spaces as '+' -- mail
  // clients mis-render '+' as a literal plus sign in the body rather than a space) plus a
  // CRLF fixup, since mailto: requires %0D%0A per RFC 6068.
  const encode = (s: string) => encodeURIComponent(s).replace(/%0A/g, '%0D%0A');
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
