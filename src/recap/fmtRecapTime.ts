/**
 * Time-of-day label for an event start/end on the recap page.
 *
 * Event times arrive either as a bare "HH:MM[:SS]" or as a zone-less venue
 * wall-clock ISO string ("2026-05-30T14:00:00"). Read the time-of-day from
 * either — a plain split(":") took the date as the hour and rendered every
 * event as "10 PM – 10 PM". The value is venue wall-clock, so it is never
 * passed through Date (which would shift it into the viewer's zone).
 */
export const fmtRecapTime = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const match = /(?:T|\s|^)(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return "";
  const hh = parseInt(match[1], 10);
  const m = match[2];
  if (hh > 23) return "";
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return m !== "00" ? `${h12}:${m} ${ampm}` : `${h12} ${ampm}`;
};
