// ─────────────────────────────────────────────────────────────────────────────
// Contact-info guard
// -----------------------------------------------------------------------------
// Detects attempts to share private contact details (phone numbers, emails,
// social handles, messaging-app names, links) inside user-written content —
// chat messages, tickets, plan comments, community posts/comments.
//
// It is deliberately aggressive about obfuscation: people try to dodge filters
// by spacing letters out, swapping "@"/"." for the words "at"/"dot", inserting
// symbols between characters, or using Arabic-Indic digits. We normalise all of
// that before testing, so "j o h n (at) gmail dot com" and "0 1 0-1234 5678"
// are both caught.
// ─────────────────────────────────────────────────────────────────────────────

export const CONTACT_INFO_MESSAGE =
  'For your safety, sharing contact details (phone numbers, emails, social handles or links) is not allowed here. Please remove them and try again.';

/** Convert Arabic-Indic / Eastern-Arabic digits to ASCII 0-9. */
function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

export function containsContactInfo(raw: unknown): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const original = normalizeDigits(raw);
  const text = original.toLowerCase();

  // 1) Plain email (tolerates a little whitespace around @ and the dot).
  if (/[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,}/i.test(original)) return true;

  // 2) Obfuscated email: "name at gmail dot com", "name (at) gmail [dot] com".
  const deobfuscated = text
    .replace(/\s*[\(\[\{]?\s*at\s*[\)\]\}]?\s*/g, '@')
    .replace(/\s*[\(\[\{]?\s*dot\s*[\)\]\}]?\s*/g, '.');
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(deobfuscated)) return true;

  // 3) Phone numbers — strip common separators that people place between
  //    digits, then look for a long run of digits. 8+ digits in a row is well
  //    beyond normal conversational numbers (sets/reps/weights) and is treated
  //    as a phone number. Egyptian mobiles are 11 digits.
  const collapsed = original.replace(/[\s\-.\(\)\+_/\\|·•*#]/g, '');
  if (/\d{8,}/.test(collapsed)) return true;

  // 4) Messaging / social apps named explicitly — a strong signal someone is
  //    trying to move the conversation off-platform.
  if (/\b(whats\s*app|whatsapp|tele\s*gram|telegram|t\.me|insta\s*gram|instagram|snap\s*chat|snapchat|messenger|fb\s*messenger|viber|signal\s+app|wechat|\bimo\b)\b/i.test(text)) return true;

  // 5) Links / URLs.
  if (/(https?:\/\/|www\.)\S+/i.test(original)) return true;

  // 6) Social-style @handle (e.g. "@john_fit"). Require it to look like a
  //    handle (3+ chars, letters/digits/._) to avoid blocking "@everyone".
  if (/(^|[\s(])@[a-z0-9](?:[a-z0-9._]{2,})/i.test(original)) return true;

  return false;
}
