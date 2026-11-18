/** Account Map draws 2,000 pin rows per request. Past that, say so. */
export const ACCOUNT_MAP_PAGE_SIZE = 2000;

/** Brand (non-admin) users: the server serves at most 200 rows a request. */
export const BRAND_ACCOUNT_MAP_PAGE_SIZE = 200;

/**
 * Rows to ask for per request. The pin list is offset-paged, so the next
 * offset must step by what the server actually serves: a brand user asking
 * for 2,000 gets 200, and stepping by 2,000 would skip 1,800 rows. (Pins
 * without a location are dropped from a page, so the rows returned cannot
 * be used to tell.)
 */
export function accountMapPageSize(serverClampsPages: boolean): number {
  return serverClampsPages ? BRAND_ACCOUNT_MAP_PAGE_SIZE : ACCOUNT_MAP_PAGE_SIZE;
}

function formatCount(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString("en-US");
}

/**
 * `scanned` is how many source rows this map has asked for.
 * `total` is accountMapPinTotal. Equal means the map is complete.
 */
export function accountMapTruncation(input: {
  total: number | null | undefined;
  scanned: number;
}): { truncated: boolean; label: string | null } {
  const total = input.total;
  if (total == null || !Number.isFinite(total) || total <= input.scanned) {
    return { truncated: false, label: null };
  }
  const shown = Math.min(input.scanned, total);
  return {
    truncated: true,
    label: `Showing ${formatCount(shown)} of ${formatCount(total)}`,
  };
}
