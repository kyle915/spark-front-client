/**
 * Standing walk-up sessions live in localStorage keyed only by the code
 * (`spark.checkin.FF-YMMK3Q`) and tenant tokens last 90 days. Reopening the
 * Feel Free link on Wednesday restores Saturday's event. Clock in then
 * punches that leftover day — the Alicia identify date-gate never runs.
 */

/** Civil YYYY-MM-DD from Event.date (noon-UTC ISO). Matches API event_calendar_date. */
export function eventCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

export function isLeftoverCheckinSession(
  eventDate: string | null | undefined,
  today: string,
): boolean {
  const cal = eventCalendarDate(eventDate);
  return Boolean(cal && today && cal !== today);
}
