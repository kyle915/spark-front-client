export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into literal and case-insensitive matched segments for `query`.
 * Safe for arbitrary punctuation/metacharacters; returns a single non-matching
 * segment when `query` is blank or has no contiguous match.
 */
export function splitHighlightSegments(
  text: string,
  query: string,
): HighlightSegment[] {
  const needle = query.trim();
  if (!text || !needle) {
    return [{ text, match: false }];
  }
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerNeedle, cursor);
    if (idx === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), match: false });
    }
    segments.push({
      text: text.slice(idx, idx + needle.length),
      match: true,
    });
    cursor = idx + needle.length;
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
}

/**
 * Resolves a copyable absolute URL for the active Command Palette item (`⌘C`),
 * supporting both routed entries (`/recaps/list`) and link-copy action hints.
 */
export function resolveCommandCopyUrl(
  entry: { to: string; hint?: string } | null | undefined,
  origin: string,
): string | null {
  if (!entry) return null;
  const base = origin.replace(/\/+$/, "");
  if (entry.to && entry.to.startsWith("/")) {
    return `${base}${entry.to}`;
  }
  const hint = entry.hint ?? "";
  const urlMatch = hint.match(/https?:\/\/\S+/);
  return urlMatch ? urlMatch[0] : null;
}
