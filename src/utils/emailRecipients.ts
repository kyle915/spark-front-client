/**
 * Shared recipient-list parsing for the Share modals (single recap +
 * bulk). Accepts comma / semicolon / whitespace separated emails and
 * de-dupes case-insensitively, preserving first-seen casing.
 */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function parseRecipients(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const email = token.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}
