/**
 * Calendar date of a moment in time, in the viewer's zone.
 *
 * `formatDate` reads the "YYYY-MM-DD" digits straight out of the string.
 * That is right for an event date (a venue calendar day, no zone) and wrong
 * for a timestamp the server stamps in UTC: a recap submitted at 6:05 PM
 * Pacific is "2026-11-15T02:05:00+00:00", and its digits say the 15th.
 *
 * A value that carries a zone ("…Z", "…+00:00") is an instant and is
 * converted. Anything else (a bare date, a zone-less wall-clock string)
 * keeps the date as written, exactly like `formatDate`.
 */
const INSTANT = /T\d{2}:\d{2}.*(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const DATE_PART = /(\d{4})-(\d{2})-(\d{2})/;

export function formatInstantDate(
  value: string | null | undefined,
  options?: { timeZone?: string; locale?: string },
): string {
  if (!value) return "-";
  const text = String(value).trim();
  if (INSTANT.test(text)) {
    const instant = new Date(text);
    if (!isNaN(instant.getTime())) {
      return instant.toLocaleDateString(options?.locale, {
        timeZone: options?.timeZone,
      });
    }
  }
  const match = DATE_PART.exec(text);
  if (match) {
    // Local noon-free construction: the written calendar day, no shifting.
    const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(day.getTime()) ? match[0] : day.toLocaleDateString(options?.locale);
  }
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? text : parsed.toLocaleDateString(options?.locale);
}
