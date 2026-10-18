/** Account Map draws 2,000 pin rows per request. Past that, say so. */
export const ACCOUNT_MAP_PAGE_SIZE = 2000;

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
