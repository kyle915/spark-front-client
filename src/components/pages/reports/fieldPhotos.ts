/** Pure helpers for the program report's "From the field" photos. */

export type FieldPhotoView = "best" | "all";

type BestPhoto = {
  caption: string;
  store: string;
  state: string;
  eventDate: string;
};

const shortDay = (iso: string): string => {
  const [y, m, d] = (iso || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Walk-up events are named "11/8/2026 - <address>"; drop the date. */
const cleanStore = (store: string): string =>
  store.trim().replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]\s*/, "");

/**
 * "Sampling table at the store entrance · Costco, CA · Oct 11". The
 * description comes first when there is one; the place and day follow.
 */
export const bestPhotoCaption = (p: BestPhoto): string => {
  const where = [cleanStore(p.store), p.state.trim()].filter(Boolean).join(", ");
  return [p.caption.trim(), where, shortDay(p.eventDate)].filter(Boolean).join(" · ");
};
