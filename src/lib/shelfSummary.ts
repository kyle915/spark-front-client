/**
 * Shaping for the "On shelf" summary: counts from shelf photos on approved
 * retail recaps, turned into shares that each carry their base. Pure
 * functions over plain numbers, unit-tested without a component or a
 * generated Relay file. Nothing here changes a count.
 */

export type ShelfSummaryCounts = {
  /** Approved retail visits with a shelf photo that has an answer. */
  visits: number;
  onShelf: number;
  notFound: number;
  unclear: number;
  priceTagVisible: number;
  /** Approved retail visits whose shelf photos have no answer yet. */
  unreadVisits: number;
};

export type ShelfFigure = {
  key: "onShelf" | "priceTag";
  label: string;
  /** "81%" */
  share: string;
  /** "34 of 42 retail visits with a shelf photo" */
  basis: string;
};

const count = (n: number): string => Math.max(0, Math.round(n)).toLocaleString("en-US");

const visitsWord = (n: number): string => (n === 1 ? "visit" : "visits");

/** A whole-number share of a base, or null when there is no base. */
export function sharePct(part: number, base: number): number | null {
  if (!(base > 0) || part < 0) return null;
  return Math.round((Math.min(part, base) / base) * 100);
}

/** "34 of 42 retail visits with a shelf photo" */
export const shelfBasis = (part: number, visits: number): string =>
  `${count(part)} of ${count(visits)} retail ${visitsWord(visits)} with a shelf photo`;

/** The two headline shares. Empty when there is no base to divide by. */
export function shelfFigures(s: ShelfSummaryCounts): ShelfFigure[] {
  const onShelf = sharePct(s.onShelf, s.visits);
  const priceTag = sharePct(s.priceTagVisible, s.visits);
  if (onShelf === null || priceTag === null) return [];
  return [
    {
      key: "onShelf",
      label: "Product on shelf",
      share: `${onShelf}%`,
      basis: shelfBasis(s.onShelf, s.visits),
    },
    {
      key: "priceTag",
      label: "Price tag visible",
      share: `${priceTag}%`,
      basis: shelfBasis(s.priceTagVisible, s.visits),
    },
  ];
}

/** What the shares leave out, in plain sentences. Empty strings are dropped. */
export function shelfNotes(s: ShelfSummaryCounts): string[] {
  const notes: string[] = [];
  if (s.unclear > 0) {
    notes.push(
      `The photos from ${count(s.unclear)} ${visitsWord(s.unclear)} did not show clearly whether the product was on the shelf.`,
    );
  }
  if (s.unreadVisits > 0) {
    notes.push(
      `Shelf photos from ${count(s.unreadVisits)} more ${visitsWord(s.unreadVisits)} have not been read yet.`,
    );
  }
  return notes;
}

/** "Nov 3" from "2026-11-03"; the input back when it is not a date. */
export function shelfVisitDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Not found at 3 visits" */
export const notFoundHeading = (n: number): string =>
  `Not found at ${count(n)} ${visitsWord(n)}`;
