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
