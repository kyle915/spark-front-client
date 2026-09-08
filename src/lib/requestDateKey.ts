/**
 * Calendar day key (YYYY-MM-DD) from a Request.date GraphQL value.
 *
 * The API serializes Request.date as a naive ISO datetime
 * ("2026-09-10T14:00:00"). Callers that do `raw.split("-").map(Number)`
 * treat the day token as "10T14:00:00" → NaN and drop the row — which
 * zeroed Client Today's 7-day forward strip. Always take the date prefix.
 */
export function requestDateKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ymd = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return ymd;
}
