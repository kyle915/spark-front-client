export type GalleryPhoto = {
  id: string;
  url: string;
  category: string;
  recapUuid: string;
  store: string;
  state: string;
  eventDate: string;
  /** A best photo: pinned by staff, or picked by Spark and not unpinned. */
  isPick?: boolean;
  /** Short description of the setup, product and setting; "" when none. */
  caption?: string;
};

/** Which photos the gallery lists. Best photos is where it opens. */
export type GalleryView = "best" | "all";

export type GalleryViewState = {
  view: GalleryView;
  /** True once a person has picked a view; before that the gallery may
   *  fall back to all photos when no best photos exist. */
  chosen: boolean;
};

export const INITIAL_GALLERY_VIEW: GalleryViewState = { view: "best", chosen: false };

/**
 * The gallery opens on best photos. When there are none for the filters and
 * nobody asked for that view, show all photos instead of an empty page.
 */
export const fallBackToAll = (state: GalleryViewState, total: number, page: number): boolean =>
  state.view === "best" && !state.chosen && total === 0 && page === 0;

export type DeckLayout = 1 | 4 | 6 | 9;
export const DECK_LAYOUTS: DeckLayout[] = [1, 4, 6, 9];

/** Split the chosen photos into deck pages of `perPage`. */
export const deckPages = <T>(photos: readonly T[], perPage: DeckLayout): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push(photos.slice(i, i + perPage));
  }
  return pages;
};

/** Columns for a deck page: 1 → 1, 4 → 2, 6 → 3, 9 → 3. */
export const deckColumns = (perPage: DeckLayout): number =>
  perPage === 1 ? 1 : perPage === 4 ? 2 : 3;

const fmtDate = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Walk-up events are named "11/8/2026 - <address>"; the date is shown
 *  separately, so drop it from the store label. */
export const storeLabel = (store: string): string =>
  store.trim().replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]\s*/, "");

/** "Costco · Highland, CA · Oct 11, 2026" — only the parts that exist. */
export const photoCaption = (p: GalleryPhoto): string =>
  [storeLabel(p.store), p.state.trim(), fmtDate(p.eventDate)].filter(Boolean).join(" · ");

/** A safe, sortable file name for the zip: date, store, category, index. */
export const photoFileName = (p: GalleryPhoto, index: number): string => {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  const ext = (p.url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ?? "jpg").toLowerCase();
  const parts = [p.eventDate, slug(storeLabel(p.store)), slug(p.category)].filter(Boolean);
  return `${parts.join("_") || "photo"}_${String(index + 1).padStart(3, "0")}.${ext}`;
};

export const DATE_RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;
export type DateRangeKey = (typeof DATE_RANGES)[number]["key"];

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Inclusive start/end for a range key; nulls mean "no bound". */
export const rangeDates = (
  key: DateRangeKey,
  today: Date = new Date(),
): { startDate: string | null; endDate: string | null } => {
  const range = DATE_RANGES.find((r) => r.key === key);
  if (!range || range.days === null) return { startDate: null, endDate: null };
  const start = new Date(today);
  start.setDate(start.getDate() - range.days);
  return { startDate: ymd(start), endDate: ymd(today) };
};
