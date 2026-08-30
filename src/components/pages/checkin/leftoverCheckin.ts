/**
 * Standing walk-up sessions live in localStorage keyed only by the code
 * (`spark.checkin.FF-…`, `LD-…`, `TH-…`, `BD-…`, …) and tenant tokens last
 * 90 days. Reopening any standing link on Wednesday can restore Saturday's
 * event. Clock in then punches that leftover day — the Alicia identify
 * date-gate never runs.
 *
 * ``isStaleWalkupSession`` / ``walkupDayKind`` detect that leftover
 * token+date case. Do NOT auto-wipe localStorage on date mismatch: that
 * fights mid-shift recovery. The leftover banner + "Start today's shift"
 * is the BA-facing path; same-day open punches must survive temporary
 * navigation (release QR / PR #577).
 *
 * Second shift (same calendar day, Feel Free market) is a different flow —
 * see ``secondShift.ts``. These must never look alike:
 *   leftover     = prior calendar day still restored
 *   second shift = already finished today's first filing, starting another
 *                  on the same day
 */

/** Banner title when the restored session's event date is not today. */
export const LEFTOVER_BANNER_TITLE = "This isn't today's shift";

/** Primary CTA — outcome-first, not "clear/delete" language. */
export const LEFTOVER_PRIMARY_CTA = "Start today's shift";

export const LEFTOVER_PRIMARY_CTA_RECAP = "Start a new recap";

export const LEFTOVER_PRIMARY_BUSY = "Starting…";

/** Secondary — BA intentionally finishing / viewing the prior day. */
export const LEFTOVER_SECONDARY_CTA = "Stay on that day";

export const LEFTOVER_BANNER_BODY =
  "You're still on that day's check-in. Start today's shift to clock in for today — punches already saved for that day stay on the record.";

export const LEFTOVER_BANNER_BODY_RECAP =
  "This form is for that day, not today. Start a new recap to pick today's date.";

/** Escape hatch when leftover (same action as primary CTA). */
export const LEFTOVER_ESCAPE_LINK = "Need today's check-in? Start today's shift";

/** Same-day wrong-store / start-over (not leftover). */
export const START_OVER_LINK = "Wrong store or date? Start over";

/**
 * Clocked-out escape when the BA needs a different place/day — avoid
 * "Log another shift/event", which reads like a second punch on this day.
 */
export const CHECK_IN_SOMEWHERE_ELSE = "Check in somewhere else";

export const CLEAR_LEFTOVER_ERROR =
  "Couldn't start today's shift. Check your connection and try again.";

/** Civil YYYY-MM-DD from Event.date (noon-UTC ISO). Matches API event_calendar_date. */
export function eventCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

/** How a restored standing session relates to "today". */
export type WalkupDayKind = "leftover_prior_day" | "same_day" | "unknown";

export function walkupDayKind(
  eventDate: string | null | undefined,
  today: string,
): WalkupDayKind {
  const cal = eventCalendarDate(eventDate);
  if (!cal || !today) return "unknown";
  if (cal !== today) return "leftover_prior_day";
  return "same_day";
}

export function isLeftoverCheckinSession(
  eventDate: string | null | undefined,
  today: string,
): boolean {
  return walkupDayKind(eventDate, today) === "leftover_prior_day";
}

/** True when a restored session token exists but the event date is not today. */
export function isStaleWalkupSession(
  hasSessionToken: boolean,
  mode: string | null | undefined,
  eventDate: string | null | undefined,
  today: string,
): boolean {
  return (
    Boolean(hasSessionToken) &&
    mode === "tenant" &&
    isLeftoverCheckinSession(eventDate, today)
  );
}
