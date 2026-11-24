/**
 * Shorten free text (BA quotes, call-outs) for a card without cutting a
 * word in half — "…the best atmosphere fo…" read as broken data. Cuts at
 * the last space inside the limit, drops punctuation that would sit oddly
 * before the ellipsis, and hard-cuts only a single over-long "word" (a URL).
 * Mirrors spark-api `utils.text_clip.clip_words`.
 */
export const ELLIPSIS = "…";

export function clipAtWord(text: string | null | undefined, limit: number): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= limit) return value;
  let head = value.slice(0, Math.max(limit - 1, 0));
  const space = head.lastIndexOf(" ");
  if (space >= Math.floor(limit / 2)) head = head.slice(0, space);
  return head.replace(/[\s,;:.\-–—]+$/u, "") + ELLIPSIS;
}

/** True when `clipAtWord(text, limit)` would shorten the text. */
export const isClipped = (text: string | null | undefined, limit: number): boolean =>
  (text ?? "").replace(/\s+/g, " ").trim().length > limit;
