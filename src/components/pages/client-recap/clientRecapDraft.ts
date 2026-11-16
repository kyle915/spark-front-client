/** Pure helpers for the client recap draft screen. */

export const MAX_DRAFT_PHOTOS = 13;
export const MAX_TAKEAWAYS = 8;

export type DraftPhoto = {
  id: string;
  url: string;
  category: string;
  caption: string;
  store: string;
  state: string;
  eventDate: string;
  isPick: boolean;
};

export type DraftText = {
  title: string;
  summary: string;
  takeaways: string[];
  photoIds: string[];
};

const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const isYmd = (raw: string | null | undefined): raw is string =>
  typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw);

/**
 * Dates the form opens with: the ones passed in the link when both are
 * valid, otherwise the last 30 days.
 */
export const initialRange = (
  start: string | null | undefined,
  end: string | null | undefined,
  today: Date = new Date(),
): { start: string; end: string } => {
  if (isYmd(start) && isYmd(end) && start <= end) return { start, end };
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  return { start: ymd(from), end: ymd(today) };
};

/** Why the form can't be sent yet, or "" when it can. */
export const rangeProblem = (start: string, end: string): string => {
  if (!isYmd(start) || !isYmd(end)) return "Pick a start and an end date.";
  if (end < start) return "The end date is before the start date.";
  return "";
};

/** Takeaways as they will be saved: trimmed, blanks dropped, capped. */
export const cleanTakeaways = (lines: readonly string[]): string[] =>
  lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_TAKEAWAYS);

/** True when what is on screen differs from what was last saved. */
export const isDirty = (saved: DraftText, current: DraftText): boolean =>
  saved.title.trim() !== current.title.trim() ||
  saved.summary.trim() !== current.summary.trim() ||
  cleanTakeaways(saved.takeaways).join("\n") !== cleanTakeaways(current.takeaways).join("\n") ||
  saved.photoIds.join(",") !== current.photoIds.join(",");

/** Move one item one place earlier (-1) or later (+1). The first photo is
 *  the cover. Out-of-range moves return the list unchanged. */
export const moveItem = <T>(items: readonly T[], index: number, by: -1 | 1): T[] => {
  const target = index + by;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** Add a photo unless it is already there or the deck is full. */
export const addPhoto = <T extends { id: string }>(items: readonly T[], photo: T): T[] =>
  items.some((p) => p.id === photo.id) || items.length >= MAX_DRAFT_PHOTOS
    ? [...items]
    : [...items, photo];

/** What to say about where the words came from. */
export const textSourceNote = (source: string): string => {
  if (source === "fallback") {
    return "The summary and takeaways were built from the numbers, because the writing service was not available. Edit them as you like.";
  }
  if (source === "summary") {
    return "The summary is the weekly or monthly client summary already written for these dates. Takeaways were built from the numbers.";
  }
  if (source === "edited") return "Edited by staff.";
  return "A first draft. Check it against the numbers before it goes to a client.";
};

/** "Costco, CA · Oct 11" for a photo, from the parts that exist. */
export const photoPlace = (p: Pick<DraftPhoto, "store" | "state" | "eventDate">): string => {
  const where = [p.store.trim(), p.state.trim()].filter(Boolean).join(", ");
  const [y, m, d] = (p.eventDate || "").slice(0, 10).split("-").map(Number);
  const day =
    y && m && d
      ? new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
  return [where, day].filter(Boolean).join(" · ");
};

/** Decode a base64 PDF into bytes for download. */
export const base64ToBytes = (base64: string): Uint8Array => {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
};
