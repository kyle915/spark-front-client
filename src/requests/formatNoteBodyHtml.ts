const MENTION_HTML =
  '<span style="color: var(--spark-lime); font-weight: 600;">@$1</span>';

/** Escape user text before any HTML interpolation. `&` first so later entities stay intact. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Safe HTML for Internal Tracker notes: escape the body, then wrap @mentions.
 * Mentions are `[\w.-]+` after escape, so `$1` cannot reintroduce tags.
 */
export const formatNoteBodyHtml = (body: string): string =>
  escapeHtml(body).replace(/@([\w.-]+)/g, MENTION_HTML);
