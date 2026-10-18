/**
 * Recaps list pagination.
 *
 * The API clamps `first` to 50 (RECAPS_LIST_MAX_LIMIT). Growing `first`
 * (50 → 100 → 150) therefore re-fetches the SAME first page and never
 * advances. Page 2+ must keep `first: 50` and pass `after: endCursor`.
 */

export const RECAPS_PAGE_SIZE = 50;

export type RecapsListPageVars = {
  first: number;
  after: string | null;
};

/**
 * Variables for one recaps-list page. `after` is null on page 1 and the
 * previous page's `pageInfo.endCursor` on every later page. `first` is
 * always the server ceiling — never a running total of loaded rows.
 */
export function recapsListPageVariables(
  after: string | null = null,
): RecapsListPageVars {
  return { first: RECAPS_PAGE_SIZE, after };
}

/**
 * DOM window for the recaps grid (MasterTracker `visibleCount` pattern).
 *
 * Infinite scroll can append unbounded 50-row pages to `filtered`; mounting
 * every loaded card janks the tab. We render only the first
 * `RECAPS_DOM_WINDOW_SIZE` filtered rows and grow the window on scroll /
 * "Show more". This caps DOM only — fetch, the review queue, selection and
 * exports all keep reading the full filtered set.
 */
export const RECAPS_DOM_WINDOW_SIZE = 60;

/** Grow the DOM window by one chunk, clamped to the filtered total. */
export function expandDomWindow(current: number, total: number): number {
  if (total <= 0) return RECAPS_DOM_WINDOW_SIZE;
  return Math.min(total, Math.max(current, 0) + RECAPS_DOM_WINDOW_SIZE);
}

/** Window size that includes `index` (e.g. keyboard-focused row), or current. */
export function domWindowForIndex(
  current: number,
  index: number,
  total: number,
): number {
  if (index < 0 || index < current) return current;
  const needed = index + 1;
  const grown =
    Math.ceil(needed / RECAPS_DOM_WINDOW_SIZE) * RECAPS_DOM_WINDOW_SIZE;
  return Math.min(Math.max(total, RECAPS_DOM_WINDOW_SIZE), grown);
}

/** Append page-N rows without duplicating uuids already on screen. */
export function appendUniqueByUuid<T extends { uuid: string }>(
  loaded: T[],
  nextPage: T[],
): T[] {
  if (nextPage.length === 0) return loaded;
  const seen = new Set(loaded.map((row) => row.uuid));
  const extra = nextPage.filter((row) => !seen.has(row.uuid));
  return extra.length === 0 ? loaded : [...loaded, ...extra];
}
