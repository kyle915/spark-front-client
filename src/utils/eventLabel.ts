/**
 * Event names and dates as people read them.
 *
 * Walk-in events are titled "11/23/2026 - 42nd St & 8th Ave, New York, NY
 * 10036 · Event Activation", and some carry a trailing "· 2026-11-23" (or a
 * clipped "· 2026-11"). Cards and tables that ALSO print the event date
 * showed the same day two to four times. These helpers strip the embedded
 * dates from the name and print the date once, in one format.
 */

// "11/23/2026 - ", "11/23 - ", "11-23-2026 — " at the start of a name.
const LEADING_DATE_RE = /^\s*\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\s*[-–—:]\s*/;
// "· 2026-11-23", "· 2026-11", "· 11/23/2026" as a trailing or middle segment.
const DATE_SEGMENT_RE = /^(?:\d{4}-\d{2}(?:-\d{2})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/;

export function cleanEventName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  const withoutLead = raw.replace(LEADING_DATE_RE, "");
  const parts = withoutLead
    .split(" · ")
    .map((p) => p.trim())
    .filter((p) => p && !DATE_SEGMENT_RE.test(p));
  return parts.join(" · ") || raw;
}

/** "2026-11-23" (or an ISO datetime) → "Nov 23, 2026", in the reader's calendar. */
export function formatEventDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return iso ?? "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Join label parts, dropping blanks and any part already contained in an
 * earlier one ("42nd St, New York, NY 10036" then "42nd St, New York, NY").
 */
export function joinDistinct(parts: readonly (string | null | undefined)[], sep = " · "): string {
  const kept: string[] = [];
  for (const raw of parts) {
    const p = (raw ?? "").trim();
    if (!p) continue;
    const low = p.toLowerCase();
    if (kept.some((k) => k.toLowerCase().includes(low) || low.includes(k.toLowerCase()))) continue;
    kept.push(p);
  }
  return kept.join(sep);
}

export type TimelineKind = "upcoming" | "today" | "past";

/** Where a dashboard Timeline row sits, from the server's status
 *  (Upcoming / Today / Recapped / Recap pending). */
export function timelineKind(status: string | null | undefined): TimelineKind {
  const s = (status ?? "").toLowerCase();
  if (s === "today") return "today";
  if (s === "upcoming" || s === "scheduled") return "upcoming";
  return "past";
}

/** "2026-11-23" → "Mon, Nov 23" in the reader's calendar (no UTC day shift). */
export function formatTimelineDay(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return iso ?? "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
